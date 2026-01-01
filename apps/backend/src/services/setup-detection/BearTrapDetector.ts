import { calculateEMA, findPivotPoints, isVolumeConfirmed } from '@marketmind/indicators';
import type { Kline, BearTrapConfig } from '@marketmind/types';
import {
    createDefaultBearTrapConfig,
    getKlineClose,
    getKlineHigh,
} from '@marketmind/types';
import { DETECTOR_CONFIG } from '../../constants';
import type { SetupDetectorResult } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

export type { BearTrapConfig };
export { createDefaultBearTrapConfig };

const MIN_LOW_PIVOTS = 2;
const MIN_TRAP_DISTANCE_PERCENT = 0.001;
const MAX_TRAP_DISTANCE_PERCENT = 0.02;
const MIN_REVERSAL_STRENGTH = 0.5;
const STOP_LOSS_BUFFER = 0.995;
const DEFAULT_RR_MULTIPLIER = 2.5;
const RESISTANCE_LOOKBACK = 50;
const CLUSTER_THRESHOLD_PERCENT = 0.005;
const MIN_CONFIDENCE_THRESHOLD = 70;
const REVERSAL_CONFIDENCE_WEIGHT = 15;
const VOLUME_CONFIDENCE_BONUS = 10;
const EMA_CONFIRMATION_BONUS = 10;
const OPTIMAL_BREAKOUT_MIN = 0.001;
const OPTIMAL_BREAKOUT_MAX = 0.01;
const BREAKOUT_BONUS = 5;
const BREAKOUT_DISTANCE_TO_PERCENT = 100;

export class BearTrapDetector extends BaseSetupDetector {
  private bearTrapConfig: BearTrapConfig;

  constructor(config: BearTrapConfig) {
    super(config);
    this.bearTrapConfig = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    if (!this.bearTrapConfig.enabled) {
      return { setup: null, confidence: 0 };
    }

    const MIN_KLINES_REQUIRED = Math.max(
      this.bearTrapConfig.lookbackPeriod,
      this.bearTrapConfig.emaPeriod,
    );
    if (currentIndex < MIN_KLINES_REQUIRED) {
      return { setup: null, confidence: 0 };
    }

    const relevantKlines = klines.slice(0, currentIndex + 1);
    const pivots = findPivotPoints(relevantKlines, 5);

    const lowPivots = this.getRecentLowPivots(pivots, currentIndex);

    if (lowPivots.length < MIN_LOW_PIVOTS) {
      return { setup: null, confidence: 0 };
    }

    const trap = this.validateTrapStructure(lowPivots, klines, currentIndex);

    if (!trap) {
      return { setup: null, confidence: 0 };
    }

    return this.createTrapSetup(trap, klines, currentIndex) ?? {
      setup: null,
      confidence: 0,
    };
  }

  private getRecentLowPivots(
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): ReturnType<typeof findPivotPoints> {
    return pivots
      .filter((p) => p.type === 'low')
      .filter(
        (p) =>
          p.index >= currentIndex - this.bearTrapConfig.lookbackPeriod,
      )
      .sort((a, b) => b.index - a.index);
  }

  private validateTrapStructure(
    lowPivots: ReturnType<typeof findPivotPoints>,
    klines: Kline[],
    currentIndex: number,
  ): {
    trapLow: { price: number; index: number };
    supportLow: { price: number };
    breakoutDistance: number;
    reversalStrength: number;
    current: Kline;
  } | null {
    const trapLow = lowPivots[0];
    const supportLow = lowPivots[1];
    const current = klines[currentIndex];

    if (!trapLow || !supportLow || !current) {
      return null;
    }

    const currentClose = getKlineClose(current);
    const currentHigh = getKlineHigh(current);
    const fakeBreakdown = trapLow.price < supportLow.price;
    const breakoutDistance =
      (supportLow.price - trapLow.price) / supportLow.price;
    const reversalInProgress = currentClose > supportLow.price;
    const reversalStrength =
      (currentClose - trapLow.price) / (currentHigh - trapLow.price);

    const validBreakoutDistance =
      breakoutDistance >= MIN_TRAP_DISTANCE_PERCENT &&
      breakoutDistance <= MAX_TRAP_DISTANCE_PERCENT;

    const validReversal = reversalStrength >= MIN_REVERSAL_STRENGTH;

    if (
      !fakeBreakdown ||
      !validBreakoutDistance ||
      !reversalInProgress ||
      !validReversal
    ) {
      return null;
    }

    return {
      trapLow,
      supportLow,
      breakoutDistance,
      reversalStrength,
      current,
    };
  }

