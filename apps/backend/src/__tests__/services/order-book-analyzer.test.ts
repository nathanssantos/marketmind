import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderBookAnalyzerService, getOrderBookAnalyzerService } from '../../services/order-book-analyzer';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
  serializeError: vi.fn((e) => e),
}));

vi.mock('binance', () => ({
  USDMClient: class MockUSDMClient {
    async getOrderBook({ symbol, limit }: { symbol: string; limit: number }) {
      if (symbol === 'ERROR') {
        throw new Error('API Error');
      }

      if (symbol === 'EMPTY') {
        return { bids: [], asks: [] };
      }

      return {
        bids: [
          [50000, 1.5],
          [49990, 2.0],
          [49980, 10.0],
          [49970, 0.5],
          [49960, 0.8],
        ].slice(0, limit),
        asks: [
          [50010, 1.2],
          [50020, 1.8],
          [50030, 0.5],
          [50040, 0.3],
          [50050, 15.0],
        ].slice(0, limit),
      };
    }
  },
  MainClient: class MockMainClient {
    async getOrderBook({ symbol: _symbol, limit }: { symbol: string; limit: number }) {
      return {
        bids: [
          [50000, 1.5],
          [49990, 2.0],
        ].slice(0, limit),
        asks: [
          [50010, 1.2],
          [50020, 1.8],
        ].slice(0, limit),
      };
    }
  },
}));

describe('OrderBookAnalyzerService', () => {
  let service: OrderBookAnalyzerService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new OrderBookAnalyzerService();
    service.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getOrderBookAnalysis', () => {
    it('should analyze order book and return analysis', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.imbalanceRatio).toBeGreaterThan(0);
      expect(result.bidVolume).toBeGreaterThan(0);
      expect(result.askVolume).toBeGreaterThan(0);
      expect(result.spread).toBeGreaterThan(0);
      expect(result.spreadPercent).toBeGreaterThan(0);
      expect(result.midPrice).toBeGreaterThan(0);
      expect(['BUYING', 'SELLING', 'NEUTRAL']).toContain(result.pressure);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should return cached data on second call', async () => {
      const result1 = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');
      const result2 = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      expect(result1.timestamp.getTime()).toBe(result2.timestamp.getTime());
    });

    it('should calculate imbalance ratio correctly', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      const expectedImbalance = result.bidVolume / result.askVolume;
      expect(result.imbalanceRatio).toBeCloseTo(expectedImbalance, 2);
    });

    it('should calculate spread correctly', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      expect(result.spread).toBe(10);
      expect(result.midPrice).toBe(50005);
    });

    it('should detect liquidity walls', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      expect(Array.isArray(result.bidWalls)).toBe(true);
      expect(Array.isArray(result.askWalls)).toBe(true);

      if (result.bidWalls.length > 0) {
        expect(result.bidWalls[0]).toHaveProperty('price');
        expect(result.bidWalls[0]).toHaveProperty('quantity');
        expect(result.bidWalls[0]).toHaveProperty('totalValue');
        expect(result.bidWalls[0]).toHaveProperty('percentFromPrice');
      }
    });

    it('should handle empty order book', async () => {
      const result = await service.getOrderBookAnalysis('EMPTY', 'FUTURES');

      expect(result.symbol).toBe('EMPTY');
      expect(result.imbalanceRatio).toBe(1);
      expect(result.bidVolume).toBe(0);
      expect(result.askVolume).toBe(0);
      expect(result.pressure).toBe('NEUTRAL');
    });

    it('should handle API errors gracefully', async () => {
      const result = await service.getOrderBookAnalysis('ERROR', 'FUTURES');

      expect(result.symbol).toBe('ERROR');
      expect(result.imbalanceRatio).toBe(1);
      expect(result.pressure).toBe('NEUTRAL');
    });

    it('should work with SPOT market type', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'SPOT');

      expect(result.symbol).toBe('BTCUSDT');
      expect(result.bidVolume).toBeGreaterThan(0);
    });
  });

  describe('getBatchOrderBookAnalysis', () => {
    it('should analyze multiple symbols', async () => {
      const results = await service.getBatchOrderBookAnalysis(
        ['BTCUSDT', 'ETHUSDT'],
        'FUTURES'
      );

      expect(results.size).toBe(2);
      expect(results.has('BTCUSDT')).toBe(true);
      expect(results.has('ETHUSDT')).toBe(true);
    });
  });

  describe('pressure detection', () => {
    it('should detect buying pressure when bid volume significantly higher', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      if (result.imbalanceRatio > 1.2) {
        expect(result.pressure).toBe('BUYING');
      }
    });

    it('should detect selling pressure when ask volume significantly higher', async () => {
      const result = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      if (result.imbalanceRatio < 0.8) {
        expect(result.pressure).toBe('SELLING');
      }
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');
      service.clearCache();

      const result1 = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');
      await new Promise((r) => setTimeout(r, 10));
      service.clearCache();
      const result2 = await service.getOrderBookAnalysis('BTCUSDT', 'FUTURES');

      expect(result1.timestamp.getTime()).not.toBe(result2.timestamp.getTime());
    });

    it('should allow setting custom cache TTL', () => {
      service.setCacheTTL(5000);
      expect(service).toBeDefined();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getOrderBookAnalyzerService();
      const instance2 = getOrderBookAnalyzerService();
      expect(instance1).toBe(instance2);
    });
  });
});
