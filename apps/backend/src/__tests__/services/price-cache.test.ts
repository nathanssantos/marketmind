import type { MarketType } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/binance-client', () => ({
  createBinanceClientForPrices: vi.fn(() => ({
    getSymbolPriceTicker: vi.fn(),
  })),
  createBinanceFuturesClientForPrices: vi.fn(() => ({
    getMarkPrice: vi.fn(),
  })),
}));

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

interface SymbolKey {
  symbol: string;
  marketType: MarketType;
}

const DEFAULT_MAX_AGE_MS = 3000;

class TestableInMemoryPriceCache {
  private prices: Map<string, PriceCacheEntry> = new Map();
  private readonly maxAgeMs: number;
  private _hits = 0;
  private _misses = 0;

  constructor(maxAgeMs: number = DEFAULT_MAX_AGE_MS) {
    this.maxAgeMs = maxAgeMs;
  }

  private getCacheKey(symbol: string, marketType: MarketType): string {
    return `${symbol}-${marketType}`;
  }

  updateFromWebSocket(symbol: string, marketType: MarketType, price: number): void {
    const key = this.getCacheKey(symbol, marketType);
    this.prices.set(key, { price, timestamp: Date.now() });
  }

  getPrice(symbol: string, marketType: MarketType): number | null {
    const key = this.getCacheKey(symbol, marketType);
    const entry = this.prices.get(key);
    if (!entry || Date.now() - entry.timestamp > this.maxAgeMs) {
      this._misses++;
      return null;
    }
    this._hits++;
    return entry.price;
  }

  clear(): void {
    this.prices.clear();
    this._hits = 0;
    this._misses = 0;
  }

  get hits(): number {
    return this._hits;
  }

  get misses(): number {
    return this._misses;
  }

  get size(): number {
    return this.prices.size;
  }

  getStats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this._hits + this._misses;
    return {
      size: this.prices.size,
      hits: this._hits,
      misses: this._misses,
      hitRate: total > 0 ? this._hits / total : 0,
    };
  }
}

describe('InMemoryPriceCache', () => {
  let cache: TestableInMemoryPriceCache;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
    cache = new TestableInMemoryPriceCache();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('updateFromWebSocket', () => {
    it('should store price for SPOT market', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
    });

    it('should store price for FUTURES market', () => {
      cache.updateFromWebSocket('BTCUSDT', 'FUTURES', 42100);
      expect(cache.getPrice('BTCUSDT', 'FUTURES')).toBe(42100);
    });

    it('should store different prices for same symbol in different markets', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('BTCUSDT', 'FUTURES', 42100);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
      expect(cache.getPrice('BTCUSDT', 'FUTURES')).toBe(42100);
    });

    it('should update existing price', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 43000);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(43000);
    });

    it('should store multiple symbols', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('ETHUSDT', 'SPOT', 2500);
      cache.updateFromWebSocket('SOLUSDT', 'FUTURES', 100);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
      expect(cache.getPrice('ETHUSDT', 'SPOT')).toBe(2500);
      expect(cache.getPrice('SOLUSDT', 'FUTURES')).toBe(100);
      expect(cache.size).toBe(3);
    });
  });

  describe('getPrice', () => {
    it('should return null for non-existent symbol', () => {
      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBeNull();
    });

    it('should return cached price within TTL', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(2000);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
    });

    it('should return null after TTL expires', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(3001);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBeNull();
    });

    it('should return price exactly at TTL boundary', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(3000);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
    });

    it('should refresh TTL on update', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(2500);
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 43000);

      vi.advanceTimersByTime(2500);

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(43000);
    });
  });

  describe('cache metrics', () => {
    it('should track hits correctly', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('BTCUSDT', 'SPOT');

      expect(cache.hits).toBe(3);
      expect(cache.misses).toBe(0);
    });

    it('should track misses correctly', () => {
      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('ETHUSDT', 'SPOT');

      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(2);
    });

    it('should track both hits and misses', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('ETHUSDT', 'SPOT');
      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('SOLUSDT', 'FUTURES');

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should reset metrics on clear', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('ETHUSDT', 'SPOT');

      cache.clear();

      expect(cache.hits).toBe(0);
      expect(cache.misses).toBe(0);
      expect(cache.size).toBe(0);
    });

    it('should track miss when TTL expires', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      cache.getPrice('BTCUSDT', 'SPOT');

      vi.advanceTimersByTime(3001);

      cache.getPrice('BTCUSDT', 'SPOT');

      expect(cache.hits).toBe(1);
      expect(cache.misses).toBe(1);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('ETHUSDT', 'SPOT', 2500);
      cache.updateFromWebSocket('SOLUSDT', 'FUTURES', 100);

      cache.clear();

      expect(cache.size).toBe(0);
      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBeNull();
      expect(cache.getPrice('ETHUSDT', 'SPOT')).toBeNull();
      expect(cache.getPrice('SOLUSDT', 'FUTURES')).toBeNull();
    });
  });

  describe('custom TTL', () => {
    it('should respect custom TTL', () => {
      const shortTtlCache = new TestableInMemoryPriceCache(1000);
      shortTtlCache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(1001);

      expect(shortTtlCache.getPrice('BTCUSDT', 'SPOT')).toBeNull();
    });

    it('should work with longer TTL', () => {
      const longTtlCache = new TestableInMemoryPriceCache(10000);
      longTtlCache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);

      vi.advanceTimersByTime(9000);

      expect(longTtlCache.getPrice('BTCUSDT', 'SPOT')).toBe(42000);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('ETHUSDT', 'SPOT', 2500);

      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('BTCUSDT', 'SPOT');
      cache.getPrice('SOLUSDT', 'FUTURES');

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.667, 2);
    });

    it('should return 0 hit rate when no requests', () => {
      const stats = cache.getStats();
      expect(stats.hitRate).toBe(0);
    });
  });
});

