import { createLogger } from '@marketmind/logger';
import type { Interval, Kline, MarketType } from '@marketmind/types';
import { klineQueries, type KlineGap, type KlineRecord } from './database/klineQueries';
import { smartBackfillKlines } from './binance-historical';
import { mapDbKlinesToApi } from '../utils/kline-mapper';

const log = createLogger('KlineCache');

interface CacheEntry {
  klines: Kline[];
  fetchedAt: number;
  startTime: number;
  endTime: number;
}

interface GetKlinesOptions {
  symbol: string;
  interval: Interval;
  marketType: MarketType;
  startTime?: number;
  endTime?: number;
  limit?: number;
  fillGaps?: boolean;
}

interface GetKlinesResult {
  klines: Kline[];
  fromCache: boolean;
  gapsFilled: number;
}

const CACHE_TTL_MS = 60 * 1000;
const MAX_CACHE_ENTRIES = 100;
const MAX_GAP_FILL_BATCH = 1000;

class KlineCacheService {
  private cache = new Map<string, CacheEntry>();
  private pendingFetches = new Map<string, Promise<KlineRecord[]>>();

  private getCacheKey(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    startTime?: number,
    endTime?: number
  ): string {
    return `${symbol}:${interval}:${marketType}:${startTime ?? 'none'}:${endTime ?? 'none'}`;
  }

  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.fetchedAt < CACHE_TTL_MS;
  }

  private evictOldEntries(): void {
    if (this.cache.size <= MAX_CACHE_ENTRIES) return;

    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].fetchedAt - b[1].fetchedAt);

    const toRemove = entries.slice(0, Math.floor(MAX_CACHE_ENTRIES * 0.2));
    for (const [key] of toRemove) {
      this.cache.delete(key);
    }
  }

  async get(options: GetKlinesOptions): Promise<GetKlinesResult> {
    const {
      symbol,
      interval,
      marketType,
      startTime,
      endTime,
      limit,
      fillGaps = true,
    } = options;

    const cacheKey = this.getCacheKey(symbol, interval, marketType, startTime, endTime);

    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      let result = cached.klines;
      if (limit && result.length > limit) {
        result = result.slice(-limit);
      }
      return { klines: result, fromCache: true, gapsFilled: 0 };
    }

    let gapsFilled = 0;

    if (fillGaps && startTime && endTime) {
      gapsFilled = await this.fillGapsIfNeeded(symbol, interval, marketType, startTime, endTime);
    }

    const dbKlines = await this.fetchFromDatabase(options);
    const apiKlines = mapDbKlinesToApi(dbKlines);

    this.evictOldEntries();
    this.cache.set(cacheKey, {
      klines: apiKlines,
      fetchedAt: Date.now(),
      startTime: startTime ?? 0,
      endTime: endTime ?? Date.now(),
    });

    let result = apiKlines;
    if (limit && result.length > limit) {
      result = result.slice(-limit);
    }

    return { klines: result, fromCache: false, gapsFilled };
  }

  private async fetchFromDatabase(options: GetKlinesOptions): Promise<KlineRecord[]> {
    const { symbol, interval, marketType, startTime, endTime, limit } = options;

    const fetchKey = this.getCacheKey(symbol, interval, marketType, startTime, endTime);
    const pendingFetch = this.pendingFetches.get(fetchKey);
    if (pendingFetch) {
      return pendingFetch;
    }

    const fetchPromise = klineQueries.findMany({
      symbol,
      interval,
      marketType,
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      limit,
    });

    this.pendingFetches.set(fetchKey, fetchPromise);

    try {
      return await fetchPromise;
    } finally {
      this.pendingFetches.delete(fetchKey);
    }
  }

  private async fillGapsIfNeeded(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    startTime: number,
    endTime: number
  ): Promise<number> {
    try {
      const gaps = await klineQueries.findGaps(
        symbol,
        interval,
        marketType,
        new Date(startTime),
        new Date(endTime)
      );

      if (gaps.length === 0) return 0;

      let totalFilled = 0;

      for (const gap of gaps) {
        if (totalFilled >= MAX_GAP_FILL_BATCH) break;

        const result = await this.fillGap(symbol, interval, marketType, gap);
        totalFilled += result;
      }

      if (totalFilled > 0) {
        log.debug('Filled kline gaps', { symbol, interval, marketType, totalFilled, gapsCount: gaps.length });
      }

      return totalFilled;
    } catch (err) {
      log.warn('Failed to fill kline gaps', { symbol, interval, marketType, error: err });
      return 0;
    }
  }

  private async fillGap(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    gap: KlineGap
  ): Promise<number> {
    try {
      const result = await smartBackfillKlines(
        symbol,
        interval,
        gap.expectedCount,
        marketType,
        false
      );
      return result.downloaded;
    } catch (err) {
      log.warn('Failed to fill individual gap', {
        symbol,
        interval,
        marketType,
        gapStart: gap.start,
        gapEnd: gap.end,
        error: err,
      });
      return 0;
    }
  }

  invalidate(symbol: string, interval?: Interval, marketType?: MarketType): void {
    for (const key of this.cache.keys()) {
      const matchesSymbol = key.startsWith(`${symbol}:`);
      const matchesInterval = !interval || key.includes(`:${interval}:`);
      const matchesMarket = !marketType || key.includes(`:${marketType}:`);

      if (matchesSymbol && matchesInterval && matchesMarket) {
        this.cache.delete(key);
      }
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }

  async prefetch(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    count: number = 1000
  ): Promise<void> {
    const endTime = Date.now();
    const intervalMs = klineQueries.getIntervalMs(interval);
    const startTime = endTime - count * intervalMs;

    await this.get({
      symbol,
      interval,
      marketType,
      startTime,
      endTime,
      fillGaps: true,
    });
  }
}

export const klineCache = new KlineCacheService();

export const getKlinesWithCache = async (options: GetKlinesOptions): Promise<GetKlinesResult> =>
  klineCache.get(options);

export const invalidateKlineCache = (
  symbol: string,
  interval?: Interval,
  marketType?: MarketType
): void => klineCache.invalidate(symbol, interval, marketType);

export const prefetchKlinesAsync = (
  symbol: string,
  interval: Interval,
  marketType: MarketType,
  count?: number
): void => {
  klineCache.prefetch(symbol, interval, marketType, count).catch((err) => {
    log.warn('Prefetch failed', { symbol, interval, marketType, error: err });
  });
};
