import type { Interval } from '@marketmind/types';
import { and, asc, desc, eq, gte } from 'drizzle-orm';
import { db } from '../db';
import { klines } from '../db/schema';
import { logger } from './logger';

const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY = 200;
const GAP_TOLERANCE_MULTIPLIER = 1.5;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const backfillHistoricalKlines = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date(),
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<number> => {
  const BINANCE_SPOT_START = new Date('2017-08-17').getTime();
  const BINANCE_FUTURES_START = new Date('2019-09-08').getTime();
  const minStartTime = marketType === 'FUTURES' ? BINANCE_FUTURES_START : BINANCE_SPOT_START;

  const effectiveStartTime = new Date(Math.max(startTime.getTime(), minStartTime));

  logger.info(
    { symbol, interval, marketType, startTime: effectiveStartTime.toISOString(), endTime: endTime.toISOString() },
    'Starting historical klines backfill'
  );

  const intervalMs = getIntervalMilliseconds(interval);
  let totalInserted = 0;
  let currentStartTime = effectiveStartTime.getTime();
  const finalEndTime = endTime.getTime();

  const baseUrl = marketType === 'FUTURES'
    ? 'https://fapi.binance.com/fapi/v1/klines'
    : 'https://api.binance.com/api/v3/klines';

  while (currentStartTime < finalEndTime) {
    try {
      const url = `${baseUrl}?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${BATCH_SIZE}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance ${marketType} API error: ${response.status} ${response.statusText}`);
      }

      const candles = await response.json();

      if (candles.length === 0) break;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) break;

      const klinesData = candles.map((candle: any) => ({
        symbol,
        interval,
        marketType,
        openTime: new Date(candle[0]),
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: new Date(candle[6]),
        quoteVolume: candle[7],
        trades: candle[8],
        takerBuyBaseVolume: candle[9] || '0',
        takerBuyQuoteVolume: candle[10] || '0',
      }));

      await db.insert(klines).values(klinesData).onConflictDoNothing();

      totalInserted += klinesData.length;
      currentStartTime = lastCandle[0] + intervalMs;

      logger.debug({ inserted: klinesData.length, total: totalInserted }, 'Inserted klines batch');

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error({ error, marketType }, 'Error fetching historical klines');
      throw error;
    }
  }

  logger.info({ symbol, interval, marketType, totalInserted }, 'Historical klines backfill complete');
  return totalInserted;
};

export const getIntervalMilliseconds = (interval: Interval): number => {
  const map: Record<Interval, number> = {
    '1s': 1000,
    '1m': 60000,
    '3m': 180000,
    '5m': 300000,
    '15m': 900000,
    '30m': 1800000,
    '1h': 3600000,
    '2h': 7200000,
    '4h': 14400000,
    '6h': 21600000,
    '8h': 28800000,
    '12h': 43200000,
    '1d': 86400000,
    '3d': 259200000,
    '1w': 604800000,
    '1M': 2592000000,
  };

  return map[interval] || 60000;
};

export const calculateStartTime = (interval: Interval, periodsBack: number): Date => {
  const now = Date.now();
  const intervalMs = getIntervalMilliseconds(interval);
  return new Date(now - intervalMs * periodsBack);
};

export const fetchHistoricalKlinesFromAPI = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date()
): Promise<any[]> => {
  logger.info(
    { symbol, interval, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
    'Fetching historical klines from Binance API'
  );

  const intervalMs = getIntervalMilliseconds(interval);
  const allKlines: any[] = [];
  let currentStartTime = startTime.getTime();
  const finalEndTime = endTime.getTime();

  while (currentStartTime < finalEndTime) {
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${BATCH_SIZE}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status} ${response.statusText}`);
      }

      const candles = await response.json();

      if (candles.length === 0) break;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) break;

      const klinesData = candles.map((candle: any) => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6],
        quoteVolume: candle[7],
        trades: candle[8],
        takerBuyBaseVolume: candle[9],
        takerBuyQuoteVolume: candle[10],
      }));

      allKlines.push(...klinesData);
      currentStartTime = lastCandle[0] + intervalMs;

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error({ error }, 'Error fetching historical klines from API');
      throw error;
    }
  }

  logger.info({ symbol, interval, totalFetched: allKlines.length }, 'Historical klines fetch complete');
  return allKlines;
};

export const fetchFuturesKlinesFromAPI = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date()
): Promise<any[]> => {
  logger.info(
    { symbol, interval, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
    'Fetching futures klines from Binance Futures API'
  );

  const intervalMs = getIntervalMilliseconds(interval);
  const allKlines: any[] = [];
  let currentStartTime = startTime.getTime();
  const finalEndTime = endTime.getTime();

  while (currentStartTime < finalEndTime) {
    try {
      const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&startTime=${currentStartTime}&limit=${BATCH_SIZE}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Binance Futures API error: ${response.status} ${response.statusText}`);
      }

      const candles = await response.json();

      if (candles.length === 0) break;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) break;

      const klinesData = candles.map((candle: any) => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6],
        quoteVolume: candle[7],
        trades: candle[8],
        takerBuyBaseVolume: candle[9],
        takerBuyQuoteVolume: candle[10],
      }));

      allKlines.push(...klinesData);
      currentStartTime = lastCandle[0] + intervalMs;

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error({ error }, 'Error fetching futures klines from API');
      throw error;
    }
  }

  logger.info({ symbol, interval, totalFetched: allKlines.length }, 'Futures klines fetch complete');
  return allKlines;
};

export interface SmartBackfillResult {
  totalInDb: number;
  downloaded: number;
  gaps: number;
  alreadyComplete: boolean;
}

