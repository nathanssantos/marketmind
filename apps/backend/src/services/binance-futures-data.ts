import type {
  FundingRateData,
  OpenInterestData,
  LiquidationData,
} from '@marketmind/indicators';
import type { FuturesSymbolInfo, FuturesContractType } from '@marketmind/types';
import { WEBSOCKET_CONFIG } from '../constants';
import { withRetryFetch } from '../utils/retry';
import { logger, serializeError } from './logger';

const FUTURES_BASE_URL = 'https://fapi.binance.com';
const RATE_LIMIT_DELAY = 100;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string): Promise<Response> => {
  return withRetryFetch(url, {}, { timeoutMs: WEBSOCKET_CONFIG.FETCH_TIMEOUT_MS });
};

interface BinanceFundingRateResponse {
  symbol: string;
  fundingTime: number;
  fundingRate: string;
  markPrice: string;
}

interface BinanceOpenInterestResponse {
  symbol: string;
  openInterest: string;
  time: number;
}

interface BinanceOpenInterestHistResponse {
  symbol: string;
  sumOpenInterest: string;
  sumOpenInterestValue: string;
  timestamp: number;
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

export class BinanceFuturesDataService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTTL: number = 60000;

  async getFundingRate(symbol: string): Promise<FundingRateData[]> {
    const cacheKey = `funding:${symbol}`;
    const cached = this.getFromCache<FundingRateData[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching funding rate');
      return [];
    }
  }

  async getCurrentFundingRate(symbol: string): Promise<{
    rate: number;
    nextFundingTime: number;
    markPrice: number;
  } | null> {
    try {
      const premiumResponse = await fetchWithRetry(`${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`);

      if (!premiumResponse.ok) return null;

      const premiumData = await premiumResponse.json();

      return {
        rate: parseFloat(premiumData.lastFundingRate) * 100,
        nextFundingTime: premiumData.nextFundingTime,
        markPrice: parseFloat(premiumData.markPrice),
      };
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching current funding rate');
      return null;
    }
  }

  async getOpenInterest(symbol: string): Promise<OpenInterestData[]> {
    const cacheKey = `oi:${symbol}`;
    const cached = this.getFromCache<OpenInterestData[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching open interest');
      return [];
    }
  }

