/**
 * Walk-Forward Optimization
 *
 * Implements walk-forward analysis to prevent overfitting and validate strategy robustness.
 * Divides historical data into in-sample (training) and out-of-sample (testing) periods.
 *
 * Process:
 * 1. Split data into windows (e.g., 6 months training + 2 months testing)
 * 2. Optimize parameters on training window
 * 3. Validate on testing window (forward period)
 * 4. Move window forward and repeat
 * 5. Aggregate results across all windows
 *
 * References:
 * - Pardo, R. (2008) "The Evaluation and Optimization of Trading Strategies"
 * - Aronson, D. (2006) "Evidence-Based Technical Analysis"
 */

import type { Kline, BacktestConfig, BacktestResult } from '@marketmind/types';
import { BacktestEngine } from './BacktestEngine';

export interface WalkForwardConfig {
  trainingWindowMonths: number;
  testingWindowMonths: number;
  stepMonths: number;
  minWindowCount: number;
}

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface OptimizationResult {
  parameters: Record<string, number>;
  score: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
}

export interface WalkForwardWindow {
  windowIndex: number;
  trainingStart: number;
  trainingEnd: number;
  testingStart: number;
  testingEnd: number;
  trainingKlines: Kline[];
  testingKlines: Kline[];
  optimizationResult: OptimizationResult | null;
  testResult: BacktestResult | null;
}

export interface WalkForwardResult {
  windows: WalkForwardWindow[];
  aggregatedMetrics: {
    avgInSampleSharpe: number;
    avgOutOfSampleSharpe: number;
    degradation: number;
    totalTrades: number;
    overallWinRate: number;
    overallProfitFactor: number;
    overallMaxDrawdown: number;
  };
  isRobust: boolean;
  degradationThreshold: number;
}

export class WalkForwardOptimizer {
  private static readonly DEFAULT_CONFIG: WalkForwardConfig = {
    trainingWindowMonths: 6,
    testingWindowMonths: 2,
    stepMonths: 2,
    minWindowCount: 3,
  };

  private static readonly DEGRADATION_THRESHOLD = 0.3;

  /**
   * Split data into walk-forward windows
   */
  static createWindows(
    klines: Kline[],
    config: WalkForwardConfig = this.DEFAULT_CONFIG
  ): WalkForwardWindow[] {
    const { trainingWindowMonths, testingWindowMonths, stepMonths, minWindowCount } = config;

    const monthMs = 30 * 24 * 60 * 60 * 1000;
    const trainingWindowMs = trainingWindowMonths * monthMs;
    const testingWindowMs = testingWindowMonths * monthMs;
    const stepMs = stepMonths * monthMs;

    if (klines.length === 0) return [];

    const firstKline = klines[0];
    const lastKline = klines[klines.length - 1];

    if (!firstKline || !lastKline) return [];

    const startTime = firstKline.openTime;
    const endTime = lastKline.openTime;
    const totalDuration = endTime - startTime;

    const totalWindowDuration = trainingWindowMs + testingWindowMs;

    if (totalDuration < totalWindowDuration) {
      throw new Error('Insufficient data for walk-forward analysis');
    }

    const windows: WalkForwardWindow[] = [];
    let windowIndex = 0;
    let currentStart = startTime;

    while (currentStart + totalWindowDuration <= endTime) {
      const trainingStart = currentStart;
      const trainingEnd = trainingStart + trainingWindowMs;
      const testingStart = trainingEnd;
      const testingEnd = testingStart + testingWindowMs;

      const trainingKlines = klines.filter(
        (k) => k.openTime >= trainingStart && k.openTime < trainingEnd
      );
      const testingKlines = klines.filter(
        (k) => k.openTime >= testingStart && k.openTime < testingEnd
      );

      if (trainingKlines.length === 0 || testingKlines.length === 0) {
        currentStart += stepMs;
        continue;
      }

      windows.push({
        windowIndex,
        trainingStart,
        trainingEnd,
        testingStart,
        testingEnd,
        trainingKlines,
        testingKlines,
        optimizationResult: null,
        testResult: null,
      });

      windowIndex++;
      currentStart += stepMs;
    }

    if (windows.length < minWindowCount) {
      throw new Error(
        `Insufficient windows (${windows.length}). Minimum required: ${minWindowCount}`
      );
    }

    return windows;
  }

