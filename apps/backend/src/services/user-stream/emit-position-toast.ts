import type { PositionSide, TradeNotificationPayload } from '@marketmind/types';

interface ToastEmitter {
  emitTradeNotification(walletId: string, payload: TradeNotificationPayload): void;
}

export interface PositionCloseToastInput {
  executionId: string;
  symbol: string;
  side: PositionSide;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string;
  source?: 'EXIT_FILL' | 'ALGO_VERIFY' | 'ORPHAN_CLEANUP' | 'UNTRACKED_FILL' | 'MANUAL';
}

const REASON_LABELS: Record<string, string> = {
  STOP_LOSS: 'Stop Loss',
  TAKE_PROFIT: 'Take Profit',
  TRAILING_STOP: 'Trailing Stop',
  LIQUIDATION: 'Liquidation',
  MANUAL: 'Manual close',
  REDUCE_ORDER: 'Reduce order',
  ALGO_VERIFICATION: 'Stop Loss',
  RECONCILED: 'Reconciled close',
};

const SOURCE_SUFFIX: Record<NonNullable<PositionCloseToastInput['source']>, string> = {
  EXIT_FILL: '',
  ALGO_VERIFY: ' (verified)',
  ORPHAN_CLEANUP: ' (orphan cleanup)',
  UNTRACKED_FILL: ' (reconciled)',
  MANUAL: '',
};

export function buildPositionClosedToast(input: PositionCloseToastInput): TradeNotificationPayload {
  const { executionId, symbol, side, exitPrice, pnl, pnlPercent, exitReason, source = 'EXIT_FILL' } = input;
  const isProfit = pnl >= 0;
  const reasonLabel = REASON_LABELS[exitReason] ?? exitReason;
  const suffix = SOURCE_SUFFIX[source];
  const urgency: TradeNotificationPayload['urgency'] = exitReason === 'LIQUIDATION' ? 'critical' : 'normal';

  return {
    type: 'POSITION_CLOSED',
    title: `${reasonLabel} hit · ${symbol}${suffix}`,
    body: `${side} closed at ${exitPrice.toFixed(2)} · ${isProfit ? '+' : ''}${pnl.toFixed(2)} (${isProfit ? '+' : ''}${pnlPercent.toFixed(2)}%)`,
    urgency,
    data: {
      executionId,
      symbol,
      side,
      exitPrice: exitPrice.toString(),
      pnl: pnl.toString(),
      pnlPercent: pnlPercent.toString(),
      exitReason,
    },
  };
}

export function emitPositionClosedToast(
  wsService: ToastEmitter,
  walletId: string,
  input: PositionCloseToastInput,
): void {
  wsService.emitTradeNotification(walletId, buildPositionClosedToast(input));
}

export interface PositionOpenedToastInput {
  executionId: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  quantity: number;
  source?: 'LIMIT_FILL' | 'MANUAL_FILL';
}

const OPEN_SOURCE_SUFFIX: Record<NonNullable<PositionOpenedToastInput['source']>, string> = {
  LIMIT_FILL: '',
  MANUAL_FILL: ' (manual)',
};

export function buildPositionOpenedToast(input: PositionOpenedToastInput): TradeNotificationPayload {
  const { executionId, symbol, side, entryPrice, quantity, source = 'LIMIT_FILL' } = input;
  const suffix = OPEN_SOURCE_SUFFIX[source];

  return {
    type: 'POSITION_OPENED',
    title: `Position opened · ${symbol}${suffix}`,
    body: `${side} · qty ${quantity} @ ${entryPrice.toFixed(2)}`,
    urgency: 'normal',
    data: {
      executionId,
      symbol,
      side,
      entryPrice: entryPrice.toString(),
    },
  };
}

export function emitPositionOpenedToast(
  wsService: ToastEmitter,
  walletId: string,
  input: PositionOpenedToastInput,
): void {
  wsService.emitTradeNotification(walletId, buildPositionOpenedToast(input));
}
