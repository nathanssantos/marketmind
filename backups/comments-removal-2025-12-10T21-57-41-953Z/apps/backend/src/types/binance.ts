export interface BinanceOrderFill {
  price: string;
  qty: string;
  commission: string;
  commissionAsset: string;
  tradeId?: number;
}

export interface BinanceNewOrderResult {
  symbol: string;
  orderId: number;
  orderListId?: number;
  clientOrderId: string;
  transactTime: number;
  price?: string;
  origQty?: string;
  executedQty?: string;
  cummulativeQuoteQty?: string;
  status: string;
  timeInForce?: string;
  type: string;
  side: 'BUY' | 'SELL';
  fills?: BinanceOrderFill[];
  workingTime?: number;
  selfTradePreventionMode?: string;
}

export interface BinanceOrderQueryResult {
  symbol: string;
  orderId: number;
  orderListId?: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: 'BUY' | 'SELL';
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  workingTime?: number;
  origQuoteOrderQty?: string;
  selfTradePreventionMode?: string;
}

export type BinanceOrderSide = 'BUY' | 'SELL';

export type BinanceOrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT'
  | 'LIMIT_MAKER';

export type BinanceOrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED';

export type BinanceTimeInForce = 'GTC' | 'IOC' | 'FOK';
