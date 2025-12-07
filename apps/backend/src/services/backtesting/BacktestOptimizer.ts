import type { BacktestConfig, BacktestResult, BacktestMetrics } from '@marketmind/types';
import { BacktestEngine } from './BacktestEngine';
import { ParameterGenerator, type ParameterCombination } from './ParameterGenerator';

export interface OptimizationConfig {
  baseConfig: BacktestConfig;
  parameterGrid: Record<string, number[]>;
  parallelWorkers?: number;
  sortBy?: keyof BacktestMetrics;
  onProgress?: (current: number, total: number) => void;
}

export interface OptimizationResult {
  params: ParameterCombination;
  config: BacktestConfig;
  result: BacktestResult;
  metrics: BacktestMetrics;
}

export class BacktestOptimizer {
  private engine: BacktestEngine;

  constructor() {
    this.engine = new BacktestEngine();
  }

  /**
   * Run grid search optimization
   * @param config - Optimization configuration
   * @param klines - Optional pre-fetched klines (for performance)
   * @returns Array of optimization results sorted by the specified metric
   */
  async optimize(
    config: OptimizationConfig,
    klines?: any[]
  ): Promise<OptimizationResult[]> {
    const { baseConfig, parameterGrid, parallelWorkers = 1, sortBy = 'totalPnlPercent', onProgress } = config;

    // Validate parameter grid
    ParameterGenerator.validate(parameterGrid);

    // Generate all parameter combinations
    const combinations = ParameterGenerator.generateGrid(parameterGrid);
    const totalCombinations = combinations.length;

    console.log(`[Optimizer] Generated ${totalCombinations} parameter combinations`);
    console.log(`[Optimizer] Parallel workers: ${parallelWorkers}`);

    const results: OptimizationResult[] = [];
    let completed = 0;

    if (parallelWorkers > 1) {
      // Parallel execution
      const chunks = ParameterGenerator.chunk(combinations, parallelWorkers);

      for (const chunk of chunks) {
        const batchResults = await Promise.all(
          chunk.map(async (params) => {
            try {
              const result = await this.runSingle(baseConfig, params, klines);
              completed++;
              if (onProgress) {
                onProgress(completed, totalCombinations);
              }
              return result;
            } catch (error) {
              console.error('[Optimizer] Error running backtest with params:', params, error);
              completed++;
              if (onProgress) {
                onProgress(completed, totalCombinations);
              }
              return null;
            }
          })
        );

        // Filter out failed backtests
        results.push(...batchResults.filter((r): r is OptimizationResult => r !== null));
      }
    } else {
      // Sequential execution
      for (const params of combinations) {
        try {
          const result = await this.runSingle(baseConfig, params, klines);
          results.push(result);
          completed++;
          if (onProgress) {
            onProgress(completed, totalCombinations);
          }
        } catch (error) {
          console.error('[Optimizer] Error running backtest with params:', params, error);
          completed++;
          if (onProgress) {
            onProgress(completed, totalCombinations);
          }
        }
      }
    }

    // Sort by the specified metric (descending for most metrics)
    const sortedResults = this.sortResults(results, sortBy);

    console.log(`[Optimizer] Completed ${results.length}/${totalCombinations} backtests successfully`);

    return sortedResults;
  }

  /**
   * Run a single backtest with specific parameters
   * @private
   */
  private async runSingle(
    baseConfig: BacktestConfig,
    params: ParameterCombination,
    klines?: any[]
  ): Promise<OptimizationResult> {
    // Separate BacktestConfig-level params from strategy-specific params
    const backtestConfigParams: any = {};
    const strategyParams: Record<string, number> = {};

    for (const [key, value] of Object.entries(params)) {
      // BacktestConfig direct fields
      if (['stopLossPercent', 'takeProfitPercent', 'minConfidence', 'maxPositionSize', 'commission'].includes(key)) {
        backtestConfigParams[key] = value;
      } else {
        // Strategy-specific parameters (pivotLookback, volumeMultiplier, etc.)
        strategyParams[key] = value;
      }
    }

    // Merge base config with parameter combination
    const config: BacktestConfig = {
      ...baseConfig,
      ...backtestConfigParams,
      // Pass strategy-specific params separately so BacktestEngine can apply them
      strategyParams: Object.keys(strategyParams).length > 0 ? strategyParams : undefined,
    };

    // Run the backtest
    const result = await this.engine.run(config, klines);

    return {
      params,
      config,
      result,
      metrics: result.metrics,
    };
  }

  /**
   * Sort optimization results by a metric
   * @private
   */
  private sortResults(
    results: OptimizationResult[],
    sortBy: keyof BacktestMetrics
  ): OptimizationResult[] {
    // Metrics where lower is better
    const lowerIsBetter = ['maxDrawdown', 'maxDrawdownPercent', 'totalCommission'];

    const multiplier = lowerIsBetter.includes(sortBy) ? 1 : -1;

    return results.sort((a, b) => {
      const aValue = a.metrics[sortBy] as number;
      const bValue = b.metrics[sortBy] as number;

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      return multiplier * (bValue - aValue);
    });
  }

  /**
   * Get statistics about the optimization results
   */
  getStatistics(results: OptimizationResult[]) {
    if (results.length === 0) {
      return null;
    }

    const metrics = results.map((r) => r.metrics);

    const best = results[0];
    const worst = results[results.length - 1];

    const avgWinRate = metrics.reduce((sum, m) => sum + m.winRate, 0) / metrics.length;
    const avgPnl = metrics.reduce((sum, m) => sum + m.totalPnlPercent, 0) / metrics.length;
    const avgProfitFactor = metrics.reduce((sum, m) => sum + m.profitFactor, 0) / metrics.length;
    const avgSharpe = metrics.reduce((sum, m) => sum + (m.sharpeRatio || 0), 0) / metrics.length;

    return {
      totalRuns: results.length,
      best: {
        params: best!.params,
        metrics: best!.metrics,
      },
      worst: {
        params: worst!.params,
        metrics: worst!.metrics,
      },
      average: {
        winRate: avgWinRate,
        totalPnlPercent: avgPnl,
        profitFactor: avgProfitFactor,
        sharpeRatio: avgSharpe,
      },
    };
  }

  /**
   * Filter results by minimum criteria
   */
  filterResults(
    results: OptimizationResult[],
    criteria: {
      minWinRate?: number;
      minProfitFactor?: number;
      minSharpeRatio?: number;
      maxDrawdownPercent?: number;
      minTrades?: number;
    }
  ): OptimizationResult[] {
    return results.filter((result) => {
      const m = result.metrics;

      if (criteria.minWinRate != null && m.winRate < criteria.minWinRate) return false;
      if (criteria.minProfitFactor != null && m.profitFactor < criteria.minProfitFactor) return false;
      if (criteria.minSharpeRatio != null && (m.sharpeRatio || 0) < criteria.minSharpeRatio) return false;
      if (criteria.maxDrawdownPercent != null && m.maxDrawdownPercent > criteria.maxDrawdownPercent) return false;
      if (criteria.minTrades != null && m.totalTrades < criteria.minTrades) return false;

      return true;
    });
  }
}
