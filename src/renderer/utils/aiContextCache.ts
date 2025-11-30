import type { OptimizedKlineData } from './candleOptimizer';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

interface CandleCacheKey {
  symbol: string;
  timeframe: string;
  count: number;
}

const CACHE_DURATION = 5 * 60 * 1000;

class AIContextCache {
  private candleCache: Map<string, CacheEntry<OptimizedKlineData>>;
  private summaryCache: Map<string, CacheEntry<string>>;
  
  constructor() {
    this.candleCache = new Map();
    this.summaryCache = new Map();
  }
  
  private createCandleCacheKey(key: CandleCacheKey): string {
    return `${key.symbol}:${key.timeframe}:${key.count}`;
  }
  
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_DURATION;
  }
  
  getCachedCandles(key: CandleCacheKey): OptimizedKlineData | null {
    const cacheKey = this.createCandleCacheKey(key);
    const entry = this.candleCache.get(cacheKey);
    
    if (!entry) return null;
    
    if (this.isExpired(entry.timestamp)) {
      this.candleCache.delete(cacheKey);
      return null;
    }
    
    return entry.data;
  }
  
  setCachedCandles(key: CandleCacheKey, data: OptimizedKlineData): void {
    const cacheKey = this.createCandleCacheKey(key);
    this.candleCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
    });
  }
  
  getCachedSummary(conversationId: string): string | null {
    const entry = this.summaryCache.get(conversationId);
    
    if (!entry) return null;
    
    if (this.isExpired(entry.timestamp)) {
      this.summaryCache.delete(conversationId);
      return null;
    }
    
    return entry.data;
  }
  
  setCachedSummary(conversationId: string, summary: string): void {
    this.summaryCache.set(conversationId, {
      data: summary,
      timestamp: Date.now(),
    });
  }
  
  clearCandleCache(): void {
    this.candleCache.clear();
  }
  
  clearSummaryCache(): void {
    this.summaryCache.clear();
  }
  
  clearAll(): void {
    this.clearCandleCache();
    this.clearSummaryCache();
  }
  
  getCacheStats() {
    return {
      candleCacheSize: this.candleCache.size,
      summaryCacheSize: this.summaryCache.size,
    };
  }
}

export const aiContextCache = new AIContextCache();
