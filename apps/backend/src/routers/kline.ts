import type { Interval, MarketType } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { REQUIRED_KLINES, TIME_MS } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { aggregateYearlyKlines, getIntervalMilliseconds, smartBackfillKlines } from '../services/binance-historical';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../services/binance-kline-stream';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const intervalSchema = z.enum([
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M', '1y',
]);

const marketTypeSchema = z.enum(['SPOT', 'FUTURES']).default('SPOT');

const symbolsCache = new Map<string, any[]>();
const symbolsCacheTime = new Map<string, number>();
const SYMBOLS_CACHE_DURATION = 5 * TIME_MS.MINUTE;

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
        limit: z.number().min(1).max(REQUIRED_KLINES).default(REQUIRED_KLINES),
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      if (input.interval === '1y') {
        await smartBackfillKlines(input.symbol, '1M', input.limit * 12, marketType);
        const yearlyKlines = await aggregateYearlyKlines(input.symbol, marketType, input.limit);
        logger.info({ symbol: input.symbol, interval: '1y', marketType, count: yearlyKlines.length }, 'Yearly klines aggregated from monthly data');
        return yearlyKlines;
      }

      await smartBackfillKlines(
        input.symbol,
        input.interval as Interval,
        input.limit,
        marketType
      );

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

      return result;
    }),

  backfill: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        marketType: marketTypeSchema,
        periodsBack: z.number().min(1).default(REQUIRED_KLINES),
      })
    )
    .mutation(async ({ input }) => {
      const marketType = input.marketType as MarketType;

      const result = await smartBackfillKlines(
        input.symbol,
        input.interval as Interval,
        input.periodsBack,
        marketType
      );

      return {
        success: true,
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
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;
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
