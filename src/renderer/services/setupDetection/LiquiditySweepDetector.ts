import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle, TradingSetup } from '@shared/types';
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
const MIN_CANDLES_AFTER_LEVEL = 2;

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

  detect(candles: Candle[], currentIndex: number): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const sweepConfig = this.config as LiquiditySweepConfig;

    if (currentIndex < sweepConfig.sweepLookback + MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const currentCandle = candles[currentIndex];
    if (!currentCandle) {
      return { setup: null, confidence: 0 };
    }

    const bullishSweep = this.detectBullishLiquiditySweep(candles, currentIndex);
    if (bullishSweep) {
      const setup = this.createBullishSetup(candles, currentIndex, bullishSweep);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(bullishSweep.hasVolumeSpike);
          return { setup, confidence };
        }
      }
    }

    const bearishSweep = this.detectBearishLiquiditySweep(candles, currentIndex);
    if (bearishSweep) {
      const setup = this.createBearishSetup(candles, currentIndex, bearishSweep);
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
    candles: Candle[],
    currentIndex: number
  ): { supportLevel: number; sweepCandle: Candle; reversalCandle: Candle; hasVolumeSpike: boolean } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const startIndex = Math.max(0, currentIndex - sweepConfig.sweepLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);

    let supportLevel = Infinity;
    let supportIndex = -1;

    for (let i = 0; i < recentCandles.length - MIN_INDEX_OFFSET; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;

      if (candle.low < supportLevel) {
        supportLevel = candle.low;
        supportIndex = i;
      }
    }

    if (supportIndex === -1 || supportIndex >= recentCandles.length - MIN_CANDLES_AFTER_LEVEL) return null;

    const sweepCandidateIndex = currentIndex - 1;
    const sweepCandle = candles[sweepCandidateIndex];
    const currentCandle = candles[currentIndex];

    if (!sweepCandle || !currentCandle) return null;

    const sweepDistance = ((supportLevel - sweepCandle.low) / supportLevel) * PERCENT_DIVISOR;
    
    if (sweepDistance < sweepConfig.minSweepDistance || sweepDistance > sweepConfig.maxSweepDistance) {
      return null;
    }

    if (sweepCandle.low >= supportLevel) return null;

    const reversalSize = ((currentCandle.close - sweepCandle.low) / sweepCandle.low) * PERCENT_DIVISOR;
    
    if (reversalSize < sweepConfig.reversalThreshold) return null;

    if (currentCandle.close <= sweepCandle.close) return null;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(candles, sweepCandidateIndex);

    return {
      supportLevel,
      sweepCandle,
      reversalCandle: currentCandle,
      hasVolumeSpike,
    };
  }

  private detectBearishLiquiditySweep(
    candles: Candle[],
    currentIndex: number
  ): { resistanceLevel: number; sweepCandle: Candle; reversalCandle: Candle; hasVolumeSpike: boolean } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const startIndex = Math.max(0, currentIndex - sweepConfig.sweepLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);

    let resistanceLevel = -Infinity;
    let resistanceIndex = -1;

    for (let i = 0; i < recentCandles.length - MIN_INDEX_OFFSET; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;

      if (candle.high > resistanceLevel) {
        resistanceLevel = candle.high;
        resistanceIndex = i;
      }
    }

    if (resistanceIndex === -1 || resistanceIndex >= recentCandles.length - MIN_CANDLES_AFTER_LEVEL) return null;

    const sweepCandidateIndex = currentIndex - 1;
    const sweepCandle = candles[sweepCandidateIndex];
    const currentCandle = candles[currentIndex];

    if (!sweepCandle || !currentCandle) return null;

    const sweepDistance = ((sweepCandle.high - resistanceLevel) / resistanceLevel) * PERCENT_DIVISOR;
    
    if (sweepDistance < sweepConfig.minSweepDistance || sweepDistance > sweepConfig.maxSweepDistance) {
      return null;
    }

    if (sweepCandle.high <= resistanceLevel) return null;

    const reversalSize = ((sweepCandle.high - currentCandle.close) / sweepCandle.high) * PERCENT_DIVISOR;
    
    if (reversalSize < sweepConfig.reversalThreshold) return null;

    if (currentCandle.close >= sweepCandle.close) return null;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(candles, sweepCandidateIndex);

    return {
      resistanceLevel,
      sweepCandle,
      reversalCandle: currentCandle,
      hasVolumeSpike,
    };
  }

  private hasVolumeSpikeAtIndex(candles: Candle[], index: number): boolean {
    const sweepConfig = this.config as LiquiditySweepConfig;
    const avgVolume = this.calculateAverageVolume(candles, index);
    const candle = candles[index];
    
    if (!candle || !avgVolume) return false;
    
    return candle.volume > avgVolume * sweepConfig.volumeMultiplier;
  }

  private calculateAverageVolume(candles: Candle[], currentIndex: number): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeCandles = candles.slice(startIndex, currentIndex);

    if (volumeCandles.length === 0) return null;

    const totalVolume = volumeCandles.reduce((sum, c) => sum + c.volume, 0);
    return totalVolume / volumeCandles.length;
  }

  private createBullishSetup(
    candles: Candle[],
    currentIndex: number,
    sweep: { supportLevel: number; sweepCandle: Candle; reversalCandle: Candle; hasVolumeSpike: boolean }
  ): TradingSetup | null {
    const { sweepCandle, reversalCandle, supportLevel, hasVolumeSpike } = sweep;

    const entry = reversalCandle.close;
    const stop = sweepCandle.low;
    const risk = entry - stop;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const resistanceLevels = pivots.filter((p) => p.type === 'high').map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const sweepConfig = this.config as LiquiditySweepConfig;
    const rrTarget = entry + risk * sweepConfig.targetMultiplier;
    const target = nearestResistance && nearestResistance < rrTarget ? nearestResistance : rrTarget;

    const confidence = this.calculateConfidence(hasVolumeSpike);

    return this.createSetup(
      'liquidity-sweep',
      'LONG',
      candles,
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
        sweepLow: sweepCandle.low,
        reversalClose: reversalCandle.close,
      }
    );
  }

  private createBearishSetup(
    candles: Candle[],
    currentIndex: number,
    sweep: { resistanceLevel: number; sweepCandle: Candle; reversalCandle: Candle; hasVolumeSpike: boolean }
  ): TradingSetup | null {
    const { sweepCandle, reversalCandle, resistanceLevel, hasVolumeSpike } = sweep;

    const entry = reversalCandle.close;
    const stop = sweepCandle.high;
    const risk = stop - entry;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const supportLevels = pivots.filter((p) => p.type === 'low').map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const sweepConfig = this.config as LiquiditySweepConfig;
    const rrTarget = entry - risk * sweepConfig.targetMultiplier;
    const target = nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const confidence = this.calculateConfidence(hasVolumeSpike);

    return this.createSetup(
      'liquidity-sweep',
      'SHORT',
      candles,
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
        sweepHigh: sweepCandle.high,
        reversalClose: reversalCandle.close,
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
