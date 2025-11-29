import { calculateEMA } from '@renderer/utils/movingAverages';
import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle } from '@shared/types';
import { BaseSetupDetector, type SetupDetectorResult } from './BaseSetupDetector';

const VOLUME_LOOKBACK = 20;
const MIN_TRAP_DISTANCE_PERCENT = 0.001;
const MAX_TRAP_DISTANCE_PERCENT = 0.02;
const MIN_REVERSAL_STRENGTH = 0.5;
const MIN_HIGH_PIVOTS = 2;
const STOP_LOSS_BUFFER = 1.005;
const DEFAULT_RR_MULTIPLIER = 2.5;
const BASE_CONFIDENCE = 60;
const MIN_CONFIDENCE_THRESHOLD = 70;
const REVERSAL_CONFIDENCE_WEIGHT = 15;
const VOLUME_CONFIDENCE_BONUS = 10;
const EMA_CONFIRMATION_BONUS = 10;
const BREAKOUT_BONUS = 5;
const MAX_CONFIDENCE = 95;
const SUPPORT_LOOKBACK = 50;
const CLUSTER_THRESHOLD_PERCENT = 0.005;
const BREAKOUT_DISTANCE_TO_PERCENT = 100;
const OPTIMAL_BREAKOUT_MIN = 0.003;
const OPTIMAL_BREAKOUT_MAX = 0.01;

export interface BullTrapConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
}

export const createDefaultBullTrapConfig = (): BullTrapConfig => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.5,
  volumeMultiplier: 1.3,
  lookbackPeriod: 20,
  emaPeriod: 20,
});

export class BullTrapDetector extends BaseSetupDetector {
  private bullTrapConfig: BullTrapConfig;

  constructor(config: BullTrapConfig) {
    super(config);
    this.bullTrapConfig = config;
  }

  updateConfig(config: BullTrapConfig): void {
    this.config = config;
    this.bullTrapConfig = config;
  }

  getConfig(): BullTrapConfig {
    return this.bullTrapConfig;
  }

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.bullTrapConfig.lookbackPeriod + this.bullTrapConfig.emaPeriod,
      SUPPORT_LOOKBACK + VOLUME_LOOKBACK,
    );
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const trapSetup = this.detectTrapPattern(candles, currentIndex);
    if (!trapSetup) {
      return { setup: null, confidence: 0 };
    }

    return trapSetup;
  }

  private detectTrapPattern(candles: Candle[], currentIndex: number): SetupDetectorResult | null {
    const pivots = findPivotPoints(
      candles.slice(0, currentIndex + 1),
      this.bullTrapConfig.lookbackPeriod,
    );

    const recentHighPivots = this.getRecentHighPivots(pivots, currentIndex);
    if (recentHighPivots.length < MIN_HIGH_PIVOTS) {
      return null;
    }

    const trap = this.validateTrapStructure(recentHighPivots, candles, currentIndex);
    if (!trap) {
      return null;
    }

    return this.createTrapSetup(trap, candles, currentIndex);
  }

  private getRecentHighPivots(
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): ReturnType<typeof findPivotPoints> {
    return pivots
      .filter((p) => p.type === 'high')
      .filter((p) => p.index >= currentIndex - this.bullTrapConfig.lookbackPeriod)
      .sort((a, b) => b.index - a.index);
  }

  private validateTrapStructure(
    highPivots: ReturnType<typeof findPivotPoints>,
    candles: Candle[],
    currentIndex: number,
  ): {
    trapHigh: { price: number; index: number };
    resistanceHigh: { price: number };
    breakoutDistance: number;
    reversalStrength: number;
    current: Candle;
  } | null {
    const trapHigh = highPivots[0];
    const resistanceHigh = highPivots[1];
    const current = candles[currentIndex];

    if (!trapHigh || !resistanceHigh || !current) {
      return null;
    }

    const fakeBreakout = trapHigh.price > resistanceHigh.price;
    const breakoutDistance = (trapHigh.price - resistanceHigh.price) / resistanceHigh.price;
    const reversalInProgress = current.close < resistanceHigh.price;
    const reversalStrength =
      (trapHigh.price - current.close) / (trapHigh.price - current.low);

    const validBreakoutDistance =
      breakoutDistance >= MIN_TRAP_DISTANCE_PERCENT &&
      breakoutDistance <= MAX_TRAP_DISTANCE_PERCENT;

    const validReversal = reversalStrength >= MIN_REVERSAL_STRENGTH;

    if (!fakeBreakout || !validBreakoutDistance || !reversalInProgress || !validReversal) {
      return null;
    }

    return { trapHigh, resistanceHigh, breakoutDistance, reversalStrength, current };
  }

  private createTrapSetup(
    trap: {
      trapHigh: { price: number; index: number };
      resistanceHigh: { price: number };
      breakoutDistance: number;
      reversalStrength: number;
      current: Candle;
    },
    candles: Candle[],
    currentIndex: number,
  ): SetupDetectorResult | null {
    const volumeData = candles.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + c.volume, 0) / volumeData.length;
    const volumeConfirmation =
      trap.current.volume > avgVolume * this.bullTrapConfig.volumeMultiplier;

    const ema = calculateEMA(candles, this.bullTrapConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) {
      return null;
    }

    const belowEMA = trap.current.close < emaCurrent;
    const entry = trap.current.close;
    const stopLoss = trap.trapHigh.price * STOP_LOSS_BUFFER;
    const supportLevel = this.findNearestSupport(candles, currentIndex, entry);
    const takeProfit = supportLevel ?? entry - (stopLoss - entry) * DEFAULT_RR_MULTIPLIER;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      trap.reversalStrength,
      volumeConfirmation,
      belowEMA,
      trap.breakoutDistance,
    );

    if (!this.meetsMinimumCriteria(confidence, rr)) {
      return null;
    }

    const setup = this.createSetup(
      'bull-trap',
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
    candles: Candle[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(SUPPORT_LOOKBACK, currentIndex);
    const recentCandles = candles.slice(Math.max(0, currentIndex - lookback), currentIndex);

    const lows = recentCandles
      .map((c) => c.low)
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
      breakoutDistance >= OPTIMAL_BREAKOUT_MIN && breakoutDistance <= OPTIMAL_BREAKOUT_MAX;
    const breakoutBonus = optimalBreakout ? BREAKOUT_BONUS : 0;

    const totalConfidence = baseConfidence + reversalBonus + volumeBonus + emaBonus + breakoutBonus;

    return Math.min(MAX_CONFIDENCE, Math.max(BASE_CONFIDENCE, totalConfidence));
  }
}
