import type { MarketType } from '@marketmind/types';
import { and, desc, eq } from 'drizzle-orm';
import { INTERVAL_MS, TIME_MS, ROTATION_FILTERS, BTC_KLINE_QUERY, ADX_TREND } from '../constants';
import { db } from '../db';
import { activeWatchers, klines } from '../db/schema';
import { checkAdxCondition } from '../utils/filters/adx-filter';
import { getEma21Direction } from '../utils/filters/btc-correlation-filter';
import { mapDbKlinesReversed } from '../utils/kline-mapper';
import { getAltcoinSeasonIndexService, type SeasonType } from './altcoin-season-index';
import { getBTCDominanceDataService } from './btc-dominance-data';
import { logger } from './logger';
import { getMinNotionalFilterService, type CapitalRequirement } from './min-notional-filter';
import { getOpportunityScoringService, type SymbolScore } from './opportunity-scoring';
import { getOrderBookAnalyzerService, type OrderBookAnalysis } from './order-book-analyzer';
import { outputRotationResults, RotationLogBuffer } from './watcher-batch-logger';

export const getIntervalMs = (interval: string): number => {
  const ms = INTERVAL_MS[interval as keyof typeof INTERVAL_MS];
  if (!ms) {
    logger.warn({ interval }, '[DynamicRotation] Invalid interval, using 1h fallback');
  }
  return ms ?? TIME_MS.HOUR;
};

const fetchBtcKlines = async (interval: string, marketType: MarketType) => {
  return db.query.klines.findMany({
    where: and(eq(klines.symbol, BTC_KLINE_QUERY.SYMBOL), eq(klines.interval, interval), eq(klines.marketType, marketType)),
    orderBy: [desc(klines.openTime)],
    limit: BTC_KLINE_QUERY.LIMIT,
  });
};

export interface RotationConfig {
  enabled: boolean;
  limit: number;
  interval: string;
  excludedSymbols: string[];
  marketType: MarketType;
  capitalRequirement?: CapitalRequirement;
  useBtcCorrelationFilter?: boolean;
  useBtcDominanceCheck?: boolean;
  btcDominanceThreshold?: number;
  useAdxTrendStrength?: boolean;
  adxMinThreshold?: number;
  useAltcoinSeasonIndex?: boolean;
  useOrderBookAnalysis?: boolean;
  minImbalanceRatio?: number;
  directionMode?: 'auto' | 'long_only' | 'short_only';
}

export type OrderBookPressure = 'BUYING' | 'SELLING' | 'NEUTRAL';

export interface RotationResult {
  added: string[];
  removed: string[];
  kept: string[];
  targetLimit: number;
  skippedInsufficientKlines: string[];
  skippedInsufficientCapital: string[];
  skippedTrend: string[];
  directionMode?: 'auto' | 'long_only' | 'short_only';
  btcTrend?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  btcDominance?: number;
  btcAdx?: number;
  isChoppyMarket?: boolean;
  altcoinSeasonType?: SeasonType;
  altcoinSeasonIndex?: number;
  btcOrderBook?: OrderBookAnalysis;
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
      const minNotionalFilter = getMinNotionalFilterService();

      const fetchMultiplier = config.capitalRequirement ? 4 : 2;
      const scores = await scoringService.getSymbolScores(config.marketType, config.limit * fetchMultiplier);

      logger.info({
        walletId,
        targetLimit: config.limit,
        fetchedSymbols: scores.length,
        hasCapitalRequirement: !!config.capitalRequirement,
        useBtcCorrelationFilter: config.useBtcCorrelationFilter,
        walletBalance: config.capitalRequirement?.walletBalance,
        leverage: config.capitalRequirement?.leverage,
      }, '[DynamicRotation] Starting rotation');

      let filteredScores = scores
        .filter((s) => !config.excludedSymbols.includes(s.symbol))
        .map(s => ({ ...s }));

      const skippedInsufficientCapital: string[] = [];

