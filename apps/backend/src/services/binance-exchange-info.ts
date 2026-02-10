import type { MarketType } from '@marketmind/types';
import { withRetryFetch } from '../utils/retry';
import { logger } from './logger';

const BINANCE_SPOT_API = 'https://api.binance.com';
const BINANCE_FUTURES_API = 'https://fapi.binance.com';

export interface Ticker24hr {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  weightedAvgPrice: number;
  lastPrice: number;
  volume: number;
  quoteVolume: number;
  openPrice: number;
  highPrice: number;
  lowPrice: number;
  count: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const TICKER_CACHE_TTL = 60_000;

class Ticker24hrCache {
  private cache: Map<string, CacheEntry<Ticker24hr>> = new Map();
  private pendingFetch: Promise<void> | null = null;

  async getForSymbols(symbols: string[], marketType: MarketType): Promise<Map<string, Ticker24hr>> {
    const now = Date.now();
    const result = new Map<string, Ticker24hr>();
    const symbolsToFetch: string[] = [];

    for (const symbol of symbols) {
      const cached = this.cache.get(symbol);
      if (cached && now - cached.timestamp < TICKER_CACHE_TTL) {
        result.set(symbol, cached.data);
      } else {
        symbolsToFetch.push(symbol);
      }
    }

    if (symbolsToFetch.length > 0) {
      await this.fetchTickers(symbolsToFetch, marketType);

      for (const symbol of symbolsToFetch) {
        const cached = this.cache.get(symbol);
        if (cached) {
          result.set(symbol, cached.data);
        }
      }
    }

    return result;
  }

  async getAllTickers(marketType: MarketType): Promise<Map<string, Ticker24hr>> {
    const now = Date.now();

    const oldestEntry = [...this.cache.values()].reduce(
      (oldest, entry) => (entry.timestamp < oldest ? entry.timestamp : oldest),
      now
    );

    if (this.cache.size > 0 && now - oldestEntry < TICKER_CACHE_TTL) {
      return new Map([...this.cache.entries()].map(([k, v]) => [k, v.data]));
    }

    await this.fetchAllTickers(marketType);

    return new Map([...this.cache.entries()].map(([k, v]) => [k, v.data]));
  }

  private async fetchTickers(symbols: string[], marketType: MarketType): Promise<void> {
    if (this.pendingFetch) {
      await this.pendingFetch;
      return;
    }

    this.pendingFetch = this.doFetchTickers(symbols, marketType);
    try {
      await this.pendingFetch;
    } finally {
      this.pendingFetch = null;
    }
  }

  private async doFetchTickers(symbols: string[], marketType: MarketType): Promise<void> {
    const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
    const endpoint = marketType === 'FUTURES' ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';

    try {
      const url = new URL(`${baseUrl}${endpoint}`);
      url.searchParams.set('symbols', JSON.stringify(symbols));

      const response = await withRetryFetch(url.toString());

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch 24hr tickers');
        return;
      }

      const data = await response.json();
      const now = Date.now();

      const tickers = Array.isArray(data) ? data : [data];

      for (const ticker of tickers) {
        const parsed: Ticker24hr = {
          symbol: ticker.symbol,
          priceChange: parseFloat(ticker.priceChange),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
          lastPrice: parseFloat(ticker.lastPrice),
          volume: parseFloat(ticker.volume),
          quoteVolume: parseFloat(ticker.quoteVolume),
          openPrice: parseFloat(ticker.openPrice),
          highPrice: parseFloat(ticker.highPrice),
          lowPrice: parseFloat(ticker.lowPrice),
          count: parseInt(ticker.count, 10),
        };

        this.cache.set(parsed.symbol, { data: parsed, timestamp: now });
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching 24hr tickers');
    }
  }

  private async fetchAllTickers(marketType: MarketType): Promise<void> {
    const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
    const endpoint = marketType === 'FUTURES' ? '/fapi/v1/ticker/24hr' : '/api/v3/ticker/24hr';

    try {
      const response = await withRetryFetch(`${baseUrl}${endpoint}`);

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch all 24hr tickers');
        return;
      }

      const data = await response.json();
      const now = Date.now();

      for (const ticker of data) {
        if (!ticker.symbol.endsWith('USDT')) continue;

        const parsed: Ticker24hr = {
          symbol: ticker.symbol,
          priceChange: parseFloat(ticker.priceChange),
          priceChangePercent: parseFloat(ticker.priceChangePercent),
          weightedAvgPrice: parseFloat(ticker.weightedAvgPrice),
          lastPrice: parseFloat(ticker.lastPrice),
          volume: parseFloat(ticker.volume),
          quoteVolume: parseFloat(ticker.quoteVolume),
          openPrice: parseFloat(ticker.openPrice),
          highPrice: parseFloat(ticker.highPrice),
          lowPrice: parseFloat(ticker.lowPrice),
          count: parseInt(ticker.count, 10),
        };

        this.cache.set(parsed.symbol, { data: parsed, timestamp: now });
      }
    } catch (error) {
      logger.error({ error }, 'Error fetching all 24hr tickers');
    }
  }

