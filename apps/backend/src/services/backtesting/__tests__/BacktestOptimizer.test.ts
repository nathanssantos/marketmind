import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BacktestOptimizer, type OptimizationConfig, type OptimizationResult } from '../BacktestOptimizer';
import type { BacktestConfig, BacktestMetrics, BacktestResult, Interval } from '@marketmind/types';

const mockRun = vi.fn();

vi.mock('../BacktestEngine', () => ({
  BacktestEngine: class MockBacktestEngine {
    run = mockRun;
  },
}));

const createBaseConfig = (): BacktestConfig => ({
  symbol: 'BTCUSDT',
  interval: '1d' as Interval,
  startDate: '2024-01-01',
  endDate: '2024-03-01',
  initialCapital: 10000,
  setupTypes: ['test-setup'],
});

const createMockResult = (config: BacktestConfig): BacktestResult => {
  const sl = (config as Record<string, number>).stopLossPercent ?? 2;
  const tp = (config as Record<string, number>).takeProfitPercent ?? 4;
  const score = tp / sl;

  return {
    id: 'test',
    status: 'SUCCESS',
    startDate: config.startDate,
    endDate: config.endDate,
    trades: [],
    metrics: {
      totalTrades: 50,
      winRate: 50 + score * 5,
      totalPnl: 1000 * score,
      totalPnlPercent: 10 * score,
      maxDrawdown: 500,
      maxDrawdownPercent: 5,
      profitFactor: 1 + score * 0.3,
      sharpeRatio: score,
      avgWin: 100,
      avgLoss: 50,
      avgWinPercent: 2,
      avgLossPercent: 1,
      largestWin: 300,
      largestLoss: 150,
      avgTradeDuration: 24,
      avgBarsInTrade: 6,
    } as BacktestMetrics,
    equityCurve: [],
    drawdownCurve: [],
    config,
  } as BacktestResult;
};

