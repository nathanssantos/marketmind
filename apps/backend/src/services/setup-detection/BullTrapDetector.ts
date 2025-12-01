import { calculateEMA, findPivotPoints } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import {
    getKlineClose,
    getKlineLow,
    getKlineVolume,
} from '../../utils/klineHelpers';
import type { SetupDetectorResult } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

export interface BullTrapConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
}

const MIN_HIGH_PIVOTS = 2;
const MIN_TRAP_DISTANCE_PERCENT = 0.001;
const MAX_TRAP_DISTANCE_PERCENT = 0.02;
const MIN_REVERSAL_STRENGTH = 0.5;
const VOLUME_LOOKBACK = 20;
const STOP_LOSS_BUFFER = 1.005;
const DEFAULT_RR_MULTIPLIER = 2.0;
const SUPPORT_LOOKBACK = 50;
const CLUSTER_THRESHOLD_PERCENT = 0.005;
const MIN_CONFIDENCE_THRESHOLD = 70;
const BASE_CONFIDENCE = 70;
const REVERSAL_CONFIDENCE_WEIGHT = 20;
const VOLUME_CONFIDENCE_BONUS = 10;
const EMA_CONFIRMATION_BONUS = 10;
const OPTIMAL_BREAKOUT_MIN = 0.001;
const OPTIMAL_BREAKOUT_MAX = 0.01;
const BREAKOUT_BONUS = 5;
const MAX_CONFIDENCE = 100;
const BREAKOUT_DISTANCE_TO_PERCENT = 100;

export class BullTrapDetector extends BaseSetupDetector {
  private bullTrapConfig: BullTrapConfig;

  constructor(config: BullTrapConfig) {
    super(config);
    this.bullTrapConfig = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    if (!this.bullTrapConfig.enabled) {
      return { setup: null, confidence: 0 };
    }

    const MIN_KLINES_REQUIRED = Math.max(
      this.bullTrapConfig.lookbackPeriod,
      this.bullTrapConfig.emaPeriod,
    );
    if (currentIndex < MIN_KLINES_REQUIRED) {
      return { setup: null, confidence: 0 };
    }

    const relevantKlines = klines.slice(0, currentIndex + 1);
    const pivots = findPivotPoints(relevantKlines, 5);

    const highPivots = this.getRecentHighPivots(pivots, currentIndex);

    if (highPivots.length < MIN_HIGH_PIVOTS) {
      return { setup: null, confidence: 0 };
    }

    const trap = this.validateTrapStructure(highPivots, klines, currentIndex);

    if (!trap) {
      return { setup: null, confidence: 0 };
    }

    return this.createTrapSetup(trap, klines, currentIndex) ?? {
      setup: null,
      confidence: 0,
    };
  }

  private getRecentHighPivots(
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): ReturnType<typeof findPivotPoints> {
    return pivots
      .filter((p) => p.type === 'high')
      .filter(
        (p) =>
          p.index >= currentIndex - this.bullTrapConfig.lookbackPeriod,
      )
      .sort((a, b) => b.index - a.index);
  }

  private validateTrapStructure(
    highPivots: ReturnType<typeof findPivotPoints>,
    klines: Kline[],
    currentIndex: number,
  ): {
    trapHigh: { price: number; index: number };
    resistanceHigh: { price: number };
    breakoutDistance: number;
    reversalStrength: number;
    current: Kline;
  } | null {
    const trapHigh = highPivots[0];
    const resistanceHigh = highPivots[1];
    const current = klines[currentIndex];

    if (!trapHigh || !resistanceHigh || !current) {
      return null;
    }

    const fakeBreakout = trapHigh.price > resistanceHigh.price;
    const breakoutDistance =
      (trapHigh.price - resistanceHigh.price) / resistanceHigh.price;
    const reversalInProgress = getKlineClose(current) < resistanceHigh.price;
    const reversalStrength =
      (trapHigh.price - getKlineClose(current)) /
      (trapHigh.price - getKlineLow(current));

    const validBreakoutDistance =
      breakoutDistance >= MIN_TRAP_DISTANCE_PERCENT &&
      breakoutDistance <= MAX_TRAP_DISTANCE_PERCENT;

    const validReversal = reversalStrength >= MIN_REVERSAL_STRENGTH;

    if (
      !fakeBreakout ||
      !validBreakoutDistance ||
      !reversalInProgress ||
      !validReversal
    ) {
      return null;
    }

    return {
      trapHigh,
      resistanceHigh,
      breakoutDistance,
      reversalStrength,
      current,
    };
  }

