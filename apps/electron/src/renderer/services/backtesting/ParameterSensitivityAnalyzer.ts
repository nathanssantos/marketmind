/**
 * Parameter Sensitivity Analyzer
 * 
 * Analyzes strategy robustness by testing parameter variations:
 * - Identifies critical vs robust parameters
 * - Generates sensitivity heatmaps
 * - Tests parameter ranges systematically
 * - Measures performance degradation
 * 
 * Process:
 * 1. Define parameter ranges to test
 * 2. Run backtests for each parameter combination
 * 3. Analyze performance across variations
 * 4. Identify stable parameter regions
 * 5. Flag over-optimized parameters
 * 
 * References:
 * - Pardo, R. (2008) "The Evaluation and Optimization of Trading Strategies"
 * - Aronson, D. (2006) "Evidence-Based Technical Analysis"
 */

import type { BacktestConfig, BacktestResult } from '@marketmind/types';

export interface ParameterRange {
  name: string;
  min: number;
  max: number;
  step: number;
}

export interface ParameterTestConfig {
  baseConfig: BacktestConfig;
  parametersToTest: ParameterRange[];
  metric: 'sharpeRatio' | 'totalReturn' | 'profitFactor' | 'winRate';
}

export interface ParameterTestResult {
  parameters: Record<string, number>;
  result: BacktestResult;
  metricValue: number;
}

export interface SensitivityAnalysis {
  parameterName: string;
  results: Array<{
    parameterValue: number;
    metricValue: number;
    percentageChange: number;
  }>;
  sensitivity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  maxDeviation: number;
  avgDeviation: number;
  recommendedRange: {
    min: number;
    max: number;
  };
}

export interface SensitivityResult {
  allTests: ParameterTestResult[];
  parameterAnalyses: SensitivityAnalysis[];
  bestParameters: Record<string, number>;
  worstParameters: Record<string, number>;
  robustnessScore: number;
  heatmap?: Array<{
    param1Value: number;
    param2Value: number;
    metricValue: number;
  }>;
}

export class ParameterSensitivityAnalyzer {
  private static readonly SENSITIVITY_THRESHOLDS = {
    LOW: 0.1,
    MEDIUM: 0.25,
    HIGH: 0.5,
    CRITICAL: 1.0,
  };

  /**
   * Analyze parameter sensitivity
   */
  static async analyze(
    config: ParameterTestConfig,
    backtestRunner: (config: BacktestConfig) => Promise<BacktestResult>
  ): Promise<SensitivityResult> {
    const allTests: ParameterTestResult[] = [];

    const parameterCombinations = this.generateParameterCombinations(config.parametersToTest);

    for (const params of parameterCombinations) {
      const testConfig = this.applyParameters(config.baseConfig, params);
      const result = await backtestRunner(testConfig);
      const metricValue = this.extractMetric(result, config.metric);

      allTests.push({
        parameters: params,
        result,
        metricValue,
      });
    }

    const parameterAnalyses = config.parametersToTest.map((paramRange) =>
      this.analyzeParameter(paramRange, allTests, config.metric)
    );

    const sortedByMetric = [...allTests].sort((a, b) => b.metricValue - a.metricValue);
    const bestTest = sortedByMetric[0];
    const worstTest = sortedByMetric[sortedByMetric.length - 1];
    if (!bestTest || !worstTest) {
      throw new Error('No test results available');
    }
    const bestParameters = bestTest.parameters;
    const worstParameters = worstTest.parameters;

    const robustnessScore = this.calculateRobustnessScore(parameterAnalyses);

    let heatmap;
    if (config.parametersToTest.length === 2) {
      heatmap = this.generateHeatmap(allTests, config.parametersToTest);
    }

    return {
      allTests,
      parameterAnalyses,
      bestParameters,
      worstParameters,
      robustnessScore,
      heatmap,
    };
  }

  /**
   * Generate all parameter combinations
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
   * Apply parameter values to config
   */
  private static applyParameters(
    baseConfig: BacktestConfig,
    parameters: Record<string, number>
  ): BacktestConfig {
    return {
      ...baseConfig,
      ...parameters,
    };
  }

  /**
   * Extract metric value from backtest result
   */
  private static extractMetric(
    result: BacktestResult,
    metric: 'sharpeRatio' | 'totalReturn' | 'profitFactor' | 'winRate'
  ): number {
    switch (metric) {
      case 'sharpeRatio':
        return result.metrics.sharpeRatio ?? 0;
      case 'totalReturn':
        return result.metrics.totalPnlPercent;
      case 'profitFactor':
        return result.metrics.profitFactor;
      case 'winRate':
        return result.metrics.winRate;
    }
  }

