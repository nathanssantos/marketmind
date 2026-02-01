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
import { checkKlineAvailability } from './kline-prefetch';
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

const fetchBtcKlines = async (interval: string) => {
  return db.query.klines.findMany({
    where: and(eq(klines.symbol, BTC_KLINE_QUERY.SYMBOL), eq(klines.interval, interval)),
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
}

export type OrderBookPressure = 'BUYING' | 'SELLING' | 'NEUTRAL';

export interface RotationResult {
  added: string[];
  removed: string[];
  kept: string[];
  skippedInsufficientKlines: string[];
  skippedInsufficientCapital: string[];
  skippedTrend: string[];
  skippedBtcDominance: string[];
  skippedChoppyMarket: string[];
  skippedAltSeason: string[];
  skippedOrderBook: string[];
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

      let filteredScores = scores.filter(
        (s) => !config.excludedSymbols.includes(s.symbol)
      );

      const skippedInsufficientCapital: string[] = [];

      if (config.capitalRequirement) {
        const allSymbols = filteredScores.map(s => s.symbol);
        const { eligibleSymbols, excludedSymbols } =
          await minNotionalFilter.calculateMaxWatchersFromSymbols(
            allSymbols,
            config.capitalRequirement.walletBalance,
            config.capitalRequirement.leverage,
            config.capitalRequirement.exposureMultiplier,
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
      const skippedBtcDominance: string[] = [];
      const skippedChoppyMarket: string[] = [];
      const skippedAltSeason: string[] = [];
      const skippedOrderBook: string[] = [];
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
        const btcDbKlines = await fetchBtcKlines(config.interval);
        if (btcDbKlines.length >= ROTATION_FILTERS.MIN_BTC_KLINES) {
          btcKlinesData = mapDbKlinesReversed(btcDbKlines);
        }
      }

      if (config.useBtcCorrelationFilter && btcKlinesData) {
        const btcEma21Trend = getEma21Direction(btcKlinesData);
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
          const btcSymbol = filteredScores.find(s => s.symbol === BTC_KLINE_QUERY.SYMBOL);
          if (btcSymbol) {
            const nonBtcSymbols = filteredScores.filter(s => s.symbol !== BTC_KLINE_QUERY.SYMBOL);
            const reducedAltCount = Math.floor(nonBtcSymbols.length * ROTATION_FILTERS.BTC_DOMINANCE_ALT_REDUCTION);
            const reducedAlts = nonBtcSymbols.slice(0, reducedAltCount);
            const removed = nonBtcSymbols.slice(reducedAltCount).map(s => s.symbol);
            skippedBtcDominance.push(...removed);
            filteredScores = [btcSymbol, ...reducedAlts];

            logger.info({
              btcDominance: btcDominance.toFixed(1),
              threshold,
              reducedFrom: nonBtcSymbols.length,
              reducedTo: reducedAltCount,
            }, '[DynamicRotation] BTC Dominance high - reducing alt exposure');
          }
        }
      }

      if (config.useAdxTrendStrength && btcKlinesData && btcKlinesData.length >= ADX_TREND.MIN_KLINES_REQUIRED) {
        const adxResult = checkAdxCondition(btcKlinesData, 'LONG');
        btcAdx = adxResult.adx ?? undefined;
        const adxThreshold = config.adxMinThreshold ?? ADX_TREND.CHOPPY_MARKET_THRESHOLD;

        if (btcAdx !== undefined && btcAdx < adxThreshold) {
          isChoppyMarket = true;
          const reducedCount = Math.floor(filteredScores.length * ROTATION_FILTERS.CHOPPY_MARKET_REDUCTION);
          const removed = filteredScores.slice(reducedCount).map(s => s.symbol);
          skippedChoppyMarket.push(...removed);
          filteredScores = filteredScores.slice(0, reducedCount);

          logger.info({
            btcAdx: btcAdx.toFixed(2),
            adxThreshold,
            isChoppyMarket: true,
            reducedFrom: filteredScores.length + removed.length,
            reducedTo: filteredScores.length,
          }, '[DynamicRotation] Market is choppy (low ADX) - reducing rotation');
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
          const btcSymbol = filteredScores.find(s => s.symbol === BTC_KLINE_QUERY.SYMBOL);
          if (btcSymbol) {
            const nonBtcSymbols = filteredScores.filter(s => s.symbol !== BTC_KLINE_QUERY.SYMBOL);
            const reducedAltCount = Math.floor(nonBtcSymbols.length * ROTATION_FILTERS.BTC_SEASON_ALT_REDUCTION);
            const reducedAlts = nonBtcSymbols.slice(0, reducedAltCount);
            const removed = nonBtcSymbols.slice(reducedAltCount).map(s => s.symbol);
            skippedAltSeason.push(...removed);
            filteredScores = [btcSymbol, ...reducedAlts];

            logger.info({
              seasonType: 'BTC_SEASON',
              altSeasonIndex: altcoinSeasonIndex.toFixed(1),
              reducedFrom: nonBtcSymbols.length,
              reducedTo: reducedAltCount,
            }, '[DynamicRotation] BTC Season - significantly reducing alt exposure');
          }
        } else if (seasonResult.seasonType === 'ALT_SEASON') {
          const btcSymbol = filteredScores.find(s => s.symbol === BTC_KLINE_QUERY.SYMBOL);
          if (btcSymbol) {
            const btcIndex = filteredScores.indexOf(btcSymbol);
            if (btcIndex > ROTATION_FILTERS.BTC_DEPRIORITIZE_RANK) {
              filteredScores = filteredScores.filter(s => s.symbol !== BTC_KLINE_QUERY.SYMBOL);
              logger.info({
                seasonType: 'ALT_SEASON',
                altSeasonIndex: altcoinSeasonIndex.toFixed(1),
              }, '[DynamicRotation] Alt Season - deprioritizing BTC');
            }
          }
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
          const reducedCount = Math.floor(filteredScores.length * ROTATION_FILTERS.SELLING_PRESSURE_REDUCTION);
          const removed = filteredScores.slice(reducedCount).map(s => s.symbol);
          skippedOrderBook.push(...removed);
          filteredScores = filteredScores.slice(0, reducedCount);

          logger.info({
            pressure: btcOrderBook.pressure,
            imbalanceRatio: btcOrderBook.imbalanceRatio.toFixed(2),
            minRatio,
            reducedFrom: filteredScores.length + removed.length,
            reducedTo: filteredScores.length,
          }, '[DynamicRotation] Strong selling pressure - reducing rotation');
        } else if (btcOrderBook.askWalls.length > btcOrderBook.bidWalls.length * ROTATION_FILTERS.ASK_WALL_RATIO_THRESHOLD) {
          const reducedCount = Math.floor(filteredScores.length * ROTATION_FILTERS.ASK_WALL_REDUCTION);
          const removed = filteredScores.slice(reducedCount).map(s => s.symbol);
          skippedOrderBook.push(...removed);
          filteredScores = filteredScores.slice(0, reducedCount);

          logger.info({
            askWalls: btcOrderBook.askWalls.length,
            bidWalls: btcOrderBook.bidWalls.length,
            reducedFrom: filteredScores.length + removed.length,
            reducedTo: filteredScores.length,
          }, '[DynamicRotation] Significant ask walls detected - slightly reducing rotation');
        } else {
          logger.info({
            pressure: btcOrderBook.pressure,
            imbalanceRatio: btcOrderBook.imbalanceRatio.toFixed(2),
            bidWalls: btcOrderBook.bidWalls.length,
            askWalls: btcOrderBook.askWalls.length,
          }, '[DynamicRotation] Order book analysis - no adjustments needed');
        }
      }

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
        }, `[DynamicRotation] ⚠️ All symbols filtered by ${filterReason} - keeping existing watchers`);
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
        skippedInsufficientKlines,
        skippedInsufficientCapital,
        skippedTrend,
        skippedBtcDominance,
        skippedChoppyMarket,
        skippedAltSeason,
        skippedOrderBook,
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
        skippedInsufficientKlines: [],
        skippedInsufficientCapital: [],
        skippedTrend: [],
        skippedBtcDominance: [],
        skippedChoppyMarket: [],
        skippedAltSeason: [],
        skippedOrderBook: [],
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
