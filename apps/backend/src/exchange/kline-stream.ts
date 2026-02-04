import type { Kline, MarketType } from '@marketmind/types';
import type { ExchangeId } from './types';

export interface KlineUpdate {
  symbol: string;
  interval: string;
  marketType: MarketType;
  kline: Kline;
  isClosed: boolean;
}

export interface IExchangeKlineStream {
  readonly exchangeId: ExchangeId;
  start(): void;
  stop(): void;
  subscribe(symbol: string, interval: string): void;
  unsubscribe(symbol: string, interval: string): void;
  getSubscriptionCount(): number;
  onKlineUpdate(handler: (update: KlineUpdate) => void): void;
}
