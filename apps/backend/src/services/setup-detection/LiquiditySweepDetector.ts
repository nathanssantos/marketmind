import { findPivotPoints } from '@marketmind/indicators';
import type { Kline, TradingSetup } from '@marketmind/types';
import {
    getKlineClose,
    getKlineHigh,
    getKlineLow,
    getKlineVolume,
} from '../../utils/klineHelpers';
import type { SetupDetectorConfig } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

const PIVOT_LOOKBACK = 5;
const SUPPORT_RESISTANCE_LOOKBACK = 50;
const MIN_SWEEP_DISTANCE = 0.002;
const MAX_SWEEP_DISTANCE = 0.01;
const REVERSAL_THRESHOLD = 0.003;
const VOLUME_SPIKE_MULTIPLIER = 1.5;
const VOLUME_LOOKBACK = 20;
const VOLUME_WEIGHT = 10;
const SWEEP_WEIGHT = 15;
const MAX_CONFIDENCE = 95;
const BASE_CONFIDENCE = 70;

export interface LiquiditySweepConfig extends SetupDetectorConfig {
  pivotLookback: number;
  srLookback: number;
  minSweepDistance: number;
  maxSweepDistance: number;
  reversalThreshold: number;
  targetMultiplier: number;
}

export class LiquiditySweepDetector extends BaseSetupDetector {
  constructor(config: LiquiditySweepConfig) {
    super(config);
  }

  detect(
    klines: Kline[],
    currentIndex: number,
  ): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const sweepConfig = this.config as LiquiditySweepConfig;

