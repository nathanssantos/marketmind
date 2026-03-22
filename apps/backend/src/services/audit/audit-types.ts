import type { FuturesOrder } from '@marketmind/types';
import type { wallets, tradeExecutions } from '../../db/schema';
import type { FuturesAlgoOrder } from '../binance-futures-client';

export interface AuditSummary {
  walletId: string;
  fixed: number;
  warnings: string[];
  errors: string[];
  durationMs: number;
}

export type AuditCheck = 'positions' | 'pending' | 'protection' | 'fees' | 'balance' | 'pnl-events';

export const ALL_AUDIT_CHECKS: AuditCheck[] = ['positions', 'pending', 'protection', 'fees', 'balance', 'pnl-events'];

export const FEES_DELTA_THRESHOLD = 0.01;
export const BALANCE_DELTA_THRESHOLD = 1.0;
export const FEES_AUDIT_CAP = 10;
export const FEES_AUDIT_DAYS = 3;
export const PNL_EVENTS_AUDIT_DAYS = 7;
export const PNL_DELTA_THRESHOLD = 0.005;
export const FEES_RATE_LIMIT_MS = 1500;
export const PENDING_GRACE_PERIOD_MS = 5 * 60 * 1000;

export type WalletRecord = typeof wallets.$inferSelect;
export type TradeExecutionRecord = typeof tradeExecutions.$inferSelect;

export interface AuditContext {
  wallet: WalletRecord;
  dryRun: boolean;
  summary: AuditSummary;
  client: ReturnType<typeof import('../binance-futures-client').createBinanceFuturesClient>;
  dbOpenExecutions: TradeExecutionRecord[];
  dbPendingExecutions: TradeExecutionRecord[];
  exchangePositionsBySymbol: Map<string, { symbol: string; positionAmt: string | number; entryPrice: string | number; leverage?: number }>;
  openOrderIds: Set<string>;
  openAlgoOrderIds: Set<string>;
  openOrders: FuturesOrder[];
  openAlgoOrders: FuturesAlgoOrder[];
  linkedAlgoIds: Set<string>;
  accountInfo: { totalWalletBalance: string; availableBalance: string };
}

export function generateExecutionId(): string {
  return `exec-audit-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function findProtectionOrders(
  symbol: string,
  openAlgoOrders: FuturesAlgoOrder[]
): { slAlgoId: string | null; tpAlgoId: string | null } {
  const symbolAlgoOrders = openAlgoOrders.filter(
    (o) => o.symbol === symbol && !o.reduceOnly && !o.closePosition
  );
  const slOrder = symbolAlgoOrders.find((o) => o.type === 'STOP_MARKET');
  const tpOrder = symbolAlgoOrders.find((o) => o.type === 'TAKE_PROFIT_MARKET');
  return {
    slAlgoId: slOrder?.algoId ?? null,
    tpAlgoId: tpOrder?.algoId ?? null,
  };
}

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
