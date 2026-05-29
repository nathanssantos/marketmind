import { TIME_MS } from '../constants';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class SimpleCache<T> {
  private entry: CacheEntry<T> | null = null;
  private ttl: number;

  constructor(ttlMs: number = 5 * TIME_MS.MINUTE) {
    this.ttl = ttlMs;
  }

  get(): T | null {
    if (!this.entry) return null;
    if (Date.now() - this.entry.timestamp >= this.ttl) return null;
    return this.entry.data;
  }

  set(data: T): void {
    this.entry = { data, timestamp: Date.now() };
  }

  clear(): void {
    this.entry = null;
  }

  setTTL(ttlMs: number): void {
    this.ttl = ttlMs;
  }

  isValid(): boolean {
    if (!this.entry) return false;
    return Date.now() - this.entry.timestamp < this.ttl;
  }
}

export class KeyedCache<T> {
  private entries: Map<string, CacheEntry<T>> = new Map();
  private ttl: number;
  private readonly maxEntries: number;

  /**
   * @param ttlMs       per-entry TTL.
   * @param maxEntries  optional cap; when exceeded the oldest-inserted
   *                    entry is evicted (FIFO). 0 = unbounded.
   */
  constructor(ttlMs: number = 5 * TIME_MS.MINUTE, maxEntries = 0) {
    this.ttl = ttlMs;
    this.maxEntries = maxEntries;
  }

  get(key: string): T | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp >= this.ttl) {
      this.entries.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    if (this.maxEntries > 0 && !this.entries.has(key) && this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    this.entries.set(key, { data, timestamp: Date.now() });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }

  setTTL(ttlMs: number): void {
    this.ttl = ttlMs;
  }

  has(key: string): boolean {
    const entry = this.entries.get(key);
    if (!entry) return false;
    if (Date.now() - entry.timestamp >= this.ttl) {
      this.entries.delete(key);
      return false;
    }
    return true;
  }

  size(): number {
    return this.entries.size;
  }
}
