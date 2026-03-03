import type { Interval, Kline } from '@marketmind/types';
import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { ABSOLUTE_MINIMUM_KLINES, TIME_MS, UNIT_MS } from '../../constants';
import { db } from '../../db';
import { klines as klinesTable } from '../../db/schema';
import { mapDbKlinesReversed } from '../../utils/kline-mapper';
import { smartBackfillKlines } from '../binance-historical';
import { smartBackfillIBKlines } from '../ib-historical';
import { getKlineMaintenance } from '../kline-maintenance';
import { logger } from '../logger';

const hasLocalIntegrityIssues = (klines: Kline[], intervalMs: number): boolean => {
  const TOLERANCE_MS = 1000;
  for (let i = 1; i < klines.length; i++) {
    const diff = klines[i]!.openTime - klines[i - 1]!.openTime;
    if (Math.abs(diff - intervalMs) > TOLERANCE_MS) return true;
  }
  return false;
};

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
    logger.debug({ symbol, interval, exchange: isIB ? 'IB' : 'Binance', downloaded: backfillResult.downloaded, totalInDb: backfillResult.totalInDb }, '[KlineFetcher] Backfill complete');

    dbKlines = await db.query.klines.findMany({
      where: queryWhere,
      orderBy: [desc(klinesTable.openTime)],
    });
  }

  const result = mapDbKlinesReversed(dbKlines);
  if (result.length > 1 && hasLocalIntegrityIssues(result, intervalMs)) {
    await getKlineMaintenance().forceCheckSymbol(symbol, interval, effectiveMarketType);
    const fixed = await db.query.klines.findMany({ where: queryWhere, orderBy: [desc(klinesTable.openTime)] });
    return mapDbKlinesReversed(fixed);
  }
  return result;
};
