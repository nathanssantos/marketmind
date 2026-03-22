import type { ReactNode } from 'react';

export interface PortfolioPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  setupType?: string;
  openedAt: Date;
  id: string;
  status: 'open' | 'pending';
  limitEntryPrice?: number;
  expiresAt?: Date;
  marketType?: 'SPOT' | 'FUTURES';
  isAutoTrade?: boolean;
  count: number;
  leverage: number;
}

export interface PortfolioProps {
  headerContent?: ReactNode;
}

export interface NavigateToSymbol {
  (symbol: string, marketType?: 'SPOT' | 'FUTURES'): void;
}
