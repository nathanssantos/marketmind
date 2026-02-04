import type { IExchangeFuturesClient } from './futures-client';
import type { IExchangeKlineStream } from './kline-stream';
import type { IExchangePriceStream } from './price-stream';
import type { IExchangeSpotClient } from './spot-client';
import type {
  ExchangeCapabilities,
  ExchangeCredentials,
  ExchangeId,
  MarketHours,
} from './types';
import type { IExchangeUserStream } from './user-stream';

export interface ExchangeProvider {
  readonly exchangeId: ExchangeId;
  readonly capabilities: ExchangeCapabilities;

  createSpotClient(credentials: ExchangeCredentials): IExchangeSpotClient;
  createFuturesClient(credentials: ExchangeCredentials): IExchangeFuturesClient;
  createPriceStream(): IExchangePriceStream;
  createSpotKlineStream(): IExchangeKlineStream;
  createFuturesKlineStream(): IExchangeKlineStream;
  createSpotUserStream(): IExchangeUserStream;
  createFuturesUserStream(): IExchangeUserStream;

  normalizeSymbol(symbol: string): string;
  isMarketOpen(): boolean;
  getMarketHours(): MarketHours;
}

class ExchangeRegistry {
  private providers = new Map<ExchangeId, ExchangeProvider>();

  register(provider: ExchangeProvider): void {
    this.providers.set(provider.exchangeId, provider);
  }

  get(exchangeId: ExchangeId): ExchangeProvider {
    const provider = this.providers.get(exchangeId);
    if (!provider) throw new Error(`Exchange provider '${exchangeId}' not registered`);
    return provider;
  }

  has(exchangeId: ExchangeId): boolean {
    return this.providers.has(exchangeId);
  }

  getAll(): ExchangeProvider[] {
    return Array.from(this.providers.values());
  }
}

export const exchangeRegistry = new ExchangeRegistry();
