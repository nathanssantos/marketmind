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
        maxDrawdown: '5.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
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
        maxDrawdown: '15.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
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
        maxDrawdown: '5.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
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
        maxDrawdown: '2.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
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
        maxDrawdown: '25.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
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

    it('should handle zero avgVolume', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'test-strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 0,
      };

      const result = await calculator.calculate(params);

      expect(result.volumeConfirmation).toBe(1.0);
    });

    it('should handle insufficient klines for volatility calculation', async () => {
      const klines = generateKlines(10);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue(null);

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'test-strategy',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);

      expect(result.volatilityAdjustment).toBe(1.0);
    });

    it('should apply different win rate bands for performance factor', async () => {
      const klines = generateKlines(50);

      const performanceTemplates = [
        { winRate: '65.00', avgRr: '2.5', expectedFactor: 1.2 },
        { winRate: '57.00', avgRr: '1.8', expectedFactor: 1.1 },
        { winRate: '52.00', avgRr: '1.2', expectedFactor: 1.0 },
        { winRate: '47.00', avgRr: '0.8', expectedFactor: 0.9 },
        { winRate: '42.00', avgRr: '0.6', expectedFactor: 0.8 },
        { winRate: '35.00', avgRr: '0.5', expectedFactor: 0.7 },
      ];

      for (const template of performanceTemplates) {
        vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
          id: 1,
          strategyId: 'test',
          symbol: 'BTCUSDT',
          interval: '1h',
          totalTrades: 30,
          winningTrades: 15,
          losingTrades: 15,
          breakevenTrades: 0,
          winRate: template.winRate,
          totalPnl: '100.00',
          maxConsecutiveLosses: 2,
          currentConsecutiveLosses: 0,
          lastTradeAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          totalPnlPercent: '5.00',
          avgWin: '8.00',
          avgLoss: '-3.00',
          avgRr: template.avgRr,
          maxDrawdown: '5.00',
          avgSlippagePercent: '0.01',
          avgExecutionTimeMs: 50,
        });

        const params: ConfidenceParams = {
          baseConfidence: 100,
          strategyId: 'test',
          symbol: 'BTCUSDT',
          interval: '1h',
          klines,
          currentVolume: 1000000,
          avgVolume: 1000000,
        };

        const result = await calculator.calculate(params);
        expect(result.strategyPerformance).toBe(template.expectedFactor);
      }
    });

    it('should return neutral factor when total trades below 20', async () => {
      const klines = generateKlines(50);

      vi.mocked(strategyPerformanceService.getPerformance).mockResolvedValue({
        id: 1,
        strategyId: 'test',
        symbol: 'BTCUSDT',
        interval: '1h',
        totalTrades: 15,
        winningTrades: 10,
        losingTrades: 5,
        breakevenTrades: 0,
        winRate: '66.67',
        totalPnl: '100.00',
        maxConsecutiveLosses: 1,
        currentConsecutiveLosses: 0,
        lastTradeAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        totalPnlPercent: '5.00',
        avgWin: '8.00',
        avgLoss: '-3.00',
        avgRr: '2.67',
        maxDrawdown: '2.00',
        avgSlippagePercent: '0.01',
        avgExecutionTimeMs: 50,
      });

      const params: ConfidenceParams = {
        baseConfidence: 80,
        strategyId: 'test',
        symbol: 'BTCUSDT',
        interval: '1h',
        klines,
        currentVolume: 1000000,
        avgVolume: 1000000,
      };

      const result = await calculator.calculate(params);
      expect(result.strategyPerformance).toBe(1.0);
    });
  });

  describe('enhanceBaseConfidence', () => {
    it('should calculate weighted average with default weights', () => {
      const factors = {
        pattern: 0.8,
        volume: 0.9,
        indicators: 0.7,
        trend: 0.85,
        momentum: 0.75,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should use custom weights when provided', () => {
      const factors = {
        pattern: 1.0,
        volume: 0.5,
      };

      const customWeights = {
        pattern: 0.8,
        volume: 0.2,
      };

      const result = calculator.enhanceBaseConfidence(factors, customWeights);

      const expectedConfidence = ((1.0 * 0.8 + 0.5 * 0.2) / (0.8 + 0.2)) * 100;
      expect(result).toBeCloseTo(expectedConfidence, 5);
    });

    it('should return 0 when no factors provided', () => {
      const result = calculator.enhanceBaseConfidence({});

      expect(result).toBe(0);
    });

    it('should handle single factor with default weight', () => {
      const factors = {
        pattern: 0.9,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      expect(result).toBeCloseTo(90, 1);
    });

    it('should use fallback weight for unknown factors', () => {
      const factors = {
        customFactor: 0.8,
        anotherFactor: 0.6,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(100);
    });

    it('should merge custom weights with defaults', () => {
      const factors = {
        pattern: 0.9,
        volume: 0.8,
        indicators: 0.7,
      };

      const customWeights = {
        pattern: 0.5,
      };

      const result = calculator.enhanceBaseConfidence(factors, customWeights);

      expect(result).toBeGreaterThan(0);
    });

    it('should handle all factors at maximum value', () => {
      const factors = {
        pattern: 1.0,
        volume: 1.0,
        indicators: 1.0,
        trend: 1.0,
        momentum: 1.0,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      expect(result).toBe(100);
    });

    it('should handle all factors at zero', () => {
      const factors = {
        pattern: 0,
        volume: 0,
        indicators: 0,
        trend: 0,
        momentum: 0,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      expect(result).toBe(0);
    });

    it('should calculate correctly with mixed factor values', () => {
      const factors = {
        pattern: 0.8,
        volume: 0.6,
      };

      const result = calculator.enhanceBaseConfidence(factors);

      const expectedWeight = 0.3 + 0.2;
      const expectedSum = 0.8 * 0.3 + 0.6 * 0.2;
      const expectedConfidence = (expectedSum / expectedWeight) * 100;
      expect(result).toBeCloseTo(expectedConfidence, 5);
    });

    it('should override default weight entirely when custom provided', () => {
      const factors = {
        pattern: 1.0,
      };

      const customWeights = {
        pattern: 1.0,
      };

      const result = calculator.enhanceBaseConfidence(factors, customWeights);

      expect(result).toBe(100);
    });
  });
});
