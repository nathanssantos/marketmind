import type { Kline } from '@marketmind/types';
import { IBKlineStream } from './kline-stream';
import { IBConnectionManager, getDefaultConnectionManager } from './connection-manager';
import { IB_RATE_LIMITS, IB_OPTIMAL_DURATION, IB_BARS_PER_REQUEST } from './constants';
import type { BackfillChunk, BackfillResult } from './types';

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export class RollingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number, windowMs: number) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();

    this.timestamps = this.timestamps.filter((t) => now - t < this.windowMs);

    if (this.timestamps.length >= this.limit) {
      const oldestTimestamp = this.timestamps[0] ?? now;
      const waitTime = this.windowMs - (now - oldestTimestamp) + 100;

      if (waitTime > 0) {
        await sleep(waitTime);
        return this.acquire();
      }
    }

    this.timestamps.push(Date.now());
  }

  get availableSlots(): number {
    const now = Date.now();
    const activeRequests = this.timestamps.filter((t) => now - t < this.windowMs).length;
    return Math.max(0, this.limit - activeRequests);
  }

  get nextAvailableIn(): number {
    if (this.availableSlots > 0) return 0;
    const now = Date.now();
    const oldestTimestamp = this.timestamps[0] ?? now;
    return Math.max(0, this.windowMs - (now - oldestTimestamp));
  }
}

export class PerContractRateLimiter {
  private contractTimestamps = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit = 5, windowMs = 2000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  async acquire(contractKey: string): Promise<void> {
    const now = Date.now();
    let timestamps = this.contractTimestamps.get(contractKey) ?? [];

    timestamps = timestamps.filter((t) => now - t < this.windowMs);

    if (timestamps.length >= this.limit) {
      const oldestTimestamp = timestamps[0] ?? now;
      const waitTime = this.windowMs - (now - oldestTimestamp) + 50;
      await sleep(waitTime);
      return this.acquire(contractKey);
    }

    timestamps.push(now);
    this.contractTimestamps.set(contractKey, timestamps);
  }
}

export class PacingViolationHandler {
  private violations: number[] = [];
  private readonly maxViolations = 3;
  private readonly backoffMultiplier = 2;

  async handleViolation(): Promise<void> {
    this.violations.push(Date.now());

    this.violations = this.violations.filter((t) => Date.now() - t < 30 * 60 * 1000);

    if (this.violations.length >= this.maxViolations) {
      const backoffTime =
        60_000 * Math.pow(this.backoffMultiplier, this.violations.length - this.maxViolations);
      console.warn(`Multiple pacing violations! Backing off for ${backoffTime / 1000}s`);
      await sleep(backoffTime);
      return;
    }

    console.warn('Pacing violation - waiting 15 seconds...');
    await sleep(IB_RATE_LIMITS.PACING_VIOLATION_DELAY_MS);
  }

  shouldReduceRate(): boolean {
    const recentViolations = this.violations.filter((t) => Date.now() - t < 10 * 60 * 1000);
    return recentViolations.length >= 2;
  }
}

type TimeInterval = '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '1d' | '1w';

export class IBBackfillService {
  private globalLimiter = new RollingWindowRateLimiter(
    IB_RATE_LIMITS.GLOBAL_REQUESTS_PER_10_MIN,
    IB_RATE_LIMITS.GLOBAL_WINDOW_MS
  );
  private contractLimiter = new PerContractRateLimiter(
    IB_RATE_LIMITS.PER_CONTRACT_REQUESTS_PER_2_SEC,
    IB_RATE_LIMITS.PER_CONTRACT_WINDOW_MS
  );
  private pacingHandler = new PacingViolationHandler();
  private activeTasks = 0;
  private readonly maxConcurrent = IB_RATE_LIMITS.MAX_CONCURRENT_REQUESTS;
  private klineStream: IBKlineStream;
  private connectionManager: IBConnectionManager;

  constructor(connectionManager?: IBConnectionManager) {
    this.connectionManager = connectionManager ?? getDefaultConnectionManager();
    this.klineStream = new IBKlineStream(this.connectionManager);
  }

  async backfillSymbol(
    symbol: string,
    interval: TimeInterval,
    targetKlines = 40_000
  ): Promise<BackfillResult> {
    const contractKey = `${symbol}:${interval}`;
    const chunks = this.createOptimalChunks(symbol, interval, targetKlines);
    const results: Kline[] = [];
    const startTime = Date.now();
    let totalRequests = 0;

    for (const chunk of chunks) {
      await this.globalLimiter.acquire();
      await this.contractLimiter.acquire(contractKey);

      while (this.activeTasks >= this.maxConcurrent) {
        await sleep(50);
      }

      this.activeTasks++;
      try {
        const klines = await this.fetchChunk(chunk);
        results.push(...klines);
        totalRequests++;
      } catch (error) {
        if (this.isPacingViolation(error)) {
          await this.pacingHandler.handleViolation();
          const klines = await this.fetchChunk(chunk);
          results.push(...klines);
          totalRequests++;
        } else {
          console.error(`[IBBackfillService] Error fetching chunk:`, error);
        }
      } finally {
        this.activeTasks--;
      }
    }

    return {
      symbol,
      interval,
      klines: this.deduplicateAndSort(results),
      totalRequests,
      durationMs: Date.now() - startTime,
      avgRequestTime: totalRequests > 0 ? (Date.now() - startTime) / totalRequests : 0,
    };
  }