  /**
   * Optimize parameters on training data using grid search
   */
  static async optimizeWindow(
    window: WalkForwardWindow,
    baseConfig: BacktestConfig,
    parameterRanges: ParameterRange[]
  ): Promise<OptimizationResult> {
    const parameterCombinations = this.generateParameterCombinations(parameterRanges);

    let bestResult: OptimizationResult | null = null;

    const engine = new BacktestEngine();

    for (const params of parameterCombinations) {
      const config = this.applyParameters(baseConfig, params);

      // Override dates to use training window
      const trainingConfig: BacktestConfig = {
        ...config,
        startDate: new Date(window.trainingStart).toISOString(),
        endDate: new Date(window.trainingEnd).toISOString(),
      };

      const result = await engine.run(trainingConfig, window.trainingKlines);

      if (result.status === 'FAILED') continue;

      const score = this.calculateScore(result);

      if (!bestResult || score > bestResult.score) {
        bestResult = {
          parameters: params,
          score,
          sharpeRatio: result.metrics.sharpeRatio ?? 0,
          profitFactor: result.metrics.profitFactor,
          maxDrawdown: result.metrics.maxDrawdown,
        };
      }
    }

    if (!bestResult) {
      throw new Error('Optimization failed: no valid results');
    }

    return bestResult;
  }

  /**
   * Test optimized parameters on out-of-sample data
   */
  static async testWindow(
    window: WalkForwardWindow,
    baseConfig: BacktestConfig,
    optimizedParams: Record<string, number>
  ): Promise<BacktestResult> {
    const config = this.applyParameters(baseConfig, optimizedParams);

    // Override dates to use testing window
    const testingConfig: BacktestConfig = {
      ...config,
      startDate: new Date(window.testingStart).toISOString(),
      endDate: new Date(window.testingEnd).toISOString(),
    };

    const engine = new BacktestEngine();
    return engine.run(testingConfig, window.testingKlines);
  }

  /**
   * Run complete walk-forward analysis
   */
  static async run(
    klines: Kline[],
    baseConfig: BacktestConfig,
    parameterRanges: ParameterRange[],
    wfConfig: WalkForwardConfig = this.DEFAULT_CONFIG
  ): Promise<WalkForwardResult> {
    const windows = this.createWindows(klines, wfConfig);

    for (const window of windows) {
      const optimizationResult = await this.optimizeWindow(window, baseConfig, parameterRanges);
      window.optimizationResult = optimizationResult;

      const testResult = await this.testWindow(window, baseConfig, optimizationResult.parameters);
      window.testResult = testResult;
    }

    const aggregatedMetrics = this.calculateAggregatedMetrics(windows);

    const degradation = this.calculateDegradation(windows);
    const isRobust = degradation <= this.DEGRADATION_THRESHOLD;

    return {
      windows,
      aggregatedMetrics,
      isRobust,
      degradationThreshold: this.DEGRADATION_THRESHOLD,
    };
  }

  /**
   * Generate all parameter combinations for grid search
   */
  private static generateParameterCombinations(
    ranges: ParameterRange[]
  ): Array<Record<string, number>> {
    if (ranges.length === 0) return [{}];

    const combinations: Array<Record<string, number>> = [];

    const generate = (index: number, current: Record<string, number>) => {
      if (index === ranges.length) {
        combinations.push({ ...current });
        return;
      }

      const range = ranges[index];
      if (!range) return;
      for (let value = range.min; value <= range.max; value += range.step) {
        current[range.name] = value;
        generate(index + 1, current);
      }
    };

    generate(0, {});
    return combinations;
  }

  /**
   * Apply parameters to config
   */
  private static applyParameters(
    baseConfig: BacktestConfig,
    params: Record<string, number>
  ): BacktestConfig {
    return {
      ...baseConfig,
      ...params,
    };
  }

