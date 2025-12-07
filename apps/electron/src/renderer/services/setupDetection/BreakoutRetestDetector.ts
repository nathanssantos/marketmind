import { findHighestSwingHigh, findLowestSwingLow, findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline, BreakoutRetestConfig } from '@marketmind/types';
import { createDefaultBreakoutRetestConfig } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { BaseSetupDetector, type SetupDetectorResult } from './BaseSetupDetector';

// Re-export for consumers
export type { BreakoutRetestConfig };
export { createDefaultBreakoutRetestConfig };

// Internal calculation constants
const VOLUME_LOOKBACK = 20;
const MIN_BREAKOUT_DISTANCE_PERCENT = 0.002;
const MIN_RETEST_TOUCHES = 2;
const MIN_CONTINUATION_STRENGTH = 0.4;
const CONTINUATION_PERCENT_MULTIPLIER = 0.01;
const BREAKOUT_STRENGTH_SCALE = 100;
const STOP_LOSS_BUFFER_PERCENT = 0.003;
const DEFAULT_RR_MULTIPLIER = 2.5;
const BASE_CONFIDENCE = 65;
const MIN_CONFIDENCE_THRESHOLD = 70;
const BREAKOUT_STRENGTH_WEIGHT = 12;
const RETEST_QUALITY_WEIGHT = 15;
const VOLUME_CONFIDENCE_BONUS = 10;
const EMA_CONFIRMATION_BONUS = 8;
const MAX_CONFIDENCE = 95;
const PIVOT_LOOKBACK = 10;
const RETEST_TOLERANCE_PERCENT = 0.005;

export class BreakoutRetestDetector extends BaseSetupDetector {
  private breakoutRetestConfig: BreakoutRetestConfig;

  constructor(config: BreakoutRetestConfig) {
    super(config);
    this.breakoutRetestConfig = config;
  }

  updateConfig(config: BreakoutRetestConfig): void {
    this.config = config;
    this.breakoutRetestConfig = config;
  }

  getConfig(): BreakoutRetestConfig {
    return this.breakoutRetestConfig;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.breakoutRetestConfig.lookbackPeriod + this.breakoutRetestConfig.emaPeriod,
      PIVOT_LOOKBACK + VOLUME_LOOKBACK,
    );
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const bullishSetup = this.detectBullishBreakoutRetest(klines, currentIndex);
    if (bullishSetup) return bullishSetup;

    const bearishSetup = this.detectBearishBreakoutRetest(klines, currentIndex);
    if (bearishSetup) return bearishSetup;