  async backfillMultipleSymbols(
    requests: Array<{ symbol: string; interval: TimeInterval; targetKlines?: number }>
  ): Promise<Map<string, BackfillResult>> {
    const results = new Map<string, BackfillResult>();
    const allChunks: Array<{ symbol: string; interval: TimeInterval; chunk: BackfillChunk }> = [];

    for (const req of requests) {
      const chunks = this.createOptimalChunks(req.symbol, req.interval, req.targetKlines ?? 40_000);
      for (const chunk of chunks) {
        allChunks.push({ symbol: req.symbol, interval: req.interval, chunk });
      }
    }

    this.shuffleArray(allChunks);

    const symbolResults = new Map<string, Kline[]>();
    const startTime = Date.now();
    const requestCounts = new Map<string, number>();

    for (const { symbol, interval, chunk } of allChunks) {
      const contractKey = `${symbol}:${interval}`;

      await this.globalLimiter.acquire();
      await this.contractLimiter.acquire(contractKey);

      while (this.activeTasks >= this.maxConcurrent) {
        await sleep(50);
      }

      this.activeTasks++;
      try {
        const klines = await this.fetchChunk(chunk);
        const existing = symbolResults.get(contractKey) ?? [];
        existing.push(...klines);
        symbolResults.set(contractKey, existing);
        requestCounts.set(contractKey, (requestCounts.get(contractKey) ?? 0) + 1);
      } catch (error) {
        if (this.isPacingViolation(error)) {
          await this.pacingHandler.handleViolation();
        }
        console.error(`[IBBackfillService] Error in parallel backfill:`, error);
      } finally {
        this.activeTasks--;
      }
    }

    for (const req of requests) {
      const key = `${req.symbol}:${req.interval}`;
      const klines = symbolResults.get(key) ?? [];
      results.set(key, {
        symbol: req.symbol,
        interval: req.interval,
        klines: this.deduplicateAndSort(klines),
        totalRequests: requestCounts.get(key) ?? 0,
        durationMs: Date.now() - startTime,
      });
    }

    return results;
  }

  private createOptimalChunks(
    symbol: string,
    interval: TimeInterval,
    targetKlines: number
  ): BackfillChunk[] {
    const optimalDuration = IB_OPTIMAL_DURATION[interval] ?? '1 D';
    const barsPerRequest = IB_BARS_PER_REQUEST[interval] ?? 390;
    const requestsNeeded = Math.ceil(targetKlines / barsPerRequest);

    const chunks: BackfillChunk[] = [];
    let endDate = new Date();

    for (let i = 0; i < requestsNeeded; i++) {
      chunks.push({
        symbol,
        interval,
        endDateTime: new Date(endDate),
        duration: optimalDuration,
      });

      endDate = this.subtractDuration(endDate, optimalDuration);
    }

    return chunks;
  }

  private async fetchChunk(chunk: BackfillChunk): Promise<Kline[]> {
    const endDateTime = this.formatIBDateTime(chunk.endDateTime);

    return this.klineStream.getHistoricalData(
      chunk.symbol,
      chunk.interval,
      chunk.duration,
      endDateTime,
      false
    );
  }

  private formatIBDateTime(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day} ${hours}:${minutes}:${seconds}`;
  }

  private subtractDuration(date: Date, duration: string): Date {
    const result = new Date(date);
    const [amount, unit] = duration.split(' ');
    const num = parseInt(amount ?? '1', 10);

    switch (unit?.toUpperCase()) {
      case 'S':
        result.setSeconds(result.getSeconds() - num);
        break;
      case 'D':
        result.setDate(result.getDate() - num);
        break;
      case 'W':
        result.setDate(result.getDate() - num * 7);
        break;
      case 'M':
        result.setMonth(result.getMonth() - num);
        break;
      case 'Y':
        result.setFullYear(result.getFullYear() - num);
        break;
      default:
        result.setDate(result.getDate() - 1);
    }

    return result;
  }

  private deduplicateAndSort(klines: Kline[]): Kline[] {
    const uniqueMap = new Map<number, Kline>();
    for (const kline of klines) {
      uniqueMap.set(kline.openTime, kline);
    }

    return Array.from(uniqueMap.values()).sort((a, b) => a.openTime - b.openTime);
  }

  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = array[i];
      array[i] = array[j] as T;
      array[j] = temp as T;
    }
  }

  private isPacingViolation(error: unknown): boolean {
    if (error instanceof Error) {
      return (
        error.message.includes('pacing') ||
        error.message.includes('162') ||
        error.message.includes('rate limit')
      );
    }
    return false;
  }

  getEstimatedTime(_symbol: string, interval: TimeInterval, targetKlines = 40_000): number {
    const barsPerRequest = IB_BARS_PER_REQUEST[interval] ?? 390;
    const requestsNeeded = Math.ceil(targetKlines / barsPerRequest);
    const requestsPerMinute = IB_RATE_LIMITS.GLOBAL_REQUESTS_PER_10_MIN / 10;
    return Math.ceil(requestsNeeded / requestsPerMinute) * 60 * 1000;
  }
}

export const backfillService = new IBBackfillService();
