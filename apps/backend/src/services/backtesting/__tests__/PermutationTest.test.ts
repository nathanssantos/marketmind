import { describe, it, expect } from 'vitest';
import { PermutationTest } from '../PermutationTest';
import type { BacktestTrade } from '@marketmind/types';

const createMockTrade = (pnl: number): BacktestTrade => ({
  id: `trade-${Math.random()}`,
  setupId: 'test-setup',
  side: 'LONG',
  entryPrice: 50000,
  exitPrice: pnl > 0 ? 51000 : 49000,
  entryTime: '2024-01-01T00:00:00Z',
  exitTime: '2024-01-02T00:00:00Z',
  quantity: 1,
  pnl,
  pnlPercent: (pnl / 10000) * 100,
  commission: 10,
  netPnl: pnl - 10,
  exitReason: 'TAKE_PROFIT',
  status: 'CLOSED',
});

describe('PermutationTest', () => {
  describe('run', () => {
    it('should throw error when no trades provided', () => {
      expect(() => PermutationTest.run([], 10000)).toThrow('No trades to test');
    });

    it('should return valid permutation test result', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(300),
        createMockTrade(-200),
        createMockTrade(400),
        createMockTrade(-100),
        createMockTrade(600),
        createMockTrade(-150),
        createMockTrade(350),
        createMockTrade(-250),
        createMockTrade(450),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 100,
        confidenceLevel: 0.95,
        metric: 'sharpe',
      });

      expect(result.actualMetric).toBeDefined();
      expect(result.permutedMetrics).toHaveLength(100);
      expect(result.pValue).toBeGreaterThanOrEqual(0);
      expect(result.pValue).toBeLessThanOrEqual(1);
      expect(result.percentile).toBeGreaterThanOrEqual(0);
      expect(result.percentile).toBeLessThanOrEqual(100);
      expect(typeof result.isSignificant).toBe('boolean');
      expect(result.confidenceLevel).toBe(0.95);
      expect(result.numPermutations).toBe(100);
      expect(result.metric).toBe('sharpe');
    });

    it('should calculate statistics correctly', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(1000),
        createMockTrade(800),
        createMockTrade(-300),
        createMockTrade(500),
        createMockTrade(-200),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'totalReturn',
      });

      expect(result.statistics.mean).toBeDefined();
      expect(result.statistics.median).toBeDefined();
      expect(result.statistics.stdDev).toBeDefined();
      expect(result.statistics.min).toBeDefined();
      expect(result.statistics.max).toBeDefined();
      expect(result.statistics.min).toBeLessThanOrEqual(result.statistics.max);
    });

    it('should test totalReturn metric', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(1000),
        createMockTrade(500),
        createMockTrade(-200),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'totalReturn',
      });

      expect(result.metric).toBe('totalReturn');
      expect(result.actualMetric).toBeCloseTo(13, 0);
    });

    it('should test profitFactor metric', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(1000),
        createMockTrade(500),
        createMockTrade(-200),
        createMockTrade(-100),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'profitFactor',
      });

      expect(result.metric).toBe('profitFactor');
      expect(result.actualMetric).toBe(5);
    });

    it('should test winRate metric', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(1000),
        createMockTrade(500),
        createMockTrade(-200),
        createMockTrade(300),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'winRate',
      });

      expect(result.metric).toBe('winRate');
      expect(result.actualMetric).toBe(75);
    });

    it('should use default config when not provided', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(300),
        createMockTrade(-200),
      ];

      const result = PermutationTest.run(trades, 10000);

      expect(result.numPermutations).toBe(1000);
      expect(result.confidenceLevel).toBe(0.95);
      expect(result.metric).toBe('sharpe');
    });
  });

  describe('runMultipleMetrics', () => {
    it('should test all four metrics', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(300),
        createMockTrade(-200),
        createMockTrade(400),
        createMockTrade(-100),
      ];

      const results = PermutationTest.runMultipleMetrics(trades, 10000, 50, 0.95);

      expect(results['sharpe']).toBeDefined();
      expect(results['totalReturn']).toBeDefined();
      expect(results['profitFactor']).toBeDefined();
      expect(results['winRate']).toBeDefined();

      expect(results['sharpe']?.metric).toBe('sharpe');
      expect(results['totalReturn']?.metric).toBe('totalReturn');
      expect(results['profitFactor']?.metric).toBe('profitFactor');
      expect(results['winRate']?.metric).toBe('winRate');
    });

    it('should use provided permutations and confidence', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(-200),
      ];

      const results = PermutationTest.runMultipleMetrics(trades, 10000, 25, 0.90);

      expect(results['sharpe']?.numPermutations).toBe(25);
      expect(results['sharpe']?.confidenceLevel).toBe(0.90);
    });
  });

  describe('edge cases', () => {
    it('should handle all positive trades', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(300),
        createMockTrade(200),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'winRate',
      });

      expect(result.actualMetric).toBe(100);
    });

    it('should handle all negative trades', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(-500),
        createMockTrade(-300),
        createMockTrade(-200),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'winRate',
      });

      expect(result.actualMetric).toBe(0);
    });

    it('should handle single trade', () => {
      const trades: BacktestTrade[] = [createMockTrade(500)];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'totalReturn',
      });

      expect(result.actualMetric).toBeCloseTo(5, 0);
    });

    it('should handle zero pnl trade', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(0),
        createMockTrade(-200),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 50,
        metric: 'profitFactor',
      });

      expect(result.actualMetric).toBe(2.5);
    });
  });

  describe('significance detection', () => {
    it('should mark highly profitable strategy as potentially significant', () => {
      const trades: BacktestTrade[] = Array.from({ length: 50 }, (_, i) =>
        createMockTrade(i % 3 === 0 ? -100 : 500)
      );

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 100,
        confidenceLevel: 0.95,
        metric: 'totalReturn',
      });

      expect(result.pValue).toBeLessThan(1);
      expect(result.percentile).toBeGreaterThan(0);
    });

    it('should have consistent pValue and percentile relationship', () => {
      const trades: BacktestTrade[] = [
        createMockTrade(500),
        createMockTrade(300),
        createMockTrade(-200),
        createMockTrade(400),
        createMockTrade(-100),
      ];

      const result = PermutationTest.run(trades, 10000, {
        numPermutations: 100,
        metric: 'sharpe',
      });

      expect(result.pValue + result.percentile / 100).toBeCloseTo(1, 1);
    });
  });
});
