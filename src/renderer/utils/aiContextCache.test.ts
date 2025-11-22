import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiContextCache } from './aiContextCache';
import type { OptimizedCandleData } from './candleOptimizer';

describe('aiContextCache', () => {
  beforeEach(() => {
    aiContextCache.clearAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockCandleData = (): OptimizedCandleData => ({
    detailed: [
      {
        timestamp: 1000,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000000,
      },
    ],
    simplified: [],
    timestampInfo: {
      timeframe: '1m',
      first: 1000,
      last: 1000,
      total: 1,
    },
  });

  describe('candle cache', () => {
    it('should cache and retrieve candle data', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);
      const cached = aiContextCache.getCachedCandles(key);

      expect(cached).toEqual(data);
    });

    it('should return null for non-existent cache key', () => {
      const key = { symbol: 'ETHUSDT', timeframe: '1h', count: 100 };
      const cached = aiContextCache.getCachedCandles(key);

      expect(cached).toBeNull();
    });

    it('should return null for expired cache entry', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);

      vi.advanceTimersByTime(6 * 60 * 1000);

      const cached = aiContextCache.getCachedCandles(key);
      expect(cached).toBeNull();
    });

    it('should delete expired entries when accessed', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);
      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(1);

      vi.advanceTimersByTime(6 * 60 * 1000);

      aiContextCache.getCachedCandles(key);
      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(0);
    });

    it('should create different cache keys for different symbols', () => {
      const key1 = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const key2 = { symbol: 'ETHUSDT', timeframe: '1h', count: 100 };
      const data1 = createMockCandleData();
      const data2 = {
        ...createMockCandleData(),
        timestampInfo: { ...createMockCandleData().timestampInfo, timeframe: '5m' },
      };

      aiContextCache.setCachedCandles(key1, data1);
      aiContextCache.setCachedCandles(key2, data2);

      expect(aiContextCache.getCachedCandles(key1)).toEqual(data1);
      expect(aiContextCache.getCachedCandles(key2)).toEqual(data2);
    });

    it('should create different cache keys for different timeframes', () => {
      const key1 = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const key2 = { symbol: 'BTCUSDT', timeframe: '5m', count: 100 };
      const data1 = createMockCandleData();
      const data2 = {
        ...createMockCandleData(),
        timestampInfo: { ...createMockCandleData().timestampInfo, timeframe: '5m' },
      };

      aiContextCache.setCachedCandles(key1, data1);
      aiContextCache.setCachedCandles(key2, data2);

      expect(aiContextCache.getCachedCandles(key1)).toEqual(data1);
      expect(aiContextCache.getCachedCandles(key2)).toEqual(data2);
    });

    it('should create different cache keys for different counts', () => {
      const key1 = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const key2 = { symbol: 'BTCUSDT', timeframe: '1h', count: 200 };
      const data1 = createMockCandleData();
      const data2 = createMockCandleData();

      aiContextCache.setCachedCandles(key1, data1);
      aiContextCache.setCachedCandles(key2, data2);

      expect(aiContextCache.getCachedCandles(key1)).toEqual(data1);
      expect(aiContextCache.getCachedCandles(key2)).toEqual(data2);
    });

    it('should overwrite existing cache entry with same key', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data1 = createMockCandleData();
      const data2 = {
        ...createMockCandleData(),
        timestampInfo: { ...createMockCandleData().timestampInfo, timeframe: '5m' },
      };

      aiContextCache.setCachedCandles(key, data1);
      aiContextCache.setCachedCandles(key, data2);

      expect(aiContextCache.getCachedCandles(key)).toEqual(data2);
    });

    it('should not expire entries before cache duration', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);

      vi.advanceTimersByTime(4 * 60 * 1000);

      const cached = aiContextCache.getCachedCandles(key);
      expect(cached).toEqual(data);
    });

    it('should clear candle cache', () => {
      const key1 = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const key2 = { symbol: 'ETHUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key1, data);
      aiContextCache.setCachedCandles(key2, data);

      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(2);

      aiContextCache.clearCandleCache();

      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(0);
      expect(aiContextCache.getCachedCandles(key1)).toBeNull();
      expect(aiContextCache.getCachedCandles(key2)).toBeNull();
    });
  });

  describe('summary cache', () => {
    it('should cache and retrieve summary', () => {
      const conversationId = 'conv-123';
      const summary = 'This is a test summary';

      aiContextCache.setCachedSummary(conversationId, summary);
      const cached = aiContextCache.getCachedSummary(conversationId);

      expect(cached).toBe(summary);
    });

    it('should return null for non-existent conversation', () => {
      const cached = aiContextCache.getCachedSummary('non-existent');
      expect(cached).toBeNull();
    });

    it('should return null for expired summary', () => {
      const conversationId = 'conv-123';
      const summary = 'This is a test summary';

      aiContextCache.setCachedSummary(conversationId, summary);

      vi.advanceTimersByTime(6 * 60 * 1000);

      const cached = aiContextCache.getCachedSummary(conversationId);
      expect(cached).toBeNull();
    });

    it('should delete expired summaries when accessed', () => {
      const conversationId = 'conv-123';
      const summary = 'This is a test summary';

      aiContextCache.setCachedSummary(conversationId, summary);
      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(1);

      vi.advanceTimersByTime(6 * 60 * 1000);

      aiContextCache.getCachedSummary(conversationId);
      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(0);
    });

    it('should cache different summaries for different conversations', () => {
      const conv1 = 'conv-123';
      const conv2 = 'conv-456';
      const summary1 = 'Summary 1';
      const summary2 = 'Summary 2';

      aiContextCache.setCachedSummary(conv1, summary1);
      aiContextCache.setCachedSummary(conv2, summary2);

      expect(aiContextCache.getCachedSummary(conv1)).toBe(summary1);
      expect(aiContextCache.getCachedSummary(conv2)).toBe(summary2);
    });

    it('should overwrite existing summary for same conversation', () => {
      const conversationId = 'conv-123';
      const summary1 = 'First summary';
      const summary2 = 'Updated summary';

      aiContextCache.setCachedSummary(conversationId, summary1);
      aiContextCache.setCachedSummary(conversationId, summary2);

      expect(aiContextCache.getCachedSummary(conversationId)).toBe(summary2);
    });

    it('should not expire summaries before cache duration', () => {
      const conversationId = 'conv-123';
      const summary = 'This is a test summary';

      aiContextCache.setCachedSummary(conversationId, summary);

      vi.advanceTimersByTime(4 * 60 * 1000);

      const cached = aiContextCache.getCachedSummary(conversationId);
      expect(cached).toBe(summary);
    });

    it('should clear summary cache', () => {
      aiContextCache.setCachedSummary('conv-1', 'Summary 1');
      aiContextCache.setCachedSummary('conv-2', 'Summary 2');

      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(2);

      aiContextCache.clearSummaryCache();

      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(0);
      expect(aiContextCache.getCachedSummary('conv-1')).toBeNull();
      expect(aiContextCache.getCachedSummary('conv-2')).toBeNull();
    });
  });

  describe('cache management', () => {
    it('should clear all caches', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();
      const conversationId = 'conv-123';
      const summary = 'Test summary';

      aiContextCache.setCachedCandles(key, data);
      aiContextCache.setCachedSummary(conversationId, summary);

      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(1);
      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(1);

      aiContextCache.clearAll();

      expect(aiContextCache.getCacheStats().candleCacheSize).toBe(0);
      expect(aiContextCache.getCacheStats().summaryCacheSize).toBe(0);
    });

    it('should return correct cache statistics', () => {
      expect(aiContextCache.getCacheStats()).toEqual({
        candleCacheSize: 0,
        summaryCacheSize: 0,
      });

      aiContextCache.setCachedCandles({ symbol: 'BTC', timeframe: '1h', count: 100 }, createMockCandleData());
      aiContextCache.setCachedCandles({ symbol: 'ETH', timeframe: '1h', count: 100 }, createMockCandleData());
      aiContextCache.setCachedSummary('conv-1', 'Summary 1');

      expect(aiContextCache.getCacheStats()).toEqual({
        candleCacheSize: 2,
        summaryCacheSize: 1,
      });
    });

    it('should maintain separate caches for candles and summaries', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();
      const conversationId = 'conv-123';
      const summary = 'Test summary';

      aiContextCache.setCachedCandles(key, data);
      aiContextCache.setCachedSummary(conversationId, summary);

      aiContextCache.clearCandleCache();

      expect(aiContextCache.getCachedCandles(key)).toBeNull();
      expect(aiContextCache.getCachedSummary(conversationId)).toBe(summary);
    });
  });

  describe('cache expiration edge cases', () => {
    it('should handle expiration exactly at cache duration boundary', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);

      vi.advanceTimersByTime(5 * 60 * 1000);

      const cached = aiContextCache.getCachedCandles(key);
      expect(cached).toEqual(data);

      vi.advanceTimersByTime(1);

      const expired = aiContextCache.getCachedCandles(key);
      expect(expired).toBeNull();
    });

    it('should handle multiple cache accesses within duration', () => {
      const key = { symbol: 'BTCUSDT', timeframe: '1h', count: 100 };
      const data = createMockCandleData();

      aiContextCache.setCachedCandles(key, data);

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(aiContextCache.getCachedCandles(key)).toEqual(data);

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(aiContextCache.getCachedCandles(key)).toEqual(data);

      vi.advanceTimersByTime(2 * 60 * 1000);
      expect(aiContextCache.getCachedCandles(key)).toBeNull();
    });
  });
});
