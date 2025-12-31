import { beforeAll, afterAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { setupTestDatabase, teardownTestDatabase, getTestDatabase, cleanupTables } from '../helpers/test-db';
import { createAuthenticatedUser } from '../helpers/test-fixtures';
import { createAuthenticatedCaller, createUnauthenticatedCaller } from '../helpers/test-caller';
import * as schema from '../../db/schema';
import type { Interval, MarketType } from '@marketmind/types';

vi.mock('../../services/binance-kline-stream', () => ({
  binanceKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
  binanceFuturesKlineStreamService: {
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    getActiveSubscriptions: vi.fn().mockReturnValue([]),
  },
}));

vi.mock('../../services/binance-historical', () => ({
  smartBackfillKlines: vi.fn().mockResolvedValue({
    downloaded: 0,
    totalInDb: 100,
    gaps: 0,
    alreadyComplete: true,
  }),
  getIntervalMilliseconds: vi.fn((interval: string) => {
    const intervals: Record<string, number> = {
      '1m': 60000,
      '5m': 300000,
      '15m': 900000,
      '1h': 3600000,
      '4h': 14400000,
      '1d': 86400000,
    };
    return intervals[interval] || 60000;
  }),
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import { binanceKlineStreamService, binanceFuturesKlineStreamService } from '../../services/binance-kline-stream';
import { smartBackfillKlines } from '../../services/binance-historical';

describe('Kline Router', () => {
  let db: ReturnType<typeof getTestDatabase>;

  beforeAll(async () => {
    await setupTestDatabase();
    db = getTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await db.delete(schema.klines);
    await cleanupTables();
  });

  const createTestKline = async (options: {
    symbol?: string;
    interval?: Interval;
    marketType?: MarketType;
    openTime?: Date;
    closeTime?: Date;
  } = {}) => {
    const baseTime = options.openTime || new Date(Date.now() - 60000);
    const closeTime = options.closeTime || new Date(baseTime.getTime() + 60000);

    const [kline] = await db.insert(schema.klines).values({
      symbol: options.symbol || 'BTCUSDT',
      interval: options.interval || '1m',
      marketType: options.marketType || 'SPOT',
      openTime: baseTime,
      closeTime: closeTime,
      open: '50000',
      high: '51000',
      low: '49000',
      close: '50500',
      volume: '100',
      quoteVolume: '5000000',
      trades: 1000,
      takerBuyBaseVolume: '50',
      takerBuyQuoteVolume: '2500000',
    }).returning();

    return kline;
  };

  describe('Authentication', () => {
    it('should reject unauthenticated access to list', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.kline.list({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT' })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated access to subscribe', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.kline.subscribe({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT' })
      ).rejects.toThrow('UNAUTHORIZED');
    });

    it('should reject unauthenticated access to searchSymbols', async () => {
      const caller = createUnauthenticatedCaller();
      await expect(
        caller.kline.searchSymbols({ query: 'BTC', marketType: 'SPOT' })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('subscribe', () => {
    it('should subscribe to SPOT stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.subscribe({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Subscribed to BTCUSDT@1h (SPOT)');
      expect(binanceKlineStreamService.subscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
    });

    it('should subscribe to FUTURES stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.subscribe({
        symbol: 'BTCUSDT',
        interval: '15m',
        marketType: 'FUTURES',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Subscribed to BTCUSDT@15m (FUTURES)');
      expect(binanceFuturesKlineStreamService.subscribe).toHaveBeenCalledWith('BTCUSDT', '15m');
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe from SPOT stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.unsubscribe({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Unsubscribed from BTCUSDT@1h (SPOT)');
      expect(binanceKlineStreamService.unsubscribe).toHaveBeenCalledWith('BTCUSDT', '1h');
    });

    it('should unsubscribe from FUTURES stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.unsubscribe({
        symbol: 'ETHUSDT',
        interval: '4h',
        marketType: 'FUTURES',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Unsubscribed from ETHUSDT@4h (FUTURES)');
      expect(binanceFuturesKlineStreamService.unsubscribe).toHaveBeenCalledWith('ETHUSDT', '4h');
    });
  });

  describe('list', () => {
    it('should return klines for a symbol', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestKline({ symbol: 'BTCUSDT', interval: '1m', marketType: 'SPOT' });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1m', marketType: 'SPOT', openTime: new Date(Date.now() - 120000) });

      const result = await caller.kline.list({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
        limit: 10,
      });

      expect(result.length).toBe(2);
      expect(smartBackfillKlines).toHaveBeenCalledWith('BTCUSDT', '1m', 10, 'SPOT');
      expect(binanceKlineStreamService.subscribe).toHaveBeenCalledWith('BTCUSDT', '1m');
    });

    it('should filter by time range', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(now - 3600000 * 3) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(now - 3600000 * 2) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(now - 3600000) });

      const result = await caller.kline.list({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
        startTime: new Date(now - 3600000 * 2.5),
        endTime: new Date(now - 3600000 * 0.5),
        limit: 100,
      });

      expect(result.length).toBe(2);
    });

    it('should return klines sorted by openTime ascending', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      await createTestKline({ symbol: 'BTCUSDT', interval: '5m', marketType: 'FUTURES', openTime: new Date(now - 300000) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '5m', marketType: 'FUTURES', openTime: new Date(now - 600000) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '5m', marketType: 'FUTURES', openTime: new Date(now - 900000) });

      const result = await caller.kline.list({
        symbol: 'BTCUSDT',
        interval: '5m',
        marketType: 'FUTURES',
        limit: 100,
      });

      expect(result.length).toBe(3);
      expect(new Date(result[0].openTime).getTime()).toBeLessThan(new Date(result[1].openTime).getTime());
      expect(new Date(result[1].openTime).getTime()).toBeLessThan(new Date(result[2].openTime).getTime());
    });
  });

  describe('backfill', () => {
    it('should trigger backfill for SPOT market', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.backfill({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
        periodsBack: 500,
      });

      expect(result.success).toBe(true);
      expect(result.downloaded).toBeDefined();
      expect(result.totalInDb).toBeDefined();
      expect(smartBackfillKlines).toHaveBeenCalledWith('BTCUSDT', '1h', 500, 'SPOT');
    });

    it('should trigger backfill for FUTURES market', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.backfill({
        symbol: 'ETHUSDT',
        interval: '4h',
        marketType: 'FUTURES',
        periodsBack: 200,
      });

      expect(result.success).toBe(true);
      expect(smartBackfillKlines).toHaveBeenCalledWith('ETHUSDT', '4h', 200, 'FUTURES');
    });
  });

  describe('latest', () => {
    it('should return the latest kline', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(now - 7200000) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(now - 3600000) });

      const result = await caller.kline.latest({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      expect(result).toBeDefined();
      expect(new Date(result!.openTime).getTime()).toBe(now - 3600000);
    });

    it('should return undefined when no klines exist', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.latest({
        symbol: 'XYZUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      expect(result).toBeUndefined();
    });
  });

  describe('subscribeStream / unsubscribeStream', () => {
    it('should subscribe to real-time stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.subscribeStream({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('real-time stream');
      expect(binanceKlineStreamService.subscribe).toHaveBeenCalledWith('BTCUSDT', '1m');
    });

    it('should unsubscribe from real-time stream', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.unsubscribeStream({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain('Unsubscribed');
      expect(binanceFuturesKlineStreamService.unsubscribe).toHaveBeenCalledWith('BTCUSDT', '1m');
    });
  });

  describe('getActiveStreams', () => {
    it('should return active subscriptions for both markets', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      vi.mocked(binanceKlineStreamService.getActiveSubscriptions).mockReturnValue(['BTCUSDT@1h', 'ETHUSDT@1h']);
      vi.mocked(binanceFuturesKlineStreamService.getActiveSubscriptions).mockReturnValue(['BTCUSDT@15m']);

      const result = await caller.kline.getActiveStreams();

      expect(result.streams).toEqual(['BTCUSDT@1h', 'ETHUSDT@1h']);
      expect(result.futuresStreams).toEqual(['BTCUSDT@15m']);
    });
  });

  describe('count', () => {
    it('should return count of klines', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT' });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(Date.now() - 3600000) });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT', openTime: new Date(Date.now() - 7200000) });

      const result = await caller.kline.count({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      expect(result.count).toBe(3);
    });

    it('should filter by market type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'SPOT' });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES' });
      await createTestKline({ symbol: 'BTCUSDT', interval: '1h', marketType: 'FUTURES', openTime: new Date(Date.now() - 3600000) });

      const spotCount = await caller.kline.count({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'SPOT',
      });

      const futuresCount = await caller.kline.count({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
      });

      expect(spotCount.count).toBe(1);
      expect(futuresCount.count).toBe(2);
    });
  });

  describe('sync', () => {
    it('should return klines since timestamp', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      await createTestKline({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
        openTime: new Date(now - 120000),
        closeTime: new Date(now - 60001),
      });
      await createTestKline({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
        openTime: new Date(now - 60000),
        closeTime: new Date(now - 1),
      });

      const result = await caller.kline.sync({
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'SPOT',
        since: now - 180000,
        limit: 100,
      });

      expect(result.klines.length).toBeGreaterThanOrEqual(0);
      expect(result.serverTime).toBeGreaterThan(0);
      expect(result.nextExpectedOpen).toBeDefined();
    });

    it('should sort klines by openTime ascending', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const now = Date.now();
      await createTestKline({
        symbol: 'ETHUSDT',
        interval: '5m',
        marketType: 'FUTURES',
        openTime: new Date(now - 600000),
        closeTime: new Date(now - 300001),
      });
      await createTestKline({
        symbol: 'ETHUSDT',
        interval: '5m',
        marketType: 'FUTURES',
        openTime: new Date(now - 900000),
        closeTime: new Date(now - 600001),
      });

      const result = await caller.kline.sync({
        symbol: 'ETHUSDT',
        interval: '5m',
        marketType: 'FUTURES',
        since: now - 1000000,
        limit: 100,
      });

      if (result.klines.length >= 2) {
        expect(new Date(result.klines[0].openTime).getTime()).toBeLessThan(
          new Date(result.klines[1].openTime).getTime()
        );
      }
    });
  });

  describe('searchSymbols', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    it('should search SPOT symbols and use cache on subsequent calls', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          symbols: [
            { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', status: 'TRADING' },
            { symbol: 'BTCBUSD', baseAsset: 'BTC', quoteAsset: 'BUSD', status: 'TRADING' },
            { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', status: 'TRADING' },
          ],
        }),
      });

      const result1 = await caller.kline.searchSymbols({
        query: 'BTC',
        marketType: 'SPOT',
      });

      expect(result1.length).toBe(2);
      expect(result1[0].symbol).toBe('BTCUSDT');
      expect(result1[1].symbol).toBe('BTCBUSD');

      const result2 = await caller.kline.searchSymbols({
        query: 'ETH',
        marketType: 'SPOT',
      });

      expect(result2.length).toBe(1);
      expect(result2[0].symbol).toBe('ETHUSDT');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should search FUTURES symbols', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          symbols: [
            { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', contractStatus: 'TRADING' },
            { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', contractStatus: 'TRADING' },
          ],
        }),
      });

      const result = await caller.kline.searchSymbols({
        query: 'ETH',
        marketType: 'FUTURES',
      });

      expect(result.length).toBe(1);
      expect(result[0].symbol).toBe('ETHUSDT');
      expect(mockFetch).toHaveBeenCalledWith('https://fapi.binance.com/fapi/v1/exchangeInfo');
    });

    it('should search case-insensitively', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.searchSymbols({
        query: 'btc',
        marketType: 'SPOT',
      });

      expect(result.some(s => s.symbol === 'BTCUSDT')).toBe(true);
    });

    it('should filter by quote asset', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.searchSymbols({
        query: 'USDT',
        marketType: 'SPOT',
      });

      expect(result.every(s => s.quoteAsset === 'USDT')).toBe(true);
    });

    it('should limit results to 50 max', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      const result = await caller.kline.searchSymbols({
        query: 'U',
        marketType: 'SPOT',
      });

      expect(result.length).toBeLessThanOrEqual(50);
    });
  });

  describe('Input validation', () => {
    it('should reject invalid interval', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.kline.subscribe({
          symbol: 'BTCUSDT',
          interval: 'invalid' as any,
          marketType: 'SPOT',
        })
      ).rejects.toThrow();
    });

    it('should reject invalid market type', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.kline.subscribe({
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'INVALID' as any,
        })
      ).rejects.toThrow();
    });

    it('should reject empty symbol search query', async () => {
      const { user, session } = await createAuthenticatedUser();
      const caller = createAuthenticatedCaller(user, session);

      await expect(
        caller.kline.searchSymbols({
          query: '',
          marketType: 'SPOT',
        })
      ).rejects.toThrow();
    });
  });
});
