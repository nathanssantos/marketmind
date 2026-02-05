import type { Interval, Kline } from '@marketmind/types';
import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import { klines as klinesTable } from '../db/schema';
import { IBKlineStream } from '../exchange/interactive-brokers/kline-stream';
import type { IBConnectionManager } from '../exchange/interactive-brokers/connection-manager';
import { IB_OPTIMAL_DURATION } from '../exchange/interactive-brokers/constants';
import { logger } from './logger';
import type { SmartBackfillResult } from './binance-historical';

let sharedConnectionManager: IBConnectionManager | null = null;

export const setIBConnectionManager = (manager: IBConnectionManager): void => {
  sharedConnectionManager = manager;
};


const getIBDuration = (interval: string): string =>
  (IB_OPTIMAL_DURATION as Record<string, string>)[interval] ?? '1 M';

const getIntervalMs = (interval: string): number => {
  const intervals: Record<string, number> = {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '30m': 1_800_000,
    '1h': 3_600_000,
    '2h': 7_200_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
    '1w': 604_800_000,
  };
  return intervals[interval] ?? 3_600_000;
};

export const smartBackfillIBKlines = async (
  symbol: string,
  interval: Interval,
  targetCount: number,
  _marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<SmartBackfillResult> => {
  const intervalMs = getIntervalMs(interval);
  const now = Date.now();
  const targetStartTime = now - intervalMs * targetCount;

  const existingKlines = await db
    .select({ openTime: klinesTable.openTime })
    .from(klinesTable)
    .where(
      and(
        eq(klinesTable.symbol, symbol),
        eq(klinesTable.interval, interval),
        eq(klinesTable.marketType, 'SPOT'),
        gte(klinesTable.openTime, new Date(targetStartTime))
      )
    )
    .orderBy(asc(klinesTable.openTime));

  if (existingKlines.length >= targetCount * 0.8) {
    return {
      totalInDb: existingKlines.length,
      downloaded: 0,
      gaps: 0,
      alreadyComplete: true,
    };
  }

  let klineStream: IBKlineStream | null = null;
  let downloaded = 0;

  try {
    klineStream = new IBKlineStream(sharedConnectionManager ?? undefined);
    const duration = getIBDuration(interval);

    logger.info({ symbol, interval, duration }, '[IB Backfill] Fetching historical data from IB Gateway');

    const ibKlines = await klineStream.getHistoricalData(
      symbol,
      interval,
      duration,
      undefined,
      false
    );

    if (ibKlines.length > 0) {
      downloaded = await storeIBKlines(ibKlines, symbol, interval);
      logger.info({ symbol, interval, downloaded }, '[IB Backfill] Stored klines from IB Gateway');
    }

    const updatedRows = await db
      .select({ openTime: klinesTable.openTime })
      .from(klinesTable)
      .where(
        and(
          eq(klinesTable.symbol, symbol),
          eq(klinesTable.interval, interval),
          eq(klinesTable.marketType, 'SPOT'),
          gte(klinesTable.openTime, new Date(targetStartTime))
        )
      );
    const updatedCount = updatedRows.length;

    return {
      totalInDb: updatedCount,
      downloaded,
      gaps: 0,
      alreadyComplete: updatedCount >= targetCount * 0.8,
    };
  } catch (error) {
    logger.warn(
      { symbol, interval, error: error instanceof Error ? error.message : String(error) },
      '[IB Backfill] Failed to fetch from IB Gateway, using existing DB data only'
    );

    return {
      totalInDb: existingKlines.length,
      downloaded: 0,
      gaps: 0,
      alreadyComplete: existingKlines.length > 0,
    };
  }
};

const storeIBKlines = async (
  ibKlines: Kline[],
  symbol: string,
  interval: string
): Promise<number> => {
  if (ibKlines.length === 0) return 0;

  const values = ibKlines.map((k) => ({
    symbol,
    interval,
    marketType: 'SPOT' as const,
    openTime: new Date(k.openTime),
    closeTime: new Date(k.closeTime),
    open: String(k.open),
    high: String(k.high),
    low: String(k.low),
    close: String(k.close),
    volume: String(k.volume),
    quoteVolume: String(k.quoteVolume ?? '0'),
    trades: k.trades ?? 0,
    takerBuyBaseVolume: String(k.takerBuyBaseVolume ?? '0'),
    takerBuyQuoteVolume: String(k.takerBuyQuoteVolume ?? '0'),
  }));

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db
      .insert(klinesTable)
      .values(batch)
      .onConflictDoNothing();
    inserted += batch.length;
  }

  return inserted;
};
