import type { Candle, CandleData, TimeInterval } from './candle';

export interface Symbol {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
}

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  displayName: string;
  minPrice: number;
  maxPrice: number;
  minQuantity: number;
  maxQuantity: number;
  tickSize: number;
  stepSize: number;
}

export interface MarketProviderConfig {
  name: string;
  type: 'crypto' | 'stock' | 'forex';
  baseUrl: string;
  apiKey?: string;
  rateLimit?: number;
  enabled: boolean;
}

export interface FetchCandlesOptions {
  symbol: string;
  interval: TimeInterval;
  limit?: number;
  startTime?: number;
  endTime?: number;
}

export interface MarketDataError {
  provider: string;
  message: string;
  code?: string;
  statusCode?: number;
}

export interface WebSocketUpdate {
  symbol: string;
  interval: TimeInterval;
  candle: Candle;
  isFinal: boolean;
}

export type WebSocketCallback = (update: WebSocketUpdate) => void;

export interface WebSocketSubscription {
  symbol: string;
  interval: TimeInterval;
  callback: WebSocketCallback;
}

export abstract class BaseMarketProvider {
  protected config: MarketProviderConfig;
  protected lastRequestTime = 0;
  protected requestCount = 0;

  constructor(config: MarketProviderConfig) {
    this.config = config;
  }

  abstract fetchCandles(options: FetchCandlesOptions): Promise<CandleData>;
  abstract searchSymbols(query: string): Promise<Symbol[]>;
  abstract getSymbolInfo(symbol: string): Promise<SymbolInfo>;
  abstract normalizeSymbol(symbol: string): string;

  subscribeToUpdates?(subscription: WebSocketSubscription): () => void;
  supportsWebSocket?(): boolean;

  protected async rateLimitedFetch<T>(
    fetcher: () => Promise<T>
  ): Promise<T> {
    if (!this.config.rateLimit) return fetcher();

    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = 1000 / this.config.rateLimit;

    if (timeSinceLastRequest < minInterval) {
      const delay = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
    this.requestCount++;

    return fetcher();
  }

  protected handleError(error: unknown, context: string): never {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    throw {
      provider: this.config.name,
      message: `${context}: ${errorMessage}`,
      code: (error as { code?: string })?.code,
      statusCode: (error as { response?: { status?: number } })?.response?.status,
    } as MarketDataError;
  }

  get name(): string {
    return this.config.name;
  }

  get type(): string {
    return this.config.type;
  }

  get isEnabled(): boolean {
    return this.config.enabled;
  }
}