  private createTrapSetup(
    trap: {
      trapHigh: { price: number; index: number };
      resistanceHigh: { price: number };
      breakoutDistance: number;
      reversalStrength: number;
      current: Kline;
    },
    klines: Kline[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const volumeData = klines.slice(
      Math.max(0, currentIndex - VOLUME_LOOKBACK),
      currentIndex,
    );
    const avgVolume =
      volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) /
      volumeData.length;
    const volumeConfirmation =
      getKlineVolume(trap.current) >
      avgVolume * this.bullTrapConfig.volumeMultiplier;

    const ema = calculateEMA(klines, this.bullTrapConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) {
      return null;
    }

    const belowEMA = getKlineClose(trap.current) < emaCurrent;
    const entry = getKlineClose(trap.current);
    const stopLoss = trap.trapHigh.price * STOP_LOSS_BUFFER;
    const supportLevel = this.findNearestSupport(klines, currentIndex, entry);
    const takeProfit =
      supportLevel ?? entry - (stopLoss - entry) * DEFAULT_RR_MULTIPLIER;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumRequirements(MIN_CONFIDENCE_THRESHOLD, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      trap.reversalStrength,
      volumeConfirmation,
      belowEMA,
      trap.breakoutDistance,
    );

    if (!this.meetsMinimumRequirements(confidence, rr)) {
      return null;
    }

    const setup = this.createSetup(
      'bull-trap',
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
        trapHighPrice: trap.trapHigh.price,
        trapHighIndex: trap.trapHigh.index,
        resistancePrice: trap.resistanceHigh.price,
        breakoutDistance: trap.breakoutDistance * BREAKOUT_DISTANCE_TO_PERCENT,
        reversalStrength: trap.reversalStrength,
        ema20: emaCurrent,
      },
    );

    return { setup, confidence };
  }

  private findNearestSupport(
    klines: Kline[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(SUPPORT_LOOKBACK, currentIndex);
    const recentKlines = klines.slice(
      Math.max(0, currentIndex - lookback),
      currentIndex,
    );

    const lows = recentKlines
      .map((c) => getKlineLow(c))
      .filter((low) => low < currentPrice)
      .sort((a, b) => b - a);

    if (lows.length === 0) return null;

    const supportClusters: number[] = [];
    const clusterThreshold = currentPrice * CLUSTER_THRESHOLD_PERCENT;

    for (const low of lows) {
      const existingCluster = supportClusters.find(
        (cluster) => Math.abs(cluster - low) < clusterThreshold,
      );

      if (!existingCluster) {
        supportClusters.push(low);
      }
    }

    const firstSupport = supportClusters[0];
    return firstSupport ?? null;
  }

  private calculateConfidence(
    reversalStrength: number,
    volumeConfirmation: boolean,
    belowEMA: boolean,
    breakoutDistance: number,
  ): number {
    const baseConfidence = BASE_CONFIDENCE;
    const reversalBonus = reversalStrength * REVERSAL_CONFIDENCE_WEIGHT;
    const volumeBonus = volumeConfirmation ? VOLUME_CONFIDENCE_BONUS : 0;
    const emaBonus = belowEMA ? EMA_CONFIRMATION_BONUS : 0;

    const optimalBreakout =
      breakoutDistance >= OPTIMAL_BREAKOUT_MIN &&
      breakoutDistance <= OPTIMAL_BREAKOUT_MAX;
    const breakoutBonus = optimalBreakout ? BREAKOUT_BONUS : 0;

    const totalConfidence =
      baseConfidence + reversalBonus + volumeBonus + emaBonus + breakoutBonus;

    return Math.min(MAX_CONFIDENCE, Math.max(BASE_CONFIDENCE, totalConfidence));
  }
}

export const createDefaultBullTrapConfig = (): BullTrapConfig => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.0,
  volumeMultiplier: 1.3,
  lookbackPeriod: 20,
  emaPeriod: 20,
});
