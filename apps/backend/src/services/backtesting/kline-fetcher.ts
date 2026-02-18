import type { Interval, Kline } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { ABSOLUTE_MINIMUM_KLINES, TIME_MS, UNIT_MS } from '../../constants';
import { db } from '../../db';
import { klines as klinesTable } from '../../db/schema';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { smartBackfillKlines } from '../binance-historical';
import { smartBackfillIBKlines } from '../ib-historical';

export const getIntervalMs = (interval: string): number => {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * TIME_MS.HOUR;
  const unitMs = UNIT_MS[match[2]];
  if (!unitMs) return 4 * TIME_MS.HOUR;
  return parseInt(match[1]) * unitMs;
};

export const fetchKlinesFromDbWithBackfill = async (
  symbol: string,
  interval: Interval,
  marketType: 'SPOT' | 'FUTURES',
  startTime: Date,
  endTime: Date,
  exchange?: 'BINANCE' | 'INTERACTIVE_BROKERS',
): Promise<Kline[]> => {
  const intervalMs = getIntervalMs(interval);
  const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / intervalMs);
  const minRequired = ABSOLUTE_MINIMUM_KLINES;
  const effectiveMarketType = exchange === 'INTERACTIVE_BROKERS' ? 'SPOT' as const : marketType;

  const queryWhere = and(
    eq(klinesTable.symbol, symbol),
    eq(klinesTable.interval, interval),
    eq(klinesTable.marketType, effectiveMarketType),
    gte(klinesTable.openTime, startTime),
    lte(klinesTable.openTime, endTime),
  );

  let dbKlines = await db.query.klines.findMany({
    where: queryWhere,
    orderBy: [desc(klinesTable.openTime)],
  });

  if (dbKlines.length < minRequired) {
    const isIB = exchange === 'INTERACTIVE_BROKERS';
    const backfillResult = isIB
      ? await smartBackfillIBKlines(symbol, interval, expectedKlines, effectiveMarketType)
      : await smartBackfillKlines(symbol, interval, expectedKlines, marketType);
    console.log(`[KlineFetcher] Backfill complete (${isIB ? 'IB' : 'Binance'}): downloaded ${backfillResult.downloaded}, total in DB: ${backfillResult.totalInDb}`);

    dbKlines = await db.query.klines.findMany({
      where: queryWhere,
      orderBy: [desc(klinesTable.openTime)],
    });
  }

  return mapDbKlinesReversed(dbKlines);
};
