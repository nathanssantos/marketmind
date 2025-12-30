import type { Interval, MarketType } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { z } from 'zod';
import { REQUIRED_KLINES } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { backfillHistoricalKlines, calculateStartTime, fetchFuturesKlinesFromAPI, fetchHistoricalKlinesFromAPI } from '../services/binance-historical';
import { binanceFuturesKlineStreamService, binanceKlineStreamService } from '../services/binance-kline-stream';
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

const marketTypeSchema = z.enum(['SPOT', 'FUTURES']).default('SPOT');

const getKlinesForMarketType = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date,
  marketType: MarketType
): Promise<any[]> => {
  if (marketType === 'FUTURES') {
    return fetchFuturesKlinesFromAPI(symbol, interval, startTime, endTime);
  }
  return fetchHistoricalKlinesFromAPI(symbol, interval, startTime, endTime);
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
        limit: z.number().min(1).max(REQUIRED_KLINES).default(REQUIRED_KLINES),
      })
    )
    .query(async ({ input }) => {
      const marketType = input.marketType as MarketType;

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

      const latestKlineResult = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
        ),
        orderBy: [desc(klines.openTime)],
      });

      const now = new Date();
      const intervalMs = getIntervalMs(input.interval);

      const existingCount = await db.query.klines.findMany({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
        ),
      });

      const minRequiredKlines = Math.floor(input.limit * 0.5);
      const hasInsufficientData = !latestKlineResult || existingCount.length < minRequiredKlines;

      if (hasInsufficientData) {
        logger.info({ symbol: input.symbol, interval: input.interval, marketType, existingCount: existingCount.length, minRequired: minRequiredKlines }, 'Insufficient data, fetching from Binance API');

        const endTime = input.endTime || now;
        const startTime = input.startTime || calculateStartTime(input.interval as Interval, input.limit);

        const apiKlines = await getKlinesForMarketType(
          input.symbol,
          input.interval as Interval,
          startTime,
          endTime,
          marketType
        );

        if (apiKlines.length > 0) {
          logger.info({ count: apiKlines.length, firstOpenTime: apiKlines[0].openTime, marketType }, 'Fetched klines from API, inserting into database');

          for (const k of apiKlines) {
            await db.insert(klines).values({
              symbol: input.symbol,
              interval: input.interval as Interval,
              marketType,
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
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
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
          marketType,
          latestInDb: latestOpenTime.toISOString(),
          staleCutoff: staleCutoff.toISOString(),
        }, 'Database data is stale, fetching recent klines');

        const recentKlines = await getKlinesForMarketType(
          input.symbol,
          input.interval as Interval,
          latestOpenTime,
          now,
          marketType
        );

        if (recentKlines.length > 0) {
          const klinesToUpsert = recentKlines.filter((k: any) =>
            k.openTime >= latestOpenTime.getTime()
          );

          if (klinesToUpsert.length > 0) {
            logger.info({ count: klinesToUpsert.length, marketType }, 'Upserting klines with latest data');

            for (const k of klinesToUpsert) {
              await db.insert(klines).values({
                symbol: input.symbol,
                interval: input.interval as Interval,
                marketType,
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
                target: [klines.symbol, klines.interval, klines.marketType, klines.openTime],
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
          const prevKline = result[i - 1];
          const currKline = result[i];
          if (!prevKline || !currKline) continue;

          const prevTime = new Date(prevKline.openTime).getTime();
          const currTime = new Date(currKline.openTime).getTime();
          const expectedNext = prevTime + intervalMs;

          if (currTime - expectedNext > intervalMs) {
            gaps.push({
              start: new Date(expectedNext),
              end: new Date(currTime - intervalMs),
            });
          }
        }

        if (gaps.length > 0) {
          logger.info({ symbol: input.symbol, interval: input.interval, marketType, gapsCount: gaps.length }, '🔍 Detected gaps in klines, fetching missing data');

          for (const gap of gaps) {
            const gapKlines = await getKlinesForMarketType(
              input.symbol,
              input.interval as Interval,
              gap.start,
              gap.end,
              marketType
            );

            if (gapKlines.length > 0) {
              for (const k of gapKlines) {
                await db.insert(klines).values({
                  symbol: input.symbol,
                  interval: input.interval as Interval,
                  marketType,
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

      const latestKlineResult = await db.query.klines.findFirst({
        where: and(
          eq(klines.symbol, input.symbol),
          eq(klines.interval, input.interval as Interval),
          eq(klines.marketType, marketType)
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
        endTime,
        marketType
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
      const intervalMs = getIntervalMs(input.interval);

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
});
