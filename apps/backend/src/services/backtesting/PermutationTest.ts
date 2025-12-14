/**
 * Monte Carlo Permutation Test
 *
 * Tests statistical significance of trading strategy results.
 * Shuffles trade returns N times and compares with actual results
 * to determine if performance is due to skill or chance.
 *
 * Process:
 * 1. Calculate actual strategy metric (Sharpe, PnL, etc.)
 * 2. Permute (shuffle) trade returns N times
 * 3. Calculate metric for each permutation
 * 4. Compute p-value: % of permutations >= actual
 * 5. Strategy is significant if p-value < 0.05 (5%)
 *
 * References:
 * - Aronson, D. (2006) "Evidence-Based Technical Analysis"
 * - White, H. (2000) "A Reality Check for Data Snooping"
 */

import type { BacktestTrade } from '@marketmind/types';

export interface PermutationTestConfig {
  numPermutations: number;
  confidenceLevel: number;
  metric: 'sharpe' | 'totalReturn' | 'profitFactor' | 'winRate';
}

export interface PermutationTestResult {
  actualMetric: number;
  permutedMetrics: number[];
  pValue: number;
  percentile: number;
  isSignificant: boolean;
  confidenceLevel: number;
  numPermutations: number;
  metric: string;
  statistics: {
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
  };
}

export class PermutationTest {
  private static readonly DEFAULT_CONFIG: PermutationTestConfig = {
    numPermutations: 1000,
    confidenceLevel: 0.95,
    metric: 'sharpe',
  };

  static run(
    trades: BacktestTrade[],
    initialCapital: number,
    config: Partial<PermutationTestConfig> = {}
  ): PermutationTestResult {
    const fullConfig = { ...this.DEFAULT_CONFIG, ...config };
    const { numPermutations, confidenceLevel, metric } = fullConfig;

    if (trades.length === 0) {
      throw new Error('No trades to test');
    }

    const returns = trades.map((t) => t.pnl ?? 0);
    const actualMetric = this.calculateMetric(returns, initialCapital, metric);

    const permutedMetrics: number[] = [];
    for (let i = 0; i < numPermutations; i++) {
      const randomizedReturns = this.generateRandomizedReturns(returns);
      const permutedMetric = this.calculateMetric(randomizedReturns, initialCapital, metric);
      permutedMetrics.push(permutedMetric);
    }

    const sortedPermuted = [...permutedMetrics].sort((a, b) => a - b);
    const countGreaterOrEqual = permutedMetrics.filter((m) => m >= actualMetric).length;
    const pValue = countGreaterOrEqual / numPermutations;
    const percentile = (sortedPermuted.filter((m) => m < actualMetric).length / numPermutations) * 100;
    const isSignificant = pValue < 1 - confidenceLevel;

    return {
      actualMetric,
      permutedMetrics,
      pValue,
      percentile,
      isSignificant,
      confidenceLevel,
      numPermutations,
      metric,
      statistics: {
        mean: this.mean(permutedMetrics),
        median: this.median(sortedPermuted),
        stdDev: this.stdDev(permutedMetrics),
        min: sortedPermuted[0] ?? 0,
        max: sortedPermuted[sortedPermuted.length - 1] ?? 0,
      },
    };
  }

  static runMultipleMetrics(
    trades: BacktestTrade[],
    initialCapital: number,
    numPermutations = 1000,
    confidenceLevel = 0.95
  ): Record<string, PermutationTestResult> {
    const metrics: Array<'sharpe' | 'totalReturn' | 'profitFactor' | 'winRate'> = [
      'sharpe',
      'totalReturn',
      'profitFactor',
      'winRate',
    ];

    const results: Record<string, PermutationTestResult> = {};
    for (const metric of metrics) {
      results[metric] = this.run(trades, initialCapital, {
        numPermutations,
        confidenceLevel,
        metric,
      });
    }

    return results;
  }

  private static calculateMetric(
    returns: number[],
    initialCapital: number,
    metric: string
  ): number {
    switch (metric) {
      case 'sharpe':
        return this.calculateSharpe(returns, initialCapital);
      case 'totalReturn':
        return this.calculateTotalReturn(returns, initialCapital);
      case 'profitFactor':
        return this.calculateProfitFactor(returns);
      case 'winRate':
        return this.calculateWinRate(returns);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  private static calculateSharpe(returns: number[], initialCapital: number): number {
    if (returns.length === 0) return 0;

    const percentReturns = returns.map((r) => r / initialCapital);
    const meanReturn = this.mean(percentReturns);
    const stdDev = this.stdDev(percentReturns);

    if (stdDev === 0) return 0;

    return (meanReturn / stdDev) * Math.sqrt(252);
  }

  private static calculateTotalReturn(returns: number[], initialCapital: number): number {
    const totalPnl = returns.reduce((sum, r) => sum + r, 0);
    return (totalPnl / initialCapital) * 100;
  }

  private static calculateProfitFactor(returns: number[]): number {
    const grossProfit = returns.filter((r) => r > 0).reduce((sum, r) => sum + r, 0);
    const grossLoss = Math.abs(returns.filter((r) => r <= 0).reduce((sum, r) => sum + r, 0));
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  }

  private static calculateWinRate(returns: number[]): number {
    if (returns.length === 0) return 0;
    const wins = returns.filter((r) => r > 0).length;
    return (wins / returns.length) * 100;
  }

  private static generateRandomizedReturns(returns: number[]): number[] {
    const positiveReturns = returns.filter((r) => r > 0);
    const negativeReturns = returns.filter((r) => r <= 0);
    const winRate = positiveReturns.length / returns.length;

    return returns.map(() => {
      if (Math.random() < winRate) {
        const idx = Math.floor(Math.random() * positiveReturns.length);
        const val = positiveReturns[idx];
        return (val ?? 0) * (0.5 + Math.random());
      } else {
        const idx = Math.floor(Math.random() * negativeReturns.length);
        const val = negativeReturns[idx];
        return (val ?? 0) * (0.5 + Math.random());
      }
    });
  }

  private static shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      const swapItem = array[j];
      if (temp !== undefined && swapItem !== undefined) {
        array[i] = swapItem;
        array[j] = temp;
      }
    }
    return array;
  }

  private static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private static median(sortedValues: number[]): number {
    if (sortedValues.length === 0) return 0;
    const mid = Math.floor(sortedValues.length / 2);
    const midValue = sortedValues[mid];
    const prevMidValue = sortedValues[mid - 1];
    if (sortedValues.length % 2 === 0 && midValue !== undefined && prevMidValue !== undefined) {
      return (prevMidValue + midValue) / 2;
    }
    return midValue ?? 0;
  }

  private static stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }
}