  /**
   * Analyze single parameter sensitivity
   */
  private static analyzeParameter(
    paramRange: ParameterRange,
    allTests: ParameterTestResult[],
    _metric: string
  ): SensitivityAnalysis {
    const parameterTests = allTests
      .filter((test) => test.parameters[paramRange.name] !== undefined)
      .map((test) => ({
        parameterValue: test.parameters[paramRange.name],
        metricValue: test.metricValue,
      }))
      .sort((a, b) => (a.parameterValue ?? 0) - (b.parameterValue ?? 0));

    if (parameterTests.length === 0) {
      return {
        parameterName: paramRange.name,
        results: [],
        sensitivity: 'LOW',
        maxDeviation: 0,
        avgDeviation: 0,
        recommendedRange: { min: paramRange.min, max: paramRange.max },
      };
    }

    const avgMetric =
      parameterTests.reduce((sum, t) => sum + t.metricValue, 0) / parameterTests.length;

    const results = parameterTests.map((test) => ({
      parameterValue: test.parameterValue ?? 0,
      metricValue: test.metricValue,
      percentageChange: avgMetric !== 0 ? (test.metricValue - avgMetric) / Math.abs(avgMetric) : 0,
    }));

    const deviations = results.map((r) => Math.abs(r.percentageChange));
    const maxDeviation = Math.max(...deviations);
    const avgDeviation = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;

    const sensitivity = this.classifySensitivity(maxDeviation);

    const stableResults = results.filter((r) => Math.abs(r.percentageChange) < 0.2);
    const stableValues = stableResults.map((r) => r.parameterValue);
    const recommendedRange =
      stableResults.length > 0
        ? {
            min: Math.min(...stableValues),
            max: Math.max(...stableValues),
          }
        : { min: paramRange.min, max: paramRange.max };

    return {
      parameterName: paramRange.name,
      results,
      sensitivity,
      maxDeviation,
      avgDeviation,
      recommendedRange,
    };
  }

  /**
   * Classify parameter sensitivity
   */
  private static classifySensitivity(maxDeviation: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (maxDeviation >= this.SENSITIVITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
    if (maxDeviation >= this.SENSITIVITY_THRESHOLDS.HIGH) return 'HIGH';
    if (maxDeviation >= this.SENSITIVITY_THRESHOLDS.MEDIUM) return 'MEDIUM';
    return 'LOW';
  }

  /**
   * Calculate overall robustness score (0-100)
   */
  private static calculateRobustnessScore(analyses: SensitivityAnalysis[]): number {
    if (analyses.length === 0) return 0;

    const scores = analyses.map((analysis) => {
      switch (analysis.sensitivity) {
        case 'LOW':
          return 100;
        case 'MEDIUM':
          return 70;
        case 'HIGH':
          return 40;
        case 'CRITICAL':
          return 0;
      }
    });

    return scores.reduce((sum: number, score) => sum + score, 0) / scores.length;
  }

  /**
   * Generate 2D heatmap for two parameters
   */
  private static generateHeatmap(
    allTests: ParameterTestResult[],
    parameters: ParameterRange[]
  ): Array<{ param1Value: number; param2Value: number; metricValue: number }> | undefined {
    if (parameters.length !== 2) return undefined;

    const [param1, param2] = parameters;
    if (!param1 || !param2) return undefined;

    return allTests.map((test) => ({
      param1Value: test.parameters[param1.name] ?? 0,
      param2Value: test.parameters[param2.name] ?? 0,
      metricValue: test.metricValue,
    }));
  }

  /**
   * Find optimal parameter plateau (stable high-performance region)
   */
  static findOptimalPlateau(
    analysis: SensitivityAnalysis,
    minPlateauSize = 3
  ): { start: number; end: number; avgMetric: number } | null {
    if (analysis.results.length < minPlateauSize) return null;

    let bestPlateau: { start: number; end: number; avgMetric: number } | null = null;
    let bestScore = -Infinity;

    for (let i = 0; i <= analysis.results.length - minPlateauSize; i++) {
      for (let j = i + minPlateauSize - 1; j < analysis.results.length; j++) {
        const plateau = analysis.results.slice(i, j + 1);
        const avgMetric = plateau.reduce((sum, r) => sum + r.metricValue, 0) / plateau.length;
        const variance =
          plateau.reduce((sum, r) => sum + Math.pow(r.metricValue - avgMetric, 2), 0) /
          plateau.length;
        const stdDev = Math.sqrt(variance);

        const score = avgMetric - stdDev * 2;

        if (score > bestScore) {
          bestScore = score;
          const first = plateau[0];
          const last = plateau[plateau.length - 1];
          if (first && last) {
            bestPlateau = {
              start: first.parameterValue,
              end: last.parameterValue,
              avgMetric,
            };
          }
        }
      }
    }

    return bestPlateau;
  }

  /**
   * Detect over-optimization
   */
  static detectOverOptimization(analysis: SensitivityAnalysis): {
    isOverOptimized: boolean;
    reason: string;
  } {
    if (analysis.sensitivity === 'CRITICAL') {
      return {
        isOverOptimized: true,
        reason: `Parameter ${analysis.parameterName} shows critical sensitivity (>${this.SENSITIVITY_THRESHOLDS.CRITICAL * 100}% deviation)`,
      };
    }

    if (analysis.sensitivity === 'HIGH' && analysis.avgDeviation > 0.4) {
      return {
        isOverOptimized: true,
        reason: `Parameter ${analysis.parameterName} shows high average deviation (${(analysis.avgDeviation * 100).toFixed(1)}%)`,
      };
    }

    const stableResults = analysis.results.filter((r) => Math.abs(r.percentageChange) < 0.15);
    const stabilityRatio = stableResults.length / analysis.results.length;

    if (stabilityRatio < 0.3) {
      return {
        isOverOptimized: true,
        reason: `Only ${(stabilityRatio * 100).toFixed(1)}% of parameter values show stable performance`,
      };
    }

    return {
      isOverOptimized: false,
      reason: 'Parameter shows acceptable robustness',
    };
  }
}