      if (config.capitalRequirement) {
        const allSymbols = filteredScores.map(s => s.symbol);
        const { eligibleSymbols, excludedSymbols } =
          await minNotionalFilter.calculateMaxWatchersFromSymbols(
            allSymbols,
            config.capitalRequirement.walletBalance,
            config.capitalRequirement.leverage,
            config.capitalRequirement.positionSizePercent,
            config.marketType
          );

        skippedInsufficientCapital.push(...excludedSymbols.keys());

        const eligibleSet = new Set(eligibleSymbols);
        filteredScores = filteredScores.filter(s => eligibleSet.has(s.symbol));

        logger.info({
          eligibleSymbolsCount: eligibleSymbols.length,
          excludedByCapital: excludedSymbols.size,
          remainingScores: filteredScores.length,
        }, '[DynamicRotation] Capital filter applied');
      }

      const skippedTrend: string[] = [];
      let btcTrend: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
      let btcDominance: number | undefined;
      let btcAdx: number | undefined;
      let isChoppyMarket = false;
      let altcoinSeasonType: SeasonType | undefined;
      let altcoinSeasonIndex: number | undefined;
      let btcOrderBook: OrderBookAnalysis | undefined;

      const symbolsAfterCapitalFilter = filteredScores.length;

      let btcKlinesData: ReturnType<typeof mapDbKlinesReversed> | null = null;

      const needsBtcKlines = config.useBtcCorrelationFilter || config.useAdxTrendStrength;
      if (needsBtcKlines) {
        const btcDbKlines = await fetchBtcKlines(config.interval, config.marketType);
        if (btcDbKlines.length >= ROTATION_FILTERS.MIN_BTC_KLINES) {
          btcKlinesData = mapDbKlinesReversed(btcDbKlines);
        }
      }

      if (config.useBtcCorrelationFilter && btcKlinesData) {
        const btcEma21Trend = await getEma21Direction(btcKlinesData);
        btcTrend = btcEma21Trend.direction;

        logger.info({
          btcTrend,
          btcPrice: btcEma21Trend.price?.toFixed(2),
          btcEma21: btcEma21Trend.ema21?.toFixed(2),
        }, '[DynamicRotation] BTC Correlation Filter - Trend');
      }

      if (config.useBtcDominanceCheck) {
        const dominanceService = getBTCDominanceDataService();
        const dominanceData = await dominanceService.getBTCDominance();
        btcDominance = dominanceData?.btcDominance;
        const threshold = config.btcDominanceThreshold ?? ROTATION_FILTERS.BTC_DOMINANCE_THRESHOLD;

        if (btcDominance && btcDominance > threshold) {
          for (const score of filteredScores) {
            score.compositeScore *= score.symbol === BTC_KLINE_QUERY.SYMBOL
              ? ROTATION_FILTERS.BTC_DOMINANCE_BTC_BONUS
              : ROTATION_FILTERS.BTC_DOMINANCE_ALT_PENALTY;
          }

          logger.info({
            btcDominance: btcDominance.toFixed(1),
            threshold,
          }, '[DynamicRotation] BTC Dominance high - adjusting scores');
        }
      }

      if (config.useAdxTrendStrength && btcKlinesData && btcKlinesData.length >= ADX_TREND.MIN_KLINES_REQUIRED) {
        const adxResult = await checkAdxCondition(btcKlinesData, 'LONG');
        btcAdx = adxResult.adx ?? undefined;
        const adxThreshold = config.adxMinThreshold ?? ADX_TREND.CHOPPY_MARKET_THRESHOLD;

        if (btcAdx !== undefined && btcAdx < adxThreshold) {
          isChoppyMarket = true;
          for (const score of filteredScores) {
            score.compositeScore *= ROTATION_FILTERS.CHOPPY_MARKET_PENALTY;
          }

          logger.info({
            btcAdx: btcAdx.toFixed(2),
            adxThreshold,
            isChoppyMarket: true,
          }, '[DynamicRotation] Market is choppy (low ADX) - penalizing scores');
        } else {
          logger.info({
            btcAdx: btcAdx?.toFixed(2),
            adxThreshold,
            isChoppyMarket: false,
          }, '[DynamicRotation] ADX Trend Strength check passed');
        }
      }

