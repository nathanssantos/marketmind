import type { OptimizedKlineData } from './klineOptimizer';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  openTime?: number;
}

interface KlineCacheKey {
  symbol: string;
  timeframe: string;
  count: number;
}

const CACHE_DURATION = 5 * 60 * 1000;

class AIContextCache {
  private klineCache: Map<string, CacheEntry<OptimizedKlineData>>;
  private summaryCache: Map<string, CacheEntry<string>>;
  
  constructor() {
    this.klineCache = new Map();
    this.summaryCache = new Map();
  }
  
  private createKlineCacheKey(key: KlineCacheKey): string {
    return `${key.symbol}:${key.timeframe}:${key.count}`;
  }
  
  private isExpired(timestamp: number): boolean {
    return Date.now() - timestamp > CACHE_DURATION;
  }
  
  getCachedKlines(key: KlineCacheKey): OptimizedKlineData | null {
    const cacheKey = this.createKlineCacheKey(key);
    const entry = this.klineCache.get(cacheKey);
    
    if (!entry) return null;
    
    if (this.isExpired(entry.timestamp)) {
      this.klineCache.delete(cacheKey);
      return null;
    }
    
    return entry.data;
  }
  
  setCachedKlines(key: KlineCacheKey, data: OptimizedKlineData): void {
    const cacheKey = this.createKlineCacheKey(key);
    this.klineCache.set(cacheKey, {
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
  
  clearKlineCache(): void {
    this.klineCache.clear();
  }
  
  clearSummaryCache(): void {
    this.summaryCache.clear();
  }
  
  clearAll(): void {
    this.clearKlineCache();
    this.clearSummaryCache();
  }
  
  getCacheStats() {
    return {
      klineCacheSize: this.klineCache.size,
      summaryCacheSize: this.summaryCache.size,
    };
  }
}

export const aiContextCache = new AIContextCache();
