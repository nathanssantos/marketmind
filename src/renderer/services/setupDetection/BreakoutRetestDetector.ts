import { calculateEMA } from '@renderer/utils/movingAverages';
import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle } from '@shared/types';
import { BaseSetupDetector, type SetupDetectorResult } from './BaseSetupDetector';

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

export interface BreakoutRetestConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
  retestTolerance: number;
}

export const createDefaultBreakoutRetestConfig = (): BreakoutRetestConfig => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.5,
  volumeMultiplier: 1.4,
  lookbackPeriod: 30,
  emaPeriod: 20,
  retestTolerance: 0.005,
});

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

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.breakoutRetestConfig.lookbackPeriod + this.breakoutRetestConfig.emaPeriod,
      PIVOT_LOOKBACK + VOLUME_LOOKBACK,
    );
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const bullishSetup = this.detectBullishBreakoutRetest(candles, currentIndex);
    if (bullishSetup) return bullishSetup;

    const bearishSetup = this.detectBearishBreakoutRetest(candles, currentIndex);
    if (bearishSetup) return bearishSetup;

    return { setup: null, confidence: 0 };
  }

  private detectBullishBreakoutRetest(
    candles: Candle[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const pivots = findPivotPoints(
      candles.slice(0, currentIndex + 1),
      PIVOT_LOOKBACK,
    );

    const resistanceLevels = this.findResistanceLevels(pivots, candles, currentIndex);
    if (resistanceLevels.length === 0) return null;

    for (const resistance of resistanceLevels) {
      const breakoutCandle = this.findBreakoutCandle(candles, resistance, currentIndex, 'bullish');
      if (!breakoutCandle) continue;

      const retestQuality = this.validateRetest(
        candles,
        resistance,
        breakoutCandle.index,
        currentIndex,
        'bullish',
      );

      if (!retestQuality) continue;

      const current = candles[currentIndex];
      if (!current) continue;

      const continuationConfirmed = current.close > resistance * (1 + MIN_CONTINUATION_STRENGTH * CONTINUATION_PERCENT_MULTIPLIER);
      if (!continuationConfirmed) continue;

      return this.createBullishSetup(
        candles,
        currentIndex,
        resistance,
        breakoutCandle,
        retestQuality,
      );
    }

    return null;
  }

  private detectBearishBreakoutRetest(
    candles: Candle[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const pivots = findPivotPoints(
      candles.slice(0, currentIndex + 1),
      PIVOT_LOOKBACK,
    );

    const supportLevels = this.findSupportLevels(pivots, candles, currentIndex);
    if (supportLevels.length === 0) return null;

    for (const support of supportLevels) {
      const breakoutCandle = this.findBreakoutCandle(candles, support, currentIndex, 'bearish');
      if (!breakoutCandle) continue;

      const retestQuality = this.validateRetest(
        candles,
        support,
        breakoutCandle.index,
        currentIndex,
        'bearish',
      );

      if (!retestQuality) continue;

      const current = candles[currentIndex];
      if (!current) continue;

      const continuationConfirmed = current.close < support * (1 - MIN_CONTINUATION_STRENGTH * CONTINUATION_PERCENT_MULTIPLIER);
      if (!continuationConfirmed) continue;

      return this.createBearishSetup(
        candles,
        currentIndex,
        support,
        breakoutCandle,
        retestQuality,
      );
    }

    return null;
  }

  private findResistanceLevels(
    pivots: ReturnType<typeof findPivotPoints>,
    _candles: Candle[],
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
    _candles: Candle[],
    currentIndex: number,
  ): number[] {
    const lookbackStart = Math.max(0, currentIndex - this.breakoutRetestConfig.lookbackPeriod);
    const lowPivots = pivots
      .filter((p) => p.type === 'low')
      .filter((p) => p.index >= lookbackStart && p.index < currentIndex - PIVOT_LOOKBACK);

    return lowPivots.map((p) => p.price).filter((price, index, arr) => arr.indexOf(price) === index);
  }

  private findBreakoutCandle(
    candles: Candle[],
    level: number,
    currentIndex: number,
    direction: 'bullish' | 'bearish',
  ): { index: number; volume: number } | null {
    const lookbackStart = Math.max(0, currentIndex - this.breakoutRetestConfig.lookbackPeriod);

    for (let i = lookbackStart; i < currentIndex; i++) {
      const candle = candles[i];
      if (!candle) continue;

      const isBullishBreakout = direction === 'bullish' && candle.close > level;
      const isBearishBreakout = direction === 'bearish' && candle.close < level;

      if (isBullishBreakout || isBearishBreakout) {
        const breakoutDistance = Math.abs(candle.close - level) / level;
        if (breakoutDistance >= MIN_BREAKOUT_DISTANCE_PERCENT) {
          return { index: i, volume: candle.volume };
        }
      }
    }

    return null;
  }

  private validateRetest(
    candles: Candle[],
    level: number,
    breakoutIndex: number,
    currentIndex: number,
    direction: 'bullish' | 'bearish',
  ): { touches: number; quality: number } | null {
    let retestTouches = 0;
    let totalRetestQuality = 0;

    for (let i = breakoutIndex + 1; i <= currentIndex; i++) {
      const candle = candles[i];
      if (!candle) continue;

      const tolerance = level * RETEST_TOLERANCE_PERCENT;
      const isRetestTouch =
        direction === 'bullish'
          ? candle.low <= level + tolerance && candle.low >= level - tolerance
          : candle.high >= level - tolerance && candle.high <= level + tolerance;

      if (isRetestTouch) {
        retestTouches++;
        const holdQuality =
          direction === 'bullish'
            ? (candle.close - candle.low) / (candle.high - candle.low)
            : (candle.high - candle.close) / (candle.high - candle.low);
        totalRetestQuality += holdQuality;
      }
    }

    if (retestTouches < MIN_RETEST_TOUCHES) return null;

    const avgQuality = totalRetestQuality / retestTouches;
    return { touches: retestTouches, quality: avgQuality };
  }

  private createBullishSetup(
    candles: Candle[],
    currentIndex: number,
    resistance: number,
    breakout: { index: number; volume: number },
    retestQuality: { touches: number; quality: number },
  ): SetupDetectorResult | null {
    const current = candles[currentIndex];
    if (!current) return null;

    const volumeData = candles.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + c.volume, 0) / volumeData.length;
    const volumeConfirmation =
      current.volume > avgVolume * this.breakoutRetestConfig.volumeMultiplier;

    const ema = calculateEMA(candles, this.breakoutRetestConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) return null;

    const aboveEMA = current.close > emaCurrent;
    const entry = current.close;
    const stopLoss = resistance * (1 - STOP_LOSS_BUFFER_PERCENT);
    const targetDistance = (entry - stopLoss) * DEFAULT_RR_MULTIPLIER;
    const takeProfit = entry + targetDistance;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) return null;

    const breakoutStrength = (current.close - resistance) / resistance;
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
      candles,
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
    candles: Candle[],
    currentIndex: number,
    support: number,
    breakout: { index: number; volume: number },
    retestQuality: { touches: number; quality: number },
  ): SetupDetectorResult | null {
    const current = candles[currentIndex];
    if (!current) return null;

    const volumeData = candles.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + c.volume, 0) / volumeData.length;
    const volumeConfirmation =
      current.volume > avgVolume * this.breakoutRetestConfig.volumeMultiplier;

    const ema = calculateEMA(candles, this.breakoutRetestConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) return null;

    const belowEMA = current.close < emaCurrent;
    const entry = current.close;
    const stopLoss = support * (1 + STOP_LOSS_BUFFER_PERCENT);
    const targetDistance = (stopLoss - entry) * DEFAULT_RR_MULTIPLIER;
    const takeProfit = entry - targetDistance;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) return null;

    const breakoutStrength = (support - current.close) / support;
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
      candles,
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
