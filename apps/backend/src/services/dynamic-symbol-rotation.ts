import type { MarketType } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { INTERVAL_MS, TIME_MS } from '../constants';
import { db } from '../db';
import { activeWatchers, tradeExecutions } from '../db/schema';
import { checkKlineAvailability } from './kline-prefetch';
import { logger } from './logger';
import { getOpportunityScoringService, type SymbolScore } from './opportunity-scoring';
import { outputRotationResults, RotationLogBuffer } from './watcher-batch-logger';

export type RotationInterval = '1h' | '4h' | '1d';

export const ROTATION_INTERVAL_MS: Record<RotationInterval, number> = {
  '1h': TIME_MS.HOUR,
  '4h': 4 * TIME_MS.HOUR,
  '1d': TIME_MS.DAY,
};

const HYSTERESIS_THRESHOLD = 10;

export const getOptimalRotationInterval = (watcherInterval: string): RotationInterval => {
  const intervalMs = INTERVAL_MS[watcherInterval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;

  if (intervalMs <= TIME_MS.HOUR) return '1h';
  if (intervalMs <= 4 * TIME_MS.HOUR) return '4h';
  return '1d';
};

export interface RotationConfig {
  enabled: boolean;
  limit: number;
  interval: RotationInterval;
  excludedSymbols: string[];
  marketType: MarketType;
  tradingInterval: string;
}

export interface RotationResult {
  added: string[];
  removed: string[];
  kept: string[];
  skippedWithPositions: string[];
  skippedInsufficientKlines: string[];
  timestamp: Date;
}

interface ScheduledRotation {
  walletId: string;
  userId: string;
  timeoutId: ReturnType<typeof setTimeout>;
  nextRunAt: Date;
}

export class DynamicSymbolRotationService {
  private scheduledRotations: Map<string, ScheduledRotation> = new Map();
  private previousRankings: Map<string, Map<string, number>> = new Map();
  private rotationHistory: Map<string, RotationResult[]> = new Map();

  async startRotation(
    walletId: string,
    userId: string,
    config: RotationConfig
  ): Promise<void> {
    this.stopRotation(walletId);

    const intervalMs = ROTATION_INTERVAL_MS[config.interval];
    const now = Date.now();
    const nextRun = Math.ceil(now / intervalMs) * intervalMs;
    const delay = nextRun - now;

    const timeoutId = setTimeout(() => {
      this.executeRotation(walletId, userId, config);
      this.scheduleNextRotation(walletId, userId, config);
    }, delay);

    this.scheduledRotations.set(walletId, {
      walletId,
      userId,
      timeoutId,
      nextRunAt: new Date(nextRun),
    });

    logger.info({ walletId, interval: config.interval, nextRun: new Date(nextRun) },
      '[DynamicRotation] Scheduled rotation');
  }

  stopRotation(walletId: string): void {
    const scheduled = this.scheduledRotations.get(walletId);
    if (scheduled) {
      clearTimeout(scheduled.timeoutId);
      this.scheduledRotations.delete(walletId);
      logger.info({ walletId }, '[DynamicRotation] Stopped rotation');
    }
  }

  private scheduleNextRotation(
    walletId: string,
    userId: string,
    config: RotationConfig
  ): void {
    const intervalMs = ROTATION_INTERVAL_MS[config.interval];

    const timeoutId = setTimeout(() => {
      this.executeRotation(walletId, userId, config);
      this.scheduleNextRotation(walletId, userId, config);
    }, intervalMs);

    this.scheduledRotations.set(walletId, {
      walletId,
      userId,
      timeoutId,
      nextRunAt: new Date(Date.now() + intervalMs),
    });
  }

  async executeRotation(
    walletId: string,
    _userId: string,
    config: RotationConfig
  ): Promise<RotationResult> {
    const logBuffer = new RotationLogBuffer(walletId, config.interval);

    try {
      const scoringService = getOpportunityScoringService();
      const scores = await scoringService.getSymbolScores(config.marketType, config.limit * 2);

      const filteredScores = scores.filter(
        (s) => !config.excludedSymbols.includes(s.symbol)
      );

      const optimalSymbols = filteredScores.slice(0, config.limit).map((s) => s.symbol);

      const currentWatchers = await db
        .select()
        .from(activeWatchers)
        .where(
          and(
            eq(activeWatchers.walletId, walletId),
            eq(activeWatchers.isManual, false)
          )
        );

      const currentSymbols = new Set(currentWatchers.map((w) => w.symbol));

      const symbolsWithOpenPositions = await this.getSymbolsWithOpenPositions(walletId);

      const walletPreviousRankings = this.previousRankings.get(walletId) ?? new Map();
      const currentRankings = new Map(
        filteredScores.map((s, i) => [s.symbol, i + 1])
      );

      const toRemove: string[] = [];
      const toAdd: string[] = [];
      const kept: string[] = [];
      const skippedWithPositions: string[] = [];
      const skippedInsufficientKlines: string[] = [];

      for (const symbol of currentSymbols) {
        const currentRank = currentRankings.get(symbol);
        const previousRank = walletPreviousRankings.get(symbol);

        if (symbolsWithOpenPositions.has(symbol)) {
          skippedWithPositions.push(symbol);
          kept.push(symbol);
          continue;
        }

        if (!currentRank || currentRank > config.limit) {
          if (previousRank && currentRank) {
            const rankDrop = currentRank - previousRank;
            if (rankDrop >= HYSTERESIS_THRESHOLD) {
              toRemove.push(symbol);
            } else {
              kept.push(symbol);
            }
          } else {
            toRemove.push(symbol);
          }
        } else {
          kept.push(symbol);
        }
      }

      const targetCount = currentSymbols.size === 0 ? config.limit : currentSymbols.size;
      const slotsAvailable = Math.max(0, targetCount - kept.length);

      for (const symbol of optimalSymbols) {
        if (toAdd.length >= slotsAvailable) break;
        if (!currentSymbols.has(symbol) && !kept.includes(symbol)) {
          const klineCheck = await checkKlineAvailability(
            symbol,
            config.tradingInterval,
            config.marketType,
            true
          );

          if (!klineCheck.hasSufficient) {
            skippedInsufficientKlines.push(symbol);
            continue;
          }

          toAdd.push(symbol);
        }
      }

      this.previousRankings.set(walletId, currentRankings);

      const result: RotationResult = {
        added: toAdd,
        removed: toRemove,
        kept,
        skippedWithPositions,
        skippedInsufficientKlines,
        timestamp: new Date(),
      };

      this.addToHistory(walletId, result);

      logBuffer.setContext({
        marketType: config.marketType,
        targetCount,
        slotsAvailable,
        currentSymbols: Array.from(currentSymbols),
        optimalSymbols: optimalSymbols.slice(0, 10),
      });

      logBuffer.setResult({
        added: toAdd,
        removed: toRemove,
        kept: kept.length,
        skippedWithPositions,
        skippedInsufficientKlines,
      });

      outputRotationResults(logBuffer.toResult());

      return result;
    } catch (error) {
      logger.error({ error, walletId }, '[DynamicRotation] Error during rotation');
      return {
        added: [],
        removed: [],
        kept: [],
        skippedWithPositions: [],
        skippedInsufficientKlines: [],
        timestamp: new Date(),
      };
    }
  }

  private async getSymbolsWithOpenPositions(walletId: string): Promise<Set<string>> {
    const openExecutions = await db
      .select({ symbol: tradeExecutions.symbol })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'open')
        )
      );

    return new Set(openExecutions.map((e) => e.symbol));
  }

  private addToHistory(walletId: string, result: RotationResult): void {
    const history = this.rotationHistory.get(walletId) ?? [];
    history.unshift(result);

    if (history.length > 100) {
      history.pop();
    }

    this.rotationHistory.set(walletId, history);
  }

  getRotationHistory(walletId: string, limit: number = 10): RotationResult[] {
    const history = this.rotationHistory.get(walletId) ?? [];
    return history.slice(0, limit);
  }

  getNextRotationTime(walletId: string): Date | null {
    const scheduled = this.scheduledRotations.get(walletId);
    return scheduled?.nextRunAt ?? null;
  }

  isRotationActive(walletId: string): boolean {
    return this.scheduledRotations.has(walletId);
  }

  async getRecommendedSymbols(
    marketType: MarketType,
    limit: number = 20,
    excludedSymbols: string[] = []
  ): Promise<SymbolScore[]> {
    const scoringService = getOpportunityScoringService();
    const scores = await scoringService.getSymbolScores(marketType, limit * 2);
    return scores
      .filter((s) => !excludedSymbols.includes(s.symbol))
      .slice(0, limit);
  }

  clearHistory(walletId: string): void {
    this.rotationHistory.delete(walletId);
    this.previousRankings.delete(walletId);
  }

  stopAll(): void {
    for (const [walletId] of this.scheduledRotations) {
      this.stopRotation(walletId);
    }
  }
}

let dynamicSymbolRotationService: DynamicSymbolRotationService | null = null;

export const getDynamicSymbolRotationService = (): DynamicSymbolRotationService => {
  if (!dynamicSymbolRotationService) {
    dynamicSymbolRotationService = new DynamicSymbolRotationService();
  }
  return dynamicSymbolRotationService;
};

export default DynamicSymbolRotationService;
