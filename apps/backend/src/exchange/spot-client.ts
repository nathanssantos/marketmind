import type { ExchangeId } from './types';

export interface SpotOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'LIMIT_MAKER';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface SpotOrderResult {
  orderId: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  status: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  timeInForce?: string;
  time?: number;
  updateTime?: number;
}

export interface CancelOrderResult {
  orderId: number;
  symbol: string;
  status: string;
}

export interface OcoOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopPrice: number;
  stopLimitPrice?: number;
  stopLimitTimeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface OcoOrderResult {
  orderListId: number;
  contingencyType: string;
  listStatusType: string;
  listOrderStatus: string;
  symbol: string;
  orders: Array<{ symbol: string; orderId: number; clientOrderId: string }>;
}

export interface SpotAccountInfo {
  makerCommission: number;
  takerCommission: number;
  canTrade: boolean;
  balances: Array<{ asset: string; free: string; locked: string }>;
}

export interface SpotTradeFees {
  symbol: string;
  makerCommission: number;
  takerCommission: number;
}

export interface IExchangeSpotClient {
  readonly exchangeId: ExchangeId;

  submitOrder(params: SpotOrderParams): Promise<SpotOrderResult>;
  cancelOrder(symbol: string, orderId: number): Promise<CancelOrderResult>;
  getOpenOrders(symbol?: string): Promise<SpotOrderResult[]>;
  getAllOrders(symbol: string, limit?: number): Promise<SpotOrderResult[]>;
  submitOcoOrder(params: OcoOrderParams): Promise<OcoOrderResult>;
  getAccountInfo(): Promise<SpotAccountInfo>;
  getTradeFees(symbol?: string): Promise<SpotTradeFees[]>;
}
