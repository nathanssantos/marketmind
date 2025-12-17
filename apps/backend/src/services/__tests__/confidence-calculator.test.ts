import type { Kline } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfidenceCalculator, type ConfidenceParams } from '../confidence-calculator';
import { strategyPerformanceService } from '../strategy-performance';

vi.mock('../strategy-performance', () => ({
  strategyPerformanceService: {
    getPerformance: vi.fn(),
  },
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('ConfidenceCalculator', () => {
  let calculator: ConfidenceCalculator;

  const generateKlines = (count: number, basePrice: number = 50000): Kline[] => {
    const klines: Kline[] = [];
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const variation = (Math.random() - 0.5) * 1000;
      const open = basePrice + variation;
      const close = open + (Math.random() - 0.5) * 500;
      const high = Math.max(open, close) + Math.random() * 200;
      const low = Math.min(open, close) - Math.random() * 200;

      klines.push({
        openTime: now - (count - i) * 60000,
        open: open.toString(),
        high: high.toString(),
        low: low.toString(),
        close: close.toString(),
        volume: (Math.random() * 1000000).toString(),
        closeTime: now - (count - i - 1) * 60000,
        quoteVolume: '0',
        trades: 100,
        takerBuyBaseVolume: '0',
        takerBuyQuoteVolume: '0',
      });
    }

    return klines;
  };

  beforeEach(() => {
    calculator = new ConfidenceCalculator();
    vi.clearAllMocks();
  });

  describe('calculate', () => {
    it('should calculate confidence with good performance', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 30,
        winningTrades: 24,
        losingTrades: 6,
        breakevenTrades: 0,
        winRate: '80.00',
        totalPnl: '150.00',
        maxConsecutiveLosses: 2,
        currentConsecutiveLosses: 0,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        profitFactor: '2.67',
      });

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 900000,
      };

      const result = await calculator.calculate(params);

      expect(result.final).toBeGreaterThan(0);
      expect(result.final).toBeLessThanOrEqual(100);
      expect(result.baseConfidence).toBe(80);
    });

    it('should reduce confidence for poor performance', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 30,
        winningTrades: 10,
        losingTrades: 20,
        breakevenTrades: 0,
        winRate: '33.33',
        totalPnl: '-50.00',
        maxConsecutiveLosses: 5,
        currentConsecutiveLosses: 3,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        profitFactor: '2.67',
      });

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 500000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.final).toBeLessThan(params.baseConfidence);
      expect(result.strategyPerformance).toBeLessThan(1.0);
    });

    it('should handle missing performance data', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 75,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.strategyPerformance).toBe(1.0);
      expect(result.final).toBeGreaterThan(0);
    });

    it('should penalize consecutive losses', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 30,
        winningTrades: 24,
        losingTrades: 6,
        breakevenTrades: 0,
        winRate: '80.00',
        totalPnl: '150.00',
        maxConsecutiveLosses: 4,
        currentConsecutiveLosses: 3,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        profitFactor: '2.67',
      });

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.consecutiveLosses).toBeLessThan(1.0);
    });

    it('should adjust for high volatility', async () => {
      const highVolKlines = generateKlines(50, 50000).map((k) => ({
        ...k,
        high: (parseFloat(k.close) * 1.05).toString(),
        low: (parseFloat(k.close) * 0.95).toString(),
      }));

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines: highVolKlines,
        currentVolume: 1000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.volatilityAdjustment).toBeLessThanOrEqual(1.0);
    });

    it('should boost confidence for high volume', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1500000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.volumeConfirmation).toBeGreaterThan(1.0);
    });

    it('should reduce confidence for low volume', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 500000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.volumeConfirmation).toBeLessThan(1.0);
    });

    it('should cap final confidence at 100', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 50,
        winningTrades: 48,
        losingTrades: 2,
        breakevenTrades: 0,
        winRate: '96.00',
        totalPnl: '500.00',
        maxConsecutiveLosses: 1,
        currentConsecutiveLosses: 0,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        profitFactor: '2.67',
      });

      const params: ConfidenceParams = {
        baseConfidence: 95,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 2000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.final).toBeLessThanOrEqual(100);
    });

    it('should floor final confidence at 0', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 30,
        winningTrades: 5,
        losingTrades: 25,
        breakevenTrades: 0,
        winRate: '16.67',
        totalPnl: '-200.00',
        maxConsecutiveLosses: 10,
        currentConsecutiveLosses: 8,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        profitFactor: '2.67',
      });

      const params: ConfidenceParams = {
        baseConfidence: 20,
        strategyId: 'larry-williams-9-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 200000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.final).toBeGreaterThanOrEqual(0);
    });
  });
});
