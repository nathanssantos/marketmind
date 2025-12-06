import type { BacktestTrade } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { BacktestMetricsCalculator } from './BacktestMetricsCalculator';

describe('BacktestMetricsCalculator', () => {
  const calculator = new BacktestMetricsCalculator();

  const createTrade = (overrides: Partial<BacktestTrade> = {}): BacktestTrade => ({
    id: 'test-trade',
    entryTime: '2024-01-01T00:00:00Z',
    entryPrice: 100,
    side: 'LONG',
    quantity: 1,
    commission: 0.1,
    status: 'CLOSED',
    exitTime: '2024-01-01T01:00:00Z',
    exitPrice: 105,
    pnl: 5,
    pnlPercent: 5,
    netPnl: 4.9,
    exitReason: 'TAKE_PROFIT',
    ...overrides,
  });

  describe('createEmptyMetrics', () => {
    it('should return all metrics initialized to zero', () => {
      const metrics = calculator.createEmptyMetrics();

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winningTrades).toBe(0);
      expect(metrics.losingTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
      expect(metrics.totalPnl).toBe(0);
      expect(metrics.profitFactor).toBe(0);
      expect(metrics.sharpeRatio).toBe(0);
    });
  });

  describe('calculate', () => {
    it('should return empty metrics for no trades', () => {
      const metrics = calculator.calculate([], 1000);

      expect(metrics.totalTrades).toBe(0);
      expect(metrics.winRate).toBe(0);
    });

    it('should calculate basic metrics for single winning trade', () => {
      const trades = [createTrade({ netPnl: 10 })];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.totalTrades).toBe(1);
      expect(metrics.winningTrades).toBe(1);
      expect(metrics.losingTrades).toBe(0);
      expect(metrics.winRate).toBe(100);
      expect(metrics.totalPnl).toBe(10);
      expect(metrics.totalPnlPercent).toBe(1);
    });

    it('should calculate basic metrics for single losing trade', () => {
      const trades = [createTrade({ netPnl: -10 })];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.totalTrades).toBe(1);
      expect(metrics.winningTrades).toBe(0);
      expect(metrics.losingTrades).toBe(1);
      expect(metrics.winRate).toBe(0);
      expect(metrics.totalPnl).toBe(-10);
      expect(metrics.totalPnlPercent).toBe(-1);
    });

    it('should calculate win rate correctly for mixed trades', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 10 }),
        createTrade({ id: '2', netPnl: -5 }),
        createTrade({ id: '3', netPnl: 8 }),
        createTrade({ id: '4', netPnl: -3 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.totalTrades).toBe(4);
      expect(metrics.winningTrades).toBe(2);
      expect(metrics.losingTrades).toBe(2);
      expect(metrics.winRate).toBe(50);
    });

    it('should calculate average win and loss correctly', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 10 }),
        createTrade({ id: '2', netPnl: 20 }),
        createTrade({ id: '3', netPnl: -5 }),
        createTrade({ id: '4', netPnl: -15 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.avgWin).toBe(15);
      expect(metrics.avgLoss).toBe(10);
    });

    it('should calculate largest win and loss correctly', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 10 }),
        createTrade({ id: '2', netPnl: 25 }),
        createTrade({ id: '3', netPnl: -5 }),
        createTrade({ id: '4', netPnl: -20 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.largestWin).toBe(25);
      expect(metrics.largestLoss).toBe(-20);
    });

    it('should calculate profit factor correctly', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 30 }),
        createTrade({ id: '2', netPnl: -10 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.profitFactor).toBe(3);
    });

    it('should handle profit factor when no losses', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 10 }),
        createTrade({ id: '2', netPnl: 20 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.profitFactor).toBe(Infinity);
    });

    it('should calculate total commission correctly', () => {
      const trades = [
        createTrade({ id: '1', commission: 0.5 }),
        createTrade({ id: '2', commission: 0.3 }),
        createTrade({ id: '3', commission: 0.2 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.totalCommission).toBe(1.0);
    });

    it('should calculate maximum drawdown correctly', () => {
      const trades = [
        createTrade({ id: '1', netPnl: 100 }),
        createTrade({ id: '2', netPnl: -50 }),
        createTrade({ id: '3', netPnl: -30 }),
        createTrade({ id: '4', netPnl: 80 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.maxDrawdown).toBeGreaterThan(0);
      expect(metrics.maxDrawdownPercent).toBeGreaterThan(0);
    });

    it('should ignore open trades', () => {
      const trades = [
        createTrade({ id: '1', status: 'CLOSED', netPnl: 10 }),
        createTrade({ id: '2', status: 'OPEN', netPnl: undefined }),
        createTrade({ id: '3', status: 'CLOSED', netPnl: -5 }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.totalTrades).toBe(2);
    });

    it('should calculate average trade duration', () => {
      const trades = [
        createTrade({
          id: '1',
          entryTime: '2024-01-01T00:00:00Z',
          exitTime: '2024-01-01T01:00:00Z',
        }),
        createTrade({
          id: '2',
          entryTime: '2024-01-01T00:00:00Z',
          exitTime: '2024-01-01T02:00:00Z',
        }),
      ];
      const metrics = calculator.calculate(trades, 1000);

      expect(metrics.avgTradeDuration).toBe(90);
    });
  });

  describe('calculateWinRateBySetup', () => {
    it('should calculate win rate for each setup type', () => {
      const trades = [
        createTrade({ id: '1', setupType: 'MEAN_REVERSION', netPnl: 10 }),
        createTrade({ id: '2', setupType: 'MEAN_REVERSION', netPnl: -5 }),
        createTrade({ id: '3', setupType: 'BREAKOUT', netPnl: 8 }),
        createTrade({ id: '4', setupType: 'BREAKOUT', netPnl: 12 }),
      ];

      const winRates = calculator.calculateWinRateBySetup(trades);

      expect(winRates.get('MEAN_REVERSION')).toBe(50);
      expect(winRates.get('BREAKOUT')).toBe(100);
    });

    it('should ignore trades without setupType', () => {
      const trades = [
        createTrade({ id: '1', setupType: undefined, netPnl: 10 }),
        createTrade({ id: '2', setupType: 'BREAKOUT', netPnl: 8 }),
      ];

      const winRates = calculator.calculateWinRateBySetup(trades);

      expect(winRates.size).toBe(1);
      expect(winRates.has('BREAKOUT')).toBe(true);
    });
  });

  describe('calculateAvgPnlBySetup', () => {
    it('should calculate average PnL for each setup type', () => {
      const trades = [
        createTrade({ id: '1', setupType: 'MEAN_REVERSION', netPnl: 10 }),
        createTrade({ id: '2', setupType: 'MEAN_REVERSION', netPnl: 20 }),
        createTrade({ id: '3', setupType: 'BREAKOUT', netPnl: 15 }),
      ];

      const avgPnl = calculator.calculateAvgPnlBySetup(trades);

      expect(avgPnl.get('MEAN_REVERSION')).toBe(15);
      expect(avgPnl.get('BREAKOUT')).toBe(15);
    });
  });

  describe('calculateProfitFactorBySetup', () => {
    it('should calculate profit factor for each setup type', () => {
      const trades = [
        createTrade({ id: '1', setupType: 'MEAN_REVERSION', netPnl: 30 }),
        createTrade({ id: '2', setupType: 'MEAN_REVERSION', netPnl: -10 }),
        createTrade({ id: '3', setupType: 'BREAKOUT', netPnl: 20 }),
        createTrade({ id: '4', setupType: 'BREAKOUT', netPnl: -5 }),
      ];

      const profitFactors = calculator.calculateProfitFactorBySetup(trades);

      expect(profitFactors.get('MEAN_REVERSION')).toBe(3);
      expect(profitFactors.get('BREAKOUT')).toBe(4);
    });

    it('should return Infinity when no losses for a setup', () => {
      const trades = [
        createTrade({ id: '1', setupType: 'BREAKOUT', netPnl: 10 }),
        createTrade({ id: '2', setupType: 'BREAKOUT', netPnl: 20 }),
      ];

      const profitFactors = calculator.calculateProfitFactorBySetup(trades);

      expect(profitFactors.get('BREAKOUT')).toBe(Infinity);
    });
  });
});
