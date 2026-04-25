import type {
  FundingRateData,
  OpenInterestData,
  LiquidationData,
} from '../lib/indicators';
import type { FuturesSymbolInfo, FuturesContractType } from '@marketmind/types';
import { WEBSOCKET_CONFIG } from '../constants';
import { withRetryFetch } from '../utils/retry';
import { BinanceIpBannedError } from './binance-api-cache';
import { DataCache } from './binance-futures-data-cache';
import {
  getFundingRate,
  getCurrentFundingRate,
  getOpenInterest,
  getCurrentOpenInterest,
  getLiquidations,
  getLongShortRatio,
  getTopTraderLongShortRatio,
  getTakerBuySellVolume,
  getHistoricalFundingRates,
  type LongShortRatioEntry,
  type TakerBuySellEntry,
} from './binance-futures-sentiment';
import { logger, serializeError } from './logger';

const FUTURES_BASE_URL = 'https://fapi.binance.com';
const RATE_LIMIT_DELAY = 100;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithRetry = async (url: string): Promise<Response> =>
  withRetryFetch(url, {}, { timeoutMs: WEBSOCKET_CONFIG.FETCH_TIMEOUT_MS });

type LongShortPeriod = '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '12h' | '1d';

export class BinanceFuturesDataService {
  private dataCache = new DataCache();

  async getFundingRate(symbol: string): Promise<FundingRateData[]> {
    return getFundingRate(this.dataCache, fetchWithRetry, symbol);
  }

  async getCurrentFundingRate(symbol: string): Promise<{
    rate: number;
    nextFundingTime: number;
    markPrice: number;
  } | null> {
    return getCurrentFundingRate(fetchWithRetry, symbol);
  }

  async getOpenInterest(symbol: string): Promise<OpenInterestData[]> {
    return getOpenInterest(this.dataCache, fetchWithRetry, symbol);
  }

  async getCurrentOpenInterest(symbol: string): Promise<{
    openInterest: number;
    timestamp: number;
  } | null> {
    return getCurrentOpenInterest(this.dataCache, fetchWithRetry, symbol);
  }

  async getLiquidations(symbol: string, startTime?: number, endTime?: number): Promise<LiquidationData[]> {
    return getLiquidations(this.dataCache, fetchWithRetry, symbol, startTime, endTime);
  }

  async getLongShortRatio(symbol: string, period: LongShortPeriod = '1h'): Promise<LongShortRatioEntry[]> {
    return getLongShortRatio(this.dataCache, fetchWithRetry, symbol, period);
  }

  async getTopTraderLongShortRatio(symbol: string, period: LongShortPeriod = '1h'): Promise<LongShortRatioEntry[]> {
    return getTopTraderLongShortRatio(this.dataCache, fetchWithRetry, symbol, period);
  }

  async getTakerBuySellVolume(symbol: string, period: LongShortPeriod = '1h'): Promise<TakerBuySellEntry[]> {
    return getTakerBuySellVolume(this.dataCache, fetchWithRetry, symbol, period);
  }

  async getAllCryptoData(symbol: string): Promise<{
    fundingRate: FundingRateData[];
    openInterest: OpenInterestData[];
    liquidations: LiquidationData[];
    longShortRatio: LongShortRatioEntry[];
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

  clearCache(): void {
    this.dataCache.clearCache();
  }

  setCacheTTL(ttl: number): void {
    this.dataCache.setCacheTTL(ttl);
  }

  async getExchangeInfo(): Promise<FuturesSymbolInfo[]> {
    const cacheKey = 'exchangeInfo';
    const cached = this.dataCache.getFromCache<FuturesSymbolInfo[]>(cacheKey);
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

      this.dataCache.setCache(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof BinanceIpBannedError) throw error;
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
    return getHistoricalFundingRates(this.dataCache, fetchWithRetry, symbol, startTime, endTime, limit);
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
      if (error instanceof BinanceIpBannedError) throw error;
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
        estimatedSettlePrice: parseFloat(data.estimatedSettlePrice ?? '0'),
        lastFundingRate: parseFloat(data.lastFundingRate) * 100,
        nextFundingTime: data.nextFundingTime,
        interestRate: parseFloat(data.interestRate) * 100,
        time: data.time,
      };
    } catch (error) {
      if (error instanceof BinanceIpBannedError) throw error;
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
    const cached = this.dataCache.getFromCache<{
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

      this.dataCache.setCache(cacheKey, result);
      return result;
    } catch (error) {
      if (error instanceof BinanceIpBannedError) throw error;
      logger.error({ error }, 'Error fetching all mark prices');
      return [];
    }
  }
}

let binanceFuturesDataService: BinanceFuturesDataService | null = null;

export const getBinanceFuturesDataService = (): BinanceFuturesDataService => {
  binanceFuturesDataService ??= new BinanceFuturesDataService();
  return binanceFuturesDataService;
};

export default BinanceFuturesDataService;
