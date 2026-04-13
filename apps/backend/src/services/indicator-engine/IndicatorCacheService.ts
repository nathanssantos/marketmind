import type { ComputedIndicators, IndicatorDefinition, Kline } from '@marketmind/types';
import { IndicatorEngine } from './IndicatorEngine';

interface CacheEntry {
  indicators: ComputedIndicators;
  timestamp: number;
}

const DEFAULT_TTL = 60_000;

export class IndicatorCacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private ttl: number;
  private engine: IndicatorEngine;
  private hits = 0;
  private misses = 0;

  constructor(ttl: number = DEFAULT_TTL) {
    this.ttl = ttl;
    this.engine = new IndicatorEngine();
  }

  setTTL(ttl: number): void {
    this.ttl = ttl;
  }

  get(key: string): ComputedIndicators | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return null;
    }
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    this.hits++;
    return entry.indicators;
  }

  set(key: string, indicators: ComputedIndicators): void {
    this.cache.set(key, { indicators, timestamp: Date.now() });
  }

  async computeOrGet(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>,
    symbol?: string,
    interval?: string,
  ): Promise<ComputedIndicators> {
    const key = this.generateKey(klines, indicators, params, symbol, interval);
    const cached = this.get(key);
    if (cached) return cached;

    const computed = await this.engine.computeIndicators(klines, indicators, params);
    this.set(key, computed);
    return computed;
  }

  async precompute(
    klines: Kline[],
    indicatorSets: Array<{ indicators: Record<string, IndicatorDefinition>; params: Record<string, number> }>,
    symbol?: string,
    interval?: string,
  ): Promise<void> {
    for (const set of indicatorSets) {
      await this.computeOrGet(klines, set.indicators, set.params, symbol, interval);
    }
  }

  evictStale(): number {
    const now = Date.now();
    let evicted = 0;
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        evicted++;
      }
    }
    return evicted;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getStats(): { cacheSize: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      cacheSize: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private generateKey(
    klines: Kline[],
    indicators: Record<string, IndicatorDefinition>,
    params: Record<string, number>,
    symbol?: string,
    interval?: string,
  ): string {
    const klineKey = klines.length > 0
      ? `${klines.length}:${klines[klines.length - 1]?.openTime}`
      : 'empty';
    const prefix = symbol && interval ? `${symbol}:${interval}:` : '';
    return `${prefix}${klineKey}:${JSON.stringify(indicators)}:${JSON.stringify(params)}`;
  }
}

let indicatorCacheServiceInstance: IndicatorCacheService | null = null;

export const getIndicatorCacheService = (ttl?: number): IndicatorCacheService => {
  if (!indicatorCacheServiceInstance) {
    indicatorCacheServiceInstance = new IndicatorCacheService(ttl);
  }
  return indicatorCacheServiceInstance;
};

export const resetIndicatorCacheService = (): void => {
  indicatorCacheServiceInstance?.clear();
  indicatorCacheServiceInstance = null;
};
