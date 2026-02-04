import type { MarketType } from './futures';

export type OrderSide = 'BUY' | 'SELL';

export type OrderType =
  | 'LIMIT'
  | 'MARKET'
  | 'STOP_LOSS'
  | 'STOP_LOSS_LIMIT'
  | 'TAKE_PROFIT'
  | 'TAKE_PROFIT_LIMIT'
  | 'LIMIT_MAKER';

export type OrderStatus =
  | 'NEW'
  | 'PARTIALLY_FILLED'
  | 'FILLED'
  | 'CANCELED'
  | 'PENDING_CANCEL'
  | 'REJECTED'
  | 'EXPIRED'
  | 'EXPIRED_IN_MATCH'
  | 'PENDING_NEW';

export type TimeInForce = 'GTC' | 'IOC' | 'FOK';

export type ExpirationType = 'gtc' | 'day' | 'custom';

export type WalletCurrency = 'USD' | 'USDT' | 'BRL' | 'EUR' | 'BTC' | 'ETH';

export type ContingencyType = 'OCO' | 'OTO' | 'OTOCO';

export type ListStatusType = 'RESPONSE' | 'EXEC_STARTED' | 'ALL_DONE';

export type ListOrderStatus = 'EXECUTING' | 'ALL_DONE' | 'REJECT';

export interface Order {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: OrderStatus;
  timeInForce: TimeInForce;
  type: OrderType;
  side: OrderSide;
  stopPrice?: string;
  icebergQty?: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
  workingTime?: number;
  selfTradePreventionMode?: string;
  
  walletId?: string;
  setupId?: string;
  setupType?: string;
  setupDirection?: 'LONG' | 'SHORT';
  setupConfidence?: number;
  entryFee?: string;
  exitFee?: string;
  totalFees?: string;
  netPnl?: string;
  netPnlPercent?: string;
  pnl?: string;
  pnlPercent?: string;
  
  id?: string;
  createdAt?: Date;
  filledAt?: Date;
  closedAt?: Date;
  expirationDate?: Date;
  expiresAt?: number;
  currentPrice?: number;
  exitPrice?: number;
  entryPrice?: number;
  quantity?: number;
  orderDirection?: 'long' | 'short';
  commission?: number;
  commissionRate?: number;
  stopLoss?: number;
  takeProfit?: number;

  isAutoTrade?: boolean;
  mlConfidence?: number;
  marketType?: MarketType;
}

export interface OrderList {
  orderListId: number;
  contingencyType: ContingencyType;
  listStatusType: ListStatusType;
  listOrderStatus: ListOrderStatus;
  listClientOrderId: string;
  transactionTime: number;
  symbol: string;
  orders: Array<{
    symbol: string;
    orderId: number;
    clientOrderId: string;
  }>;
}

export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface Account {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  commissionRates: {
    maker: string;
    taker: string;
    buyer: string;
    seller: string;
  };
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  brokered: boolean;
  requireSelfTradePrevention: boolean;
  preventSor: boolean;
  updateTime: number;
  accountType: 'SPOT' | 'MARGIN' | 'FUTURES';
  balances: Balance[];
  permissions: string[];
  uid?: number;
}

export interface Wallet extends Account {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  currency: WalletCurrency;
  createdAt: number | Date;
  performance: WalletPerformancePoint[];
}

export interface WalletPerformancePoint {
  openTime: number | Date;
  balance: number;
  pnl: number;
  pnlPercent: number;
}

export interface Position {
  symbol: string;
  side?: 'LONG' | 'SHORT';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  unrealizedPnl?: string;
  unrealizedPnlPercent?: string;
  realizedPnl?: string;
  realizedPnlPercent?: string;
  pnl: number;
  pnlPercent: number;
  orderIds?: number[];
  orderListId?: number;
  orders: string[];
}

export interface OrderCreateParams {
  walletId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: TimeInForce;
  clientOrderId?: string;
}

export interface OrderUpdateParams {
  stopPrice?: string;
  price?: string;
  quantity?: string;
}

export interface WalletCreateParams {
  name: string;
  initialBalance: number;
  currency: WalletCurrency;
}
