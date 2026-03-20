import { and, asc, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../../db';
import { klines } from '../../db/schema';
import type { Interval, MarketType } from '@marketmind/types';
import { INTERVAL_MS } from '@marketmind/types';

export type KlineRecord = typeof klines.$inferSelect;

export interface KlineQueryParams {
  symbol: string;
  interval: Interval;
  marketType: MarketType;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface KlineGap {
  start: Date;
  end: Date;
  expectedCount: number;
}

export interface KlineRange {
  earliest: Date;
  latest: Date;
  count: number;
}

export const klineQueries = {
  async findMany(params: KlineQueryParams): Promise<KlineRecord[]> {
    const { symbol, interval, marketType, startTime, endTime, limit } = params;

    const conditions = [
      eq(klines.symbol, symbol),
      eq(klines.interval, interval),
      eq(klines.marketType, marketType),
    ];

    if (startTime) conditions.push(gte(klines.openTime, startTime));
    if (endTime) conditions.push(lte(klines.openTime, endTime));

    let query = db
      .select()
      .from(klines)
      .where(and(...conditions))
      .orderBy(asc(klines.openTime));

    if (limit) query = query.limit(limit) as typeof query;

    return query;
  },

  async findLatest(
    symbol: string,
    interval: Interval,
    marketType: MarketType
  ): Promise<KlineRecord | null> {
    const [result] = await db
      .select()
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType)
        )
      )
      .orderBy(desc(klines.openTime))
      .limit(1);

    return result ?? null;
  },

  async findEarliest(
    symbol: string,
    interval: Interval,
    marketType: MarketType
  ): Promise<KlineRecord | null> {
    const [result] = await db
      .select()
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType)
        )
      )
      .orderBy(asc(klines.openTime))
      .limit(1);

    return result ?? null;
  },

  async count(
    symbol: string,
    interval: Interval,
    marketType: MarketType
  ): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType)
        )
      );

    return result?.count ?? 0;
  },

  async getRange(
    symbol: string,
    interval: Interval,
    marketType: MarketType
  ): Promise<KlineRange | null> {
    const [result] = await db
      .select({
        earliest: sql<Date>`min(open_time)`,
        latest: sql<Date>`max(open_time)`,
        count: sql<number>`count(*)::int`,
      })
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType)
        )
      );

    if (!result || result.count === 0) return null;

    return {
      earliest: result.earliest,
      latest: result.latest,
      count: result.count,
    };
  },

  async findGaps(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    startTime: Date,
    endTime: Date
  ): Promise<KlineGap[]> {
    const intervalMs = INTERVAL_MS[interval];
    if (!intervalMs) return [];

    const existingKlines = await this.findMany({
      symbol,
      interval,
      marketType,
      startTime,
      endTime,
    });

    if (existingKlines.length === 0) {
      const expectedCount = Math.floor((endTime.getTime() - startTime.getTime()) / intervalMs);
      return [{ start: startTime, end: endTime, expectedCount }];
    }

    const gaps: KlineGap[] = [];
    const sortedKlines = existingKlines.sort(
      (a, b) => a.openTime.getTime() - b.openTime.getTime()
    );

    const firstKline = sortedKlines[0];
    if (firstKline && firstKline.openTime.getTime() > startTime.getTime() + intervalMs) {
      const gapEnd = new Date(firstKline.openTime.getTime() - intervalMs);
      const expectedCount = Math.floor((gapEnd.getTime() - startTime.getTime()) / intervalMs);
      if (expectedCount > 0) {
        gaps.push({ start: startTime, end: gapEnd, expectedCount });
      }
    }

    for (let i = 1; i < sortedKlines.length; i++) {
      const prevKline = sortedKlines[i - 1];
      const currKline = sortedKlines[i];
      if (!prevKline || !currKline) continue;
      const timeDiff = currKline.openTime.getTime() - prevKline.openTime.getTime();

      if (timeDiff > intervalMs * 1.5) {
        const gapStart = new Date(prevKline.openTime.getTime() + intervalMs);
        const gapEnd = new Date(currKline.openTime.getTime() - intervalMs);
        const expectedCount = Math.floor(timeDiff / intervalMs) - 1;
        if (expectedCount > 0) {
          gaps.push({ start: gapStart, end: gapEnd, expectedCount });
        }
      }
    }

    const lastKline = sortedKlines[sortedKlines.length - 1];
    if (lastKline && lastKline.openTime.getTime() < endTime.getTime() - intervalMs) {
      const gapStart = new Date(lastKline.openTime.getTime() + intervalMs);
      const expectedCount = Math.floor((endTime.getTime() - gapStart.getTime()) / intervalMs);
      if (expectedCount > 0) {
        gaps.push({ start: gapStart, end: endTime, expectedCount });
      }
    }

    return gaps;
  },

  async hasKlinesInRange(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    startTime: Date,
    endTime: Date
  ): Promise<boolean> {
    const [result] = await db
      .select({ exists: sql<boolean>`exists(
        select 1 from klines
        where symbol = ${symbol}
        and interval = ${interval}
        and market_type = ${marketType}
        and open_time >= ${startTime}
        and open_time <= ${endTime}
      )` })
      .from(sql`(select 1) as dummy`);

    return result?.exists ?? false;
  },

  async countInRange(
    symbol: string,
    interval: Interval,
    marketType: MarketType,
    startTime: Date,
    endTime: Date
  ): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(klines)
      .where(
        and(
          eq(klines.symbol, symbol),
          eq(klines.interval, interval),
          eq(klines.marketType, marketType),
          gte(klines.openTime, startTime),
          lte(klines.openTime, endTime)
        )
      );

    return result?.count ?? 0;
  },

  getIntervalMs(interval: Interval): number {
    return INTERVAL_MS[interval] ?? 60 * 1000;
  },
};

export const getKlineRange = klineQueries.getRange.bind(klineQueries);
export const findKlineGaps = klineQueries.findGaps.bind(klineQueries);
export const countKlines = klineQueries.count.bind(klineQueries);