  private createTrapSetup(
    trap: {
      trapLow: { price: number; index: number };
      supportLow: { price: number };
      breakoutDistance: number;
      reversalStrength: number;
      current: Kline;
    },
    klines: Kline[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const volumeConfirmation = isVolumeConfirmed(klines, currentIndex, DETECTOR_CONFIG.VOLUME_LOOKBACK, this.bearTrapConfig.volumeMultiplier);

    const ema = calculateEMA(klines, this.bearTrapConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) {
      return null;
    }

    const currentClose = getKlineClose(trap.current);
    const aboveEMA = currentClose > emaCurrent;
    const entry = currentClose;
    const stopLoss = trap.trapLow.price * STOP_LOSS_BUFFER;
    const resistanceLevel = this.findNearestResistance(
      klines,
      currentIndex,
      entry,
    );
    const takeProfit =
      resistanceLevel ?? entry + (entry - stopLoss) * DEFAULT_RR_MULTIPLIER;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumRequirements(MIN_CONFIDENCE_THRESHOLD, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      trap.reversalStrength,
      volumeConfirmation,
      aboveEMA,
      trap.breakoutDistance,
    );

    if (!this.meetsMinimumRequirements(confidence, rr)) {
      return null;
    }

    const setup = this.createSetup(
      'bear-trap',
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
        trapLowPrice: trap.trapLow.price,
        trapLowIndex: trap.trapLow.index,
        supportPrice: trap.supportLow.price,
        breakoutDistance: trap.breakoutDistance * BREAKOUT_DISTANCE_TO_PERCENT,
        reversalStrength: trap.reversalStrength,
        ema20: emaCurrent,
      },
    );

    return { setup, confidence };
  }

  private findNearestResistance(
    klines: Kline[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(RESISTANCE_LOOKBACK, currentIndex);
    const recentKlines = klines.slice(
      Math.max(0, currentIndex - lookback),
      currentIndex,
    );

    const highs = recentKlines
      .map((c) => getKlineHigh(c))
      .filter((high) => high > currentPrice)
      .sort((a, b) => a - b);

    if (highs.length === 0) return null;

    const resistanceClusters: number[] = [];
    const clusterThreshold = currentPrice * CLUSTER_THRESHOLD_PERCENT;

    for (const high of highs) {
      const existingCluster = resistanceClusters.find(
        (cluster) => Math.abs(cluster - high) < clusterThreshold,
      );

      if (!existingCluster) {
        resistanceClusters.push(high);
      }
    }

    const firstResistance = resistanceClusters[0];
    return firstResistance ?? null;
  }

  private calculateConfidence(
    reversalStrength: number,
    volumeConfirmation: boolean,
    aboveEMA: boolean,
    breakoutDistance: number,
  ): number {
    const baseConfidence = DETECTOR_CONFIG.BASE_CONFIDENCE;
    const reversalBonus = reversalStrength * REVERSAL_CONFIDENCE_WEIGHT;
    const volumeBonus = volumeConfirmation ? VOLUME_CONFIDENCE_BONUS : 0;
    const emaBonus = aboveEMA ? EMA_CONFIRMATION_BONUS : 0;

    const optimalBreakout =
      breakoutDistance >= OPTIMAL_BREAKOUT_MIN &&
      breakoutDistance <= OPTIMAL_BREAKOUT_MAX;
    const breakoutBonus = optimalBreakout ? BREAKOUT_BONUS : 0;

    const totalConfidence =
      baseConfidence + reversalBonus + volumeBonus + emaBonus + breakoutBonus;

    return Math.min(DETECTOR_CONFIG.MAX_CONFIDENCE, Math.max(DETECTOR_CONFIG.BASE_CONFIDENCE, totalConfidence));
  }
}