  async getCurrentOpenInterest(symbol: string): Promise<{
    openInterest: number;
    timestamp: number;
  } | null> {
    const cacheKey = `oi-current:${symbol}`;
    const cached = this.getFromCache<{ openInterest: number; timestamp: number }>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching current open interest');
      return null;
    }
  }

  async getLiquidations(symbol: string, startTime?: number, endTime?: number): Promise<LiquidationData[]> {
    const cacheKey = `liq:${symbol}:${startTime}:${endTime}`;
    const cached = this.getFromCache<LiquidationData[]>(cacheKey);
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

        const existing = grouped.get(timeKey) || { long: 0, short: 0 };
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching liquidations');
      return [];
    }
  }

  async getLongShortRatio(symbol: string, period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h'): Promise<{
    longAccount: number;
    shortAccount: number;
    longShortRatio: number;
    timestamp: number;
  }[]> {
    const cacheKey = `lsr:${symbol}:${period}`;
    const cached = this.getFromCache<{ longAccount: number; shortAccount: number; longShortRatio: number; timestamp: number }[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching long/short ratio');
      return [];
    }
  }

  async getTopTraderLongShortRatio(symbol: string, period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h'): Promise<{
    longAccount: number;
    shortAccount: number;
    longShortRatio: number;
    timestamp: number;
  }[]> {
    const cacheKey = `tlsr:${symbol}:${period}`;
    const cached = this.getFromCache<{ longAccount: number; shortAccount: number; longShortRatio: number; timestamp: number }[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching top trader long/short ratio');
      return [];
    }
  }

  async getTakerBuySellVolume(symbol: string, period: '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d' = '1h'): Promise<{
    buySellRatio: number;
    buyVol: number;
    sellVol: number;
    timestamp: number;
  }[]> {
    const cacheKey = `tbsv:${symbol}:${period}`;
    const cached = this.getFromCache<{ buySellRatio: number; buyVol: number; sellVol: number; timestamp: number }[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching taker buy/sell volume');
      return [];
    }
  }

  async getAllCryptoData(symbol: string): Promise<{
    fundingRate: FundingRateData[];
    openInterest: OpenInterestData[];
    liquidations: LiquidationData[];
    longShortRatio: { longAccount: number; shortAccount: number; longShortRatio: number; timestamp: number }[];
  }> {
    const [fundingRate, openInterest, liquidations, longShortRatio] = await Promise.all([
      this.getFundingRate(symbol),
      this.getOpenInterest(symbol),
      this.getLiquidations(symbol),
      this.getLongShortRatio(symbol),
    ]);

    await sleep(RATE_LIMIT_DELAY);

    return {
      fundingRate,
      openInterest,
      liquidations,
      longShortRatio,
    };
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    return null;
  }

  private setCache(key: string, data: unknown): void {
    const MAX_CACHE_SIZE = 200;
    if (this.cache.size >= MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  clearCache(): void {
    this.cache.clear();
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  async getExchangeInfo(): Promise<FuturesSymbolInfo[]> {
    const cacheKey = 'exchangeInfo';
    const cached = this.getFromCache<FuturesSymbolInfo[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithRetry(`${FUTURES_BASE_URL}/fapi/v1/exchangeInfo`);

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch futures exchange info');
        return [];
      }

      const data = await response.json();

      const result: FuturesSymbolInfo[] = data.symbols
        .filter((s: { contractType: string; status: string }) =>
          s.contractType === 'PERPETUAL' && s.status === 'TRADING'
        )
        .map((s: {
          symbol: string;
          pair: string;
          baseAsset: string;
          quoteAsset: string;
          contractType: string;
          deliveryDate: number;
          onboardDate: number;
          status: string;
          pricePrecision: number;
          quantityPrecision: number;
          baseAssetPrecision: number;
          quotePrecision: number;
          maintMarginPercent: string;
          requiredMarginPercent: string;
          underlyingType: string;
          underlyingSubType: string[];
        }) => ({
          symbol: s.symbol,
          pair: s.pair,
          baseAsset: s.baseAsset,
          quoteAsset: s.quoteAsset,
          contractType: s.contractType as FuturesContractType,
          deliveryDate: s.deliveryDate,
          onboardDate: s.onboardDate,
          status: s.status,
          pricePrecision: s.pricePrecision,
          quantityPrecision: s.quantityPrecision,
          baseAssetPrecision: s.baseAssetPrecision,
          quotePrecision: s.quotePrecision,
          maxLeverage: 125,
          maintMarginPercent: s.maintMarginPercent,
          requiredMarginPercent: s.requiredMarginPercent,
          underlyingType: s.underlyingType,
          underlyingSubType: s.underlyingSubType || [],
        }));

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error }, 'Error fetching futures exchange info');
      return [];
    }
  }

  async getHistoricalFundingRates(
    symbol: string,
    startTime?: number,
    endTime?: number,
    limit = 1000
  ): Promise<FundingRateData[]> {
    const cacheKey = `historicalFunding:${symbol}:${startTime}:${endTime}:${limit}`;
    const cached = this.getFromCache<FundingRateData[]>(cacheKey);
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

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching historical funding rates');
      return [];
    }
  }

  async getFuturesKlines(
    symbol: string,
    interval: string,
    startTime?: number,
    endTime?: number,
    limit = 1000
  ): Promise<{
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    closeTime: number;
    quoteVolume: number;
    trades: number;
    takerBuyBaseVolume: number;
    takerBuyQuoteVolume: number;
  }[]> {
    try {
      let url = `${FUTURES_BASE_URL}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
      if (startTime) url += `&startTime=${startTime}`;
      if (endTime) url += `&endTime=${endTime}`;

      const response = await fetchWithRetry(url);

      if (!response.ok) {
        logger.warn({ symbol, interval, status: response.status }, 'Failed to fetch futures klines');
        return [];
      }

      const data: (string | number)[][] = await response.json();

      return data.map((k) => ({
        openTime: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
        closeTime: k[6] as number,
        quoteVolume: parseFloat(k[7] as string),
        trades: k[8] as number,
        takerBuyBaseVolume: parseFloat(k[9] as string),
        takerBuyQuoteVolume: parseFloat(k[10] as string),
      }));
    } catch (error) {
      logger.error({ error: serializeError(error), symbol, interval }, 'Error fetching futures klines');
      return [];
    }
  }

  async getMarkPrice(symbol: string): Promise<{
    symbol: string;
    markPrice: number;
    indexPrice: number;
    estimatedSettlePrice: number;
    lastFundingRate: number;
    nextFundingTime: number;
    interestRate: number;
    time: number;
  } | null> {
    try {
      const response = await fetchWithRetry(`${FUTURES_BASE_URL}/fapi/v1/premiumIndex?symbol=${symbol}`);

      if (!response.ok) return null;

      const data = await response.json();

      return {
        symbol: data.symbol,
        markPrice: parseFloat(data.markPrice),
        indexPrice: parseFloat(data.indexPrice),
        estimatedSettlePrice: parseFloat(data.estimatedSettlePrice || '0'),
        lastFundingRate: parseFloat(data.lastFundingRate) * 100,
        nextFundingTime: data.nextFundingTime,
        interestRate: parseFloat(data.interestRate) * 100,
        time: data.time,
      };
    } catch (error) {
      logger.error({ error: serializeError(error), symbol }, 'Error fetching mark price');
      return null;
    }
  }

  async getAllMarkPrices(): Promise<{
    symbol: string;
    markPrice: number;
    indexPrice: number;
    lastFundingRate: number;
    nextFundingTime: number;
    time: number;
  }[]> {
    const cacheKey = 'allMarkPrices';
    const cached = this.getFromCache<{
      symbol: string;
      markPrice: number;
      indexPrice: number;
      lastFundingRate: number;
      nextFundingTime: number;
      time: number;
    }[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithRetry(`${FUTURES_BASE_URL}/fapi/v1/premiumIndex`);

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch all mark prices');
        return [];
      }

      const data = await response.json();

      const result = data.map((item: {
        symbol: string;
        markPrice: string;
        indexPrice: string;
        lastFundingRate: string;
        nextFundingTime: number;
        time: number;
      }) => ({
        symbol: item.symbol,
        markPrice: parseFloat(item.markPrice),
        indexPrice: parseFloat(item.indexPrice),
        lastFundingRate: parseFloat(item.lastFundingRate) * 100,
        nextFundingTime: item.nextFundingTime,
        time: item.time,
      }));

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      logger.error({ error }, 'Error fetching all mark prices');
      return [];
    }
  }
}

let binanceFuturesDataService: BinanceFuturesDataService | null = null;

export const getBinanceFuturesDataService = (): BinanceFuturesDataService => {
  if (!binanceFuturesDataService) {
    binanceFuturesDataService = new BinanceFuturesDataService();
  }
  return binanceFuturesDataService;
};

export default BinanceFuturesDataService;
