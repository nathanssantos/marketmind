/**
 * Monte Carlo Simulator
 * 
 * Performs Monte Carlo simulation on backtest results to:
 * - Assess statistical significance
 * - Calculate confidence intervals
 * - Estimate probability of specific outcomes
 * - Stress test strategy under different scenarios
 * 
 * Process:
 * 1. Take completed backtest trades
 * 2. Randomly shuffle trade order N times (1000+ simulations)
 * 3. Calculate metrics for each simulation
 * 4. Generate distribution of outcomes
 * 5. Calculate percentiles and confidence intervals
 * 
 * References:
 * - Vince, R. (1992) "The Mathematics of Money Management"
 * - Tharp, V. K. (1998) "Trade Your Way to Financial Freedom"
 */

import type { BacktestTrade } from '@marketmind/types';

export interface MonteCarloConfig {
  numSimulations: number;
  confidenceLevel: number;
}

export interface SimulationRun {
  runIndex: number;
  finalEquity: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  totalReturn: number;
  trades: BacktestTrade[];
}

export interface MonteCarloResult {
  simulations: SimulationRun[];
  statistics: {
    meanFinalEquity: number;
    medianFinalEquity: number;
    stdDevFinalEquity: number;
    meanMaxDrawdown: number;
    medianMaxDrawdown: number;
    meanSharpeRatio: number;
    medianSharpeRatio: number;
    meanTotalReturn: number;
    medianTotalReturn: number;
  };
  confidenceIntervals: {
    finalEquity: { lower: number; upper: number };
    maxDrawdown: { lower: number; upper: number };
    sharpeRatio: { lower: number; upper: number };
    totalReturn: { lower: number; upper: number };
  };
  probabilities: {
    profitableProbability: number;
    drawdownExceeds10Percent: number;
    drawdownExceeds20Percent: number;
    drawdownExceeds30Percent: number;
    returnExceeds10Percent: number;
    returnExceeds20Percent: number;
    returnExceeds50Percent: number;
  };
  worstCase: SimulationRun;
  bestCase: SimulationRun;
  medianCase: SimulationRun;
}

export class MonteCarloSimulator {
  private static readonly DEFAULT_CONFIG: MonteCarloConfig = {
    numSimulations: 1000,
    confidenceLevel: 0.95,
  };

  /**
   * Run Monte Carlo simulation on backtest trades
   */
  static simulate(
    trades: BacktestTrade[],
    initialCapital: number,
    config: MonteCarloConfig = this.DEFAULT_CONFIG
  ): MonteCarloResult {
    if (trades.length === 0) {
      throw new Error('No trades to simulate');
    }

    const simulations: SimulationRun[] = [];

    for (let i = 0; i < config.numSimulations; i++) {
      const shuffledTrades = this.shuffleTrades([...trades]);
      const run = this.runSimulation(shuffledTrades, initialCapital, i);
      simulations.push(run);
    }

    const statistics = this.calculateStatistics(simulations);
    const confidenceIntervals = this.calculateConfidenceIntervals(simulations, config.confidenceLevel);
    const probabilities = this.calculateProbabilities(simulations);

    const sortedByEquity = [...simulations].sort((a, b) => a.finalEquity - b.finalEquity);
    const worstCase = sortedByEquity[0];
    const bestCase = sortedByEquity[sortedByEquity.length - 1];
    const medianCase = sortedByEquity[Math.floor(sortedByEquity.length / 2)];

    if (!worstCase || !bestCase || !medianCase) {
      throw new Error('Insufficient simulation data');
    }

    return {
      simulations,
      statistics,
      confidenceIntervals,
      probabilities,
      worstCase,
      bestCase,
      medianCase,
    };
  }

