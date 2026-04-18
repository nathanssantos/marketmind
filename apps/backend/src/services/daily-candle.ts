import type { MarketType } from '@marketmind/types';
import { withRetryFetch } from '../utils/retry';
import { logger } from './logger';
import { serializeError } from '../utils/errors';

export interface DailyCandle {
  symbol: string;
  openTime: number;
  open: number;
  close: number;
}

interface CacheEntry {
  candle: DailyCandle;
  fetchedAt: number;
}

const BINANCE_SPOT_URL = 'https://api.binance.com/api/v3/klines';
const BINANCE_FUTURES_URL = 'https://fapi.binance.com/fapi/v1/klines';

const MS_PER_DAY = 86_400_000;
const FETCH_TTL_MS = 60_000;

const cacheSpot = new Map<string, CacheEntry>();
const cacheFutures = new Map<string, CacheEntry>();

const getCache = (marketType: MarketType): Map<string, CacheEntry> =>
  marketType === 'FUTURES' ? cacheFutures : cacheSpot;

const getBaseUrl = (marketType: MarketType): string =>
  marketType === 'FUTURES' ? BINANCE_FUTURES_URL : BINANCE_SPOT_URL;

const currentDailyOpenTime = (now: number = Date.now()): number =>
  Math.floor(now / MS_PER_DAY) * MS_PER_DAY;

const fetchDailyCandle = async (
  symbol: string,
  marketType: MarketType,
): Promise<DailyCandle | null> => {
  try {
    const url = `${getBaseUrl(marketType)}?symbol=${symbol}&interval=1d&limit=1`;
    const res = await withRetryFetch(url);
    if (!res.ok) {
      logger.warn({ symbol, marketType, status: res.status }, 'Failed to fetch daily candle');
      return null;
    }
    const data = (await res.json()) as Array<Array<string | number>>;
    const row = data[0];
    if (!row) return null;
    return {
      symbol,
      openTime: row[0] as number,
      open: parseFloat(row[1] as string),
      close: parseFloat(row[4] as string),
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, marketType }, 'Error fetching daily candle');
    return null;
  }
};

export const getDailyCandles = async (
  symbols: string[],
  marketType: MarketType,
): Promise<Map<string, DailyCandle>> => {
  const cache = getCache(marketType);
  const todayOpen = currentDailyOpenTime();
  const now = Date.now();
  const result = new Map<string, DailyCandle>();
  const toFetch: string[] = [];

  for (const symbol of symbols) {
    const cached = cache.get(symbol);
    if (
      cached &&
      cached.candle.openTime === todayOpen &&
      now - cached.fetchedAt < FETCH_TTL_MS
    ) {
      result.set(symbol, cached.candle);
    } else {
      toFetch.push(symbol);
    }
  }

  if (toFetch.length === 0) return result;

  const fetched = await Promise.all(toFetch.map((s) => fetchDailyCandle(s, marketType)));
  for (const candle of fetched) {
    if (!candle) continue;
    cache.set(candle.symbol, { candle, fetchedAt: now });
    result.set(candle.symbol, candle);
  }

  return result;
};

export const clearDailyCandleCache = (): void => {
  cacheSpot.clear();
  cacheFutures.clear();
};
