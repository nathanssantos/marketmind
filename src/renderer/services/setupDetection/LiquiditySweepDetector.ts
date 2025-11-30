import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Kline, TradingSetup } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import type { SetupDetectorConfig } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

const SWEEP_LOOKBACK = 20;
const MIN_SWEEP_DISTANCE = 0.2;
const MAX_SWEEP_DISTANCE = 1.0;
const REVERSAL_THRESHOLD = 0.3;
const VOLUME_MULTIPLIER = 1.5;
const VOLUME_LOOKBACK = 20;
const VOLUME_WEIGHT = 10;
const SWEEP_WEIGHT = 15;
const MAX_CONFIDENCE = 95;
const BASE_CONFIDENCE = 70;
const MIN_INDEX_OFFSET = 3;
const PERCENT_DIVISOR = 100;
const MIN_KLINES_AFTER_LEVEL = 2;

export interface LiquiditySweepConfig extends SetupDetectorConfig {
  sweepLookback: number;
  minSweepDistance: number;
  maxSweepDistance: number;
  reversalThreshold: number;
  volumeMultiplier: number;
  targetMultiplier: number;
}

export const createDefaultLiquiditySweepConfig = (): LiquiditySweepConfig => ({
  enabled: false,
  minConfidence: 75,
  minRiskReward: 2.0,
  sweepLookback: SWEEP_LOOKBACK,
  minSweepDistance: MIN_SWEEP_DISTANCE,
  maxSweepDistance: MAX_SWEEP_DISTANCE,
  reversalThreshold: REVERSAL_THRESHOLD,
  volumeMultiplier: VOLUME_MULTIPLIER,
  targetMultiplier: 2.0,
});

export class LiquiditySweepDetector extends BaseSetupDetector {
  constructor(config: LiquiditySweepConfig) {
    super(config);
  }

  detect(klines: Kline[], currentIndex: number): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const sweepConfig = this.config as LiquiditySweepConfig;

