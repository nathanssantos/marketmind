import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import type { BacktestConfig } from './types';
import { WalkForwardOptimizer } from './WalkForwardOptimizer';

const createKline = (timestamp: number, close: number): Kline => ({
  openTime: timestamp,
  open: close,
  high: close * 1.01,
  low: close * 0.99,
  close,
  volume: 1000,
  closeTime: timestamp + 60000,
  quoteVolume: close * 1000,
  trades: 100,
  takerBuyBaseVolume: 500,
  takerBuyQuoteVolume: close * 500,
});

const generateKlines = (count: number, startTime: number, intervalMs: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    klines.push(createKline(startTime + i * intervalMs, 100 + Math.random() * 10));
  }
  return klines;
};

describe('WalkForwardOptimizer', () => {
  describe('createWindows', () => {
    it('should create walk-forward windows from klines', () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const startTime = Date.now();

      const klines = generateKlines(12 * 30 * 24, startTime, hourMs);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 2,
      });

      expect(windows.length).toBeGreaterThan(0);
      windows.forEach((window) => {
        expect(window.trainingKlines.length).toBeGreaterThan(0);
        expect(window.testingKlines.length).toBeGreaterThan(0);
        expect(window.trainingEnd).toBe(window.testingStart);
      });
    });

    it('should throw error for insufficient data', () => {
      const klines = generateKlines(10, Date.now(), 60000);

      expect(() => {
        WalkForwardOptimizer.createWindows(klines, {
          trainingWindowMonths: 6,
          testingWindowMonths: 2,
          stepMonths: 2,
          minWindowCount: 2,
        });
      }).toThrow('Insufficient data');
    });

    it('should throw error for insufficient windows', () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(8 * 30 * 24, Date.now(), hourMs);

      expect(() => {
        WalkForwardOptimizer.createWindows(klines, {
          trainingWindowMonths: 6,
          testingWindowMonths: 2,
          stepMonths: 6,
          minWindowCount: 5,
        });
      }).toThrow('Insufficient data for walk-forward analysis');
    });

    it('should return empty array for empty klines', () => {
      const windows = WalkForwardOptimizer.createWindows([], {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 1,
      });

      expect(windows).toEqual([]);
    });

    it('should create non-overlapping testing windows with step', () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(12 * 30 * 24, Date.now(), hourMs);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 4,
        testingWindowMonths: 2,
        stepMonths: 2,
        minWindowCount: 2,
      });

      for (let i = 1; i < windows.length; i++) {
        expect(windows[i].testingStart).toBeGreaterThanOrEqual(windows[i - 1].testingEnd);
      }
    });
  });

  describe('optimizeWindow', () => {
    it('should find best parameters for window', async () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const startTime = Date.now();
      const klines = generateKlines(12 * 30 * 24, startTime, hourMs);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 1,
      });

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
        algorithmic: {
          enableMeanReversion: true,
          enableBreakout: false,
          enableMultiTimeframe: false,
          enableGridTrading: false,
        },
      };

      const parameterRanges = [
        { name: 'maxPositionSize', min: 0.05, max: 0.15, step: 0.05 },
      ];

      const result = await WalkForwardOptimizer.optimizeWindow(
        windows[0],
        baseConfig,
        parameterRanges
      );

      expect(result.parameters).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.sharpeRatio).toBeDefined();
      expect(result.profitFactor).toBeDefined();
      expect(result.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty parameter ranges gracefully', async () => {
      const window = {
        windowIndex: 0,
        trainingStart: 0,
        trainingEnd: 1000,
        testingStart: 1000,
        testingEnd: 2000,
        trainingKlines: [],
        testingKlines: [],
        optimizationResult: null,
        testResult: null,
      };

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
      };

      const result = await WalkForwardOptimizer.optimizeWindow(window, baseConfig, []);
      expect(result).toBeDefined();
      expect(result.parameters).toEqual({});
    });
  });

  describe('testWindow', () => {
    it('should test optimized parameters on out-of-sample data', async () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(12 * 30 * 24, Date.now(), hourMs);

      const windows = WalkForwardOptimizer.createWindows(klines, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 1,
      });

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
      };

      const optimizedParams = { maxPositionSize: 0.15 };

      const result = await WalkForwardOptimizer.testWindow(
        windows[0],
        baseConfig,
        optimizedParams
      );

      expect(result).toBeDefined();
      expect(result.metrics).toBeDefined();
    });
  });

  describe('run', () => {
    it('should execute complete walk-forward analysis', async () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(12 * 30 * 24, Date.now(), hourMs);

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
        algorithmic: {
          enableMeanReversion: true,
          enableBreakout: false,
          enableMultiTimeframe: false,
          enableGridTrading: false,
        },
      };

      const parameterRanges = [
        { name: 'maxPositionSize', min: 0.1, max: 0.2, step: 0.1 },
      ];

      const result = await WalkForwardOptimizer.run(klines, baseConfig, parameterRanges, {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 1,
      });

      expect(result.windows.length).toBeGreaterThan(0);
      expect(result.aggregatedMetrics).toBeDefined();
      expect(typeof result.isRobust).toBe('boolean');
      expect(result.degradationThreshold).toBe(0.3);

      result.windows.forEach((window) => {
        expect(window.optimizationResult).not.toBeNull();
        expect(window.testResult).not.toBeNull();
      });
    });

    it('should flag non-robust strategies with high degradation', async () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(12 * 30 * 24, Date.now(), hourMs);

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
      };

      const result = await WalkForwardOptimizer.run(klines, baseConfig, [], {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 1,
      });

      expect(result.aggregatedMetrics.degradation).toBeGreaterThanOrEqual(0);
    });

    it('should calculate aggregated metrics correctly', async () => {
      const monthMs = 30 * 24 * 60 * 60 * 1000;
      const hourMs = 60 * 60 * 1000;
      const klines = generateKlines(12 * 30 * 24, Date.now(), hourMs);

      const baseConfig: BacktestConfig = {
        initialCapital: 10000,
        maxPositionSize: 0.1,
        commission: 0.001,
        useAlgorithmicStops: true,
      };

      const result = await WalkForwardOptimizer.run(klines, baseConfig, [], {
        trainingWindowMonths: 6,
        testingWindowMonths: 2,
        stepMonths: 4,
        minWindowCount: 1,
      });

      expect(result.aggregatedMetrics.avgInSampleSharpe).toBeDefined();
      expect(result.aggregatedMetrics.avgOutOfSampleSharpe).toBeDefined();
      expect(result.aggregatedMetrics.totalTrades).toBeGreaterThanOrEqual(0);
      expect(result.aggregatedMetrics.overallWinRate).toBeGreaterThanOrEqual(0);
      expect(result.aggregatedMetrics.overallWinRate).toBeLessThanOrEqual(1);
      expect(result.aggregatedMetrics.overallProfitFactor).toBeGreaterThanOrEqual(0);
      expect(result.aggregatedMetrics.overallMaxDrawdown).toBeGreaterThanOrEqual(0);
    });
  });
});