  clear(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; oldestAge: number | null } {
    if (this.cache.size === 0) return { size: 0, oldestAge: null };

    const now = Date.now();
    const oldest = [...this.cache.values()].reduce(
      (min, entry) => Math.min(min, entry.timestamp),
      now
    );

    return { size: this.cache.size, oldestAge: now - oldest };
  }
}

const ticker24hrCacheSpot = new Ticker24hrCache();
const ticker24hrCacheFutures = new Ticker24hrCache();

export const getTicker24hrCache = (marketType: MarketType): Ticker24hrCache =>
  marketType === 'FUTURES' ? ticker24hrCacheFutures : ticker24hrCacheSpot;

export const get24hrTickerData = async (
  symbols: string[],
  marketType: MarketType
): Promise<Map<string, Ticker24hr>> => {
  const cache = getTicker24hrCache(marketType);
  return cache.getForSymbols(symbols, marketType);
};

export const getAll24hrTickers = async (
  marketType: MarketType
): Promise<Map<string, Ticker24hr>> => {
  const cache = getTicker24hrCache(marketType);
  return cache.getAllTickers(marketType);
};

const EXCLUDED_SYMBOLS = new Set([
  'USDCUSDT',
  'BUSDUSDT',
  'TUSDUSDT',
  'USDPUSDT',
  'FDUSDUSDT',
  'DAIUSDT',
  'EURUSDT',
]);

const TOP_MARKET_CAP_SYMBOLS = [
  // Top 1-10
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'DOGEUSDT',
  'ADAUSDT',
  'AVAXUSDT',
  'TRXUSDT',
  'LINKUSDT',
  // Top 11-20
  'DOTUSDT',
  'LTCUSDT',
  'MATICUSDT',
  'SHIBUSDT',
  'ATOMUSDT',
  'UNIUSDT',
  'XLMUSDT',
  'NEARUSDT',
  'AAVEUSDT',
  'APTUSDT',
  // Top 21-30
  'ICPUSDT',
  'ETCUSDT',
  'FILUSDT',
  'STXUSDT',
  'IMXUSDT',
  'INJUSDT',
  'RNDRUSDT',
  'VETUSDT',
  'OPUSDT',
  'ARBUSDT',
  // Top 31-40
  'MKRUSDT',
  'GRTUSDT',
  'THETAUSDT',
  'FTMUSDT',
  'ALGOUSDT',
  'RUNEUSDT',
  'LDOUSDT',
  'TIAUSDT',
  'SEIUSDT',
  'SUIUSDT',
  // Top 41-50
  'PENDLEUSDT',
  'JUPUSDT',
  'WLDUSDT',
  'ONDOUSDT',
  'ENAUSDT',
  'PYTHUSDT',
  'STRKUSDT',
  'JASMYUSDT',
  'BONKUSDT',
  'WIFUSDT',
  // Extra buffer
  'FLOKIUSDT',
  'PEPEUSDT',
  'FETUSDT',
  'AGIXUSDT',
  'OCEANUSDT',
] as const;

const validateSymbolsExist = async (
  symbols: string[],
  marketType: MarketType
): Promise<string[]> => {
  const available = await getAvailableSymbols(marketType);
  const availableSet = new Set(available);
  return symbols.filter((s) => availableSet.has(s));
};

export const getTopSymbolsByMarketCap = async (
  marketType: MarketType = 'FUTURES',
  limit: number = 12
): Promise<string[]> => {
  const candidates = [...TOP_MARKET_CAP_SYMBOLS].slice(0, Math.min(limit + 5, TOP_MARKET_CAP_SYMBOLS.length));
  const validSymbols = await validateSymbolsExist(candidates, marketType);
  return validSymbols.slice(0, limit);
};

export const getTopSymbolsByVolume = async (
  marketType: MarketType = 'FUTURES',
  limit: number = 12
): Promise<string[]> => {
  return getTopSymbolsByMarketCap(marketType, limit);
};

export const getAvailableSymbols = async (marketType: MarketType = 'FUTURES'): Promise<string[]> => {
  const baseUrl = marketType === 'FUTURES' ? BINANCE_FUTURES_API : BINANCE_SPOT_API;
  const endpoint = marketType === 'FUTURES' ? '/fapi/v1/exchangeInfo' : '/api/v3/exchangeInfo';

  const response = await withRetryFetch(`${baseUrl}${endpoint}`, {}, {
    maxRetries: 3,
    initialDelayMs: 1000,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch exchange info: ${response.statusText}`);
  }

  const data = await response.json();
  const symbols: Array<{ symbol: string; status: string }> = data.symbols;

  return symbols
    .filter((s) => s.status === 'TRADING' && s.symbol.endsWith('USDT') && !EXCLUDED_SYMBOLS.has(s.symbol))
    .map((s) => s.symbol)
    .sort();
};
