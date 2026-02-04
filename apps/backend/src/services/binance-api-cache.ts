import { TIME_MS } from '../constants';
import { logger } from './logger';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const CACHE_TTL = {
  POSITIONS: 10 * TIME_MS.SECOND,
  OPEN_ORDERS: 10 * TIME_MS.SECOND,
  ALGO_ORDERS: 10 * TIME_MS.SECOND,
  ACCOUNT_INFO: 30 * TIME_MS.SECOND,
  FILTERED_SYMBOLS: 60 * TIME_MS.SECOND,
  SYMBOL_SCORES: 60 * TIME_MS.SECOND,
  TOP_COINS: 5 * TIME_MS.MINUTE,
} as const;

class BinanceApiCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;
  private banExpiry = 0;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 60 * TIME_MS.SECOND);
  }

  setBanned(expiryTimestamp: number): void {
    if (this.banExpiry > 0 && Date.now() < this.banExpiry) return;
    this.banExpiry = expiryTimestamp;
    logger.warn({ expiresIn: Math.ceil((expiryTimestamp - Date.now()) / 1000) }, '[BinanceApiCache] IP banned');
  }

  isBanned(): boolean {
    if (this.banExpiry > 0 && Date.now() < this.banExpiry) {
      return true;
    }
    if (this.banExpiry > 0 && Date.now() >= this.banExpiry) {
      this.banExpiry = 0;
      logger.info('[BinanceApiCache] Ban expired');
    }
    return false;
  }

  getBanExpiresIn(): number {
    if (this.banExpiry > 0 && Date.now() < this.banExpiry) {
      return this.banExpiry - Date.now();
    }
    return 0;
  }

  private generateKey(type: string, walletId: string, extra?: string): string {
    return `${type}:${walletId}${extra ? `:${extra}` : ''}`;
  }

  get<T>(type: keyof typeof CACHE_TTL, walletId: string, extra?: string): T | null {
    const key = this.generateKey(type, walletId, extra);
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set<T>(type: keyof typeof CACHE_TTL, walletId: string, data: T, extra?: string): void {
    const key = this.generateKey(type, walletId, extra);
    const ttl = CACHE_TTL[type];

    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  invalidate(type: keyof typeof CACHE_TTL, walletId: string, extra?: string): void {
    const key = this.generateKey(type, walletId, extra);
    this.cache.delete(key);
  }

  invalidateWallet(walletId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${walletId}`)) {
        this.cache.delete(key);
      }
    }
  }

  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.trace({ cleaned, remaining: this.cache.size }, '[BinanceApiCache] Cleanup completed');
    }
  }

  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
  }
}

export const binanceApiCache = new BinanceApiCache();
