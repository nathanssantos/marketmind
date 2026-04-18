import type { MarketType } from '@marketmind/types';
import { TIME_MS } from '../constants';
import { logger } from './logger';
import { getValidBinanceSymbols } from './symbol-mapping';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export interface CoinGeckoMarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  ath: number;
  atl: number;
}

export interface TopCoin {
  binanceSymbol: string;
  coingeckoId: string;
  name: string;
  marketCapRank: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  currentPrice: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class MarketCapDataService {
  private cache: CacheEntry<TopCoin[]> | null = null;
  private cacheTTL = 5 * TIME_MS.MINUTE;
  private lastFetchTimestamp = 0;
  private minFetchInterval = 10_000;

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }

  async getTopCoinsByMarketCap(
    limit: number = 100,
    marketType: MarketType = 'FUTURES'
  ): Promise<TopCoin[]> {
    const cached = this.getFromCache();
    if (cached) {
      return cached.slice(0, limit);
    }

    const now = Date.now();
    if (now - this.lastFetchTimestamp < this.minFetchInterval) {
      logger.trace('Rate limiting CoinGecko fetch, returning empty');
      return [];
    }

    const coins = await this.fetchFromCoinGecko();
    if (!coins || coins.length === 0) {
      logger.warn('Failed to fetch coins from CoinGecko');
      return [];
    }

    const validSymbols = await getValidBinanceSymbols(
      coins.map((c) => ({ id: c.id, symbol: c.symbol })),
      marketType
    );

    const validSymbolSet = new Set(validSymbols);

    const topCoins: TopCoin[] = coins
      .map((coin) => {
        const binanceSymbol = `${coin.symbol.toUpperCase()  }USDT`;
        return {
          binanceSymbol,
          coingeckoId: coin.id,
          name: coin.name,
          marketCapRank: coin.market_cap_rank,
          marketCap: coin.market_cap,
          volume24h: coin.total_volume,
          priceChange24h: coin.price_change_24h,
          priceChangePercent24h: coin.price_change_percentage_24h,
          currentPrice: coin.current_price,
          isAvailable: validSymbolSet.has(binanceSymbol),
        };
      })
      .filter((coin) => coin.isAvailable)
      .map(({ isAvailable: _isAvailable, ...coin }) => coin);

    this.setCache(topCoins);
    this.lastFetchTimestamp = now;

    return topCoins.slice(0, limit);
  }

  async getTopBinanceSymbolsByMarketCap(
    limit: number = 100,
    marketType: MarketType = 'FUTURES'
  ): Promise<string[]> {
    const coins = await this.getTopCoinsByMarketCap(limit, marketType);
    return coins.map((c) => c.binanceSymbol);
  }

  private async fetchFromCoinGecko(): Promise<CoinGeckoMarketData[] | null> {
    try {
      const url = new URL(`${COINGECKO_BASE_URL}/coins/markets`);
      url.searchParams.set('vs_currency', 'usd');
      url.searchParams.set('order', 'market_cap_desc');
      url.searchParams.set('per_page', '250');
      url.searchParams.set('page', '1');
      url.searchParams.set('sparkline', 'false');
      url.searchParams.set('price_change_percentage', '24h');

      const response = await fetch(url.toString(), {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('CoinGecko rate limit reached for /coins/markets');
        } else {
          logger.warn({ status: response.status }, 'Failed to fetch from CoinGecko /coins/markets');
        }
        return null;
      }

      const data: CoinGeckoMarketData[] = await response.json();

      if (!Array.isArray(data)) {
        logger.warn('Invalid CoinGecko response format - expected array');
        return null;
      }

      return data;
    } catch (error) {
      logger.error({ error }, 'Error fetching from CoinGecko /coins/markets');
      return null;
    }
  }

  private getFromCache(): TopCoin[] | null {
    if (this.cache && Date.now() - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }
    return null;
  }

  private setCache(data: TopCoin[]): void {
    this.cache = { data, timestamp: Date.now() };
  }

  clearCache(): void {
    this.cache = null;
  }

  getCacheStatus(): { isCached: boolean; age: number | null; itemCount: number } {
    if (!this.cache) {
      return { isCached: false, age: null, itemCount: 0 };
    }
    return {
      isCached: true,
      age: Date.now() - this.cache.timestamp,
      itemCount: this.cache.data.length,
    };
  }
}

let marketCapDataService: MarketCapDataService | null = null;

export const getMarketCapDataService = (): MarketCapDataService => {
  if (!marketCapDataService) {
    marketCapDataService = new MarketCapDataService();
  }
  return marketCapDataService;
};

export default MarketCapDataService;
