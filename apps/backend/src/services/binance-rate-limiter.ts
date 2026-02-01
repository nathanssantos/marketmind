import { TIME_MS } from '../constants';
import { logger } from './logger';

interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  priority: number;
  addedAt: number;
}

const RATE_LIMIT_CONFIG = {
  MAX_REQUESTS_PER_MINUTE: 600,
  MIN_DELAY_BETWEEN_REQUESTS_MS: 100,
  BATCH_SIZE: 5,
  BATCH_DELAY_MS: 200,
} as const;

class BinanceRateLimiter {
  private queue: QueuedRequest<unknown>[] = [];
  private requestTimestamps: number[] = [];
  private isProcessing = false;
  private isBanned = false;
  private banExpiry = 0;

  async execute<T>(fn: () => Promise<T>, priority = 0): Promise<T> {
    if (this.isBanned && Date.now() < this.banExpiry) {
      const waitTime = Math.ceil((this.banExpiry - Date.now()) / 1000);
      throw new Error(`IP banned by Binance. Try again in ${waitTime} seconds.`);
    }

    if (this.isBanned && Date.now() >= this.banExpiry) {
      this.isBanned = false;
      this.banExpiry = 0;
      logger.info('[BinanceRateLimiter] Ban expired, resuming requests');
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        execute: fn as () => Promise<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        addedAt: Date.now(),
      });

      this.queue.sort((a, b) => b.priority - a.priority || a.addedAt - b.addedAt);

      if (!this.isProcessing) {
        void this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) return;

    this.isProcessing = true;

    while (this.queue.length > 0) {
      if (this.isBanned && Date.now() < this.banExpiry) {
        const waitTime = this.banExpiry - Date.now();
        logger.warn({ waitTime }, '[BinanceRateLimiter] Waiting for ban to expire');
        await this.sleep(waitTime);
        this.isBanned = false;
        this.banExpiry = 0;
      }

      await this.waitForRateLimit();

      const batch = this.queue.splice(0, RATE_LIMIT_CONFIG.BATCH_SIZE);

      await Promise.all(
        batch.map(async (request) => {
          try {
            this.recordRequest();
            const result = await request.execute();
            request.resolve(result);
          } catch (error) {
            if (this.isBanError(error)) {
              this.handleBan(error);
              request.reject(error as Error);
            } else {
              request.reject(error as Error);
            }
          }
        })
      );

      if (this.queue.length > 0) {
        await this.sleep(RATE_LIMIT_CONFIG.BATCH_DELAY_MS);
      }
    }

    this.isProcessing = false;
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - TIME_MS.MINUTE;

    this.requestTimestamps = this.requestTimestamps.filter((ts) => ts > oneMinuteAgo);

    if (this.requestTimestamps.length >= RATE_LIMIT_CONFIG.MAX_REQUESTS_PER_MINUTE) {
      const oldestInWindow = this.requestTimestamps[0];
      if (oldestInWindow) {
        const waitTime = oldestInWindow + TIME_MS.MINUTE - now + 100;
        if (waitTime > 0) {
          logger.warn({ waitTime, queueSize: this.queue.length }, '[BinanceRateLimiter] Rate limit reached, waiting');
          await this.sleep(waitTime);
        }
      }
    }

    const lastRequest = this.requestTimestamps[this.requestTimestamps.length - 1];
    if (lastRequest) {
      const timeSinceLast = now - lastRequest;
      if (timeSinceLast < RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS_MS) {
        await this.sleep(RATE_LIMIT_CONFIG.MIN_DELAY_BETWEEN_REQUESTS_MS - timeSinceLast);
      }
    }
  }

  private recordRequest(): void {
    this.requestTimestamps.push(Date.now());
  }

  private isBanError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes('banned') ||
        message.includes('418') ||
        message.includes('too many requests') ||
        message.includes('-1003')
      );
    }
    return false;
  }

  private handleBan(error: unknown): void {
    this.isBanned = true;

    const errorMessage = error instanceof Error ? error.message : String(error);
    const banMatch = errorMessage.match(/until\s+(\d+)/);

    if (banMatch?.[1]) {
      this.banExpiry = parseInt(banMatch[1], 10);
    } else {
      this.banExpiry = Date.now() + 5 * TIME_MS.MINUTE;
    }

    const waitSeconds = Math.ceil((this.banExpiry - Date.now()) / 1000);
    logger.error({ waitSeconds, queueSize: this.queue.length }, '[BinanceRateLimiter] IP banned by Binance');

    for (const request of this.queue) {
      request.reject(new Error(`IP banned by Binance. Try again in ${waitSeconds} seconds.`));
    }
    this.queue = [];
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  isBannedStatus(): { banned: boolean; expiresIn: number } {
    return {
      banned: this.isBanned && Date.now() < this.banExpiry,
      expiresIn: this.isBanned ? Math.max(0, this.banExpiry - Date.now()) : 0,
    };
  }

  clearQueue(): void {
    for (const request of this.queue) {
      request.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }
}

export const binanceRateLimiter = new BinanceRateLimiter();