    if (currentIndex < sweepConfig.srLookback) {
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
        const rr = this.calculateRR(
          setup.entryPrice,
          setup.stopLoss,
          setup.takeProfit,
        );
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(klines, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    const bearishSweep = this.detectBearishLiquiditySweep(klines, currentIndex);
    if (bearishSweep) {
      const setup = this.createBearishSetup(klines, currentIndex, bearishSweep);
      if (setup) {
        const rr = this.calculateRR(
          setup.entryPrice,
          setup.stopLoss,
          setup.takeProfit,
        );
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(klines, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    return { setup: null, confidence: 0 };
  }

  private detectBullishLiquiditySweep(
    klines: Kline[],
    currentIndex: number,
  ): { supportLevel: number; sweepIndex: number; sweepLow: number } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;

    const startIndex = Math.max(0, currentIndex - sweepConfig.srLookback);
    const pivots = findPivotPoints(
      klines.slice(startIndex, currentIndex + 1),
      sweepConfig.pivotLookback,
    );

    const supportLevels = pivots
      .filter((p) => p.type === 'low')
      .map((p) => p.price)
      .sort((a, b) => a - b);

    if (supportLevels.length === 0) return null;

    for (let i = currentIndex; i >= Math.max(0, currentIndex - 5); i -= 1) {
      const kline = klines[i];
      if (!kline) continue;

      const low = getKlineLow(kline);
      const close = getKlineClose(kline);

      for (const support of supportLevels) {
        if (low >= support) continue;

        const sweepDistance = (support - low) / support;
        if (
          sweepDistance < sweepConfig.minSweepDistance ||
          sweepDistance > sweepConfig.maxSweepDistance
        )
          {continue;}

        if (close <= support) continue;

        const reversal = (close - low) / low;
        if (reversal < sweepConfig.reversalThreshold) continue;

        if (!this.hasVolumeSpikeAtIndex(klines, i)) continue;

        return {
          supportLevel: support,
          sweepIndex: i,
          sweepLow: low,
        };
      }
    }

    return null;
  }

  private detectBearishLiquiditySweep(
    klines: Kline[],
    currentIndex: number,
  ): { resistanceLevel: number; sweepIndex: number; sweepHigh: number } | null {
    const sweepConfig = this.config as LiquiditySweepConfig;

    const startIndex = Math.max(0, currentIndex - sweepConfig.srLookback);
    const pivots = findPivotPoints(
      klines.slice(startIndex, currentIndex + 1),
      sweepConfig.pivotLookback,
    );

    const resistanceLevels = pivots
      .filter((p) => p.type === 'high')
      .map((p) => p.price)
      .sort((a, b) => b - a);

    if (resistanceLevels.length === 0) return null;

    for (let i = currentIndex; i >= Math.max(0, currentIndex - 5); i -= 1) {
      const kline = klines[i];
      if (!kline) continue;

      const high = getKlineHigh(kline);
      const close = getKlineClose(kline);

      for (const resistance of resistanceLevels) {
        if (high <= resistance) continue;

        const sweepDistance = (high - resistance) / resistance;
        if (
          sweepDistance < sweepConfig.minSweepDistance ||
          sweepDistance > sweepConfig.maxSweepDistance
        )
          {continue;}

        if (close >= resistance) continue;

        const reversal = (high - close) / high;
        if (reversal < sweepConfig.reversalThreshold) continue;

        if (!this.hasVolumeSpikeAtIndex(klines, i)) continue;

        return {
          resistanceLevel: resistance,
          sweepIndex: i,
          sweepHigh: high,
        };
      }
    }

    return null;
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    sweep: { supportLevel: number; sweepIndex: number; sweepLow: number },
  ): TradingSetup | null {
    const currentKline = klines[currentIndex];
    if (!currentKline) return null;

    const entry = getKlineClose(currentKline);
    const stop = sweep.sweepLow;
    const risk = entry - stop;

    if (risk <= 0) return null;

    const sweepConfig = this.config as LiquiditySweepConfig;
    const pivots = findPivotPoints(klines.slice(0, currentIndex + 1), 5);
    const resistanceLevels = pivots
      .filter((p) => p.type === 'high')
      .map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const rrTarget = entry + risk * sweepConfig.targetMultiplier;
    const target =
      nearestResistance && nearestResistance < rrTarget
        ? nearestResistance
        : rrTarget;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(klines, sweep.sweepIndex);
    const confidence = this.calculateConfidence(klines, currentIndex, true);

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
        supportLevel: sweep.supportLevel,
        sweepIndex: sweep.sweepIndex,
        sweepLow: sweep.sweepLow,
      },
    );
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    sweep: { resistanceLevel: number; sweepIndex: number; sweepHigh: number },
  ): TradingSetup | null {
    const currentKline = klines[currentIndex];
    if (!currentKline) return null;

    const entry = getKlineClose(currentKline);
    const stop = sweep.sweepHigh;
    const risk = stop - entry;

    if (risk <= 0) return null;

    const sweepConfig = this.config as LiquiditySweepConfig;
    const pivots = findPivotPoints(klines.slice(0, currentIndex + 1), 5);
    const supportLevels = pivots
      .filter((p) => p.type === 'low')
      .map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const rrTarget = entry - risk * sweepConfig.targetMultiplier;
    const target =
      nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const hasVolumeSpike = this.hasVolumeSpikeAtIndex(klines, sweep.sweepIndex);
    const confidence = this.calculateConfidence(klines, currentIndex, true);

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
        resistanceLevel: sweep.resistanceLevel,
        sweepIndex: sweep.sweepIndex,
        sweepHigh: sweep.sweepHigh,
      },
    );
  }

  private hasVolumeSpikeAtIndex(klines: Kline[], index: number): boolean {
    const avgVolume = this.calculateAverageVolume(klines, index);
    const kline = klines[index];
    if (!kline || !avgVolume) return false;
    return getKlineVolume(kline) > avgVolume * VOLUME_SPIKE_MULTIPLIER;
  }

  private calculateAverageVolume(
    klines: Kline[],
    currentIndex: number,
  ): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeKlines = klines.slice(startIndex, currentIndex);

    if (volumeKlines.length === 0) return null;

    const totalVolume = volumeKlines.reduce(
      (sum, c) => sum + getKlineVolume(c),
      0,
    );
    return totalVolume / volumeKlines.length;
  }

  private calculateConfidence(
    klines: Kline[],
    currentIndex: number,
    hasSweep: boolean,
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (hasSweep) {
      confidence += SWEEP_WEIGHT;
    }

    const currentKline = klines[currentIndex];
    if (currentKline && this.hasVolumeSpikeAtIndex(klines, currentIndex)) {
      confidence += VOLUME_WEIGHT;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }
}

export const createDefaultLiquiditySweepConfig = (): LiquiditySweepConfig => ({
  enabled: false,
  minConfidence: 75,
  minRiskReward: 2.0,
  pivotLookback: PIVOT_LOOKBACK,
  srLookback: SUPPORT_RESISTANCE_LOOKBACK,
  minSweepDistance: MIN_SWEEP_DISTANCE,
  maxSweepDistance: MAX_SWEEP_DISTANCE,
  reversalThreshold: REVERSAL_THRESHOLD,
  targetMultiplier: 2.0,
});
