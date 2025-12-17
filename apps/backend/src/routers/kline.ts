import type { Interval } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db';
import { klines } from '../db/schema';
import { backfillHistoricalKlines, calculateStartTime, fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { binanceKlineStreamService } from '../services/binance-kline-stream';
import { logger } from '../services/logger';
import { protectedProcedure, router } from '../trpc';

const getIntervalMs = (interval: string): number => {
  const units: Record<string, number> = {
    's': 1000,
    'm': 60 * 1000,
    'h': 60 * 60 * 1000,
    'd': 24 * 60 * 60 * 1000,
    'w': 7 * 24 * 60 * 60 * 1000,
    'M': 30 * 24 * 60 * 60 * 1000,
  };
  const match = interval.match(/^(\d+)([smhdwM])$/);
  if (!match?.[1] || !match[2]) return 4 * 60 * 60 * 1000;
  const unitMs = units[match[2]];
  if (!unitMs) return 4 * 60 * 60 * 1000;
  return parseInt(match[1]) * unitMs;
};

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
      binanceKlineStreamService.subscribe(input.symbol, input.interval);
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
      binanceKlineStreamService.unsubscribe(input.symbol, input.interval);
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

      const latestKlineResult = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
        orderBy: [desc(klines.openTime)],
      });

      const now = new Date();
      const intervalMs = getIntervalMs(input.interval);

      const existingCount = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
      });

      const minRequiredKlines = Math.floor(input.limit * 0.5);
      const hasInsufficientData = !latestKlineResult || existingCount.length < minRequiredKlines;

      if (hasInsufficientData) {
        logger.info({ symbol: input.symbol, interval: input.interval, existingCount: existingCount.length, minRequired: minRequiredKlines }, 'Insufficient data, fetching from Binance API');

        const endTime = input.endTime || now;
        const startTime = input.startTime || calculateStartTime(input.interval as Interval, input.limit);

        const apiKlines = await fetchHistoricalKlinesFromAPI(
          input.symbol,
          input.interval as Interval,
          startTime,
          endTime
        );

        if (apiKlines.length > 0) {
          logger.info({ count: apiKlines.length, firstOpenTime: apiKlines[0].openTime }, 'Fetched klines from API, inserting into database');

          for (const k of apiKlines) {
            await db.insert(klines).values({
              symbol: input.symbol,
              interval: input.interval as Interval,
              openTime: new Date(k.openTime),
              open: k.open,
              high: k.high,
              low: k.low,
              close: k.close,
              volume: k.volume,
              closeTime: new Date(k.closeTime),
              quoteVolume: k.quoteVolume,
              trades: k.trades,
              takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
              takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
            }).onConflictDoNothing();
          }
        }
      }

      const updatedLatestKline = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
        orderBy: [desc(klines.openTime)],
      });

      if (updatedLatestKline) {
        const staleCutoff = new Date(now.getTime() - intervalMs * 2);
        const latestOpenTime = new Date(updatedLatestKline.openTime);

        if (latestOpenTime < staleCutoff) {
        logger.info({
          symbol: input.symbol,
          interval: input.interval,
          latestInDb: latestOpenTime.toISOString(),
          staleCutoff: staleCutoff.toISOString(),
        }, 'Database data is stale, fetching recent klines');

        const recentKlines = await fetchHistoricalKlinesFromAPI(
          input.symbol,
          input.interval as Interval,
          latestOpenTime,
          now
        );

        if (recentKlines.length > 0) {
          const klinesToUpsert = recentKlines.filter((k: any) =>
            k.openTime >= latestOpenTime.getTime()
          );

          if (klinesToUpsert.length > 0) {
            logger.info({ count: klinesToUpsert.length }, 'Upserting klines with latest data');

            for (const k of klinesToUpsert) {
              await db.insert(klines).values({
                symbol: input.symbol,
                interval: input.interval as Interval,
                openTime: new Date(k.openTime),
                open: k.open,
                high: k.high,
                low: k.low,
                close: k.close,
                volume: k.volume,
                closeTime: new Date(k.closeTime),
                quoteVolume: k.quoteVolume,
                trades: k.trades,
                takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
                takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
              }).onConflictDoUpdate({
                target: [klines.symbol, klines.interval, klines.openTime],
                set: {
                  open: k.open,
                  high: k.high,
                  low: k.low,
                  close: k.close,
                  volume: k.volume,
                  closeTime: new Date(k.closeTime),
                  quoteVolume: k.quoteVolume,
                  trades: k.trades,
                  takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
                  takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
                },
              });
            }
          }
        }
        }
      }

      let result = await db.query.klines.findMany({
        where: and(...conditions),
        orderBy: [desc(klines.openTime)],
        limit: input.limit,
      });

      result.sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());

      if (result.length > 1) {
        const intervalMs = getIntervalMs(input.interval);
        const gaps: Array<{ start: Date; end: Date }> = [];

        for (let i = 1; i < result.length; i++) {
          const prevTime = new Date(result[i - 1].openTime).getTime();
          const currTime = new Date(result[i].openTime).getTime();
          const expectedNext = prevTime + intervalMs;
          
          if (currTime - expectedNext > intervalMs) {
            gaps.push({
              start: new Date(expectedNext),
              end: new Date(currTime - intervalMs),
            });
          }
        }

        if (gaps.length > 0) {
          logger.info({ symbol: input.symbol, interval: input.interval, gapsCount: gaps.length }, '🔍 Detected gaps in klines, fetching missing data');

          for (const gap of gaps) {
            const gapKlines = await fetchHistoricalKlinesFromAPI(
              input.symbol,
              input.interval as Interval,
              gap.start,
              gap.end
            );

            if (gapKlines.length > 0) {
              for (const k of gapKlines) {
                await db.insert(klines).values({
                  symbol: input.symbol,
                  interval: input.interval as Interval,
                  openTime: new Date(k.openTime),
                  open: k.open,
                  high: k.high,
                  low: k.low,
                  close: k.close,
                  volume: k.volume,
                  closeTime: new Date(k.closeTime),
                  quoteVolume: k.quoteVolume,
                  trades: k.trades,
                  takerBuyBaseVolume: k.takerBuyBaseVolume || '0',
                  takerBuyQuoteVolume: k.takerBuyQuoteVolume || '0',
                }).onConflictDoNothing();
              }
            }
          }

          result = await db.query.klines.findMany({
            where: and(...conditions),
            orderBy: [desc(klines.openTime)],
            limit: input.limit,
          });
          result.sort((a, b) => new Date(a.openTime).getTime() - new Date(b.openTime).getTime());
        }
      }

      binanceKlineStreamService.subscribe(input.symbol, input.interval as Interval);
      logger.info({ symbol: input.symbol, interval: input.interval }, '📊 Auto-subscribed to kline stream after list query');

      return result;
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
      const latestKlineResult = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval)
        ),
        orderBy: [desc(klines.openTime)],
      });
      
      const latestKline = latestKlineResult?.openTime || null;
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
