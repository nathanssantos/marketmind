import type { MarketType } from '@marketmind/types';
import type { ExchangeId } from './types';

export interface PriceUpdate {
  symbol: string;
  price: number;
  timestamp: number;
}

export interface IExchangePriceStream {
  readonly exchangeId: ExchangeId;
  start(): void;
  stop(): void;
  subscribe(symbol: string, marketType: MarketType): void | Promise<void>;
  unsubscribe(symbol: string): void;
  isSubscribed(symbol: string): boolean;
  onPriceUpdate(handler: (update: PriceUpdate) => void): void;
}
