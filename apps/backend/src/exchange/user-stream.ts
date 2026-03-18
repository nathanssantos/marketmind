import type { Wallet } from '../db/schema';
import type { ExchangeId } from './types';

export interface OrderFillEvent {
  walletId: string;
  symbol: string;
  orderId: string;
  side: 'BUY' | 'SELL';
  status: string;
  price: number;
  quantity: number;
  commission: number;
  commissionAsset: string;
  realizedPnl?: number;
  executionType: string;
}

export interface AccountUpdateEvent {
  walletId: string;
  balances: Array<{ asset: string; balance: string }>;
  positions: Array<{
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    unrealizedPnl: string;
  }>;
}

export interface IExchangeUserStream {
  readonly exchangeId: ExchangeId;
  subscribeWallet(wallet: Wallet): Promise<void>;
  unsubscribeWallet(walletId: string): void;
  resubscribeWallet(wallet: Wallet): Promise<void>;
  isSubscribed(walletId: string): boolean;
  onOrderFill(handler: (event: OrderFillEvent) => void): void;
  onAccountUpdate(handler: (event: AccountUpdateEvent) => void): void;
}