describe('InMemoryPriceCache Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('batchFetch simulation', () => {
    it('should use cached values and fetch only missing ones', async () => {
      const cache = new TestableInMemoryPriceCache();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000);
      cache.updateFromWebSocket('ETHUSDT', 'SPOT', 2500);

      const symbolsToFetch: SymbolKey[] = [
        { symbol: 'BTCUSDT', marketType: 'SPOT' },
        { symbol: 'ETHUSDT', marketType: 'SPOT' },
        { symbol: 'SOLUSDT', marketType: 'SPOT' },
        { symbol: 'BTCUSDT', marketType: 'FUTURES' },
      ];

      const result = new Map<string, number>();
      const toFetch: SymbolKey[] = [];

      for (const s of symbolsToFetch) {
        const cached = cache.getPrice(s.symbol, s.marketType);
        if (cached !== null) {
          result.set(`${s.symbol}-${s.marketType}`, cached);
        } else {
          toFetch.push(s);
        }
      }

      expect(result.size).toBe(2);
      expect(result.get('BTCUSDT-SPOT')).toBe(42000);
      expect(result.get('ETHUSDT-SPOT')).toBe(2500);

      expect(toFetch).toHaveLength(2);
      expect(toFetch).toContainEqual({ symbol: 'SOLUSDT', marketType: 'SPOT' });
      expect(toFetch).toContainEqual({ symbol: 'BTCUSDT', marketType: 'FUTURES' });
    });
  });

  describe('WebSocket update integration', () => {
    it('should handle rapid WebSocket updates', () => {
      const cache = new TestableInMemoryPriceCache();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      for (let i = 0; i < 100; i++) {
        cache.updateFromWebSocket('BTCUSDT', 'SPOT', 42000 + i);
      }

      expect(cache.getPrice('BTCUSDT', 'SPOT')).toBe(42099);
      expect(cache.size).toBe(1);
    });

    it('should handle multiple symbols from WebSocket', () => {
      const cache = new TestableInMemoryPriceCache();
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));

      const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'AVAXUSDT', 'DOTUSDT'];
      const marketTypes: Array<MarketType> = ['SPOT', 'FUTURES'];

      for (const symbol of symbols) {
        for (const marketType of marketTypes) {
          cache.updateFromWebSocket(symbol, marketType, Math.random() * 1000);
        }
      }

      expect(cache.size).toBe(10);
    });
  });
});
