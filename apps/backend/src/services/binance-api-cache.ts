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
  SYMBOL_LEVERAGE: 30 * TIME_MS.SECOND,
  FILTERED_SYMBOLS: 60 * TIME_MS.SECOND,
  SYMBOL_SCORES: 60 * TIME_MS.SECOND,
  TOP_COINS: 5 * TIME_MS.MINUTE,
} as const;

const RATE_LIMIT = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS: 2400,
  SAFE_THRESHOLD: 1200,
  MIN_INTERVAL_MS: 50,
} as const;

class BinanceRateLimiter {
  private timestamps: number[] = [];
  private queue: Array<{ resolve: () => void; reject: (err: Error) => void }> = [];
  private draining = false;

  recordRequest(): void {
    this.timestamps.push(Date.now());
  }

  getCount(): number {
    this.prune();
    return this.timestamps.length;
  }

  isOverLimit(): boolean {
    this.prune();
    return this.timestamps.length >= RATE_LIMIT.MAX_REQUESTS;
  }

  async acquireSlot(): Promise<void> {
    this.prune();

    if (this.timestamps.length < RATE_LIMIT.SAFE_THRESHOLD) {
      this.recordRequest();
      return;
    }

    if (this.timestamps.length >= RATE_LIMIT.MAX_REQUESTS) {
      return new Promise<void>((resolve, reject) => {
        this.queue.push({ resolve, reject });
        this.scheduleDrain();
      });
    }

    const delay = Math.min(
      RATE_LIMIT.MIN_INTERVAL_MS * Math.ceil((this.timestamps.length - RATE_LIMIT.SAFE_THRESHOLD) / 100),
      500
    );
    await new Promise(resolve => setTimeout(resolve, delay));
    this.recordRequest();
  }

  private prune(): void {
    const cutoff = Date.now() - RATE_LIMIT.WINDOW_MS;
    while (this.timestamps.length > 0 && this.timestamps[0]! < cutoff) {
      this.timestamps.shift();
    }
  }

  private scheduleDrain(): void {
    if (this.draining) return;
    this.draining = true;

    const drain = () => {
      this.prune();
      if (this.queue.length === 0) {
        this.draining = false;
        return;
      }
      if (this.timestamps.length < RATE_LIMIT.SAFE_THRESHOLD) {
        const item = this.queue.shift();
        if (item) {
          this.recordRequest();
          item.resolve();
        }
      }
      setTimeout(drain, RATE_LIMIT.MIN_INTERVAL_MS);
    };

    setTimeout(drain, RATE_LIMIT.MIN_INTERVAL_MS);
  }
}

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
    if (this.banExpiry > 0 && Date.now() < this.banExpiry) return true;
    if (this.banExpiry > 0 && Date.now() >= this.banExpiry) {
      this.banExpiry = 0;
      logger.info('[BinanceApiCache] Ban expired');
    }
    return false;
  }

  getBanExpiresIn(): number {
    if (this.banExpiry > 0 && Date.now() < this.banExpiry) return this.banExpiry - Date.now();
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
    this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL[type] });
  }

  invalidate(type: keyof typeof CACHE_TTL, walletId: string, extra?: string): void {
    this.cache.delete(this.generateKey(type, walletId, extra));
  }

  invalidateWallet(walletId: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(`:${walletId}`)) this.cache.delete(key);
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
    if (cleaned > 0) logger.trace({ cleaned, remaining: this.cache.size }, '[BinanceApiCache] Cleanup completed');
  }

  checkAndSetBan(error: unknown): boolean {
    const msg = typeof error === 'string'
      ? error
      : error instanceof Error
        ? error.message
        : JSON.stringify(error);
    const lower = msg.toLowerCase();

    const isBan = lower.includes('-1003')
      || lower.includes('too many requests')
      || lower.includes('way too many requests')
      || (lower.includes('banned') && (lower.includes('ip') || lower.includes('until')))
      || /[":\s]418[,}\s"]/.test(msg);

    if (!isBan) return false;

    const banMatch = msg.match(/until\s+(\d+)/);
    const retryMatch = msg.match(/"retry-after"\s*:\s*"?(\d+)"?/);

    let expiry: number;
    if (banMatch?.[1]) expiry = parseInt(banMatch[1], 10);
    else if (retryMatch?.[1]) expiry = Date.now() + parseInt(retryMatch[1], 10) * 1000;
    else expiry = Date.now() + 5 * TIME_MS.MINUTE;

    this.setBanned(expiry);
    return true;
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
export const binanceRateLimiter = new BinanceRateLimiter();

export class BinanceIpBannedError extends Error {
  constructor(waitSeconds: number) {
    super(`IP banned by Binance. Try again in ${waitSeconds} seconds.`);
    this.name = 'BinanceIpBannedError';
  }
}

export async function guardBinanceCall<T>(fn: () => Promise<T>): Promise<T> {
  if (binanceApiCache.isBanned()) {
    const waitSeconds = Math.ceil(binanceApiCache.getBanExpiresIn() / 1000);
    throw new BinanceIpBannedError(waitSeconds);
  }

  await binanceRateLimiter.acquireSlot();

  try {
    return await fn();
  } catch (error) {
    binanceApiCache.checkAndSetBan(error);
    throw error;
  }
}
