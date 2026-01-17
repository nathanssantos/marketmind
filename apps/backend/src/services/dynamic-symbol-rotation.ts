import type { MarketType } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { INTERVAL_MS, TIME_MS } from '../constants';
import { db } from '../db';
import { activeWatchers, tradeExecutions } from '../db/schema';
import { checkKlineAvailability } from './kline-prefetch';
import { logger } from './logger';
import { getOpportunityScoringService, type SymbolScore } from './opportunity-scoring';
import { outputRotationResults, RotationLogBuffer } from './watcher-batch-logger';

const HYSTERESIS_THRESHOLD = 10;

export const getIntervalMs = (interval: string): number => {
  const ms = INTERVAL_MS[interval as keyof typeof INTERVAL_MS];
  if (!ms) {
    logger.warn({ interval }, '[DynamicRotation] Invalid interval, using 1h fallback');
  }
  return ms ?? TIME_MS.HOUR;
};

export interface RotationConfig {
  enabled: boolean;
  limit: number;
  interval: string;
  excludedSymbols: string[];
  marketType: MarketType;
}

export interface RotationResult {
  added: string[];
  removed: string[];
  kept: string[];
  skippedWithPositions: string[];
  skippedInsufficientKlines: string[];
  timestamp: Date;
}

export class DynamicSymbolRotationService {
  private previousRankings: Map<string, Map<string, number>> = new Map();
  private rotationHistory: Map<string, RotationResult[]> = new Map();

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
          } else if (previousRank && !currentRank) {
            toRemove.push(symbol);
          } else {
            kept.push(symbol);
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
            config.interval,
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

      const unrankedRank = filteredScores.length + 1;
      for (const symbol of currentSymbols) {
        if (!currentRankings.has(symbol)) {
          currentRankings.set(symbol, unrankedRank);
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

  cleanupWallet(walletId: string): void {
    this.rotationHistory.delete(walletId);
    this.previousRankings.delete(walletId);
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