describe('BacktestOptimizer', () => {
  let optimizer: BacktestOptimizer;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRun.mockImplementation(async (config: BacktestConfig) => createMockResult(config));
    optimizer = new BacktestOptimizer();
  });

  describe('optimize', () => {
    it('should run optimization for all parameter combinations', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2],
          takeProfitPercent: [4, 6],
        },
      };

      const results = await optimizer.optimize(config);

      expect(results).toHaveLength(4);
    });

    it('should sort results by specified metric (default totalPnlPercent)', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2, 3],
          takeProfitPercent: [4],
        },
        sortBy: 'totalPnlPercent',
      };

      const results = await optimizer.optimize(config);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.metrics.totalPnlPercent).toBeGreaterThanOrEqual(
          results[i + 1]!.metrics.totalPnlPercent
        );
      }
    });

    it('should sort by maxDrawdown in ascending order', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2],
          takeProfitPercent: [4, 6],
        },
        sortBy: 'maxDrawdown',
      };

      const results = await optimizer.optimize(config);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i]!.metrics.maxDrawdown).toBeLessThanOrEqual(
          results[i + 1]!.metrics.maxDrawdown
        );
      }
    });

    it('should call progress callback', async () => {
      const onProgress = vi.fn();

      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2, 3],
        },
        onProgress,
      };

      await optimizer.optimize(config);

      expect(onProgress).toHaveBeenCalledTimes(3);
      expect(onProgress).toHaveBeenCalledWith(1, 3);
      expect(onProgress).toHaveBeenCalledWith(2, 3);
      expect(onProgress).toHaveBeenCalledWith(3, 3);
    });

    it('should support parallel execution', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2, 3, 4],
        },
        parallelWorkers: 2,
      };

      const results = await optimizer.optimize(config);

      expect(results).toHaveLength(4);
    });

    it('should throw error for empty parameter grid', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {},
      };

      await expect(optimizer.optimize(config)).rejects.toThrow('Parameter grid is empty');
    });

    it('should include params in result', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [2],
          takeProfitPercent: [6],
        },
      };

      const results = await optimizer.optimize(config);

      expect(results[0]!.params).toEqual({
        stopLossPercent: 2,
        takeProfitPercent: 6,
      });
    });
  });

  describe('getStatistics', () => {
    it('should return null for empty results', () => {
      const stats = optimizer.getStatistics([]);
      expect(stats).toBeNull();
    });

    it('should calculate statistics correctly', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2, 3],
          takeProfitPercent: [4, 6, 8],
        },
      };

      const results = await optimizer.optimize(config);
      const stats = optimizer.getStatistics(results);

      expect(stats).not.toBeNull();
      expect(stats!.totalRuns).toBe(9);
      expect(stats!.best.params).toBeDefined();
      expect(stats!.worst.params).toBeDefined();
      expect(stats!.average.winRate).toBeGreaterThan(0);
      expect(stats!.average.totalPnlPercent).toBeGreaterThan(0);
      expect(stats!.average.profitFactor).toBeGreaterThan(0);
    });

    it('should identify best and worst correctly', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 3],
          takeProfitPercent: [4, 8],
        },
        sortBy: 'totalPnlPercent',
      };

      const results = await optimizer.optimize(config);
      const stats = optimizer.getStatistics(results);

      expect(stats!.best.metrics.totalPnlPercent).toBeGreaterThan(
        stats!.worst.metrics.totalPnlPercent
      );
    });
  });

  describe('filterResults', () => {
    let results: OptimizationResult[];

    beforeEach(async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [1, 2, 3],
          takeProfitPercent: [4, 6, 8],
        },
      };

      results = await optimizer.optimize(config);
    });

    it('should filter by minimum win rate', () => {
      const filtered = optimizer.filterResults(results, { minWinRate: 60 });
      filtered.forEach((r) => expect(r.metrics.winRate).toBeGreaterThanOrEqual(60));
    });

    it('should filter by minimum profit factor', () => {
      const filtered = optimizer.filterResults(results, { minProfitFactor: 1.5 });
      filtered.forEach((r) => expect(r.metrics.profitFactor).toBeGreaterThanOrEqual(1.5));
    });

    it('should filter by minimum Sharpe ratio', () => {
      const filtered = optimizer.filterResults(results, { minSharpeRatio: 3 });
      filtered.forEach((r) => expect(r.metrics.sharpeRatio ?? 0).toBeGreaterThanOrEqual(3));
    });

    it('should filter by maximum drawdown', () => {
      const filtered = optimizer.filterResults(results, { maxDrawdownPercent: 10 });
      filtered.forEach((r) => expect(r.metrics.maxDrawdownPercent).toBeLessThanOrEqual(10));
    });

    it('should filter by minimum trades', () => {
      const filtered = optimizer.filterResults(results, { minTrades: 40 });
      filtered.forEach((r) => expect(r.metrics.totalTrades).toBeGreaterThanOrEqual(40));
    });

    it('should apply multiple filters', () => {
      const filtered = optimizer.filterResults(results, {
        minWinRate: 55,
        minProfitFactor: 1.3,
        maxDrawdownPercent: 10,
      });

      filtered.forEach((r) => {
        expect(r.metrics.winRate).toBeGreaterThanOrEqual(55);
        expect(r.metrics.profitFactor).toBeGreaterThanOrEqual(1.3);
        expect(r.metrics.maxDrawdownPercent).toBeLessThanOrEqual(10);
      });
    });

    it('should return all results when no criteria specified', () => {
      const filtered = optimizer.filterResults(results, {});
      expect(filtered).toHaveLength(results.length);
    });
  });

  describe('parameter handling', () => {
    it('should separate backtest config fields from strategy params', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          stopLossPercent: [2],
          customStrategyParam: [10],
        },
      };

      await optimizer.optimize(config);

      const calledConfig = mockRun.mock.calls[0]?.[0] as BacktestConfig;
      expect(calledConfig.stopLossPercent).toBe(2);
      expect(calledConfig.strategyParams).toEqual({ customStrategyParam: 10 });
    });

    it('should convert maxTotalExposure to decimal', async () => {
      const config: OptimizationConfig = {
        baseConfig: createBaseConfig(),
        parameterGrid: {
          maxTotalExposure: [50],
        },
      };

      await optimizer.optimize(config);

      const calledConfig = mockRun.mock.calls[0]?.[0] as BacktestConfig;
      expect(calledConfig.maxTotalExposure).toBe(0.5);
    });
  });
});
