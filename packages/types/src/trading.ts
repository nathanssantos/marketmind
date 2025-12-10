import type {
    BinanceAccount,
    BinanceBalance,
    BinanceContingencyType,
    BinanceListOrderStatus,
    BinanceListStatusType,
    BinanceOrderList,
    BinanceOrderSide,
    BinanceOrderStatus,
    BinanceOrderType,
    BinanceTimeInForce,
} from './binance';

export type OrderStatus = BinanceOrderStatus | 'EXPIRED_IN_MATCH' | 'PENDING_NEW';

export type OrderType = BinanceOrderType;

export type OrderSide = BinanceOrderSide;

export type TimeInForce = BinanceTimeInForce;

export type ExpirationType = 'gtc' | 'day' | 'custom';

export type WalletCurrency = 'USD' | 'BRL' | 'EUR' | 'USDT' | 'BTC' | 'ETH';

export type ContingencyType = BinanceContingencyType;

export type ListStatusType = BinanceListStatusType;

export type ListOrderStatus = BinanceListOrderStatus;

/**
 * Exchange-standard order structure (Binance format)
 * Note: In Binance, stop-loss and take-profit are separate orders linked via OrderList (OCO)
 */
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
}

export interface OrderList extends BinanceOrderList {}

export type Balance = BinanceBalance;

export interface Account extends BinanceAccount {}

/**
 * Simulator wallet (extends Account with simulator-specific fields)
 */
export interface Wallet extends Account {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
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

/**
 * Position structure (calculated from filled orders)
 * Not a direct Binance API type, but derived from account orders
 */
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