      if (config.useAltcoinSeasonIndex) {
        const altSeasonService = getAltcoinSeasonIndexService();
        const seasonResult = await altSeasonService.getAltcoinSeasonIndex({
          marketType: config.marketType,
        });

        altcoinSeasonType = seasonResult.seasonType;
        altcoinSeasonIndex = seasonResult.altSeasonIndex;

        if (seasonResult.seasonType === 'BTC_SEASON') {
          for (const score of filteredScores) {
            score.compositeScore *= score.symbol === BTC_KLINE_QUERY.SYMBOL
              ? ROTATION_FILTERS.BTC_SEASON_BTC_BONUS
              : ROTATION_FILTERS.BTC_SEASON_ALT_PENALTY;
          }

          logger.info({
            seasonType: 'BTC_SEASON',
            altSeasonIndex: altcoinSeasonIndex.toFixed(1),
          }, '[DynamicRotation] BTC Season - adjusting scores');
        } else if (seasonResult.seasonType === 'ALT_SEASON') {
          for (const score of filteredScores) {
            if (score.symbol === BTC_KLINE_QUERY.SYMBOL) {
              score.compositeScore *= ROTATION_FILTERS.ALT_SEASON_BTC_PENALTY;
            }
          }

          logger.info({
            seasonType: 'ALT_SEASON',
            altSeasonIndex: altcoinSeasonIndex.toFixed(1),
          }, '[DynamicRotation] Alt Season - penalizing BTC score');
        } else {
          logger.info({
            seasonType: 'NEUTRAL',
            altSeasonIndex: altcoinSeasonIndex.toFixed(1),
          }, '[DynamicRotation] Neutral season - no adjustments');
        }
      }

      if (config.useOrderBookAnalysis) {
        const orderBookService = getOrderBookAnalyzerService();
        btcOrderBook = await orderBookService.getOrderBookAnalysis(BTC_KLINE_QUERY.SYMBOL, config.marketType);
        const minRatio = config.minImbalanceRatio ?? ROTATION_FILTERS.MIN_ORDER_BOOK_IMBALANCE;

        if (btcOrderBook.pressure === 'SELLING' && btcOrderBook.imbalanceRatio < minRatio) {
          for (const score of filteredScores) {
            score.compositeScore *= ROTATION_FILTERS.SELLING_PRESSURE_PENALTY;
          }

          logger.info({
            pressure: btcOrderBook.pressure,
            imbalanceRatio: btcOrderBook.imbalanceRatio.toFixed(2),
            minRatio,
          }, '[DynamicRotation] Strong selling pressure - penalizing scores');
        } else if (btcOrderBook.askWalls.length > btcOrderBook.bidWalls.length * ROTATION_FILTERS.ASK_WALL_RATIO_THRESHOLD) {
          for (const score of filteredScores) {
            score.compositeScore *= ROTATION_FILTERS.ASK_WALL_PENALTY;
          }

          logger.info({
            askWalls: btcOrderBook.askWalls.length,
            bidWalls: btcOrderBook.bidWalls.length,
          }, '[DynamicRotation] Significant ask walls detected - penalizing scores');
        } else {
          logger.info({
            pressure: btcOrderBook.pressure,
            imbalanceRatio: btcOrderBook.imbalanceRatio.toFixed(2),
            bidWalls: btcOrderBook.bidWalls.length,
            askWalls: btcOrderBook.askWalls.length,
          }, '[DynamicRotation] Order book analysis - no adjustments needed');
        }
      }

      const directionMode = config.directionMode ?? 'auto';
      if (directionMode === 'long_only') {
        for (const score of filteredScores) {
          score.compositeScore *= score.rawData.priceChange24h > 0
            ? ROTATION_FILTERS.DIRECTION_BONUS
            : score.rawData.priceChange24h < 0
              ? ROTATION_FILTERS.DIRECTION_PENALTY
              : 1;
        }
      } else if (directionMode === 'short_only') {
        for (const score of filteredScores) {
          score.compositeScore *= score.rawData.priceChange24h < 0
            ? ROTATION_FILTERS.DIRECTION_BONUS
            : score.rawData.priceChange24h > 0
              ? ROTATION_FILTERS.DIRECTION_PENALTY
              : 1;
        }
      }

