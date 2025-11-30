export type OrderType = 'long' | 'short';
export type OrderSubType = 'limit' | 'stop';
export type OrderStatus =
  | 'pending'
  | 'active'
  | 'filled'
  | 'cancelled'
  | 'expired'
  | 'closed';
export type ExpirationType = 'day' | 'gtc' | 'custom';
export type WalletCurrency = 'USD' | 'BRL' | 'EUR';

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  initialBalance: number;
  currency: WalletCurrency;
  createdAt: Date;
  performance: WalletPerformancePoint[];
}

export interface WalletPerformancePoint {
  timestamp: Date;
  balance: number;
  pnl: number;
  pnlPercent: number;
}

export interface Order {
  id: string;
  walletId: string;
  symbol: string;
  type: OrderType;
  subType: OrderSubType;
  status: OrderStatus;
  quantity: number;
  entryPrice: number;
  currentPrice?: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
  expiresAt?: number;
  commissionRate?: number;
  createdAt: Date;
  filledAt?: Date;
  closedAt?: Date;
  pnl?: number;
  pnlPercent?: number;
  commission?: number;
  setupId?: string;
  setupType?: string;
  setupDirection?: 'LONG' | 'SHORT';
  setupConfidence?: number;
  metadata?: {
    isPosition?: boolean;
    positionData?: {
      symbol: string;
      type: 'long' | 'short';
      avgPrice: number;
      totalQuantity: number;
      totalPnL: number;
      orders: Order[];
    };
  };
}

export interface Position {
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  orders: string[];
}

export interface OrderCreateParams {
  walletId: string;
  symbol: string;
  type: OrderType;
  quantity: number;
  price: number;
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
}

export interface OrderUpdateParams {
  stopLoss?: number;
  takeProfit?: number;
  expirationDate?: Date;
}

export interface WalletCreateParams {
  name: string;
  initialBalance: number;
  currency: WalletCurrency;
}
