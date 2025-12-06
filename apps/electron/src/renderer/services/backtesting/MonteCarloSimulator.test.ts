import { describe, expect, it } from 'vitest';
import { MonteCarloSimulator } from './MonteCarloSimulator';
import type { BacktestTrade } from './types';

describe('MonteCarloSimulator', () => {
  const createTrades = (count: number, avgPnl: number, variance: number): BacktestTrade[] => {
    return Array.from({ length: count }, (_, i) => ({
      symbol: 'BTCUSDT',
      setupName: 'Test Setup',
      entryTime: new Date(Date.now() + i * 3600000),
      entryPrice: 50000,
      exitTime: new Date(Date.now() + (i + 1) * 3600000),
      exitPrice: 50000 + avgPnl + (Math.random() - 0.5) * variance,
      quantity: 1,
      side: 'LONG' as const,
      pnl: avgPnl + (Math.random() - 0.5) * variance,
      exitReason: 'TP' as const,
      fees: 10,
      slippage: 5,
    }));
  };

  describe('simulate', () => {
    it('should run Monte Carlo simulation successfully', () => {
      const trades = createTrades(50, 100, 200);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.simulations).toHaveLength(100);
      expect(result.statistics).toBeDefined();
      expect(result.confidenceIntervals).toBeDefined();
      expect(result.probabilities).toBeDefined();
      expect(result.worstCase).toBeDefined();
      expect(result.bestCase).toBeDefined();
      expect(result.medianCase).toBeDefined();
    });

    it('should calculate statistics correctly', () => {
      const trades = createTrades(30, 50, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeGreaterThan(10000);
      expect(result.statistics.medianFinalEquity).toBeGreaterThan(10000);
      expect(result.statistics.stdDevFinalEquity).toBeGreaterThan(0);
      expect(result.statistics.meanMaxDrawdown).toBeGreaterThanOrEqual(0);
      expect(result.statistics.medianMaxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('should calculate confidence intervals', () => {
      const trades = createTrades(40, 100, 150);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.confidenceIntervals.finalEquity.lower).toBeLessThanOrEqual(
        result.statistics.medianFinalEquity
      );
      expect(result.confidenceIntervals.finalEquity.upper).toBeGreaterThanOrEqual(
        result.statistics.medianFinalEquity
      );
      expect(result.confidenceIntervals.maxDrawdown.lower).toBeLessThanOrEqual(
        result.confidenceIntervals.maxDrawdown.upper
      );
    });

    it('should calculate probabilities', () => {
      const trades = createTrades(50, 100, 200);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      expect(result.probabilities.profitableProbability).toBeGreaterThan(0);
      expect(result.probabilities.profitableProbability).toBeLessThanOrEqual(1);
      expect(result.probabilities.drawdownExceeds10Percent).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.drawdownExceeds10Percent).toBeLessThanOrEqual(1);
      expect(result.probabilities.returnExceeds10Percent).toBeGreaterThanOrEqual(0);
      expect(result.probabilities.returnExceeds10Percent).toBeLessThanOrEqual(1);
    });

    it('should identify worst, best, and median cases', () => {
      const trades = createTrades(30, 50, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      expect(result.worstCase.finalEquity).toBeLessThanOrEqual(result.medianCase.finalEquity);
      expect(result.medianCase.finalEquity).toBeLessThanOrEqual(result.bestCase.finalEquity);
    });

    it('should handle positive trades correctly', () => {
      const trades = createTrades(20, 200, 50);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeGreaterThan(10000);
      expect(result.probabilities.profitableProbability).toBeGreaterThan(0.5);
    });

    it('should handle negative trades correctly', () => {
      const trades = createTrades(20, -100, 50);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      expect(result.statistics.meanFinalEquity).toBeLessThan(10000);
      expect(result.probabilities.profitableProbability).toBeLessThan(0.5);
    });

    it('should throw error for empty trades array', () => {
      expect(() => {
        MonteCarloSimulator.simulate([], 10000);
      }).toThrow('No trades to simulate');
    });

    it('should handle mixed positive and negative trades', () => {
      const trades: BacktestTrade[] = [
        ...createTrades(10, 200, 50),
        ...createTrades(10, -100, 50),
      ];
      
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      expect(result.simulations).toHaveLength(50);
      expect(result.statistics.meanMaxDrawdown).toBeGreaterThan(0);
    });
  });

  describe('getDistribution', () => {
    it('should create distribution buckets for finalEquity', () => {
      const trades = createTrades(50, 100, 200);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 100,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(
        result.simulations,
        'finalEquity',
        10
      );

      expect(distribution).toHaveLength(10);
      distribution.forEach((bucket) => {
        expect(bucket.bucket).toBeDefined();
        expect(bucket.count).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeGreaterThanOrEqual(0);
        expect(bucket.percentage).toBeLessThanOrEqual(1);
      });

      const totalPercentage = distribution.reduce((sum, b) => sum + b.percentage, 0);
      expect(totalPercentage).toBeCloseTo(1, 1);
    });

    it('should create distribution buckets for maxDrawdown', () => {
      const trades = createTrades(40, 50, 150);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(
        result.simulations,
        'maxDrawdown',
        10
      );

      expect(distribution).toHaveLength(10);
      const totalCount = distribution.reduce((sum, b) => sum + b.count, 0);
      expect(totalCount).toBe(50);
    });

    it('should create distribution buckets for sharpeRatio', () => {
      const trades = createTrades(30, 100, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(
        result.simulations,
        'sharpeRatio',
        10
      );

      expect(distribution).toHaveLength(10);
    });

    it('should create distribution buckets for totalReturn', () => {
      const trades = createTrades(40, 80, 120);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      const distribution = MonteCarloSimulator.getDistribution(
        result.simulations,
        'totalReturn',
        10
      );

      expect(distribution).toHaveLength(10);
    });

    it('should handle custom number of buckets', () => {
      const trades = createTrades(30, 100, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.95,
      });

      const distribution5 = MonteCarloSimulator.getDistribution(
        result.simulations,
        'finalEquity',
        5
      );
      const distribution20 = MonteCarloSimulator.getDistribution(
        result.simulations,
        'finalEquity',
        20
      );

      expect(distribution5).toHaveLength(5);
      expect(distribution20).toHaveLength(20);
    });
  });

  describe('edge cases', () => {
    it('should handle single trade', () => {
      const trades = createTrades(1, 100, 0);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 10,
        confidenceLevel: 0.95,
      });

      expect(result.simulations).toHaveLength(10);
      result.simulations.forEach((sim) => {
        expect(sim.finalEquity).toBeCloseTo(10100, 0);
      });
    });

    it('should handle very low confidence level', () => {
      const trades = createTrades(30, 50, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.5,
      });

      expect(result.confidenceIntervals.finalEquity.upper).toBeGreaterThanOrEqual(
        result.confidenceIntervals.finalEquity.lower
      );
    });

    it('should handle very high confidence level', () => {
      const trades = createTrades(30, 50, 100);
      const result = MonteCarloSimulator.simulate(trades, 10000, {
        numSimulations: 50,
        confidenceLevel: 0.99,
      });

      expect(result.confidenceIntervals.finalEquity.upper).toBeGreaterThanOrEqual(
        result.confidenceIntervals.finalEquity.lower
      );
    });
  });
});
