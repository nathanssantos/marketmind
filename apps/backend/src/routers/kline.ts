import type { Interval } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { klines } from '../db/schema';
import { backfillHistoricalKlines, calculateStartTime, fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { binanceKlineStreamService } from '../services/binance-kline-stream';
import { getBinanceKlineSync } from '../services/binance-kline-sync';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const intervalSchema = z.enum([
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

const klineSchema = z.object({
  symbol: z.string(),
  interval: z.string(),
  openTime: z.date(),
  open: z.string(),
  high: z.string(),
  low: z.string(),
  close: z.string(),
  volume: z.string(),
  quoteVolume: z.string(),
  trades: z.number(),
  takerBuyBaseVolume: z.string(),
  takerBuyQuoteVolume: z.string(),
  createdAt: z.string(),
});

export const klineRouter = router({
  subscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .mutation(async ({ input }) => {
      const sync = getBinanceKlineSync();
      sync.subscribe(input.symbol, input.interval as Interval);

      return { success: true, message: `Subscribed to ${input.symbol}@${input.interval}` };
    }),

  unsubscribe: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .mutation(async ({ input }) => {
      const sync = getBinanceKlineSync();
      sync.unsubscribe(input.symbol, input.interval as Interval);

      return { success: true, message: `Unsubscribed from ${input.symbol}@${input.interval}` };
    }),

  list: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        startTime: z.date().optional(),
        endTime: z.date().optional(),
        limit: z.number().min(1).max(1000).default(500),
      })
    )
    .query(async ({ input }) => {
      const conditions = [
        eq(klines.symbol, input.symbol),
        eq(klines.interval, input.interval as Interval),
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

      // If database is empty, fetch directly from Binance API
      if (result.length === 0) {
        logger.info({ symbol: input.symbol, interval: input.interval }, 'Database empty, fetching from Binance API');
        
        const endTime = input.endTime || new Date();
        const startTime = input.startTime || calculateStartTime(input.interval as Interval, input.limit);
        
        const apiKlines = await fetchHistoricalKlinesFromAPI(
          input.symbol,
          input.interval as Interval,
          startTime,
          endTime
        );
        
        // Debug: Log first kline to verify data
        if (apiKlines.length > 0) {
          logger.info({ firstKline: apiKlines[0] }, 'Sample kline from API');
        }
        
        // API already returns objects with correct keys, just add metadata
        return apiKlines.map((k: any) => ({
          symbol: input.symbol,
          interval: input.interval,
          openTime: new Date(k.openTime),
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
          volume: k.volume,
          quoteVolume: k.quoteVolume,
          trades: k.trades,
          takerBuyBaseVolume: k.takerBuyBaseVolume,
          takerBuyQuoteVolume: k.takerBuyQuoteVolume,
          createdAt: new Date().toISOString(),
        }));
      }

      return result.reverse();
    }),

  backfill: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
        periodsBack: z.number().min(1).max(10000).default(500),
      })
    )
    .mutation(async ({ input }) => {
      const sync = getBinanceKlineSync();
      const latestKline = await sync.getLatestKline(input.symbol, input.interval as Interval);

      const startTime = latestKline || calculateStartTime(input.interval as Interval, input.periodsBack);
      const endTime = new Date();

      const inserted = await backfillHistoricalKlines(
        input.symbol,
        input.interval as Interval,
        startTime,
        endTime
      );

      return {
        success: true,
        inserted,
        startTime,
        endTime,
      };
    }),

  latest: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .query(async ({ input }) => {
      const latest = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
        orderBy: [desc(klines.openTime)],
      });

      return latest;
    }),

  // Real-time streaming endpoints
  subscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .mutation(async ({ input }) => {
      binanceKlineStreamService.subscribe(input.symbol, input.interval);
      return { success: true, message: `Subscribed to real-time stream ${input.symbol}@${input.interval}` };
    }),

  unsubscribeStream: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .mutation(async ({ input }) => {
      binanceKlineStreamService.unsubscribe(input.symbol, input.interval);
      return { success: true, message: `Unsubscribed from real-time stream ${input.symbol}@${input.interval}` };
    }),

  getActiveStreams: protectedProcedure
    .query(async () => {
      const streams = binanceKlineStreamService.getActiveSubscriptions();
      return { streams };
    }),

  count: protectedProcedure
    .input(
      z.object({
        symbol: z.string(),
        interval: intervalSchema,
      })
    )
    .query(async ({ input }) => {
      const result = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
      });

      return { count: result.length };
    }),
});
