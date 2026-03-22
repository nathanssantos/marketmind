export class DataCache {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL: number = 60000;

  getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    return null;
  }

  setCache(key: string, data: unknown): void {
    const MAX_CACHE_SIZE = 200;
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }
}
