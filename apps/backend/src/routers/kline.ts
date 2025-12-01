import type { Interval } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { klines } from '../db/schema';
import { backfillHistoricalKlines, calculateStartTime } from '../services/binance-historical';
import { getBinanceKlineSync } from '../services/binance-kline-sync';
import { protectedProcedure, router } from '../trpc';

const intervalSchema = z.enum([
  '1s', '1m', '3m', '5m', '15m', '30m',
  '1h', '2h', '4h', '6h', '8h', '12h',
  '1d', '3d', '1w', '1M',
]);

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
