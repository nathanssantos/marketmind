import Binance from 'binance-api-node';
import { db } from '../db';
import { klines } from '../db/schema';
import type { Interval } from '@marketmind/types';

const BATCH_SIZE = 1000;
const RATE_LIMIT_DELAY = 200;

interface HistoricalKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}

const binanceClient = Binance();

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export const backfillHistoricalKlines = async (
  symbol: string,
  interval: Interval,
  startTime: Date,
  endTime: Date = new Date()
): Promise<number> => {
  console.log(`Starting backfill for ${symbol}@${interval} from ${startTime.toISOString()} to ${endTime.toISOString()}`);

  let totalInserted = 0;
  let currentStartTime = startTime.getTime();
  const finalEndTime = endTime.getTime();

  while (currentStartTime < finalEndTime) {
    try {
      const candles = (await binanceClient.candles({
        symbol,
        interval,
        startTime: currentStartTime,
        limit: BATCH_SIZE,
      })) as HistoricalKline[];

      if (candles.length === 0) break;

      const lastCandle = candles[candles.length - 1];
      if (!lastCandle) break;

      const klinesData = candles.map((candle) => ({
        symbol,
        interval,
        openTime: new Date(candle.openTime),
        open: parseFloat(candle.open),
        high: parseFloat(candle.high),
        low: parseFloat(candle.low),
        close: parseFloat(candle.close),
        volume: parseFloat(candle.volume),
        closeTime: new Date(candle.closeTime),
        quoteVolume: parseFloat(candle.quoteVolume),
        trades: candle.trades,
        takerBuyBaseVolume: parseFloat(candle.takerBuyBaseVolume),
        takerBuyQuoteVolume: parseFloat(candle.takerBuyQuoteVolume),
      }));

      await db.insert(klines).values(klinesData).onConflictDoNothing();

      totalInserted += klinesData.length;
      currentStartTime = lastCandle.closeTime + 1;

      console.log(`Inserted ${klinesData.length} klines (total: ${totalInserted})`);

      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Error fetching historical klines:`, error);
      throw error;
    }
  }

  console.log(`Backfill complete: ${totalInserted} klines inserted for ${symbol}@${interval}`);
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