    return { setup: null, confidence: 0 };
  }

  private detectBullishBreakoutRetest(
    klines: Kline[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const pivots = findPivotPoints(
      klines.slice(0, currentIndex + 1),
      PIVOT_LOOKBACK,
    );

    const resistanceLevels = this.findResistanceLevels(pivots, klines, currentIndex);
    if (resistanceLevels.length === 0) return null;

    for (const resistance of resistanceLevels) {
      const breakoutKline = this.findBreakoutKline(klines, resistance, currentIndex, 'bullish');
      if (!breakoutKline) continue;

      const retestQuality = this.validateRetest(
        klines,
        resistance,
        breakoutKline.index,
        currentIndex,
        'bullish',
      );

      if (!retestQuality) continue;

      const current = klines[currentIndex];
      if (!current) continue;

      const continuationConfirmed = getKlineClose(current) > resistance * (1 + MIN_CONTINUATION_STRENGTH * CONTINUATION_PERCENT_MULTIPLIER);
      if (!continuationConfirmed) continue;

      return this.createBullishSetup(
        klines,
        currentIndex,
        resistance,
        breakoutKline,
        retestQuality,
      );
    }

    return null;
  }

  private detectBearishBreakoutRetest(
    klines: Kline[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const pivots = findPivotPoints(
      klines.slice(0, currentIndex + 1),
      PIVOT_LOOKBACK,
    );

    const supportLevels = this.findSupportLevels(pivots, klines, currentIndex);
    if (supportLevels.length === 0) return null;

    for (const support of supportLevels) {
      const breakoutKline = this.findBreakoutKline(klines, support, currentIndex, 'bearish');
      if (!breakoutKline) continue;

      const retestQuality = this.validateRetest(
        klines,
        support,
        breakoutKline.index,
        currentIndex,
        'bearish',
      );

      if (!retestQuality) continue;

      const current = klines[currentIndex];
      if (!current) continue;

      const continuationConfirmed = getKlineClose(current) < support * (1 - MIN_CONTINUATION_STRENGTH * CONTINUATION_PERCENT_MULTIPLIER);
      if (!continuationConfirmed) continue;

      return this.createBearishSetup(
        klines,
        currentIndex,
        support,
        breakoutKline,
        retestQuality,
      );
    }

    return null;
  }

  private findResistanceLevels(
    pivots: ReturnType<typeof findPivotPoints>,
    _klines: Kline[],
    currentIndex: number,
  ): number[] {
    const lookbackStart = Math.max(0, currentIndex - this.breakoutRetestConfig.lookbackPeriod);
    const highPivots = pivots
      .filter((p) => p.type === 'high')
      .filter((p) => p.index >= lookbackStart && p.index < currentIndex - PIVOT_LOOKBACK);

    return highPivots.map((p) => p.price).filter((price, index, arr) => arr.indexOf(price) === index);
  }

  private findSupportLevels(
    pivots: ReturnType<typeof findPivotPoints>,
    _klines: Kline[],
    currentIndex: number,
  ): number[] {
    const lookbackStart = Math.max(0, currentIndex - this.breakoutRetestConfig.lookbackPeriod);
    const lowPivots = pivots
      .filter((p) => p.type === 'low')
      .filter((p) => p.index >= lookbackStart && p.index < currentIndex - PIVOT_LOOKBACK);

    return lowPivots.map((p) => p.price).filter((price, index, arr) => arr.indexOf(price) === index);
  }

  private findBreakoutKline(
    klines: Kline[],
    level: number,
    currentIndex: number,
    direction: 'bullish' | 'bearish',
  ): { index: number; volume: number } | null {
    const lookbackStart = Math.max(0, currentIndex - this.breakoutRetestConfig.lookbackPeriod);

    for (let i = lookbackStart; i < currentIndex; i++) {
      const kline = klines[i];
      if (!kline) continue;

      const isBullishBreakout = direction === 'bullish' && getKlineClose(kline) > level;
      const isBearishBreakout = direction === 'bearish' && getKlineClose(kline) < level;

      if (isBullishBreakout || isBearishBreakout) {
        const breakoutDistance = Math.abs(getKlineClose(kline) - level) / level;
        if (breakoutDistance >= MIN_BREAKOUT_DISTANCE_PERCENT) {
          return { index: i, volume: getKlineVolume(kline) };
        }
      }
    }

    return null;
  }

  private validateRetest(
    klines: Kline[],
    level: number,
    breakoutIndex: number,
    currentIndex: number,
    direction: 'bullish' | 'bearish',
  ): { touches: number; quality: number } | null {
    let retestTouches = 0;
    let totalRetestQuality = 0;

    for (let i = breakoutIndex + 1; i <= currentIndex; i++) {
      const kline = klines[i];
      if (!kline) continue;

      const tolerance = level * RETEST_TOLERANCE_PERCENT;
      const isRetestTouch =
        direction === 'bullish'
          ? getKlineLow(kline) <= level + tolerance && getKlineLow(kline) >= level - tolerance
          : getKlineHigh(kline) >= level - tolerance && getKlineHigh(kline) <= level + tolerance;

      if (isRetestTouch) {
        retestTouches++;
        const holdQuality =
          direction === 'bullish'
            ? (getKlineClose(kline) - getKlineLow(kline)) / (getKlineHigh(kline) - getKlineLow(kline))
            : (getKlineHigh(kline) - getKlineClose(kline)) / (getKlineHigh(kline) - getKlineLow(kline));
        totalRetestQuality += holdQuality;
      }
    }

    if (retestTouches < MIN_RETEST_TOUCHES) return null;

    const avgQuality = totalRetestQuality / retestTouches;
    return { touches: retestTouches, quality: avgQuality };
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    resistance: number,
    breakout: { index: number; volume: number },
    retestQuality: { touches: number; quality: number },
  ): SetupDetectorResult | null {
    const current = klines[currentIndex];
    if (!current) return null;

    const volumeData = klines.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) / volumeData.length;
    const volumeConfirmation =
      getKlineVolume(current) > avgVolume * this.breakoutRetestConfig.volumeMultiplier;

    const ema = calculateEMA(klines, this.breakoutRetestConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) return null;

    const aboveEMA = getKlineClose(current) > emaCurrent;
    const entry = getKlineClose(current);
    
    let stopLoss = resistance * (1 - STOP_LOSS_BUFFER_PERCENT);
    const swingLow = findLowestSwingLow(klines, currentIndex, this.breakoutRetestConfig.lookbackPeriod, 3);
    if (swingLow && swingLow > stopLoss && swingLow < entry) {
      stopLoss = swingLow * 0.997;
    }
    
    const targetDistance = (entry - stopLoss) * DEFAULT_RR_MULTIPLIER;
    const takeProfit = entry + targetDistance;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) return null;

    const breakoutStrength = (getKlineClose(current) - resistance) / resistance;
    const confidence = this.calculateConfidence(
      breakoutStrength,
      retestQuality,
      volumeConfirmation,
      aboveEMA,
    );

    if (!this.meetsMinimumCriteria(confidence, rr)) return null;

    const setup = this.createSetup(
      'breakout-retest',
      'LONG',
      klines,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      1,
      {
        resistanceLevel: resistance,
        breakoutIndex: breakout.index,
        retestTouches: retestQuality.touches,
        retestQuality: retestQuality.quality,
        breakoutStrength,
        ema20: emaCurrent,
      },
    );

    return { setup, confidence };
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    support: number,
    breakout: { index: number; volume: number },
    retestQuality: { touches: number; quality: number },
  ): SetupDetectorResult | null {
    const current = klines[currentIndex];
    if (!current) return null;

    const volumeData = klines.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) / volumeData.length;
    const volumeConfirmation =
      getKlineVolume(current) > avgVolume * this.breakoutRetestConfig.volumeMultiplier;

    const ema = calculateEMA(klines, this.breakoutRetestConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) return null;

    const belowEMA = getKlineClose(current) < emaCurrent;
    const entry = getKlineClose(current);
    
    let stopLoss = support * (1 + STOP_LOSS_BUFFER_PERCENT);
    const swingHigh = findHighestSwingHigh(klines, currentIndex, this.breakoutRetestConfig.lookbackPeriod, 3);
    if (swingHigh && swingHigh < stopLoss && swingHigh > entry) {
      stopLoss = swingHigh * 1.003;
    }
    
    const targetDistance = (stopLoss - entry) * DEFAULT_RR_MULTIPLIER;
    const takeProfit = entry - targetDistance;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) return null;

    const breakoutStrength = (support - getKlineClose(current)) / support;
    const confidence = this.calculateConfidence(
      breakoutStrength,
      retestQuality,
      volumeConfirmation,
      belowEMA,
    );

    if (!this.meetsMinimumCriteria(confidence, rr)) return null;

    const setup = this.createSetup(
      'breakout-retest',
      'SHORT',
      klines,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      1,
      {
        supportLevel: support,
        breakoutIndex: breakout.index,
        retestTouches: retestQuality.touches,
        retestQuality: retestQuality.quality,
        breakoutStrength,
        ema20: emaCurrent,
      },
    );

    return { setup, confidence };
  }

  private calculateConfidence(
    breakoutStrength: number,
    retestQuality: { touches: number; quality: number },
    volumeConfirmation: boolean,
    emaAlignment: boolean,
  ): number {
    const baseConfidence = BASE_CONFIDENCE;
    const breakoutBonus = Math.min(breakoutStrength * BREAKOUT_STRENGTH_SCALE, 1) * BREAKOUT_STRENGTH_WEIGHT;
    const retestBonus = retestQuality.quality * RETEST_QUALITY_WEIGHT;
    const volumeBonus = volumeConfirmation ? VOLUME_CONFIDENCE_BONUS : 0;
    const emaBonus = emaAlignment ? EMA_CONFIRMATION_BONUS : 0;

    const totalConfidence = baseConfidence + breakoutBonus + retestBonus + volumeBonus + emaBonus;

    return Math.min(MAX_CONFIDENCE, Math.max(BASE_CONFIDENCE, totalConfidence));
  }
}
