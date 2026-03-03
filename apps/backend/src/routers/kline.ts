import type { AssetClass, Interval, MarketType } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { CHART_INITIAL_KLINES, TIME_MS } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { symbolSearch } from '../exchange/interactive-brokers/symbol-search';
import { aggregateYearlyKlines, getIntervalMilliseconds } from '../services/binance-historical';
import { prefetchKlines } from '../services/kline-prefetch';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../services/binance-kline-stream';
import { getKlineMaintenance } from '../services/kline-maintenance';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const intervalSchema = z.enum([
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M', '1y',
]);

const marketTypeSchema = z.enum(['SPOT', 'FUTURES']).default('FUTURES');
const assetClassSchema = z.enum(['CRYPTO', 'STOCKS']).default('CRYPTO');

const symbolsCache = new Map<string, any[]>();
const symbolsCacheTime = new Map<string, number>();
const SYMBOLS_CACHE_DURATION = 5 * TIME_MS.MINUTE;

const corruptionCheckCache = new Map<string, number>();
const CORRUPTION_CHECK_COOLDOWN = 2 * TIME_MS.MINUTE;

const triggerCorruptionCheck = (symbol: string, interval: string, marketType: MarketType): void => {
  const key = `${symbol}@${interval}@${marketType}`;
  const lastCheck = corruptionCheckCache.get(key) ?? 0;
  const now = Date.now();

  if (now - lastCheck < CORRUPTION_CHECK_COOLDOWN) return;

  corruptionCheckCache.set(key, now);

  const gapFiller = getKlineMaintenance();
  gapFiller.forceCheckSymbol(symbol, interval as Interval, marketType).catch((error) => {
    logger.error({ symbol, interval, marketType, error }, 'Error in corruption check');
  });
};

const subscribeToStream = (symbol: string, interval: string, marketType: MarketType): void => {
  if (marketType === 'FUTURES') {
    binanceFuturesKlineStreamService.subscribe(symbol, interval);
  } else {
    binanceKlineStreamService.subscribe(symbol, interval);
  }
};

const unsubscribeFromStream = (symbol: string, interval: string, marketType: MarketType): void => {
  if (marketType === 'FUTURES') {
    binanceFuturesKlineStreamService.unsubscribe(symbol, interval);
  } else {
    binanceKlineStreamService.unsubscribe(symbol, interval);
  }
};

