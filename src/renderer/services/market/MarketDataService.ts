import type {
  BaseMarketProvider,
  FetchCandlesOptions,
  Symbol,
  SymbolInfo,
  MarketDataError,
  WebSocketSubscription,
} from '@shared/types';
import type { CandleData } from '@shared/types';

export interface MarketDataServiceConfig {
  primaryProvider: BaseMarketProvider;
  fallbackProviders?: BaseMarketProvider[];
  enableCache?: boolean;
  cacheDuration?: number;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

export class MarketDataService {
  private primaryProvider: BaseMarketProvider;
  private fallbackProviders: BaseMarketProvider[];
  private cache: Map<string, CacheEntry<CandleData>> = new Map();
  private cacheDuration: number;
  private enableCache: boolean;
  private wsUnsubscribe: Map<string, () => void> = new Map();

  constructor(config: MarketDataServiceConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProviders = config.fallbackProviders || [];
    this.enableCache = config.enableCache ?? true;
    this.cacheDuration = config.cacheDuration ?? 60 * 1000;
  }

  async fetchCandles(options: FetchCandlesOptions): Promise<CandleData> {
    const cacheKey = this.getCacheKey(options);

    if (this.enableCache) {
      const cached = this.getFromCache(cacheKey);
      if (cached) return cached;
    }

    const providers = [this.primaryProvider, ...this.fallbackProviders].filter(
      p => p.isEnabled
    );

    const errors: MarketDataError[] = [];

    for (const provider of providers) {
      try {
        const data = await provider.fetchCandles(options);
        
        if (this.enableCache) {
          this.setCache(cacheKey, data);
        }

        return data;
      } catch (error) {
        errors.push(error as MarketDataError);
        console.warn(`Provider ${provider.name} failed:`, error);
      }
    }

    throw new Error(
      `All providers failed to fetch candles. Errors: ${errors
        .map(e => `[${e.provider}] ${e.message}`)
        .join(', ')}`
    );
  }

  async searchSymbols(query: string): Promise<Symbol[]> {
    const providers = [this.primaryProvider, ...this.fallbackProviders].filter(
      p => p.isEnabled
    );

    for (const provider of providers) {
      try {
        return await provider.searchSymbols(query);
      } catch (error) {
        console.warn(`Provider ${provider.name} search failed:`, error);
      }
    }

    return [];
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    const providers = [this.primaryProvider, ...this.fallbackProviders].filter(
      p => p.isEnabled
    );

    const errors: MarketDataError[] = [];

    for (const provider of providers) {
      try {
        return await provider.getSymbolInfo(symbol);
      } catch (error) {
        errors.push(error as MarketDataError);
        console.warn(`Provider ${provider.name} failed:`, error);
      }
    }

    throw new Error(
      `All providers failed to get symbol info. Errors: ${errors
        .map(e => `[${e.provider}] ${e.message}`)
        .join(', ')}`
    );
  }

  clearCache(): void {
    this.cache.clear();
  }

  setPrimaryProvider(provider: BaseMarketProvider): void {
    this.primaryProvider = provider;
    this.clearCache();
  }

  addFallbackProvider(provider: BaseMarketProvider): void {
    this.fallbackProviders.push(provider);
  }

  removeFallbackProvider(providerName: string): void {
    this.fallbackProviders = this.fallbackProviders.filter(
      p => p.name !== providerName
    );
  }

  subscribeToUpdates(subscription: WebSocketSubscription): () => void {
    const provider = this.primaryProvider.supportsWebSocket?.() 
      ? this.primaryProvider 
      : this.fallbackProviders.find(p => p.supportsWebSocket?.());

    if (!provider?.subscribeToUpdates) {
      console.warn('No provider supports WebSocket subscriptions');
      return () => {};
    }

    const key = `${subscription.symbol}_${subscription.interval}`;
    
    const existingUnsubscribe = this.wsUnsubscribe.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }

    const unsubscribe = provider.subscribeToUpdates(subscription);
    this.wsUnsubscribe.set(key, unsubscribe);

    return () => {
      unsubscribe();
      this.wsUnsubscribe.delete(key);
    };
  }

  unsubscribeAll(): void {
    this.wsUnsubscribe.forEach(unsubscribe => unsubscribe());
    this.wsUnsubscribe.clear();
  }

  private getCacheKey(options: FetchCandlesOptions): string {
    return `${options.symbol}_${options.interval}_${options.limit || 500}_${
      options.startTime || 'latest'
    }`;
  }

  private getFromCache(key: string): CandleData | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > this.cacheDuration) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: CandleData): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}
