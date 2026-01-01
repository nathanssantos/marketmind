import { logger } from './logger';
import { TIME_MS } from '../constants';

export interface BTCDominanceData {
  timestamp: number;
  btcDominance: number;
  ethDominance?: number;
  totalMarketCap?: number;
  btcMarketCap?: number;
}

export interface BTCDominanceResult {
  current: number | null;
  change24h: number | null;
  trend: 'increasing' | 'decreasing' | 'stable';
}

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const COINMARKETCAP_BASE_URL = 'https://pro-api.coinmarketcap.com/v1';

export class BTCDominanceDataService {
  private cache: { data: BTCDominanceData | null; timestamp: number } = { data: null, timestamp: 0 };
  private cacheTTL: number = 120000;
  private history: Array<{ dominance: number; timestamp: number }> = [];
  private readonly HISTORY_TTL_MS = TIME_MS.DAY;
  private cmcApiKey: string | null = null;
  private previousDominance: number | null = null;

  setCMCApiKey(apiKey: string): void {
    this.cmcApiKey = apiKey;
  }

  async getBTCDominance(): Promise<BTCDominanceData | null> {
    const cached = this.getFromCache();
    if (cached) return cached;

    let data = await this.fetchFromCoinGecko();

    if (!data && this.cmcApiKey) {
      data = await this.fetchFromCoinMarketCap();
    }

    if (data) {
      this.setCache(data);
      if (this.previousDominance === null) {
        this.previousDominance = data.btcDominance;
      }
    }

    return data;
  }

  async getBTCDominanceResult(): Promise<BTCDominanceResult> {
    const data = await this.getBTCDominance();

    if (!data) {
      return {
        current: null,
        change24h: null,
        trend: 'stable',
      };
    }

    const now = Date.now();
    this.history.push({ dominance: data.btcDominance, timestamp: now });
    this.history = this.history.filter(h => now - h.timestamp < this.HISTORY_TTL_MS);

    let change24h: number | null = null;
    const day24hAgo = now - TIME_MS.DAY;
    const oldestEntry = this.history.find(h => h.timestamp >= day24hAgo - 600000);

    if (oldestEntry) {
      change24h = data.btcDominance - oldestEntry.dominance;
    }

    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (change24h !== null) {
      if (change24h > 0.5) {
        trend = 'increasing';
      } else if (change24h < -0.5) {
        trend = 'decreasing';
      }
    }

    return {
      current: data.btcDominance,
      change24h,
      trend,
    };
  }

  private async fetchFromCoinGecko(): Promise<BTCDominanceData | null> {
    try {
      const response = await fetch(`${COINGECKO_BASE_URL}/global`, {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('CoinGecko rate limit reached');
        } else {
          logger.warn({ status: response.status }, 'Failed to fetch from CoinGecko');
        }
        return null;
      }

      const json = await response.json();
      const data = json.data;

      if (!data?.market_cap_percentage?.btc) {
        logger.warn('Invalid CoinGecko response format');
        return null;
      }

      return {
        timestamp: Date.now(),
        btcDominance: data.market_cap_percentage.btc,
        ethDominance: data.market_cap_percentage.eth ?? undefined,
        totalMarketCap: data.total_market_cap?.usd ?? undefined,
        btcMarketCap: undefined,
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching from CoinGecko');
      return null;
    }
  }

  private async fetchFromCoinMarketCap(): Promise<BTCDominanceData | null> {
    if (!this.cmcApiKey) {
      return null;
    }

    try {
      const response = await fetch(`${COINMARKETCAP_BASE_URL}/global-metrics/quotes/latest`, {
        headers: {
          'X-CMC_PRO_API_KEY': this.cmcApiKey,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          logger.warn('CoinMarketCap rate limit reached');
        } else {
          logger.warn({ status: response.status }, 'Failed to fetch from CoinMarketCap');
        }
        return null;
      }

      const json = await response.json();
      const data = json.data;

      if (data?.btc_dominance === undefined) {
        logger.warn('Invalid CoinMarketCap response format');
        return null;
      }

      return {
        timestamp: Date.now(),
        btcDominance: data.btc_dominance,
        ethDominance: data.eth_dominance ?? undefined,
        totalMarketCap: data.quote?.USD?.total_market_cap ?? undefined,
        btcMarketCap: undefined,
      };
    } catch (error) {
      logger.error({ error }, 'Error fetching from CoinMarketCap');
      return null;
    }
  }

  private getFromCache(): BTCDominanceData | null {
    if (this.cache.data && Date.now() - this.cache.timestamp < this.cacheTTL) {
      return this.cache.data;
    }
    return null;
  }

  private setCache(data: BTCDominanceData): void {
    this.cache = { data, timestamp: Date.now() };
  }

  clearCache(): void {
    this.cache = { data: null, timestamp: 0 };
  }

  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
  }
}

let btcDominanceDataService: BTCDominanceDataService | null = null;

export const getBTCDominanceDataService = (): BTCDominanceDataService => {
  if (!btcDominanceDataService) {
    btcDominanceDataService = new BTCDominanceDataService();
  }
  return btcDominanceDataService;
};

export default BTCDominanceDataService;