export const klineRouter = router({
  subscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      subscribeToStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Subscribed to ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      unsubscribeFromStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Unsubscribed from ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  list: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        limit: z.number().min(1).max(50_000).default(CHART_INITIAL_KLINES),
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      if (input.interval === '1y') {
        await prefetchKlines({ symbol: input.symbol, interval: '1M', targetCount: input.limit * 12, marketType });
        const yearlyKlines = await aggregateYearlyKlines(input.symbol, marketType, input.limit);
        logger.trace({ symbol: input.symbol, interval: '1y', marketType, count: yearlyKlines.length }, 'Yearly klines aggregated from monthly data');
        return yearlyKlines;
      }

      await prefetchKlines({
        symbol: input.symbol,
        interval: input.interval,
        targetCount: input.limit,
        marketType,
      });

      const conditions = [
        eq(klines.symbol, input.symbol),
        eq(klines.interval, input.interval as Interval),
        eq(klines.marketType, marketType),
      ];

      if (input.startTime) {
        conditions.push(gte(klines.openTime, input.startTime));
      }

      if (input.endTime) {
        conditions.push(lte(klines.openTime, input.endTime));
      }

      const result = await db.query.klines.findMany({
        where: and(...conditions),
        orderBy: [desc(klines.openTime)],
        limit: input.limit,
      });

      result.sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

      subscribeToStream(input.symbol, input.interval as Interval, marketType);

      triggerCorruptionCheck(input.symbol, input.interval, marketType);

      return result;
    }),

  backfill: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        periodsBack: z.number().min(1).default(CHART_INITIAL_KLINES),
      })
    )
    .mutation(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      const result = await prefetchKlines({
        symbol: input.symbol,
        interval: input.interval,
        targetCount: input.periodsBack,
        marketType,
      });

      return {
        success: result.success,
        downloaded: result.downloaded,
        totalInDb: result.totalInDb,
        gaps: result.gaps,
        alreadyComplete: result.alreadyComplete,
      };
    }),

  latest: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      const latest = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
        ),
        orderBy: [desc(klines.openTime)],
      });

      return latest;
    }),

  subscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      subscribeToStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Subscribed to real-time stream ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  unsubscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .mutation(async ({ input }) => {
      unsubscribeFromStream(input.symbol, input.interval, input.marketType);
      return { success: true, message: `Unsubscribed from real-time stream ${input.symbol}@${input.interval} (${input.marketType})` };
    }),

  getActiveStreams: protectedProcedure
    .query(async () => {
      const spotStreams = binanceKlineStreamService.getActiveSubscriptions();
      const futuresStreams = binanceFuturesKlineStreamService.getActiveSubscriptions();
      return {
        streams: spotStreams,
        futuresStreams,
      };
    }),

  count: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      const result = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
        ),
      });

      return { count: result.length };
    }),

  auditAndRepair: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        limit: z.number().min(1).max(500).default(100),
        autoFix: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const gapFiller = getKlineMaintenance();
      const marketType = input.marketType as MarketType;

      const result = await gapFiller.forceCheckSymbol(
        input.symbol,
        input.interval as Interval,
        marketType
      );

      return {
        success: true,
        gapsFilled: result.gapsFilled,
        corruptedFixed: result.corruptedFixed,
      };
    }),

  repairAll: protectedProcedure
    .mutation(async () => {
      const maintenance = getKlineMaintenance();
      return maintenance.repairAll();
    }),

  getMaintenanceStatus: protectedProcedure
    .query(async () => {
      const maintenance = getKlineMaintenance();
      return maintenance.getStatusEntries();
    }),

  getCooldowns: protectedProcedure
    .query(() => {
      return getKlineMaintenance().getCooldowns();
    }),

  setCooldowns: protectedProcedure
    .input(
      z.object({
        gapCheckMs: z.number().min(30 * 60 * 1000).max(24 * 60 * 60 * 1000),
        corruptionCheckMs: z.number().min(30 * 60 * 1000).max(24 * 60 * 60 * 1000),
      })
    )
    .mutation(({ input }) => {
      getKlineMaintenance().setCooldowns(input.gapCheckMs, input.corruptionCheckMs);
      return { success: true };
    }),

  sync: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        since: z.number(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;
      const sinceDate = new Date(input.since);
      const now = Date.now();
      const intervalMs = getIntervalMilliseconds(input.interval as Interval);

      const result = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType),
          gte(klines.closeTime, sinceDate)
        ),
        orderBy: [desc(klines.openTime)],
        limit: input.limit,
      });

      const closedKlines = result.filter((k) => {
        const closeTime = k.closeTime.getTime();
        return now >= closeTime + 2000;
      });

      closedKlines.sort((a, b) => a.openTime.getTime() - b.openTime.getTime());

      const latestClosed = closedKlines[closedKlines.length - 1];
      const nextExpectedOpen = latestClosed
        ? latestClosed.openTime.getTime() + intervalMs
        : input.since;

      return {
        klines: closedKlines,
        latestCloseTime: latestClosed?.closeTime.getTime() ?? input.since,
        nextExpectedOpen,
        serverTime: now,
      };
    }),

  searchSymbols: protectedProcedure
    .input(
      z.object({
        query: z.string().min(1).max(20),
        marketType: marketTypeSchema,
        assetClass: assetClassSchema,
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;
      const assetClass = input.assetClass as AssetClass;

      if (assetClass === 'STOCKS') {
        try {
          const results = await symbolSearch.searchStocks(input.query, 50);
          return results.map((r) => ({
            symbol: r.symbol,
            baseAsset: r.symbol,
            quoteAsset: r.currency,
            displayName: r.description ?? r.symbol,
            conId: r.conId,
            secType: r.secType,
            primaryExchange: r.primaryExchange,
          }));
        } catch (error) {
          logger.warn({ query: input.query, error }, 'IB symbol search failed, returning empty results');
          return [];
        }
      }

      const cacheKey = `symbols_${marketType}`;

      let symbols = symbolsCache.get(cacheKey);
      const cacheTime = symbolsCacheTime.get(cacheKey) ?? 0;
      const now = Date.now();

      if (!symbols || now - cacheTime > SYMBOLS_CACHE_DURATION) {
        const baseUrl = marketType === 'FUTURES'
          ? 'https://fapi.binance.com/fapi/v1/exchangeInfo'
          : 'https://api.binance.com/api/v3/exchangeInfo';

        const response = await fetch(baseUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch exchange info: ${response.status}`);
        }

        const data = await response.json();
        const fetchedSymbols = data.symbols
          .filter((s: any) => s.status === 'TRADING' || s.contractStatus === 'TRADING')
          .map((s: any) => ({
            symbol: s.symbol,
            baseAsset: s.baseAsset,
            quoteAsset: s.quoteAsset,
            displayName: `${s.baseAsset}/${s.quoteAsset}`,
          }));

        symbolsCache.set(cacheKey, fetchedSymbols);
        symbolsCacheTime.set(cacheKey, now);
        symbols = fetchedSymbols;
        logger.info({ marketType, count: fetchedSymbols.length }, 'Cached exchange symbols');
      }

      const query = input.query.toUpperCase();
      const symbolList = symbols ?? [];
      const filtered = symbolList.filter((s: any) =>
        s.symbol.includes(query) ||
        s.baseAsset.includes(query) ||
        s.quoteAsset.includes(query)
      );

      return filtered.slice(0, 50);
    }),
});
