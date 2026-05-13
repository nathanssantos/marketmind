import type { PositionSide, MarketType } from '@marketmind/types';
import type { ReactNode } from 'react';

export interface PortfolioPosition {
  symbol: string;
  side: PositionSide;
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
  marketType?: MarketType;
  isAutoTrade?: boolean;
  count: number;
  leverage: number;
  /** Real entry-side fees already paid (summed across executions in the group). */
  entryFee: number;
}

export interface PortfolioProps {
  headerContent?: ReactNode;
}

export interface NavigateToSymbol {
  (symbol: string, marketType?: MarketType): void;
}