  /**
   * Calculate optimization score (higher is better)
   */
  private static calculateScore(result: BacktestResult): number {
    const { sharpeRatio, profitFactor, maxDrawdown } = result.metrics;

    const sharpeWeight = 0.4;
    const profitFactorWeight = 0.3;
    const drawdownWeight = 0.3;

    const normalizedSharpe = Math.max(0, Math.min((sharpeRatio ?? 0) / 3, 1));
    const normalizedPF = Math.max(0, Math.min((profitFactor - 1) / 2, 1));
    const normalizedDD = Math.max(0, 1 - maxDrawdown);

    return (
      normalizedSharpe * sharpeWeight +
      normalizedPF * profitFactorWeight +
      normalizedDD * drawdownWeight
    );
  }

  /**
   * Calculate aggregated metrics across all windows
   */
  private static calculateAggregatedMetrics(windows: WalkForwardWindow[]) {
    const inSampleSharpes = windows
      .map((w) => w.optimizationResult?.sharpeRatio || 0)
      .filter((s) => !isNaN(s));

    const outOfSampleSharpes = windows
      .map((w) => w.testResult?.metrics.sharpeRatio || 0)
      .filter((s) => !isNaN(s));

    const avgInSampleSharpe =
      inSampleSharpes.reduce((sum, s) => sum + s, 0) / inSampleSharpes.length || 0;
    const avgOutOfSampleSharpe =
      outOfSampleSharpes.reduce((sum, s) => sum + s, 0) / outOfSampleSharpes.length || 0;

    const degradation =
      avgInSampleSharpe > 0 ? (avgInSampleSharpe - avgOutOfSampleSharpe) / avgInSampleSharpe : 0;

    const allTestResults = windows.map((w) => w.testResult).filter((r) => r !== null);

    const totalTrades = allTestResults.reduce((sum, r) => sum + r!.trades.length, 0);

    const totalWins = allTestResults.reduce(
      (sum, r) => sum + r!.trades.filter((t) => (t.pnl ?? 0) > 0).length,
      0
    );
    const overallWinRate = totalTrades > 0 ? totalWins / totalTrades : 0;

    const totalGross = allTestResults.reduce(
      (sum, r) => sum + r!.trades.filter((t) => (t.pnl ?? 0) > 0).reduce((s, t) => s + (t.pnl ?? 0), 0),
      0
    );
    const totalLoss = Math.abs(
      allTestResults.reduce(
        (sum, r) => sum + r!.trades.filter((t) => (t.pnl ?? 0) <= 0).reduce((s, t) => s + (t.pnl ?? 0), 0),
        0
      )
    );
    const overallProfitFactor = totalLoss > 0 ? totalGross / totalLoss : 0;

    const overallMaxDrawdown = Math.max(...allTestResults.map((r) => r!.metrics.maxDrawdown));

    return {
      avgInSampleSharpe,
      avgOutOfSampleSharpe,
      degradation,
      totalTrades,
      overallWinRate,
      overallProfitFactor,
      overallMaxDrawdown,
    };
  }

  /**
   * Calculate performance degradation (in-sample vs out-of-sample)
   */
  private static calculateDegradation(windows: WalkForwardWindow[]): number {
    const inSampleSharpes = windows
      .map((w) => w.optimizationResult?.sharpeRatio || 0)
      .filter((s) => !isNaN(s));

    const outOfSampleSharpes = windows
      .map((w) => w.testResult?.metrics.sharpeRatio || 0)
      .filter((s) => !isNaN(s));

    const avgInSample =
      inSampleSharpes.reduce((sum, s) => sum + s, 0) / inSampleSharpes.length || 0;
    const avgOutOfSample =
      outOfSampleSharpes.reduce((sum, s) => sum + s, 0) / outOfSampleSharpes.length || 0;

    if (avgInSample === 0) return 0;

    return (avgInSample - avgOutOfSample) / avgInSample;
  }
}
