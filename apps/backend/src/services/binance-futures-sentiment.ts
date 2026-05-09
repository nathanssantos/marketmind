import type {
  FundingRateData,
  OpenInterestData,
  LiquidationData,
} from '../lib/indicators';
import { BinanceIpBannedError } from './binance-api-cache';
import { logger, serializeError } from './logger';
import type { DataCache } from './binance-futures-data-cache';

const FUTURES_BASE_URL = 'https://fapi.binance.com';

interface BinanceFundingRateResponse {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice: string;
}

interface BinanceLiquidationResponse {
  symbol: string;
  price: string;
  origQty: string;
  executedQty: string;
  averagePrice: string;
  status: string;
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  time: number;
}

interface BinanceOpenInterestHistResponse {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
}

interface BinanceOpenInterestResponse {
  symbol: string;
  openInterest: string;
  time: number;
}

export const getFundingRate = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string
): Promise<FundingRateData[]> => {
  const cacheKey = `funding:${symbol}`;
  const cached = cache.getFromCache<FundingRateData[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/fapi/v1/fundingRate?symbol=${symbol}&limit=100`
    );

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch funding rate');
      return [];
    }

    const data: BinanceFundingRateResponse[] = await response.json();

    const result: FundingRateData[] = data.map((item) => ({
      timestamp: item.fundingTime,
      rate: parseFloat(item.fundingRate) * 100,
      markPrice: parseFloat(item.markPrice),
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching funding rate');
    return [];
  }
};

export const getCurrentFundingRate = async (
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string
): Promise<{
  rate: number;
  nextFundingTime: number;
  markPrice: number;
} | null> => {
  // Prefer the live `<symbol>@markPrice@1s` stream cache. Saves a REST
  // round-trip per call, and the cached funding rate is at most 1s
  // stale (vs. the previous 5-minute polling cadence of any caller).
  const { binanceMarkPriceStreamService } = await import('./binance-mark-price-stream');
  const cached = binanceMarkPriceStreamService.getCached(symbol);
  if (cached) {
    return {
      rate: cached.fundingRate * 100,
      nextFundingTime: cached.nextFundingTime,
      markPrice: cached.markPrice,
    };
  }

  try {
    const premiumResponse = await fetchWithRetry(`${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`);

    if (!premiumResponse.ok) return null;

    const premiumData = await premiumResponse.json();

    // Lazy subscribe so subsequent calls hit the stream cache.
    binanceMarkPriceStreamService.subscribe(symbol);

    return {
      rate: parseFloat(premiumData.lastFundingRate) * 100,
      nextFundingTime: premiumData.nextFundingTime,
      markPrice: parseFloat(premiumData.markPrice),
    };
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching current funding rate');
    return null;
  }
};

export const getOpenInterest = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string
): Promise<OpenInterestData[]> => {
  const cacheKey = `oi:${symbol}`;
  const cached = cache.getFromCache<OpenInterestData[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/futures/data/openInterestHist?symbol=${symbol}&period=5m&limit=100`
    );

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch open interest history');
      return [];
    }

    const data: BinanceOpenInterestHistResponse[] = await response.json();

    const result: OpenInterestData[] = data.map((item) => ({
      timestamp: item.timestamp,
      value: parseFloat(item.sumOpenInterest),
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching open interest');
    return [];
  }
};

export const getCurrentOpenInterest = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string
): Promise<{ openInterest: number; timestamp: number } | null> => {
  const cacheKey = `oi-current:${symbol}`;
  const cached = cache.getFromCache<{ openInterest: number; timestamp: number }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/fapi/v1/openInterest?symbol=${symbol}`
    );

    if (!response.ok) return null;

    const data: BinanceOpenInterestResponse = await response.json();

    const result = {
      openInterest: parseFloat(data.openInterest),
      timestamp: data.time,
    };

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching current open interest');
    return null;
  }
};

export const getLiquidations = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string,
  startTime?: number,
  endTime?: number
): Promise<LiquidationData[]> => {
  const cacheKey = `liq:${symbol}:${startTime}:${endTime}`;
  const cached = cache.getFromCache<LiquidationData[]>(cacheKey);
  if (cached) return cached;

  try {
    let url = `${FUTURES_BASE_URL}/fapi/v1/allForceOrders?symbol=${symbol}&limit=100`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;

    const response = await fetchWithRetry(url);

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch liquidations');
      return [];
    }

    const data: BinanceLiquidationResponse[] = await response.json();

    const grouped = new Map<number, { long: number; short: number }>();

    for (const liq of data) {
      const timeKey = Math.floor(liq.time / 60000) * 60000;
      const qty = parseFloat(liq.executedQty) * parseFloat(liq.averagePrice);

      const existing = grouped.get(timeKey) ?? { long: 0, short: 0 };
      if (liq.side === 'SELL') {
        existing.long += qty;
      } else {
        existing.short += qty;
      }
      grouped.set(timeKey, existing);
    }

    const result: LiquidationData[] = Array.from(grouped.entries())
      .map(([timestamp, values]) => ({
        timestamp,
        longLiquidations: values.long,
        shortLiquidations: values.short,
        totalLiquidations: values.long + values.short,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching liquidations');
    return [];
  }
};

type LongShortPeriod = '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d';

export interface LongShortRatioEntry {
  longAccount: number;
  shortAccount: number;
  longShortRatio: number;
  timestamp: number;
}

export const getLongShortRatio = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string,
  period: LongShortPeriod = '1h'
): Promise<LongShortRatioEntry[]> => {
  const cacheKey = `lsr:${symbol}:${period}`;
  const cached = cache.getFromCache<LongShortRatioEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/futures/data/globalLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=100`
    );

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch long/short ratio');
      return [];
    }

    const data = await response.json();

    const result = data.map((item: { longAccount: string; shortAccount: string; longShortRatio: string; timestamp: number }) => ({
      longAccount: parseFloat(item.longAccount),
      shortAccount: parseFloat(item.shortAccount),
      longShortRatio: parseFloat(item.longShortRatio),
      timestamp: item.timestamp,
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching long/short ratio');
    return [];
  }
};

export const getTopTraderLongShortRatio = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string,
  period: LongShortPeriod = '1h'
): Promise<LongShortRatioEntry[]> => {
  const cacheKey = `tlsr:${symbol}:${period}`;
  const cached = cache.getFromCache<LongShortRatioEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/futures/data/topLongShortAccountRatio?symbol=${symbol}&period=${period}&limit=100`
    );

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch top trader long/short ratio');
      return [];
    }

    const data = await response.json();

    const result = data.map((item: { longAccount: string; shortAccount: string; longShortRatio: string; timestamp: number }) => ({
      longAccount: parseFloat(item.longAccount),
      shortAccount: parseFloat(item.shortAccount),
      longShortRatio: parseFloat(item.longShortRatio),
      timestamp: item.timestamp,
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching top trader long/short ratio');
    return [];
  }
};

export interface TakerBuySellEntry {
  buySellRatio: number;
  buyVol: number;
  sellVol: number;
  timestamp: number;
}

export const getTakerBuySellVolume = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string,
  period: LongShortPeriod = '1h'
): Promise<TakerBuySellEntry[]> => {
  const cacheKey = `tbsv:${symbol}:${period}`;
  const cached = cache.getFromCache<TakerBuySellEntry[]>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetchWithRetry(
      `${FUTURES_BASE_URL}/futures/data/takerlongshortRatio?symbol=${symbol}&period=${period}&limit=100`
    );

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch taker buy/sell volume');
      return [];
    }

    const data = await response.json();

    const result = data.map((item: { buySellRatio: string; buyVol: string; sellVol: string; timestamp: number }) => ({
      buySellRatio: parseFloat(item.buySellRatio),
      buyVol: parseFloat(item.buyVol),
      sellVol: parseFloat(item.sellVol),
      timestamp: item.timestamp,
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching taker buy/sell volume');
    return [];
  }
};

export const getHistoricalFundingRates = async (
  cache: DataCache,
  fetchWithRetry: (url: string) => Promise<Response>,
  symbol: string,
  startTime?: number,
  endTime?: number,
  limit = 1000
): Promise<FundingRateData[]> => {
  const cacheKey = `historicalFunding:${symbol}:${startTime}:${endTime}:${limit}`;
  const cached = cache.getFromCache<FundingRateData[]>(cacheKey);
  if (cached) return cached;

  try {
    let url = `${FUTURES_BASE_URL}/fapi/v1/fundingRate?symbol=${symbol}&limit=${limit}`;
    if (startTime) url += `&startTime=${startTime}`;
    if (endTime) url += `&endTime=${endTime}`;

    const response = await fetchWithRetry(url);

    if (!response.ok) {
      logger.warn({ symbol, status: response.status }, 'Failed to fetch historical funding rates');
      return [];
    }

    const data: BinanceFundingRateResponse[] = await response.json();

    const result: FundingRateData[] = data.map((item) => ({
      timestamp: item.fundingTime,
      rate: parseFloat(item.fundingRate) * 100,
      markPrice: parseFloat(item.markPrice),
    }));

    cache.setCache(cacheKey, result);
    return result;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Error fetching historical funding rates');
    return [];
  }
};
