import { describe, it, expect } from 'vitest';
import { MonteCarloSimulator } from '../MonteCarloSimulator';
import type { BacktestTrade } from '@marketmind/types';

const createMockTrades = (count: number, avgPnl: number, winRate: number): BacktestTrade[] => {
  return Array.from({ length: count }, (_, i) => {
    const isWin = Math.random() < winRate;
    const pnl = isWin ? Math.abs(avgPnl) * (0.5 + Math.random()) : -Math.abs(avgPnl) * (0.5 + Math.random()) * 0.5;

    return {
      id: `trade-${i}`,
      setupType: 'test-setup',
      entryTime: new Date(Date.now() + i * 3600000).toISOString(),
      entryPrice: 50000,
      exitTime: new Date(Date.now() + i * 3600000 + 1800000).toISOString(),
      exitPrice: 50000 + pnl,
      quantity: 1,
      side: 'LONG' as const,
      pnl,
      pnlPercent: (pnl / 50000) * 100,
      exitReason: 'TAKE_PROFIT' as const,
      commission: 0,
      status: 'CLOSED' as const,
    };
  });
};

describe('MonteCarloSimulator', () => {
  describe('simulate', () => {
    it('should throw error when no trades provided', () => {
      expect(() => MonteCarloSimulator.simulate([], 10000)).toThrow('No trades to simulate');
    });

    it('should return valid simulation result', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.simulations.length).toBe(100);
      expect(result.statistics).toBeDefined();
      expect(result.confidenceIntervals).toBeDefined();
      expect(result.probabilities).toBeDefined();
      expect(result.worstCase).toBeDefined();
      expect(result.bestCase).toBeDefined();
      expect(result.medianCase).toBeDefined();
    });

    it('should calculate statistics correctly', () => {
      const trades = createMockTrades(30, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeGreaterThan(0);
      expect(result.statistics.medianFinalEquity).toBeGreaterThan(0);
      expect(result.statistics.stdDevFinalEquity).toBeGreaterThanOrEqual(0);
      expect(result.statistics.meanMaxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.statistics.meanMaxDrawdown).toBeLessThanOrEqual(1);
    });

    it('should calculate confidence intervals', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.confidenceIntervals.finalEquity.lower).toBeLessThanOrEqual(result.confidenceIntervals.finalEquity.upper);
      expect(result.confidenceIntervals.maxDrawdown.lower).toBeLessThanOrEqual(result.confidenceIntervals.maxDrawdown.upper);
      expect(result.confidenceIntervals.sharpeRatio.lower).toBeLessThanOrEqual(result.confidenceIntervals.sharpeRatio.upper);
      expect(result.confidenceIntervals.totalReturn.lower).toBeLessThanOrEqual(result.confidenceIntervals.totalReturn.upper);
    });

    it('should calculate probabilities', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.probabilities.profitableProbability).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.profitableProbability).toBeLessThanOrEqual(1);
      expect(result.probabilities.drawdownExceeds10Percent).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.drawdownExceeds10Percent).toBeLessThanOrEqual(1);
      expect(result.probabilities.drawdownExceeds20Percent).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.drawdownExceeds30Percent).toBeGreaterThanOrEqual(0);
    });

    it('should identify worst/best/median cases correctly', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.worstCase.finalEquity).toBeLessThanOrEqual(result.medianCase.finalEquity);
      expect(result.medianCase.finalEquity).toBeLessThanOrEqual(result.bestCase.finalEquity);
    });

    it('should use default config when not provided', () => {
      const trades = createMockTrades(20, 100, 0.5);
      const result = MonteCarloSimulator.simulate(trades, 10000);

      expect(result.simulations.length).toBe(1000);
    });

    it('should handle all losing trades', () => {
      const trades: BacktestTrade[] = Array.from({ length: 20 }, (_, i) => ({
        id: `trade-${i}`,
        setupType: 'test-setup',
        entryTime: new Date(Date.now() + i * 3600000).toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + i * 3600000 + 1800000).toISOString(),
        exitPrice: 49900,
        quantity: 1,
        side: 'LONG' as const,
        pnl: -100,
        pnlPercent: -0.2,
        exitReason: 'STOP_LOSS' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }));

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeLessThan(10000);
      expect(result.probabilities.profitableProbability).toBe(0);
    });

    it('should handle all winning trades', () => {
      const trades: BacktestTrade[] = Array.from({ length: 20 }, (_, i) => ({
        id: `trade-${i}`,
        setupType: 'test-setup',
        entryTime: new Date(Date.now() + i * 3600000).toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + i * 3600000 + 1800000).toISOString(),
        exitPrice: 50100,
        quantity: 1,
        side: 'LONG' as const,
        pnl: 100,
        pnlPercent: 0.2,
        exitReason: 'TAKE_PROFIT' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }));

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeGreaterThan(10000);
      expect(result.probabilities.profitableProbability).toBe(1);
    });
  });

  describe('getDistribution', () => {
    it('should return distribution buckets', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(result.simulations, 'finalEquity', 10);

      expect(distribution.length).toBe(10);
      distribution.forEach((bucket) => {
        expect(bucket.bucket).toBeDefined();
        expect(bucket.count).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeLessThanOrEqual(1);
      });
    });

    it('should distribute correctly for all metrics', () => {
      const trades = createMockTrades(50, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      const metrics: Array<'finalEquity' | 'maxDrawdown' | 'sharpeRatio' | 'totalReturn'> = [
        'finalEquity',
        'maxDrawdown',
        'sharpeRatio',
        'totalReturn',
      ];

      for (const metric of metrics) {
        const distribution = MonteCarloSimulator.getDistribution(result.simulations, metric, 5);
        expect(distribution.length).toBe(5);

        const totalCount = distribution.reduce((sum, b) => sum + b.count, 0);
        expect(totalCount).toBe(100);
      }
    });

    it('should handle single value distribution', () => {
      const trades: BacktestTrade[] = [{
        id: 'trade-1',
        setupType: 'test-setup',
        entryTime: new Date().toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + 3600000).toISOString(),
        exitPrice: 50100,
        quantity: 1,
        side: 'LONG' as const,
        pnl: 100,
        pnlPercent: 0.2,
        exitReason: 'TAKE_PROFIT' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }];

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 10,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(result.simulations, 'finalEquity', 5);
      expect(distribution.length).toBe(5);
    });
  });

  describe('simulation consistency', () => {
    it('should produce different drawdown paths on each simulation', () => {
      const trades = createMockTrades(30, 100, 0.5);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      const uniqueDrawdowns = new Set(result.simulations.map((s) => s.maxDrawdown.toFixed(6)));
      expect(uniqueDrawdowns.size).toBeGreaterThan(1);
    });

    it('should maintain trade count in each simulation', () => {
      const tradeCount = 25;
      const trades = createMockTrades(tradeCount, 100, 0.6);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      result.simulations.forEach((sim) => {
        expect(sim.trades.length).toBe(tradeCount);
      });
    });
  });

  describe('edge cases', () => {
    it('should handle single trade', () => {
      const trades: BacktestTrade[] = [{
        id: 'trade-1',
        setupType: 'test-setup',
        entryTime: new Date().toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + 3600000).toISOString(),
        exitPrice: 50500,
        quantity: 1,
        side: 'LONG' as const,
        pnl: 500,
        pnlPercent: 1,
        exitReason: 'TAKE_PROFIT' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }];

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 10,
        confidenceLevel: 0.95,
      });

      expect(result.simulations.length).toBe(10);
      expect(result.statistics.meanFinalEquity).toBe(10500);
    });

    it('should handle trades with zero pnl', () => {
      const trades: BacktestTrade[] = Array.from({ length: 10 }, (_, i) => ({
        id: `trade-${i}`,
        setupType: 'test-setup',
        entryTime: new Date(Date.now() + i * 3600000).toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + i * 3600000 + 1800000).toISOString(),
        exitPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        pnl: 0,
        pnlPercent: 0,
        exitReason: 'MANUAL' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }));

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 10,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBe(10000);
      expect(result.statistics.meanMaxDrawdown).toBe(0);
    });

    it('should handle undefined pnl values', () => {
      const trades: BacktestTrade[] = [{
        id: 'trade-1',
        setupType: 'test-setup',
        entryTime: new Date().toISOString(),
        entryPrice: 50000,
        exitTime: new Date(Date.now() + 3600000).toISOString(),
        exitPrice: 50000,
        quantity: 1,
        side: 'LONG' as const,
        pnl: undefined as unknown as number,
        pnlPercent: 0,
        exitReason: 'MANUAL' as const,
        commission: 0,
        status: 'CLOSED' as const,
      }];

      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 10,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBe(10000);
    });
  });
});