  /**
   * Shuffle trades randomly (Fisher-Yates algorithm)
   */
  private static shuffleTrades(trades: BacktestTrade[]): BacktestTrade[] {
    const shuffled = [...trades];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      const swapItem = shuffled[j];
      if (temp && swapItem) {
        shuffled[i] = swapItem;
        shuffled[j] = temp;
      }
    }
    return shuffled;
  }

  /**
   * Run single simulation with shuffled trades
   */
  private static runSimulation(
    trades: BacktestTrade[],
    initialCapital: number,
    runIndex: number
  ): SimulationRun {
    let equity = initialCapital;
    let peak = initialCapital;
    let maxDrawdown = 0;

    const equityCurve: number[] = [initialCapital];

    trades.forEach((trade) => {
      equity += trade.pnl ?? 0;
      equityCurve.push(equity);

      if (equity > peak) {
        peak = equity;
      }

      const drawdown = (peak - equity) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    const totalReturn = (equity - initialCapital) / initialCapital;

    const sharpeRatio = this.calculateSharpeRatio(trades, initialCapital);
    const profitFactor = this.calculateProfitFactor(trades);

    return {
      runIndex,
      finalEquity: equity,
      maxDrawdown,
      sharpeRatio,
      profitFactor,
      totalReturn,
      trades,
    };
  }

  /**
   * Calculate Sharpe ratio for simulation
   */
  private static calculateSharpeRatio(trades: BacktestTrade[], initialCapital: number): number {
    if (trades.length === 0) return 0;

    const returns = trades.map((t) => (t.pnl ?? 0) / initialCapital);
    const meanReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;

    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    return (meanReturn / stdDev) * Math.sqrt(252);
  }

  /**
   * Calculate profit factor for simulation
   */
  private static calculateProfitFactor(trades: BacktestTrade[]): number {
    const grossProfit = trades.filter((t) => (t.pnl ?? 0) > 0).reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(trades.filter((t) => (t.pnl ?? 0) <= 0).reduce((sum, t) => sum + (t.pnl ?? 0), 0));

    return grossLoss > 0 ? grossProfit / grossLoss : 0;
  }

  /**
   * Calculate statistics across all simulations
   */
  private static calculateStatistics(simulations: SimulationRun[]) {
    const finalEquities = simulations.map((s) => s.finalEquity);
    const maxDrawdowns = simulations.map((s) => s.maxDrawdown);
    const sharpeRatios = simulations.map((s) => s.sharpeRatio);
    const totalReturns = simulations.map((s) => s.totalReturn);

    return {
      meanFinalEquity: this.mean(finalEquities),
      medianFinalEquity: this.median(finalEquities),
      stdDevFinalEquity: this.stdDev(finalEquities),
      meanMaxDrawdown: this.mean(maxDrawdowns),
      medianMaxDrawdown: this.median(maxDrawdowns),
      meanSharpeRatio: this.mean(sharpeRatios),
      medianSharpeRatio: this.median(sharpeRatios),
      meanTotalReturn: this.mean(totalReturns),
      medianTotalReturn: this.median(totalReturns),
    };
  }

  /**
   * Calculate confidence intervals
   */
  private static calculateConfidenceIntervals(
    simulations: SimulationRun[],
    confidenceLevel: number
  ) {
    const alpha = 1 - confidenceLevel;
    const lowerPercentile = alpha / 2;
    const upperPercentile = 1 - alpha / 2;

    const finalEquities = simulations.map((s) => s.finalEquity).sort((a, b) => a - b);
    const maxDrawdowns = simulations.map((s) => s.maxDrawdown).sort((a, b) => a - b);
    const sharpeRatios = simulations.map((s) => s.sharpeRatio).sort((a, b) => a - b);
    const totalReturns = simulations.map((s) => s.totalReturn).sort((a, b) => a - b);

    return {
      finalEquity: {
        lower: this.percentile(finalEquities, lowerPercentile),
        upper: this.percentile(finalEquities, upperPercentile),
      },
      maxDrawdown: {
        lower: this.percentile(maxDrawdowns, lowerPercentile),
        upper: this.percentile(maxDrawdowns, upperPercentile),
      },
      sharpeRatio: {
        lower: this.percentile(sharpeRatios, lowerPercentile),
        upper: this.percentile(sharpeRatios, upperPercentile),
      },
      totalReturn: {
        lower: this.percentile(totalReturns, lowerPercentile),
        upper: this.percentile(totalReturns, upperPercentile),
      },
    };
  }

  /**
   * Calculate probabilities of specific outcomes
   */
  private static calculateProbabilities(simulations: SimulationRun[]) {
    const total = simulations.length;

    return {
      profitableProbability:
        simulations.filter((s) => s.totalReturn > 0).length / total,
      drawdownExceeds10Percent:
        simulations.filter((s) => s.maxDrawdown > 0.1).length / total,
      drawdownExceeds20Percent:
        simulations.filter((s) => s.maxDrawdown > 0.2).length / total,
      drawdownExceeds30Percent:
        simulations.filter((s) => s.maxDrawdown > 0.3).length / total,
      returnExceeds10Percent:
        simulations.filter((s) => s.totalReturn > 0.1).length / total,
      returnExceeds20Percent:
        simulations.filter((s) => s.totalReturn > 0.2).length / total,
      returnExceeds50Percent:
        simulations.filter((s) => s.totalReturn > 0.5).length / total,
    };
  }

  /**
   * Calculate mean of array
   */
  private static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Calculate median of array
   */
  private static median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const midValue = sorted[mid];
    const prevMidValue = sorted[mid - 1];
    if (sorted.length % 2 === 0 && midValue !== undefined && prevMidValue !== undefined) {
      return (prevMidValue + midValue) / 2;
    }
    return midValue ?? 0;
  }

  /**
   * Calculate standard deviation
   */
  private static stdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const avg = this.mean(values);
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Calculate percentile
   */
  private static percentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;
    const index = Math.floor(sortedValues.length * percentile);
    return sortedValues[Math.min(index, sortedValues.length - 1)] ?? 0;
  }

  /**
   * Get distribution buckets for histogram
   */
  static getDistribution(
    simulations: SimulationRun[],
    metric: 'finalEquity' | 'maxDrawdown' | 'sharpeRatio' | 'totalReturn',
    numBuckets = 20
  ): Array<{ bucket: string; count: number; percentage: number }> {
    const values = simulations.map((s) => s[metric]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = (max - min) / numBuckets;

    const buckets = Array.from({ length: numBuckets }, (_, i) => ({
      bucket: `${(min + i * bucketSize).toFixed(2)}-${(min + (i + 1) * bucketSize).toFixed(2)}`,
      count: 0,
      percentage: 0,
    }));

    values.forEach((value) => {
      if (bucketSize === 0) {
        const firstBucket = buckets[0];
        if (firstBucket) {
          firstBucket.count++;
        }
        return;
      }
      const bucketIndex = Math.min(
        Math.max(0, Math.floor((value - min) / bucketSize)),
        numBuckets - 1
      );
      const bucket = buckets[bucketIndex];
      if (bucket) {
        bucket.count++;
      }
    });

    buckets.forEach((bucket) => {
      bucket.percentage = bucket.count / values.length;
    });

    return buckets;
  }
}