      filteredScores.sort((a, b) => b.compositeScore - a.compositeScore);
      const optimalSymbols = filteredScores.slice(0, config.limit).map((s) => s.symbol);

      const currentWatchers = await db
        .select()
        .from(activeWatchers)
        .where(
          and(
            eq(activeWatchers.walletId, walletId),
            eq(activeWatchers.isManual, false),
            eq(activeWatchers.interval, config.interval),
            eq(activeWatchers.marketType, config.marketType)
          )
        );

      const currentSymbols = new Set(currentWatchers.map((w) => w.symbol));

      const walletPreviousRankings = this.previousRankings.get(walletId) ?? new Map();
      const currentRankings = new Map(
        filteredScores.map((s, i) => [s.symbol, i + 1])
      );

      const toRemove: string[] = [];
      const toAdd: string[] = [];
      const kept: string[] = [];
      const skippedInsufficientKlines: string[] = [];

      for (const symbol of currentSymbols) {
        const currentRank = currentRankings.get(symbol);
        const previousRank = walletPreviousRankings.get(symbol);

        if (!currentRank || currentRank > config.limit) {
          if (previousRank && currentRank) {
            const rankDrop = currentRank - previousRank;
            if (rankDrop >= ROTATION_FILTERS.HYSTERESIS_THRESHOLD) {
              toRemove.push(symbol);
            } else {
              kept.push(symbol);
            }
          } else if (previousRank && !currentRank) {
            if (filteredScores.length === 0) {
              kept.push(symbol);
            } else {
              toRemove.push(symbol);
            }
          } else {
            kept.push(symbol);
          }
        } else {
          kept.push(symbol);
        }
      }

      if (kept.length > config.limit) {
        const rankedKept = kept.map(s => ({ symbol: s, rank: currentRankings.get(s) ?? Infinity }));
        rankedKept.sort((a, b) => a.rank - b.rank);
        const excess = rankedKept.slice(config.limit);
        for (const { symbol } of excess) {
          toRemove.push(symbol);
        }
        kept.length = 0;
        kept.push(...rankedKept.slice(0, config.limit).map(r => r.symbol));
      }

      if (filteredScores.length === 0 && currentSymbols.size > 0) {
        const filterReason = symbolsAfterCapitalFilter === 0
          ? 'capital requirements'
          : 'unknown';
        logger.warn({
          walletId,
          marketType: config.marketType,
          currentWatchersCount: currentSymbols.size,
          keptCount: kept.length,
          symbolsAfterCapitalFilter,
          btcTrend,
          filterReason,
        }, `[DynamicRotation] ! All symbols filtered by ${filterReason} - keeping existing watchers`);
      }

      const targetCount = config.limit;
      const slotsAvailable = Math.max(0, targetCount - kept.length);

      for (const symbol of optimalSymbols) {
        if (toAdd.length >= slotsAvailable) break;
        if (!currentSymbols.has(symbol) && !kept.includes(symbol)) {
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
        targetLimit: config.limit,
        skippedInsufficientKlines,
        skippedInsufficientCapital,
        skippedTrend,
        directionMode,
        btcTrend,
        btcDominance,
        btcAdx,
        isChoppyMarket,
        altcoinSeasonType,
        altcoinSeasonIndex,
        btcOrderBook,
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
        skippedInsufficientKlines,
        skippedInsufficientCapital,
      });

      outputRotationResults(logBuffer.toResult());

      return result;
    } catch (error) {
      logger.error({ error, walletId }, '[DynamicRotation] Error during rotation');
      return {
        added: [],
        removed: [],
        kept: [],
        targetLimit: config.limit,
        skippedInsufficientKlines: [],
        skippedInsufficientCapital: [],
        skippedTrend: [],
        btcTrend: 'NEUTRAL',
        isChoppyMarket: false,
        timestamp: new Date(),
      };
    }
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
