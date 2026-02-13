import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../../db', () => ({
  db: {
    query: {
      klines: { findMany: vi.fn() },
    },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(),
        })),
      })),
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: { walletId: 'walletId' },
  klines: {
    symbol: 'symbol',
    interval: 'interval',
    marketType: 'marketType',
    openTime: 'openTime',
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock('../../../constants', () => ({
  AUTO_TRADING_CACHE: {
    DEFAULT_TTL_MS: 60_000,
    CONFIG_TTL_MS: 30_000,
    FUNDING_RATE_TTL_MS: 300_000,
  },
}));

import { CacheManager } from '../cache-manager';
import { db } from '../../../db';

describe('CacheManager', () => {
  let manager: CacheManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new CacheManager();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('isCacheValid', () => {
    it('should return false for undefined entry', () => {
      expect(manager.isCacheValid(undefined)).toBe(false);
    });

    it('should return true for fresh entry', () => {
      const entry = { data: 'test', timestamp: Date.now() };
      expect(manager.isCacheValid(entry)).toBe(true);
    });

    it('should return false for expired entry', () => {
      const entry = { data: 'test', timestamp: Date.now() };
      vi.advanceTimersByTime(60_001);
      expect(manager.isCacheValid(entry)).toBe(false);
    });

    it('should use custom TTL', () => {
      const entry = { data: 'test', timestamp: Date.now() };
      vi.advanceTimersByTime(5000);
      expect(manager.isCacheValid(entry, 3000)).toBe(false);
      expect(manager.isCacheValid(entry, 10000)).toBe(true);
    });
  });

  describe('getBtcKlines', () => {
    it('should return cached klines when cache is valid', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValueOnce(
        [{ symbol: 'BTCUSDT', interval: '1h', openTime: new Date(1000), closeTime: new Date(2000), open: '100', high: '101', low: '99', close: '100', volume: '1000', quoteVolume: '10000', trades: 50, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '5000' }] as never
      );

      const first = await manager.getBtcKlines('1h');
      const second = await manager.getBtcKlines('1h');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(1);
      expect(first).toEqual(second);
    });

    it('should refetch when cache expires', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValue(
        [{ symbol: 'BTCUSDT', interval: '1h', openTime: new Date(1000), closeTime: new Date(2000), open: '100', high: '101', low: '99', close: '100', volume: '1000', quoteVolume: null, trades: null, takerBuyBaseVolume: null, takerBuyQuoteVolume: null }] as never
      );

      await manager.getBtcKlines('1h');
      vi.advanceTimersByTime(60_001);
      await manager.getBtcKlines('1h');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(2);
    });

    it('should use separate cache keys for different intervals', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValue([] as never);

      await manager.getBtcKlines('1h');
      await manager.getBtcKlines('4h');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(2);
    });

    it('should use separate cache keys for different market types', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValue([] as never);

      await manager.getBtcKlines('1h', 'FUTURES');
      await manager.getBtcKlines('1h', 'SPOT');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(2);
    });

    it('should handle null optional fields with defaults', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValueOnce(
        [{ symbol: 'BTCUSDT', interval: '1h', openTime: new Date(1000), closeTime: new Date(2000), open: '100', high: '101', low: '99', close: '100', volume: '1000', quoteVolume: null, trades: null, takerBuyBaseVolume: null, takerBuyQuoteVolume: null }] as never
      );

      const result = await manager.getBtcKlines('1h');
      expect(result[0]!.quoteVolume).toBe('0');
      expect(result[0]!.trades).toBe(0);
      expect(result[0]!.takerBuyBaseVolume).toBe('0');
      expect(result[0]!.takerBuyQuoteVolume).toBe('0');
    });
  });

  describe('getHtfKlines', () => {
    it('should fetch and cache HTF klines', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValue([] as never);

      await manager.getHtfKlines('ETHUSDT', '4h');
      await manager.getHtfKlines('ETHUSDT', '4h');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(1);
    });

    it('should use separate keys for different symbols', async () => {
      vi.mocked(db.query.klines.findMany).mockResolvedValue([] as never);

      await manager.getHtfKlines('ETHUSDT', '4h');
      await manager.getHtfKlines('BTCUSDT', '4h');

      expect(db.query.klines.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCachedConfig', () => {
    const createMockSelect = (config: unknown) => {
      const limitFn = vi.fn().mockResolvedValue(config ? [config] : []);
      const whereFn = vi.fn(() => ({ limit: limitFn }));
      const fromFn = vi.fn(() => ({ where: whereFn }));
      vi.mocked(db.select).mockReturnValue({ from: fromFn } as never);
      return { limitFn, whereFn, fromFn };
    };

    it('should return cached config on cache hit', async () => {
      const config = { walletId: 'w1', enabled: true };
      createMockSelect(config);

      await manager.getCachedConfig('w1');
      const result = await manager.getCachedConfig('w1');

      expect(result).toEqual(config);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should fetch from DB on cache miss', async () => {
      const config = { walletId: 'w1', enabled: true };
      createMockSelect(config);

      const result = await manager.getCachedConfig('w1');
      expect(result).toEqual(config);
      expect(db.select).toHaveBeenCalledTimes(1);
    });

    it('should return null when config not found', async () => {
      createMockSelect(null);

      const result = await manager.getCachedConfig('nonexistent');
      expect(result).toBeNull();
    });

    it('should track cache hits and misses', async () => {
      const config = { walletId: 'w1' };
      createMockSelect(config);

      await manager.getCachedConfig('w1');
      await manager.getCachedConfig('w1');

      const metrics = manager.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(1);
    });

    it('should refetch when config cache expires', async () => {
      const config = { walletId: 'w1' };
      createMockSelect(config);

      await manager.getCachedConfig('w1');
      vi.advanceTimersByTime(30_001);
      await manager.getCachedConfig('w1');

      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  describe('funding rate cache', () => {
    it('should set and get funding rate', () => {
      manager.setFundingRateCache('BTCUSDT', 0.001);
      expect(manager.getCachedFundingRate('BTCUSDT')).toBe(0.001);
    });

    it('should return null for missing symbol', () => {
      expect(manager.getCachedFundingRate('ETHUSDT')).toBeNull();
    });

    it('should return null after TTL expires', () => {
      manager.setFundingRateCache('BTCUSDT', 0.001);
      vi.advanceTimersByTime(300_001);
      expect(manager.getCachedFundingRate('BTCUSDT')).toBeNull();
    });
  });

  describe('preloadConfig', () => {
    it('should preload config and track metrics', () => {
      const config = { walletId: 'w1', enabled: true };
      manager.preloadConfig('w1', config as never);

      const metrics = manager.getMetrics();
      expect(metrics.preloads).toBe(1);
    });

    it('should return preloaded config on getCachedConfig', async () => {
      const config = { walletId: 'w1', enabled: true };
      manager.preloadConfig('w1', config as never);

      const result = await manager.getCachedConfig('w1');
      expect(result).toEqual(config);
    });
  });

  describe('invalidateConfig', () => {
    it('should remove config from cache', async () => {
      const config = { walletId: 'w1', enabled: true };
      manager.preloadConfig('w1', config as never);
      manager.invalidateConfig('w1');

      const createMockSelect = (cfg: unknown) => {
        const limitFn = vi.fn().mockResolvedValue(cfg ? [cfg] : []);
        const whereFn = vi.fn(() => ({ limit: limitFn }));
        const fromFn = vi.fn(() => ({ where: whereFn }));
        vi.mocked(db.select).mockReturnValue({ from: fromFn } as never);
      };
      createMockSelect(config);

      await manager.getCachedConfig('w1');
      expect(db.select).toHaveBeenCalled();
    });
  });

  describe('clearAll', () => {
    it('should clear all caches', () => {
      manager.setFundingRateCache('BTCUSDT', 0.001);
      manager.preloadConfig('w1', { walletId: 'w1' } as never);

      manager.clearAll();

      expect(manager.getCachedFundingRate('BTCUSDT')).toBeNull();
    });
  });

  describe('getMetrics', () => {
    it('should return a copy of metrics', () => {
      const metrics1 = manager.getMetrics();
      const metrics2 = manager.getMetrics();
      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);
    });

    it('should have correct initial values', () => {
      const metrics = manager.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.preloads).toBe(0);
    });
  });
});
