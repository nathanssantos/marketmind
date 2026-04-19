import type {
  FuturesAccount,
  FuturesLeverage,
  FuturesOrder,
  FuturesPosition,
  MarginType,
} from '@marketmind/types';
import type { ExchangeId } from './types';

export interface FuturesOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  closePosition?: boolean;
  newClientOrderId?: string;
  newOrderRespType?: 'ACK' | 'RESULT';
}

export interface FuturesAlgoOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP' | 'TAKE_PROFIT' | 'TRAILING_STOP_MARKET';
  quantity?: string;
  triggerPrice?: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  closePosition?: boolean;
  activationPrice?: string;
  callbackRate?: string;
  clientAlgoId?: string;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  priceProtect?: boolean;
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
}

export interface FuturesAlgoOrder {
  algoId: string;
  clientAlgoId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  type: string;
  quantity: string;
  triggerPrice?: string;
  price?: string;
  activationPrice?: string;
  callbackRate?: string;
  algoStatus: string;
  reduceOnly: boolean;
  closePosition: boolean;
  createTime: number;
  updateTime: number;
}

export interface MarginModifyResult {
  amount: string;
  type: number;
  code: number;
  msg: string;
}

export interface IncomeHistoryParams {
  symbol?: string;
  incomeType?: string;
  startTime?: number;
  endTime?: number;
  limit?: number;
}

export interface IncomeHistoryRecord {
  symbol?: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  info: string;
  tranId: number;
  tradeId: string;
}

export interface AccountTradeRecord {
  symbol: string;
  id: number;
  orderId: string;
  side: 'BUY' | 'SELL';
  price: string;
  qty: string;
  realizedPnl: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

export interface ClosingTradeResult {
  price: number;
  realizedPnl: number;
  commission: number;
}

export interface AllTradeFeesResult {
  entryFee: number;
  exitFee: number;
  totalFees: number;
  entryPrice: number;
  exitPrice: number;
  realizedPnl: number;
}

export interface OrderEntryFeeResult {
  entryFee: number;
  avgPrice: number;
  totalQty: number;
}

export interface LeverageBracket {
  bracket: number;
  initialLeverage: number;
  notionalCap: number;
  notionalFloor: number;
  maintMarginRatio: number;
  cum: number;
}

export interface CommissionRate {
  makerCommissionRate: number;
  takerCommissionRate: number;
}

export interface IExchangeFuturesClient {
  readonly exchangeId: ExchangeId;

  getAccountInfo(): Promise<FuturesAccount>;
  getPositions(): Promise<FuturesPosition[]>;
  getPosition(symbol: string): Promise<FuturesPosition | null>;

  setLeverage(symbol: string, leverage: number): Promise<FuturesLeverage>;
  setMarginType(symbol: string, marginType: MarginType): Promise<void>;
  setPositionMode(dualSidePosition: boolean): Promise<void>;
  modifyIsolatedMargin(
    symbol: string,
    amount: number,
    type: 'ADD' | 'REDUCE',
    positionSide?: string
  ): Promise<MarginModifyResult>;

  submitOrder(params: FuturesOrderParams): Promise<FuturesOrder>;
  cancelOrder(symbol: string, orderId: string): Promise<void>;
  cancelAllOrders(symbol: string): Promise<void>;
  getOpenOrders(symbol?: string): Promise<FuturesOrder[]>;
  closePosition(symbol: string, positionAmt: string, stepSize?: string): Promise<FuturesOrder>;

  submitAlgoOrder(params: FuturesAlgoOrderParams): Promise<FuturesAlgoOrder>;
  cancelAlgoOrder(algoId: string): Promise<void>;
  cancelAllAlgoOrders(symbol: string): Promise<void>;
  getOpenAlgoOrders(symbol?: string): Promise<FuturesAlgoOrder[]>;
  getAlgoOrder(algoId: string): Promise<FuturesAlgoOrder | null>;

  getIncomeHistory(params?: IncomeHistoryParams): Promise<IncomeHistoryRecord[]>;
  getRecentTrades(symbol: string, limit?: number): Promise<AccountTradeRecord[]>;
  getLastClosingTrade(
    symbol: string,
    side: 'LONG' | 'SHORT',
    openedAt: number
  ): Promise<ClosingTradeResult | null>;
  getAllTradeFeesForPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    openedAt: number,
    closedAt?: number
  ): Promise<AllTradeFeesResult | null>;
  getOrderEntryFee(symbol: string, orderId: string): Promise<OrderEntryFeeResult | null>;

  getLeverageBrackets(symbol: string): Promise<LeverageBracket[]>;
  getCommissionRate(): Promise<CommissionRate>;
}
