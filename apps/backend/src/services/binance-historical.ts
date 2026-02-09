import type { Interval } from '@marketmind/types';
import { BINANCE_NATIVE_INTERVALS, INTERVAL_MS } from '@marketmind/types';
import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { ABSOLUTE_MINIMUM_KLINES, AUTO_TRADING_API, AUTO_TRADING_BATCH } from '../constants';
import { db } from '../db';
import { klines } from '../db/schema';
import { withRetryFetch } from '../utils/retry';
import { logger, serializeError } from './logger';

const BATCH_SIZE = AUTO_TRADING_BATCH.KLINE_FETCH_BATCH_SIZE;
const RATE_LIMIT_DELAY = AUTO_TRADING_API.RATE_LIMIT_DELAY_MS;
const GAP_TOLERANCE_MULTIPLIER = AUTO_TRADING_API.GAP_TOLERANCE_MULTIPLIER;

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

  logger.trace(
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
      const response = await withRetryFetch(url);

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

      logger.trace({ inserted: klinesData.length, total: totalInserted }, 'Inserted klines batch');

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error({ error: serializeError(error), marketType }, 'Error fetching historical klines');
      throw error;
    }
  }

  logger.trace({ symbol, interval, marketType, totalInserted }, 'Historical klines backfill complete');
  return totalInserted;
};

export const getIntervalMilliseconds = (interval: Interval): number => INTERVAL_MS[interval] || 60000;

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
  logger.trace(
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
      const response = await withRetryFetch(url);

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
      logger.error({ error: serializeError(error) }, 'Error fetching historical klines from API');
      throw error;
    }
  }

  logger.trace({ symbol, interval, totalFetched: allKlines.length }, 'Historical klines fetch complete');
  return allKlines;
};

