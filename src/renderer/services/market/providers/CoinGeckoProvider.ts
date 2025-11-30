import type { Kline, KlineData, TimeInterval } from '@shared/types';
import {
    BaseMarketProvider,
    type FetchCandlesOptions,
    type MarketProviderConfig,
    type Symbol,
    type SymbolInfo,
} from '@shared/types';
import type { AxiosInstance } from 'axios';
import axios from 'axios';

interface CoinGeckoMarketChart {
  prices: number[][];
  market_caps: number[][];
  total_volumes: number[][];
}

interface CoinGeckoCoin {
  id: string;
  symbol: string;
  name: string;
}

const COINGECKO_DAYS_MAP: Record<TimeInterval, number> = {
  '1s': 1,
  '1m': 1,
  '3m': 1,
  '5m': 1,
  '15m': 1,
  '30m': 1,
  '1h': 7,
  '2h': 7,
  '4h': 7,
  '6h': 7,
  '8h': 7,
  '12h': 7,
  '1d': 90,
  '3d': 90,
  '1w': 90,
  '1M': 365,
};

export class CoinGeckoProvider extends BaseMarketProvider {
  private client: AxiosInstance;
  private coinsCache: CoinGeckoCoin[] | null = null;
  private coinsCacheTime = 0;
  private readonly CACHE_DURATION = 60 * 60 * 1000;

  constructor(config?: Partial<MarketProviderConfig>) {
    const defaultConfig: MarketProviderConfig = {
      name: 'CoinGecko',
      type: 'crypto',
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: 10,
      enabled: true,
      ...config,
    };

    super(defaultConfig);

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async fetchCandles(options: FetchCandlesOptions): Promise<KlineData> {
    const { symbol, interval, limit = 500 } = options;

    return this.rateLimitedFetch(async () => {
      try {
        const coinId = this.normalizeSymbol(symbol).toLowerCase();
        const days = COINGECKO_DAYS_MAP[interval];

        const response = await this.client.get<CoinGeckoMarketChart>(
          `/coins/${coinId}/market_chart`,
          {
            params: {
              vs_currency: 'usd',
              days,
              interval: days === 1 ? '5m' : days <= 7 ? 'hourly' : 'daily',
            },
          }
        );

        const { prices, total_volumes } = response.data;

        const klines: Kline[] = prices.slice(-limit).map((price, index) => {
          const openTime = price[0] || Date.now();
          const closePrice = price[1] || 0;
          const volume = total_volumes[index]?.[1] || 0;

          const priceStr = closePrice.toString();
          const volumeStr = volume.toString();

          return {
            openTime,
            open: priceStr,
            high: priceStr,
            low: priceStr,
            close: priceStr,
            volume: volumeStr,
            closeTime: openTime,
            quoteVolume: volumeStr,
            trades: 0,
            takerBuyBaseVolume: '0',
            takerBuyQuoteVolume: '0',
          };
        });

        return {
          symbol,
          interval,
          klines,
        };
      } catch (error) {
        this.handleError(error, `Failed to fetch candles for ${symbol}`);
      }
    });
  }

  async searchSymbols(query: string): Promise<Symbol[]> {
    await this.ensureCoinsCache();

    if (!this.coinsCache) return [];

    const normalizedQuery = query.toLowerCase();

    return this.coinsCache
      .filter(
        coin =>
          coin.id.includes(normalizedQuery) ||
          coin.symbol.includes(normalizedQuery) ||
          coin.name.toLowerCase().includes(normalizedQuery)
      )
      .slice(0, 50)
      .map(coin => ({
        symbol: coin.id.toUpperCase(),
        status: 'TRADING' as const,
        baseAsset: coin.symbol.toUpperCase(),
        baseAssetPrecision: 8,
        quoteAsset: 'USD',
        quotePrecision: 2,
        quoteAssetPrecision: 2,
        baseCommissionPrecision: 8,
        quoteCommissionPrecision: 2,
        orderTypes: ['LIMIT', 'MARKET'],
        icebergAllowed: false,
        ocoAllowed: false,
        quoteOrderQtyMarketAllowed: true,
        allowTrailingStop: false,
        cancelReplaceAllowed: false,
        isSpotTradingAllowed: true,
        isMarginTradingAllowed: false,
        filters: [],
        permissions: ['SPOT'],
        displayName: `${coin.name} (${coin.symbol.toUpperCase()})`,
      }));
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    await this.ensureCoinsCache();

    if (!this.coinsCache) {
      this.handleError(new Error('Coins cache not available'), 'Failed to get symbol info');
    }

    const normalizedSymbol = this.normalizeSymbol(symbol).toLowerCase();
    const coin = this.coinsCache.find(c => c.id === normalizedSymbol);

    if (!coin) {
      this.handleError(new Error(`Symbol ${symbol} not found`), 'Invalid symbol');
    }

    return {
      symbol: coin.id.toUpperCase(),
      baseAsset: coin.symbol.toUpperCase(),
      quoteAsset: 'USD',
      displayName: `${coin.name} (${coin.symbol.toUpperCase()})`,
      minPrice: 0,
      maxPrice: 0,
      tickSize: 0.01,
      minQuantity: 0,
      maxQuantity: 0,
      stepSize: 0.00000001,
    };
  }

  normalizeSymbol(symbol: string): string {
    return symbol.replace(/USD|USDT/gi, '').toLowerCase();
  }

  private async ensureCoinsCache(): Promise<void> {
    const now = Date.now();

    if (this.coinsCache && now - this.coinsCacheTime < this.CACHE_DURATION) {
      return;
    }

    try {
      const response = await this.client.get<CoinGeckoCoin[]>('/coins/list');
      this.coinsCache = response.data;
      this.coinsCacheTime = now;
    } catch (error) {
      this.handleError(error, 'Failed to fetch coins list');
    }
  }
}