export const smartBackfillKlines = async (
  symbol: string,
  interval: Interval,
  targetCount: number,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<SmartBackfillResult> => {
  const intervalMs = getIntervalMilliseconds(interval);
  const now = Date.now();

  const BINANCE_SPOT_START = new Date('2017-08-17').getTime();
  const BINANCE_FUTURES_START = new Date('2019-09-08').getTime();
  const minStartTime = marketType === 'FUTURES' ? BINANCE_FUTURES_START : BINANCE_SPOT_START;

  const calculatedStartTime = now - intervalMs * targetCount;
  const targetStartTime = Math.max(calculatedStartTime, minStartTime);

  logger.info(
    { symbol, interval, marketType, targetCount, targetStartTime: new Date(targetStartTime).toISOString() },
    'Smart backfill: analyzing existing data'
  );

  const existingKlines = await db
    .select({ openTime: klines.openTime })
    .from(klines)
    .where(
      and(
        eq(klines.symbol, symbol),
        eq(klines.interval, interval),
        eq(klines.marketType, marketType),
        gte(klines.openTime, new Date(targetStartTime))
      )
    )
    .orderBy(asc(klines.openTime));

  const currentCount = existingKlines.length;

  logger.info(
    { symbol, interval, marketType, currentCount, targetCount },
    'Smart backfill: current vs target'
  );

  if (currentCount >= targetCount * 0.95) {
    const newestKline = await db
      .select({ openTime: klines.openTime })
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

    const newestTime = newestKline[0]?.openTime?.getTime() ?? 0;
    const timeSinceNewest = now - newestTime;

    if (timeSinceNewest <= intervalMs * 2) {
      logger.info({ symbol, interval, marketType }, 'Smart backfill: data is complete and up-to-date');
      return { totalInDb: currentCount, downloaded: 0, gaps: 0, alreadyComplete: true };
    }

    const recentDownloaded = await backfillHistoricalKlines(
      symbol,
      interval,
      new Date(newestTime),
      new Date(),
      marketType
    );

    return { totalInDb: currentCount + recentDownloaded, downloaded: recentDownloaded, gaps: 0, alreadyComplete: false };
  }

  const gaps: Array<{ start: number; end: number }> = [];
  let totalDownloaded = 0;

  if (existingKlines.length === 0) {
    logger.info({ symbol, interval, marketType }, 'Smart backfill: no existing data, downloading full range');
    const downloaded = await backfillHistoricalKlines(
      symbol,
      interval,
      new Date(targetStartTime),
      new Date(),
      marketType
    );
    return { totalInDb: downloaded, downloaded, gaps: 1, alreadyComplete: false };
  }

  const oldestExisting = existingKlines[0]?.openTime?.getTime() ?? now;
  const newestExisting = existingKlines[existingKlines.length - 1]?.openTime?.getTime() ?? now;

  if (oldestExisting > targetStartTime + intervalMs * GAP_TOLERANCE_MULTIPLIER) {
    gaps.push({ start: targetStartTime, end: oldestExisting - intervalMs });
    logger.info(
      { symbol, interval, marketType, gapStart: new Date(targetStartTime).toISOString(), gapEnd: new Date(oldestExisting).toISOString() },
      'Smart backfill: detected gap at start (need older data)'
    );
  }

  if (newestExisting < now - intervalMs * GAP_TOLERANCE_MULTIPLIER) {
    gaps.push({ start: newestExisting + intervalMs, end: now });
    logger.info(
      { symbol, interval, marketType, gapStart: new Date(newestExisting).toISOString(), gapEnd: new Date(now).toISOString() },
      'Smart backfill: detected gap at end (need recent data)'
    );
  }

  if (existingKlines.length > 1) {
    for (let i = 1; i < existingKlines.length; i++) {
      const prevTime = existingKlines[i - 1]?.openTime?.getTime() ?? 0;
      const currTime = existingKlines[i]?.openTime?.getTime() ?? 0;
      const expectedDiff = intervalMs;
      const actualDiff = currTime - prevTime;

      if (actualDiff > expectedDiff * GAP_TOLERANCE_MULTIPLIER) {
        gaps.push({ start: prevTime + intervalMs, end: currTime - intervalMs });
        logger.info(
          { symbol, interval, marketType, gapStart: new Date(prevTime).toISOString(), gapEnd: new Date(currTime).toISOString(), missingCandles: Math.floor(actualDiff / intervalMs) - 1 },
          'Smart backfill: detected internal gap'
        );
      }
    }
  }

  if (gaps.length === 0) {
    logger.info({ symbol, interval, marketType }, 'Smart backfill: no gaps detected');
    return { totalInDb: currentCount, downloaded: 0, gaps: 0, alreadyComplete: true };
  }

  logger.info({ symbol, interval, marketType, gapsCount: gaps.length }, 'Smart backfill: filling gaps');

  for (const gap of gaps) {
    const downloaded = await backfillHistoricalKlines(
      symbol,
      interval,
      new Date(gap.start),
      new Date(gap.end),
      marketType
    );
    totalDownloaded += downloaded;
  }

  const finalCount = await db
    .select({ openTime: klines.openTime })
    .from(klines)
    .where(
      and(
        eq(klines.symbol, symbol),
        eq(klines.interval, interval),
        eq(klines.marketType, marketType),
        gte(klines.openTime, new Date(targetStartTime))
      )
    );

  logger.info(
    { symbol, interval, marketType, finalCount: finalCount.length, downloaded: totalDownloaded, gaps: gaps.length },
    'Smart backfill: complete'
  );

  return { totalInDb: finalCount.length, downloaded: totalDownloaded, gaps: gaps.length, alreadyComplete: false };
};
