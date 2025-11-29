import { calculateEMA } from '@renderer/utils/movingAverages';
import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle } from '@shared/types';
import { BaseSetupDetector, type SetupDetectorResult } from './BaseSetupDetector';

const VOLUME_LOOKBACK = 20;
const MIN_TRAP_DISTANCE_PERCENT = 0.001;
const MAX_TRAP_DISTANCE_PERCENT = 0.02;
const MIN_REVERSAL_STRENGTH = 0.5;
const MIN_LOW_PIVOTS = 2;
const STOP_LOSS_BUFFER = 0.998;
const DEFAULT_RR_MULTIPLIER = 2.5;
const BASE_CONFIDENCE = 60;
const MIN_CONFIDENCE_THRESHOLD = 70;
const REVERSAL_CONFIDENCE_WEIGHT = 15;
const VOLUME_CONFIDENCE_BONUS = 10;
const EMA_CONFIRMATION_BONUS = 10;
const BREAKOUT_BONUS = 5;
const MAX_CONFIDENCE = 95;
const RESISTANCE_LOOKBACK = 50;
const CLUSTER_THRESHOLD_PERCENT = 0.005;
const BREAKOUT_DISTANCE_TO_PERCENT = 100;
const OPTIMAL_BREAKOUT_MIN = 0.003;
const OPTIMAL_BREAKOUT_MAX = 0.01;

export interface BearTrapConfig {
  enabled: boolean;
  minConfidence: number;
  minRiskReward: number;
  volumeMultiplier: number;
  lookbackPeriod: number;
  emaPeriod: number;
}

export const createDefaultBearTrapConfig = (): BearTrapConfig => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.5,
  volumeMultiplier: 1.3,
  lookbackPeriod: 20,
  emaPeriod: 20,
});

export class BearTrapDetector extends BaseSetupDetector {
  private bearTrapConfig: BearTrapConfig;

  constructor(config: BearTrapConfig) {
    super(config);
    this.bearTrapConfig = config;
  }

  updateConfig(config: BearTrapConfig): void {
    this.config = config;
    this.bearTrapConfig = config;
  }

  getConfig(): BearTrapConfig {
    return this.bearTrapConfig;
  }

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.bearTrapConfig.lookbackPeriod + this.bearTrapConfig.emaPeriod,
      RESISTANCE_LOOKBACK + VOLUME_LOOKBACK,
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
      this.bearTrapConfig.lookbackPeriod,
    );

    const recentLowPivots = this.getRecentLowPivots(pivots, currentIndex);
    if (recentLowPivots.length < MIN_LOW_PIVOTS) {
      return null;
    }

    const trap = this.validateTrapStructure(recentLowPivots, candles, currentIndex);
    if (!trap) {
      return null;
    }

    return this.createTrapSetup(trap, candles, currentIndex);
  }

  private getRecentLowPivots(
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): ReturnType<typeof findPivotPoints> {
    return pivots
      .filter((p) => p.type === 'low')
      .filter((p) => p.index >= currentIndex - this.bearTrapConfig.lookbackPeriod)
      .sort((a, b) => b.index - a.index);
  }

  private validateTrapStructure(
    lowPivots: ReturnType<typeof findPivotPoints>,
    candles: Candle[],
    currentIndex: number,
  ): {
    trapLow: { price: number; index: number };
    supportLow: { price: number };
    breakoutDistance: number;
    reversalStrength: number;
    current: Candle;
  } | null {
    const trapLow = lowPivots[0];
    const supportLow = lowPivots[1];
    const current = candles[currentIndex];

    if (!trapLow || !supportLow || !current) {
      return null;
    }

    const fakeBreakdown = trapLow.price < supportLow.price;
    const breakoutDistance = (supportLow.price - trapLow.price) / supportLow.price;
    const reversalInProgress = current.close > supportLow.price;
    const reversalStrength = (current.close - trapLow.price) / (current.high - trapLow.price);

    const validBreakoutDistance =
      breakoutDistance >= MIN_TRAP_DISTANCE_PERCENT &&
      breakoutDistance <= MAX_TRAP_DISTANCE_PERCENT;

    const validReversal = reversalStrength >= MIN_REVERSAL_STRENGTH;

    if (!fakeBreakdown || !validBreakoutDistance || !reversalInProgress || !validReversal) {
      return null;
    }

    return { trapLow, supportLow, breakoutDistance, reversalStrength, current };
  }

  private createTrapSetup(
    trap: {
      trapLow: { price: number; index: number };
      supportLow: { price: number };
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
      trap.current.volume > avgVolume * this.bearTrapConfig.volumeMultiplier;

    const ema = calculateEMA(candles, this.bearTrapConfig.emaPeriod);
    const emaCurrent = ema[currentIndex];

    if (emaCurrent === null || emaCurrent === undefined) {
      return null;
    }

    const aboveEMA = trap.current.close > emaCurrent;
    const entry = trap.current.close;
    const stopLoss = trap.trapLow.price * STOP_LOSS_BUFFER;
    const resistanceLevel = this.findNearestResistance(candles, currentIndex, entry);
    const takeProfit = resistanceLevel ?? entry + (entry - stopLoss) * DEFAULT_RR_MULTIPLIER;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(MIN_CONFIDENCE_THRESHOLD, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      trap.reversalStrength,
      volumeConfirmation,
      aboveEMA,
      trap.breakoutDistance,
    );

    if (!this.meetsMinimumCriteria(confidence, rr)) {
      return null;
    }

    const setup = this.createSetup(
      'bear-trap',
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
    candles: Candle[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(RESISTANCE_LOOKBACK, currentIndex);
    const recentCandles = candles.slice(Math.max(0, currentIndex - lookback), currentIndex);

    const highs = recentCandles
      .map((c) => c.high)
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
    const baseConfidence = BASE_CONFIDENCE;
    const reversalBonus = reversalStrength * REVERSAL_CONFIDENCE_WEIGHT;
    const volumeBonus = volumeConfirmation ? VOLUME_CONFIDENCE_BONUS : 0;
    const emaBonus = aboveEMA ? EMA_CONFIRMATION_BONUS : 0;

    const optimalBreakout =
      breakoutDistance >= OPTIMAL_BREAKOUT_MIN && breakoutDistance <= OPTIMAL_BREAKOUT_MAX;
    const breakoutBonus = optimalBreakout ? BREAKOUT_BONUS : 0;

    const totalConfidence = baseConfidence + reversalBonus + volumeBonus + emaBonus + breakoutBonus;

    return Math.min(MAX_CONFIDENCE, Math.max(BASE_CONFIDENCE, totalConfidence));
  }
}
