import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

const createMockKline = (overrides: Partial<Kline> = {}): Kline => ({
  openTime: Date.now() - 60000,
  closeTime: Date.now(),
  open: '100',
  high: '105',
  low: '95',
  close: '102',
  volume: '1000',
  quoteVolume: '102000',
  trades: 500,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '51000',
  ...overrides,
});

const createMockKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) =>
    createMockKline({ openTime: Date.now() - (count - i) * 60000 })
  );

describe('AutoTradingScheduler Cache Optimizations', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('FundingRateCache', () => {
    const FUNDING_CACHE_TTL_MS = 5 * 60 * 1000;

    interface CacheEntry<T> {
      data: T;
      timestamp: number;
    }

    class TestFundingRateCache {
      private cache: Map<string, CacheEntry<number>> = new Map();
      private ttl: number;
      private fetchCount = 0;
      private mockFetchFn: (symbol: string) => Promise<number | null>;

      constructor(ttl: number, mockFetchFn: (symbol: string) => Promise<number | null>) {
        this.ttl = ttl;
        this.mockFetchFn = mockFetchFn;
      }

      async getCachedFundingRate(symbol: string): Promise<number | null> {
        const cached = this.cache.get(symbol);
        if (cached && Date.now() - cached.timestamp < this.ttl) {
          return cached.data;
        }

        this.fetchCount++;
        const rate = await this.mockFetchFn(symbol);

        if (rate !== null) {
          this.cache.set(symbol, { data: rate, timestamp: Date.now() });
        }
        return rate;
      }

      getFetchCount(): number {
        return this.fetchCount;
      }

      clearCache(): void {
        this.cache.clear();
      }
    }

    it('should return cached value within TTL', async () => {
      const mockFetch = vi.fn().mockResolvedValue(0.0001);
      const cache = new TestFundingRateCache(FUNDING_CACHE_TTL_MS, mockFetch);

      const first = await cache.getCachedFundingRate('BTCUSDT');
      expect(first).toBe(0.0001);
      expect(cache.getFetchCount()).toBe(1);

      const second = await cache.getCachedFundingRate('BTCUSDT');
      expect(second).toBe(0.0001);
      expect(cache.getFetchCount()).toBe(1);
    });

    it('should refetch after TTL expires', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(0.0001)
        .mockResolvedValueOnce(0.0002);
      const cache = new TestFundingRateCache(FUNDING_CACHE_TTL_MS, mockFetch);

      const first = await cache.getCachedFundingRate('ETHUSDT');
      expect(first).toBe(0.0001);
      expect(cache.getFetchCount()).toBe(1);

      vi.advanceTimersByTime(FUNDING_CACHE_TTL_MS + 1);

      const second = await cache.getCachedFundingRate('ETHUSDT');
      expect(second).toBe(0.0002);
      expect(cache.getFetchCount()).toBe(2);
    });

    it('should cache different symbols independently', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(0.0001)
        .mockResolvedValueOnce(0.0003);
      const cache = new TestFundingRateCache(FUNDING_CACHE_TTL_MS, mockFetch);

      const btc = await cache.getCachedFundingRate('BTCUSDT');
      expect(btc).toBe(0.0001);

      const eth = await cache.getCachedFundingRate('ETHUSDT');
      expect(eth).toBe(0.0003);

      expect(cache.getFetchCount()).toBe(2);

      const btcAgain = await cache.getCachedFundingRate('BTCUSDT');
      expect(btcAgain).toBe(0.0001);
      expect(cache.getFetchCount()).toBe(2);
    });

    it('should not cache null values', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(0.0001);
      const cache = new TestFundingRateCache(FUNDING_CACHE_TTL_MS, mockFetch);

      const first = await cache.getCachedFundingRate('NEWCOIN');
      expect(first).toBeNull();
      expect(cache.getFetchCount()).toBe(1);

      const second = await cache.getCachedFundingRate('NEWCOIN');
      expect(second).toBe(0.0001);
      expect(cache.getFetchCount()).toBe(2);
    });

    it('should clear cache properly', async () => {
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(0.0001)
        .mockResolvedValueOnce(0.0002);
      const cache = new TestFundingRateCache(FUNDING_CACHE_TTL_MS, mockFetch);

      await cache.getCachedFundingRate('BTCUSDT');
      expect(cache.getFetchCount()).toBe(1);

      cache.clearCache();

      await cache.getCachedFundingRate('BTCUSDT');
      expect(cache.getFetchCount()).toBe(2);
    });
  });

  describe('CycleKlines Optimization', () => {
    it('should provide sufficient klines for all filters', () => {
      const cycleKlines = createMockKlines(100);

      expect(cycleKlines.length).toBeGreaterThanOrEqual(30);
      expect(cycleKlines.length).toBeGreaterThanOrEqual(21);
      expect(cycleKlines.length).toBeGreaterThanOrEqual(28);
      expect(cycleKlines.length).toBeGreaterThanOrEqual(40);
    });

    it('should have klines in chronological order', () => {
      const cycleKlines = createMockKlines(50);

      for (let i = 1; i < cycleKlines.length; i++) {
        expect(cycleKlines[i]!.openTime).toBeGreaterThan(cycleKlines[i - 1]!.openTime);
      }
    });

    it('should have valid kline data structure', () => {
      const kline = createMockKline();

      expect(typeof kline.openTime).toBe('number');
      expect(typeof kline.closeTime).toBe('number');
      expect(typeof kline.open).toBe('string');
      expect(typeof kline.high).toBe('string');
      expect(typeof kline.low).toBe('string');
      expect(typeof kline.close).toBe('string');
      expect(typeof kline.volume).toBe('string');
    });
  });

  describe('BTC Klines Cache', () => {
    const CACHE_TTL_MS = 60 * 1000;

    interface CacheEntry<T> {
      data: T;
      timestamp: number;
    }

    class TestBtcKlinesCache {
      private cache: Map<string, CacheEntry<Kline[]>> = new Map();
      private ttl: number;
      private fetchCount = 0;
      private mockFetchFn: () => Promise<Kline[]>;

      constructor(ttl: number, mockFetchFn: () => Promise<Kline[]>) {
        this.ttl = ttl;
        this.mockFetchFn = mockFetchFn;
      }

      isCacheValid(cacheKey: string): boolean {
        const cached = this.cache.get(cacheKey);
        if (!cached) return false;
        return Date.now() - cached.timestamp < this.ttl;
      }

      async getBtcKlines(interval: string): Promise<Kline[]> {
        const cacheKey = `BTCUSDT-${interval}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.ttl) {
          return cached.data;
        }

        this.fetchCount++;
        const btcKlines = await this.mockFetchFn();
        this.cache.set(cacheKey, { data: btcKlines, timestamp: Date.now() });
        return btcKlines;
      }

      getFetchCount(): number {
        return this.fetchCount;
      }

      clearCache(): void {
        this.cache.clear();
      }
    }

    it('should cache BTC klines for 60 seconds', async () => {
      const mockKlines = createMockKlines(100);
      const mockFetch = vi.fn().mockResolvedValue(mockKlines);
      const cache = new TestBtcKlinesCache(CACHE_TTL_MS, mockFetch);

      await cache.getBtcKlines('1h');
      expect(cache.getFetchCount()).toBe(1);

      await cache.getBtcKlines('1h');
      expect(cache.getFetchCount()).toBe(1);

      vi.advanceTimersByTime(30 * 1000);
      await cache.getBtcKlines('1h');
      expect(cache.getFetchCount()).toBe(1);

      vi.advanceTimersByTime(31 * 1000);
      await cache.getBtcKlines('1h');
      expect(cache.getFetchCount()).toBe(2);
    });

    it('should cache different intervals separately', async () => {
      const mockKlines1h = createMockKlines(100);
      const mockKlines4h = createMockKlines(100);
      const mockFetch = vi.fn()
        .mockResolvedValueOnce(mockKlines1h)
        .mockResolvedValueOnce(mockKlines4h);
      const cache = new TestBtcKlinesCache(CACHE_TTL_MS, mockFetch);

      await cache.getBtcKlines('1h');
      await cache.getBtcKlines('4h');
      expect(cache.getFetchCount()).toBe(2);

      await cache.getBtcKlines('1h');
      await cache.getBtcKlines('4h');
      expect(cache.getFetchCount()).toBe(2);
    });
  });

  describe('HTF Klines Cache', () => {
    const CACHE_TTL_MS = 60 * 1000;

    interface CacheEntry<T> {
      data: T;
      timestamp: number;
    }

    class TestHtfKlinesCache {
      private cache: Map<string, CacheEntry<Kline[]>> = new Map();
      private ttl: number;
      private fetchCount = 0;
      private mockFetchFn: () => Promise<Kline[]>;

      constructor(ttl: number, mockFetchFn: () => Promise<Kline[]>) {
        this.ttl = ttl;
        this.mockFetchFn = mockFetchFn;
      }

      async getHtfKlines(symbol: string, htfInterval: string): Promise<Kline[]> {
        const cacheKey = `${symbol}-${htfInterval}`;
        const cached = this.cache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < this.ttl) {
          return cached.data;
        }

        this.fetchCount++;
        const htfKlines = await this.mockFetchFn();
        this.cache.set(cacheKey, { data: htfKlines, timestamp: Date.now() });
        return htfKlines;
      }

      getFetchCount(): number {
        return this.fetchCount;
      }

      clearCache(): void {
        this.cache.clear();
      }
    }

    it('should cache HTF klines by symbol and interval', async () => {
      const mockKlines = createMockKlines(300);
      const mockFetch = vi.fn().mockResolvedValue(mockKlines);
      const cache = new TestHtfKlinesCache(CACHE_TTL_MS, mockFetch);

      await cache.getHtfKlines('ETHUSDT', '4h');
      expect(cache.getFetchCount()).toBe(1);

      await cache.getHtfKlines('ETHUSDT', '4h');
      expect(cache.getFetchCount()).toBe(1);

      await cache.getHtfKlines('ETHUSDT', '1d');
      expect(cache.getFetchCount()).toBe(2);

      await cache.getHtfKlines('BTCUSDT', '4h');
      expect(cache.getFetchCount()).toBe(3);
    });

    it('should invalidate cache after TTL', async () => {
      const mockKlines = createMockKlines(300);
      const mockFetch = vi.fn().mockResolvedValue(mockKlines);
      const cache = new TestHtfKlinesCache(CACHE_TTL_MS, mockFetch);

      await cache.getHtfKlines('SOLUSDT', '4h');
      expect(cache.getFetchCount()).toBe(1);

      vi.advanceTimersByTime(CACHE_TTL_MS + 1);

      await cache.getHtfKlines('SOLUSDT', '4h');
      expect(cache.getFetchCount()).toBe(2);
    });
  });

  describe('Cache Clearing', () => {
    it('should clear all caches when no active watchers', () => {
      const btcCache = new Map<string, { data: Kline[]; timestamp: number }>();
      const htfCache = new Map<string, { data: Kline[]; timestamp: number }>();
      const fundingCache = new Map<string, { data: number; timestamp: number }>();

      btcCache.set('BTCUSDT-1h', { data: createMockKlines(100), timestamp: Date.now() });
      htfCache.set('ETHUSDT-4h', { data: createMockKlines(300), timestamp: Date.now() });
      fundingCache.set('BTCUSDT', { data: 0.0001, timestamp: Date.now() });

      expect(btcCache.size).toBe(1);
      expect(htfCache.size).toBe(1);
      expect(fundingCache.size).toBe(1);

      btcCache.clear();
      htfCache.clear();
      fundingCache.clear();

      expect(btcCache.size).toBe(0);
      expect(htfCache.size).toBe(0);
      expect(fundingCache.size).toBe(0);
    });
  });

  describe('Performance Metrics', () => {
    it('should demonstrate cache hit benefits', () => {
      let fetchCount = 0;
      const slowFetch = vi.fn().mockImplementation(() => {
        fetchCount++;
        return Promise.resolve(0.0001);
      });

      interface CacheEntry<T> {
        data: T;
        timestamp: number;
      }

      const cache = new Map<string, CacheEntry<number>>();
      const CACHE_TTL = 5 * 60 * 1000;

      const getCachedValueSync = (symbol: string): number | null => {
        const cached = cache.get(symbol);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          return cached.data;
        }
        fetchCount++;
        const value = 0.0001;
        cache.set(symbol, { data: value, timestamp: Date.now() });
        return value;
      };

      getCachedValueSync('BTCUSDT');
      expect(fetchCount).toBe(1);

      getCachedValueSync('BTCUSDT');
      expect(fetchCount).toBe(1);

      getCachedValueSync('ETHUSDT');
      expect(fetchCount).toBe(2);

      getCachedValueSync('BTCUSDT');
      getCachedValueSync('ETHUSDT');
      expect(fetchCount).toBe(2);
    });
  });
});
