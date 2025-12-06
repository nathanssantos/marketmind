/**
 * Volatility-Adjusted Kelly Calculator
 * 
 * Adjusts Kelly Criterion position sizing based on market volatility.
 * Uses ATR (Average True Range) to measure volatility and scale position sizes.
 * 
 * Key Principles:
 * - High volatility → reduce position size (higher risk)
 * - Low volatility → increase position size (lower risk)
 * - Protects against volatile market conditions
 * - Maintains risk-adjusted returns
 * 
 * References:
 * - Wilder, J. W. (1978) "New Concepts in Technical Trading Systems"
 * - Pardo, R. (2008) "The Evaluation and Optimization of Trading Strategies"
 */

import type { Kline } from '@marketmind/types';

export interface VolatilityMetrics {
  atr: number;
  atrPercent: number;
  volatilityRank: number;
  volatilityScore: number;
  isHighVolatility: boolean;
  isLowVolatility: boolean;
}

export interface VolatilityAdjustedResult {
  originalKelly: number;
  adjustedKelly: number;
  scaleFactor: number;
  volatilityMetrics: VolatilityMetrics;
  recommendedPositionSize: number;
}

export class VolatilityAdjustedKelly {
  private static readonly ATR_PERIOD = 14;
  private static readonly HIGH_VOLATILITY_THRESHOLD = 0.75;
  private static readonly LOW_VOLATILITY_THRESHOLD = 0.25;
  private static readonly MIN_SCALE_FACTOR = 0.25;
  private static readonly MAX_SCALE_FACTOR = 1.5;
  private static readonly LOOKBACK_PERIOD = 100;

  /**
   * Calculate ATR (Average True Range)
   */
  static calculateATR(klines: Kline[], period = this.ATR_PERIOD): number {
    if (klines.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < klines.length; i++) {
      const current = klines[i];
      const previous = klines[i - 1];

      const highLow = Number(current!.high) - Number(current!.low);
      const highClose = Math.abs(Number(current!.high) - Number(previous!.close));
      const lowClose = Math.abs(Number(current!.low) - Number(previous!.close));

      const trueRange = Math.max(highLow, highClose, lowClose);
      trueRanges.push(trueRange);
    }

    const recentTR = trueRanges.slice(-period);
    const atr = recentTR.reduce((sum, tr) => sum + tr, 0) / period;

    return atr;
  }

  /**
   * Calculate ATR as percentage of price
   */
  static calculateATRPercent(klines: Kline[], period = this.ATR_PERIOD): number {
    if (klines.length === 0) return 0;

    const atr = this.calculateATR(klines, period);
    const currentPrice = Number(klines[klines.length - 1]!.close);

    if (currentPrice === 0) return 0;

    return (atr / currentPrice) * 100;
  }

  /**
   * Calculate volatility rank (percentile)
   */
  static calculateVolatilityRank(
    klines: Kline[],
    lookbackPeriod = this.LOOKBACK_PERIOD
  ): number {
    if (klines.length < lookbackPeriod) return 0.5;

    const recentKlines = klines.slice(-lookbackPeriod);
    const currentATR = this.calculateATR(recentKlines);

    const atrHistory: number[] = [];
    for (let i = this.ATR_PERIOD; i < recentKlines.length; i++) {
      const subset = recentKlines.slice(i - this.ATR_PERIOD, i);
      const historicalATR = this.calculateATR(subset);
      atrHistory.push(historicalATR);
    }

    if (atrHistory.length === 0) return 0.5;

    const lowerCount = atrHistory.filter((atr) => atr < currentATR).length;
    const rank = lowerCount / atrHistory.length;

    return rank;
  }

  /**
   * Calculate comprehensive volatility metrics
   */
  static calculateVolatilityMetrics(klines: Kline[]): VolatilityMetrics {
    const atr = this.calculateATR(klines);
    const atrPercent = this.calculateATRPercent(klines);
    const volatilityRank = this.calculateVolatilityRank(klines);

    const volatilityScore = volatilityRank;

    const isHighVolatility = volatilityScore > this.HIGH_VOLATILITY_THRESHOLD;
    const isLowVolatility = volatilityScore < this.LOW_VOLATILITY_THRESHOLD;

    return {
      atr,
      atrPercent,
      volatilityRank,
      volatilityScore,
      isHighVolatility,
      isLowVolatility,
    };
  }

  /**
   * Calculate volatility scale factor
   */
  static calculateVolatilityScaleFactor(volatilityMetrics: VolatilityMetrics): number {
    const { volatilityScore } = volatilityMetrics;

    const scaleFactor = 1 - volatilityScore * 0.5;

    const capped = Math.max(this.MIN_SCALE_FACTOR, Math.min(scaleFactor, this.MAX_SCALE_FACTOR));

    return capped;
  }

  /**
   * Adjust Kelly fraction based on volatility
   */
  static adjustKellyForVolatility(
    originalKelly: number,
    klines: Kline[],
    capital: number
  ): VolatilityAdjustedResult {
    const volatilityMetrics = this.calculateVolatilityMetrics(klines);
    const scaleFactor = this.calculateVolatilityScaleFactor(volatilityMetrics);

    const adjustedKelly = originalKelly * scaleFactor;

    const recommendedPositionSize = capital * adjustedKelly;

    return {
      originalKelly,
      adjustedKelly,
      scaleFactor,
      volatilityMetrics,
      recommendedPositionSize,
    };
  }

  /**
   * Calculate dynamic stop loss based on ATR
   */
  static calculateATRStopLoss(klines: Kline[], multiplier = 2): number {
    const atr = this.calculateATR(klines);
    const currentPrice = Number(klines[klines.length - 1]!.close);

    return currentPrice - atr * multiplier;
  }

  /**
   * Calculate dynamic take profit based on ATR
   */
  static calculateATRTakeProfit(klines: Kline[], multiplier = 3): number {
    const atr = this.calculateATR(klines);
    const currentPrice = Number(klines[klines.length - 1]!.close);

    return currentPrice + atr * multiplier;
  }

  /**
   * Calculate risk per trade based on ATR
   */
  static calculateATRRisk(klines: Kline[], capital: number, riskPercent = 1): number {
    const atr = this.calculateATR(klines);
    const currentPrice = Number(klines[klines.length - 1]!.close);

    if (currentPrice === 0 || atr === 0) return 0;

    const riskAmount = capital * (riskPercent / 100);

    const atrRiskPercent = (atr / currentPrice) * 100;

    if (atrRiskPercent === 0) return 0;

    return riskAmount / atrRiskPercent;
  }

  /**
   * Determine optimal position size using ATR and Kelly
   */
  static calculateOptimalPositionSize(
    kellyFraction: number,
    klines: Kline[],
    capital: number,
    maxRiskPercent = 2
  ): number {
    const volatilityAdjusted = this.adjustKellyForVolatility(kellyFraction, klines, capital);

    const atrRiskSize = this.calculateATRRisk(klines, capital, maxRiskPercent);

    const optimalSize = Math.min(volatilityAdjusted.recommendedPositionSize, atrRiskSize);

    return optimalSize;
  }

  /**
   * Calculate recommended leverage based on volatility
   */
  static calculateRecommendedLeverage(klines: Kline[], maxLeverage = 10): number {
    const volatilityMetrics = this.calculateVolatilityMetrics(klines);

    const baseLeverage = maxLeverage * (1 - volatilityMetrics.volatilityScore);

    const recommendedLeverage = Math.max(1, Math.min(baseLeverage, maxLeverage));

    return Math.round(recommendedLeverage * 10) / 10;
  }
}
