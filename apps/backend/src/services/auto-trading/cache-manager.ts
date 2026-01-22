import type { Interval, Kline } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { AUTO_TRADING_CACHE } from '../../constants';
import { db } from '../../db';
import { autoTradingConfig, klines } from '../../db/schema';
import type { CacheEntry, CacheMetrics } from './types';

const CACHE_TTL_MS = AUTO_TRADING_CACHE.DEFAULT_TTL_MS;
const CONFIG_CACHE_TTL_MS = AUTO_TRADING_CACHE.CONFIG_TTL_MS;
const FUNDING_CACHE_TTL_MS = AUTO_TRADING_CACHE.FUNDING_RATE_TTL_MS;

export class CacheManager {
  private btcKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private htfKlinesCache: Map<string, CacheEntry<Kline[]>> = new Map();
  private fundingRateCache: Map<string, CacheEntry<number>> = new Map();
  private configCache: Map<string, CacheEntry<typeof autoTradingConfig.$inferSelect>> = new Map();
  private configCacheMetrics: CacheMetrics = { hits: 0, misses: 0, preloads: 0 };

  isCacheValid<T>(cache: CacheEntry<T> | undefined, ttlMs: number = CACHE_TTL_MS): cache is CacheEntry<T> {
    if (!cache) return false;
    return Date.now() - cache.timestamp < ttlMs;
  }

  async getBtcKlines(interval: string): Promise<Kline[]> {
    const cacheKey = `BTCUSDT-${interval}`;
    const cached = this.btcKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const btcKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, 'BTCUSDT'),
        eq(klines.interval, interval)
      ),
      orderBy: [desc(klines.openTime)],
      limit: 100,
    });

    const mappedKlines: Kline[] = btcKlines.reverse().map((k) => ({
      symbol: k.symbol,
      interval: k.interval as Interval,
      openTime: k.openTime.getTime(),
      closeTime: k.closeTime.getTime(),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume ?? '0',
      trades: k.trades ?? 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
    }));

    this.btcKlinesCache.set(cacheKey, { data: mappedKlines, timestamp: Date.now() });
    return mappedKlines;
  }

  async getHtfKlines(symbol: string, htfInterval: string): Promise<Kline[]> {
    const cacheKey = `${symbol}-${htfInterval}`;
    const cached = this.htfKlinesCache.get(cacheKey);

    if (this.isCacheValid(cached)) {
      return cached.data;
    }

    const htfKlines = await db.query.klines.findMany({
      where: and(
        eq(klines.symbol, symbol),
        eq(klines.interval, htfInterval)
      ),
      orderBy: [desc(klines.openTime)],
      limit: 300,
    });

    const mappedKlines: Kline[] = htfKlines.reverse().map((k) => ({
      symbol: k.symbol,
      interval: k.interval as Interval,
      openTime: k.openTime.getTime(),
      closeTime: k.closeTime.getTime(),
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
      quoteVolume: k.quoteVolume ?? '0',
      trades: k.trades ?? 0,
      takerBuyBaseVolume: k.takerBuyBaseVolume ?? '0',
      takerBuyQuoteVolume: k.takerBuyQuoteVolume ?? '0',
    }));

    this.htfKlinesCache.set(cacheKey, { data: mappedKlines, timestamp: Date.now() });
    return mappedKlines;
  }

  async getCachedConfig(walletId: string, userId?: string): Promise<typeof autoTradingConfig.$inferSelect | null> {
    const cached = this.configCache.get(walletId);

    if (this.isCacheValid(cached, CONFIG_CACHE_TTL_MS)) {
      this.configCacheMetrics.hits++;
      return cached.data;
    }

    this.configCacheMetrics.misses++;

    const [config] = await db
      .select()
      .from(autoTradingConfig)
      .where(eq(autoTradingConfig.walletId, walletId))
      .limit(1);

    if (config) {
      this.configCache.set(walletId, { data: config, timestamp: Date.now() });
    }

    return config ?? null;
  }

  setFundingRateCache(symbol: string, rate: number): void {
    this.fundingRateCache.set(symbol, { data: rate, timestamp: Date.now() });
  }

  getCachedFundingRate(symbol: string): number | null {
    const cached = this.fundingRateCache.get(symbol);
    if (this.isCacheValid(cached, FUNDING_CACHE_TTL_MS)) {
      return cached.data;
    }
    return null;
  }

  preloadConfig(walletId: string, config: typeof autoTradingConfig.$inferSelect): void {
    this.configCache.set(walletId, { data: config, timestamp: Date.now() });
    this.configCacheMetrics.preloads++;
  }

  invalidateConfig(walletId: string): void {
    this.configCache.delete(walletId);
  }

  clearAll(): void {
    this.btcKlinesCache.clear();
    this.htfKlinesCache.clear();
    this.fundingRateCache.clear();
    this.configCache.clear();
  }

  getMetrics(): CacheMetrics {
    return { ...this.configCacheMetrics };
  }
}

export const cacheManager = new CacheManager();