export const fetchFuturesKlinesFromAPI = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date()
): Promise<any[]> => {
  logger.trace(
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
      const response = await withRetryFetch(url);

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
      logger.error({ error: serializeError(error) }, 'Error fetching futures klines from API');
      throw error;
    }
  }

  logger.trace({ symbol, interval, totalFetched: allKlines.length }, 'Futures klines fetch complete');
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
  marketType: 'SPOT' | 'FUTURES' = 'SPOT',
  forRotation: boolean = false
): Promise<SmartBackfillResult> => {
  const intervalMs = getIntervalMilliseconds(interval);
  const now = Date.now();

  const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
  const effectiveEndTime = forRotation ? currentCandleOpenTime - 1 : now;

  const BINANCE_SPOT_START = new Date('2017-08-17').getTime();
  const BINANCE_FUTURES_START = new Date('2019-09-08').getTime();
  const minStartTime = marketType === 'FUTURES' ? BINANCE_FUTURES_START : BINANCE_SPOT_START;

  const calculatedStartTime = effectiveEndTime - intervalMs * targetCount;
  const targetStartTime = Math.max(calculatedStartTime, minStartTime);

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

  const gaps: Array<{ start: number; end: number; type: 'start' | 'end' | 'internal' }> = [];
  let totalDownloaded = 0;

  if (existingKlines.length === 0) {
    logger.info({ symbol, interval, marketType, targetCount, forRotation }, '> [SmartBackfill] No existing data, downloading full range');
    const downloaded = await backfillHistoricalKlines(
      symbol,
      interval,
      new Date(targetStartTime),
      new Date(effectiveEndTime),
      marketType
    );
    const isComplete = downloaded === 0;
    return { totalInDb: downloaded, downloaded, gaps: isComplete ? 0 : 1, alreadyComplete: isComplete };
  }

  const oldestExisting = existingKlines[0]?.openTime?.getTime() ?? now;
  const newestExisting = existingKlines[existingKlines.length - 1]?.openTime?.getTime() ?? now;

  if (oldestExisting > targetStartTime + intervalMs * GAP_TOLERANCE_MULTIPLIER) {
    gaps.push({ start: targetStartTime, end: oldestExisting - intervalMs, type: 'start' });
    logger.trace(
      { symbol, interval, marketType, gapStart: new Date(targetStartTime).toISOString(), gapEnd: new Date(oldestExisting).toISOString() },
      'Smart backfill: detected gap at start (need older data)'
    );
  }

  if (newestExisting < effectiveEndTime - intervalMs * GAP_TOLERANCE_MULTIPLIER) {
    gaps.push({ start: newestExisting + intervalMs, end: effectiveEndTime, type: 'end' });
    logger.trace(
      { symbol, interval, marketType, gapStart: new Date(newestExisting).toISOString(), gapEnd: new Date(effectiveEndTime).toISOString() },
      'Smart backfill: detected gap at end (need recent data)'
    );
  }

  for (let i = 1; i < existingKlines.length; i++) {
    const prevTime = existingKlines[i - 1]?.openTime?.getTime() ?? 0;
    const currTime = existingKlines[i]?.openTime?.getTime() ?? 0;
    const expectedDiff = intervalMs;
    const actualDiff = currTime - prevTime;

    if (actualDiff > expectedDiff * GAP_TOLERANCE_MULTIPLIER) {
      gaps.push({ start: prevTime + intervalMs, end: currTime - intervalMs, type: 'internal' });
      logger.trace(
        { symbol, interval, marketType, gapStart: new Date(prevTime).toISOString(), gapEnd: new Date(currTime).toISOString(), missingCandles: Math.floor(actualDiff / intervalMs) - 1 },
        'Smart backfill: detected internal gap'
      );
    }
  }

  if (gaps.length === 0) {
    logger.trace({ symbol, interval, marketType, currentCount }, '[SmartBackfill] Data complete');
    return { totalInDb: currentCount, downloaded: 0, gaps: 0, alreadyComplete: true };
  }

  logger.trace({ symbol, interval, marketType, gapsCount: gaps.length }, '[SmartBackfill] Filling gaps');

  const gapsFilled: Set<number> = new Set();

  for (let i = 0; i < gaps.length; i++) {
    const gap = gaps[i];
    if (!gap) continue;

    const downloaded = await backfillHistoricalKlines(
      symbol,
      interval,
      new Date(gap.start),
      new Date(gap.end),
      marketType
    );
    totalDownloaded += downloaded;

    if (downloaded > 0 || gap.type === 'start') {
      gapsFilled.add(i);
    }

    if (gap.type === 'start' && downloaded === 0) {
      logger.trace(
        { symbol, interval, marketType, gapStart: new Date(gap.start).toISOString() },
        'Smart backfill: no older data available (reached listing date)'
      );
    }
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

  const hasSufficientData = finalCount.length >= ABSOLUTE_MINIMUM_KLINES;
  const criticalGaps = gaps.filter((g, i) => !gapsFilled.has(i) && g.type !== 'start');
  const isOperationallyComplete = hasSufficientData || criticalGaps.length === 0;
  const reportedGaps = isOperationallyComplete ? 0 : criticalGaps.length;

  logger.trace(
    { symbol, interval, marketType, finalCount: finalCount.length, downloaded: totalDownloaded, gaps: reportedGaps },
    '[SmartBackfill] Complete'
  );

  return { totalInDb: finalCount.length, downloaded: totalDownloaded, gaps: reportedGaps, alreadyComplete: isOperationallyComplete };
};

export interface AggregatedKline {
  symbol: string;
  interval: '1y';
  marketType: 'SPOT' | 'FUTURES';
  openTime: Date;
  closeTime: Date;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

export const aggregateYearlyKline = async (
  symbol: string,
  year: number,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT'
): Promise<AggregatedKline | null> => {
  const startTime = new Date(year, 0, 1);
  const endTime = new Date(year + 1, 0, 1);

  const monthlyKlines = await db
    .select()
    .from(klines)
    .where(
      and(
        eq(klines.symbol, symbol),
        eq(klines.interval, '1M'),
        eq(klines.marketType, marketType),
        gte(klines.openTime, startTime),
        lt(klines.openTime, endTime)
      )
    )
    .orderBy(asc(klines.openTime));

  if (monthlyKlines.length === 0) {
    logger.warn({ symbol, year, marketType }, 'No monthly klines found for yearly aggregation');
    return null;
  }

  const firstKline = monthlyKlines[0];
  const lastKline = monthlyKlines[monthlyKlines.length - 1];

  if (!firstKline || !lastKline) return null;

  const high = Math.max(...monthlyKlines.map((k) => parseFloat(k.high)));
  const low = Math.min(...monthlyKlines.map((k) => parseFloat(k.low)));
  const volume = monthlyKlines.reduce((sum, k) => sum + parseFloat(k.volume), 0);
  const quoteVolume = monthlyKlines.reduce((sum, k) => sum + parseFloat(k.quoteVolume ?? '0'), 0);
  const trades = monthlyKlines.reduce((sum, k) => sum + (k.trades ?? 0), 0);
  const takerBuyBaseVolume = monthlyKlines.reduce((sum, k) => sum + parseFloat(k.takerBuyBaseVolume ?? '0'), 0);
  const takerBuyQuoteVolume = monthlyKlines.reduce((sum, k) => sum + parseFloat(k.takerBuyQuoteVolume ?? '0'), 0);

  return {
    symbol,
    interval: '1y',
    marketType,
    openTime: firstKline.openTime,
    closeTime: lastKline.closeTime,
    open: firstKline.open,
    high: high.toString(),
    low: low.toString(),
    close: lastKline.close,
    volume: volume.toString(),
    quoteVolume: quoteVolume.toString(),
    trades,
    takerBuyBaseVolume: takerBuyBaseVolume.toString(),
    takerBuyQuoteVolume: takerBuyQuoteVolume.toString(),
  };
};

export const aggregateYearlyKlines = async (
  symbol: string,
  marketType: 'SPOT' | 'FUTURES' = 'SPOT',
  limit: number = 10
): Promise<AggregatedKline[]> => {
  const currentYear = new Date().getFullYear();
  const startYear = marketType === 'FUTURES' ? 2019 : 2017;

  const years: number[] = [];
  for (let year = currentYear; year >= startYear && years.length < limit; year--) {
    years.push(year);
  }

  const aggregatedKlines: AggregatedKline[] = [];

  for (const year of years) {
    const kline = await aggregateYearlyKline(symbol, year, marketType);
    if (kline) aggregatedKlines.push(kline);
  }

  return aggregatedKlines.reverse();
};

export const isNativeBinanceInterval = (interval: Interval): boolean =>
  BINANCE_NATIVE_INTERVALS.includes(interval);
