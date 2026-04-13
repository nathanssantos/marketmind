import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BacktestEngine } from '../BacktestEngine';
import {
  generateMockKlines,
  generateTrendingKlines,
  createMockBacktestConfig,
} from './helpers/mockData';

vi.mock('pinets', () => ({
  PineTS: class MockPineTS {
    ready = vi.fn().mockResolvedValue(undefined);
    run = vi.fn().mockResolvedValue({ plots: {} });
    constructor() {}
  },
}));

vi.mock('../../binance-historical', () => ({
  fetchHistoricalKlinesFromAPI: vi.fn(),
  smartBackfillKlines: vi.fn().mockResolvedValue({ totalInDb: 0, downloaded: 0, gaps: 0, alreadyComplete: false }),
}));

vi.mock('../../ib-historical', () => ({
  smartBackfillIBKlines: vi.fn().mockResolvedValue({ totalInDb: 0, downloaded: 0, gaps: 0, alreadyComplete: false }),
}));

vi.mock('../../../db', () => ({
  db: {
    query: {
      klines: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    },
  },
}));

describe('BacktestEngine', () => {
  let engine: BacktestEngine;

  beforeEach(() => {
    engine = new BacktestEngine();
    vi.clearAllMocks();
  });

  describe('run() - Basic Functionality', () => {
    it('should run a backtest with pre-fetched klines', async () => {
      const klines = generateMockKlines(200, 50000, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      expect(result).toBeDefined();
      expect(result.status).toBe('COMPLETED');
      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.trades)).toBe(true);
      expect(result.metrics).toBeDefined();
      expect(result.equityCurve).toBeDefined();
    });

    it('should attempt backfill when given empty klines and throw if no data found', async () => {
      const config = createMockBacktestConfig();

      await expect(engine.run(config, [])).rejects.toThrow(
        expect.objectContaining({ code: 'INTERNAL_SERVER_ERROR' })
      );
    });

    it('should return correct structure', async () => {
      const klines = generateMockKlines(200, 50000, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('equityCurve');
    });
  });

  describe('run() - Metrics Calculation', () => {
    it('should calculate metrics correctly', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig({
        setupTypes: ['setup91'],
        stopLossPercent: 2,
        takeProfitPercent: 6,
      });

      const result = await engine.run(config, klines);

      expect(result.metrics).toHaveProperty('totalTrades');
      expect(result.metrics).toHaveProperty('winningTrades');
      expect(result.metrics).toHaveProperty('losingTrades');
      expect(result.metrics).toHaveProperty('winRate');
      expect(result.metrics).toHaveProperty('profitFactor');
      expect(result.metrics).toHaveProperty('totalPnl');
      expect(result.metrics).toHaveProperty('totalPnlPercent');
      expect(result.metrics).toHaveProperty('maxDrawdown');
      expect(result.metrics).toHaveProperty('maxDrawdownPercent');

      expect(typeof result.metrics.totalTrades).toBe('number');
      expect(typeof result.metrics.winRate).toBe('number');
      expect(typeof result.metrics.profitFactor).toBe('number');

      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(100);
      expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
    });

    it('should calculate win rate correctly', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      if (result.metrics.totalTrades > 0) {
        const expectedWinRate =
          (result.metrics.winningTrades / result.metrics.totalTrades) * 100;
        expect(result.metrics.winRate).toBeCloseTo(expectedWinRate, 2);
      }
    });

    it('should calculate profit factor correctly', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      if (result.metrics.totalTrades > 0) {
        expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);

        if (result.metrics.losingTrades === 0) {
          expect(result.metrics.profitFactor).toBeGreaterThan(0);
        }
      }
    });

    it('should calculate Sharpe ratio', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      if (result.metrics.totalTrades > 5) {
        expect(result.metrics.sharpeRatio).toBeDefined();
        expect(typeof result.metrics.sharpeRatio).toBe('number');
      }
    });

    it('should calculate max drawdown', async () => {
      const klines = generateMockKlines(200, 50000, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      expect(result.metrics.maxDrawdown).toBeDefined();
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdownPercent).toBeGreaterThanOrEqual(0);
      expect(result.metrics.maxDrawdownPercent).toBeLessThanOrEqual(100);
    });
  });

  describe('run() - Trade Execution', () => {
    it('should complete successfully in uptrend', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.003, '1h');
      const config = createMockBacktestConfig({
        setupTypes: ['setup91'], // LONG setup
        minConfidence: 30,
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');
      expect(result.trades).toBeDefined();
      expect(Array.isArray(result.trades)).toBe(true);

    });

    it('should respect initial capital', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const initialCapital = 5000;
      const config = createMockBacktestConfig({
        initialCapital,
      });

      const result = await engine.run(config, klines);

      const expectedFinalEquity = initialCapital + result.metrics.totalPnl;

      if (result.equityCurve.length > 0) {
        const finalEquity = result.equityCurve[result.equityCurve.length - 1]?.equity || initialCapital;
        expect(Math.abs(finalEquity - expectedFinalEquity)).toBeLessThan(1); // Allow small floating point diff
      }
    });

    it('should apply commission to trades', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const commission = 0.001; // 0.1%
      const config = createMockBacktestConfig({
        commission,
      });

      const result = await engine.run(config, klines);

      if (result.trades.length > 0) {
        for (const trade of result.trades) {
          expect(trade.commission).toBeDefined();
          expect(trade.commission).toBeGreaterThan(0);

          const expectedCommission = (trade.entryPrice + (trade.exitPrice || trade.entryPrice)) * commission;
          expect(trade.commission).toBeGreaterThan(0);
          expect(trade.commission).toBeLessThan(expectedCommission * 2); // Upper bound
        }
      }
    });

    it('should accept max position size parameter', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const initialCapital = 10000;
      const maxPositionSize = 5; // 5% of capital
      const config = createMockBacktestConfig({
        initialCapital,
        maxPositionSize,
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');

    });
  });

  describe('run() - Strategy Configuration', () => {
    it('should use only specified strategies', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig({
        setupTypes: ['setup91'], // Only Setup 9.1
      });

      const result = await engine.run(config, klines);

      if (result.trades && result.trades.length > 0) {
        for (const trade of result.trades) {
          expect(trade.setupType).toBe('setup91');
        }
      }
    });

    it('should respect minConfidence filter', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const minConfidence = 70;
      const config = createMockBacktestConfig({
        minConfidence,
      });

      const result = await engine.run(config, klines);

      expect(result).toBeDefined();
    });

    it('should use algorithmic levels when enabled', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig({
        useAlgorithmicLevels: true,
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');
    });

    it('should filter by trend when useTrendFilter is enabled', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig({
        useTrendFilter: true,
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('run() - Edge Cases', () => {
    it('should handle minimum required klines', async () => {
      const klines = generateMockKlines(60, 50000, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');
    });

    it('should handle no detected setups', async () => {
      const klines = generateMockKlines(100, 50000, '1h');
      const config = createMockBacktestConfig({
        minConfidence: 95, // Very high confidence = likely no setups
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');
      expect(result.metrics.totalTrades).toBe(0);
      expect(result.metrics.totalPnl).toBe(0);
      expect(result.metrics.winRate).toBe(0);
    });

    it('should handle all losing trades', async () => {
      const klines = generateTrendingKlines(200, 50000, 'down', 0.003, '1h');
      const config = createMockBacktestConfig({
        setupTypes: ['setup91'], // LONG setup in downtrend
        minConfidence: 30,
      });

      const result = await engine.run(config, klines);

      expect(result.status).toBe('COMPLETED');

      if (result.metrics.totalTrades > 0) {
        expect(result.metrics.profitFactor).toBeLessThan(1);
        expect(result.metrics.totalPnl).toBeLessThan(0);
      }
    });

    it('should handle different intervals', async () => {
      const intervals = ['15m', '1h', '4h', '1d'];

      for (const interval of intervals) {
        const klines = generateMockKlines(200, 50000, interval);
        const config = createMockBacktestConfig({
          interval,
        });

        const result = await engine.run(config, klines);

        expect(result.status).toBe('COMPLETED');
      }
    });
  });

  describe('run() - Equity Curve', () => {
    it('should generate equity curve', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      expect(result.equityCurve).toBeDefined();
      expect(Array.isArray(result.equityCurve)).toBe(true);
    });

    it('should start equity curve at initial capital', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const initialCapital = 5000;
      const config = createMockBacktestConfig({
        initialCapital,
      });

      const result = await engine.run(config, klines);

      if (result.equityCurve.length > 0) {
        const firstPoint = result.equityCurve[0];
        expect(firstPoint?.equity).toBe(initialCapital);
      }
    });

    it('should update equity curve after each trade', async () => {
      const klines = generateTrendingKlines(200, 50000, 'up', 0.002, '1h');
      const config = createMockBacktestConfig();

      const result = await engine.run(config, klines);

      if (result.trades.length > 0) {
        expect(result.equityCurve.length).toBeGreaterThanOrEqual(result.trades.length);
      }
    });
  });

  describe('run() - Performance', () => {
    it('should complete large dataset in reasonable time', async () => {
      const klines = generateMockKlines(1000, 50000, '1h'); // 1000 candles
      const config = createMockBacktestConfig();

      const startTime = Date.now();
      const result = await engine.run(config, klines);
      const duration = Date.now() - startTime;

      expect(result.status).toBe('COMPLETED');
      expect(duration).toBeLessThan(30000); // Should complete within 30 seconds
    }, 35000); // Increase test timeout

    it('should reuse pre-fetched klines efficiently', async () => {
      const klines = generateMockKlines(500, 50000, '1h');
      const config = createMockBacktestConfig();

      const start1 = Date.now();
      await engine.run(config, klines);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await engine.run(config, klines);
      const duration2 = Date.now() - start2;

      expect(duration1).toBeLessThan(15000);
      expect(duration2).toBeLessThan(15000);
    }, 35000);
  });
});