    if (currentIndex < sweepConfig.sweepLookback + MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const currentKline = klines[currentIndex];
    if (!currentKline) {
      return { setup: null, confidence: 0 };
    }

    const bullishSweep = this.detectBullishLiquiditySweep(klines, currentIndex);
    if (bullishSweep) {
      const setup = this.createBullishSetup(klines, currentIndex, bullishSweep);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(bullishSweep.hasVolumeSpike);
          return { setup, confidence };
        }
      }
    }

    const bearishSweep = this.detectBearishLiquiditySweep(klines, currentIndex);
    if (bearishSweep) {
      const setup = this.createBearishSetup(klines, currentIndex, bearishSweep);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(bearishSweep.hasVolumeSpike);
          return { setup, confidence };
        }
      }
    }

    return { setup: null, confidence: 0 };
  }

  private detectBullishLiquiditySweep(
    klines: Kline[],
    currentIndex: number
  ): { supportLevel: number; sweepKline: Kline; reversalKline: Kline; hasVolumeSpike: boolean } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const startIndex = Math.max(0, currentIndex - sweepConfig.sweepLookback);
    const recentKlines = klines.slice(startIndex, currentIndex + 1);

    let supportLevel = Infinity;
    let supportIndex = -1;

    for (let i = 0; i < recentKlines.length - MIN_INDEX_OFFSET; i += 1) {
      const kline = recentKlines[i];
      if (!kline) continue;

      if (getKlineLow(kline) < supportLevel) {
        supportLevel = getKlineLow(kline);
        supportIndex = i;
      }
    }

    if (supportIndex === -1 || supportIndex >= recentKlines.length - MIN_KLINES_AFTER_LEVEL) return null;

    const sweepCandidateIndex = currentIndex - 1;
    const sweepKline = klines[sweepCandidateIndex];
    const currentKline = klines[currentIndex];

    if (!sweepKline || !currentKline) return null;

    const sweepDistance = ((supportLevel - getKlineLow(sweepKline)) / supportLevel) * PERCENT_DIVISOR;
    
    if (sweepDistance < sweepConfig.minSweepDistance || sweepDistance > sweepConfig.maxSweepDistance) {
      return null;
    }

    if (getKlineLow(sweepKline) >= supportLevel) return null;

    const reversalSize = ((getKlineClose(currentKline) - getKlineLow(sweepKline)) / getKlineLow(sweepKline)) * PERCENT_DIVISOR;
    
    if (reversalSize < sweepConfig.reversalThreshold) return null;

    if (getKlineClose(currentKline) <= getKlineClose(sweepKline)) return null;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(klines, sweepCandidateIndex);

    return {
      supportLevel,
      sweepKline,
      reversalKline: currentKline,
      hasVolumeSpike,
    };
  }

  private detectBearishLiquiditySweep(
    klines: Kline[],
    currentIndex: number
  ): { resistanceLevel: number; sweepKline: Kline; reversalKline: Kline; hasVolumeSpike: boolean } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const startIndex = Math.max(0, currentIndex - sweepConfig.sweepLookback);
    const recentKlines = klines.slice(startIndex, currentIndex + 1);

    let resistanceLevel = -Infinity;
    let resistanceIndex = -1;

    for (let i = 0; i < recentKlines.length - MIN_INDEX_OFFSET; i += 1) {
      const kline = recentKlines[i];
      if (!kline) continue;

      if (getKlineHigh(kline) > resistanceLevel) {
        resistanceLevel = getKlineHigh(kline);
        resistanceIndex = i;
      }
    }

    if (resistanceIndex === -1 || resistanceIndex >= recentKlines.length - MIN_KLINES_AFTER_LEVEL) return null;

    const sweepCandidateIndex = currentIndex - 1;
    const sweepKline = klines[sweepCandidateIndex];
    const currentKline = klines[currentIndex];

    if (!sweepKline || !currentKline) return null;

    const sweepDistance = ((getKlineHigh(sweepKline) - resistanceLevel) / resistanceLevel) * PERCENT_DIVISOR;
    
    if (sweepDistance < sweepConfig.minSweepDistance || sweepDistance > sweepConfig.maxSweepDistance) {
      return null;
    }

    if (getKlineHigh(sweepKline) <= resistanceLevel) return null;

    const reversalSize = ((getKlineHigh(sweepKline) - getKlineClose(currentKline)) / getKlineHigh(sweepKline)) * PERCENT_DIVISOR;
    
    if (reversalSize < sweepConfig.reversalThreshold) return null;

    if (getKlineClose(currentKline) >= getKlineClose(sweepKline)) return null;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(klines, sweepCandidateIndex);

    return {
      resistanceLevel,
      sweepKline,
      reversalKline: currentKline,
      hasVolumeSpike,
    };
  }

  private hasVolumeSpikeAtIndex(klines: Kline[], index: number): boolean {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const avgVolume = this.calculateAverageVolume(klines, index);
    const kline = klines[index];
    
    if (!kline || !avgVolume) return false;
    
    return getKlineVolume(kline) > avgVolume * sweepConfig.volumeMultiplier;
  }

  private calculateAverageVolume(klines: Kline[], currentIndex: number): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeKlines = klines.slice(startIndex, currentIndex);

    if (volumeKlines.length === 0) return null;

    const totalVolume = volumeKlines.reduce((sum, c) => sum + getKlineVolume(c), 0);
    return totalVolume / volumeKlines.length;
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    sweep: { supportLevel: number; sweepKline: Kline; reversalKline: Kline; hasVolumeSpike: boolean }
  ): TradingSetup | null {
    const { sweepKline, reversalKline, supportLevel, hasVolumeSpike } = sweep;

    const entry = getKlineClose(reversalKline);
    const stop = getKlineLow(sweepKline);
    const risk = entry - stop;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(klines);
    const resistanceLevels = pivots.filter((p) => p.type === 'high').map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const sweepConfig = this.config as LiquiditySweepConfig;
    const rrTarget = entry + risk * sweepConfig.targetMultiplier;
    const target = nearestResistance && nearestResistance < rrTarget ? nearestResistance : rrTarget;

    const confidence = this.calculateConfidence(hasVolumeSpike);

    return this.createSetup(
      'liquidity-sweep',
      'LONG',
      klines,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeSpike,
      0,
      {
        sweepType: 'bullish',
        supportLevel,
        sweepLow: sweepKline.low,
        reversalClose: reversalKline.close,
      }
    );
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    sweep: { resistanceLevel: number; sweepKline: Kline; reversalKline: Kline; hasVolumeSpike: boolean }
  ): TradingSetup | null {
    const { sweepKline, reversalKline, resistanceLevel, hasVolumeSpike } = sweep;

    const entry = getKlineClose(reversalKline);
    const stop = getKlineHigh(sweepKline);
    const risk = stop - entry;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(klines);
    const supportLevels = pivots.filter((p) => p.type === 'low').map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const sweepConfig = this.config as LiquiditySweepConfig;
    const rrTarget = entry - risk * sweepConfig.targetMultiplier;
    const target = nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const confidence = this.calculateConfidence(hasVolumeSpike);

    return this.createSetup(
      'liquidity-sweep',
      'SHORT',
      klines,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeSpike,
      0,
      {
        sweepType: 'bearish',
        resistanceLevel,
        sweepHigh: sweepKline.high,
        reversalClose: reversalKline.close,
      }
    );
  }

  private calculateConfidence(hasVolumeSpike: boolean): number {
    let confidence = BASE_CONFIDENCE;

    confidence += SWEEP_WEIGHT;

    if (hasVolumeSpike) {
      confidence += VOLUME_WEIGHT;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }
}
