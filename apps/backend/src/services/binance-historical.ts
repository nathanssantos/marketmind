import type { Interval } from '@marketmind/types';
import BinanceModule from 'binance-api-node';
import { db } from '../db';
import { klines } from '../db/schema';
import { logger } from './logger';

const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY = 200;

const Binance = (BinanceModule as any).default;
const binanceClient = Binance();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const backfillHistoricalKlines = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date()
): Promise<number> => {
  logger.info(
    { symbol, interval, startTime: startTime.toISOString(), endTime: endTime.toISOString() },
    'Starting historical klines backfill'
  );

  let totalInserted = 0;
  let currentStartTime = startTime.getTime();
  const finalEndTime = endTime.getTime();

  while (currentStartTime < finalEndTime) {
    try {
      const candles = await binanceClient.candles({
        symbol,
        interval,
        startTime: currentStartTime,
        limit: BATCH_SIZE,
      });

      if (candles.length === 0) break;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) break;

      const klinesData = candles.map((candle: any) => ({
        symbol,
        interval,
        openTime: new Date(candle.openTime),
        open: candle.open,
        high: candle.high,
        low: candle.low,
        close: candle.close,
        volume: candle.volume,
        closeTime: new Date(candle.closeTime),
        quoteVolume: candle.quoteVolume,
        trades: candle.trades,
        takerBuyBaseVolume: '0',
        takerBuyQuoteVolume: '0',
      }));

      await db.insert(klines).values(klinesData).onConflictDoNothing();

      totalInserted += klinesData.length;
      currentStartTime = lastCandle.closeTime + 1;

      logger.debug({ inserted: klinesData.length, total: totalInserted }, 'Inserted klines batch');

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      logger.error({ error }, 'Error fetching historical klines');
      throw error;
    }
  }

  logger.info({ symbol, interval, totalInserted }, 'Historical klines backfill complete');
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
