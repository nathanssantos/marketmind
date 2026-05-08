import { eq, sql } from 'drizzle-orm';
import type { tradeExecutions as tradeExecutionsTable } from '../db/schema';
import { wallets } from '../db/schema';
import { db } from '../db';
import { logger } from './logger';
import { getWebSocketService } from './websocket';

type ExecutionRow = typeof tradeExecutionsTable.$inferSelect;

interface WalletBroadcastResult {
  currentBalance: string;
  totalWalletBalance: string | null;
}

/**
 * Atomic wallet-balance increment + WS broadcast in one call.
 *
 * Every place that mutates `wallets.currentBalance` after a position /
 * order event also needs to push a `wallet:update` to connected
 * clients — otherwise the renderer's `wallet.list` cache stays stale
 * until the next user-stream `ACCOUNT_UPDATE` arrives (which can be
 * 200-500ms behind the order-trade-update, sometimes more during
 * reconnect storms). For paper paths there is no Binance event AT
 * ALL, so the renderer would wait for the debounced ~250ms cache
 * invalidation + tRPC round-trip ≈ 400-600ms of stale capital.
 *
 * This helper unifies the two operations so future mutations can't
 * silently forget the broadcast (a recurring source of perceived
 * "lag" between an SL/TP fill and the ticket reflecting the freed
 * capital).
 *
 * The DB update uses `RETURNING` so the broadcast carries the
 * authoritative post-increment balance — no second SELECT.
 */
export const incrementWalletBalanceAndBroadcast = async (
  walletId: string,
  delta: number,
): Promise<WalletBroadcastResult | null> => {
  if (delta === 0) {
    // No-op increment, no event. Caller intent was already a balance
    // change; if they pass 0 it's a paper-flat-close edge case where
    // we still want symmetric return shape.
    return null;
  }

  const [updated] = await db
    .update(wallets)
    .set({
      currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${delta}`,
      totalWalletBalance: sql`CAST(COALESCE(${wallets.totalWalletBalance}, ${wallets.currentBalance}) AS DECIMAL(20,8)) + ${delta}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId))
    .returning({
      currentBalance: wallets.currentBalance,
      totalWalletBalance: wallets.totalWalletBalance,
    });

  if (!updated) {
    logger.warn({ walletId, delta }, '[wallet-broadcast] update returned no rows');
    return null;
  }

  const wsService = getWebSocketService();
  if (wsService && updated.currentBalance) {
    // Frontend's `mergeWalletBalanceUpdate` accepts the flat patch
    // shape (`{ currentBalance, totalWalletBalance }`) AND the
    // Binance USER_DATA shape (`{ balances: [...] }`). We send the
    // flat shape — there's no Binance balance delta to forward.
    wsService.emitWalletUpdate(walletId, {
      currentBalance: updated.currentBalance,
      totalWalletBalance: updated.totalWalletBalance,
    });
  }

  return {
    currentBalance: updated.currentBalance ?? '0',
    totalWalletBalance: updated.totalWalletBalance,
  };
};

interface PositionClosedEventOptions {
  walletId: string;
  execution: ExecutionRow;
  exitPrice: number;
  pnl: number;
  pnlPercent: number;
  exitReason: string | null | undefined;
  /** When omitted, uses `execution.symbol`. */
  symbol?: string;
}

/**
 * Single-call broadcast of the WS events that fire together when a
 * position closes:
 *
 *   - `order:update`     (status: closed)  — keeps order tables in sync
 *   - `position:closed`                    — drives the close cascade
 *                                             (markExecutionClosedInAllCaches +
 *                                             wallet/setupStats/equityCurve
 *                                             invalidation schedule)
 *
 * The earlier shape also emitted `position:update` with status='closed'
 * but the renderer's position:update handler short-circuits when
 * status='closed' (PR #492) since position:closed runs the canonical
 * mark-closed path. The renderer-side cache merge for position:closed
 * now writes exitPrice too, so the position:update emit is pure
 * waste — one extra socket frame per close, multiplied by N siblings
 * on DCA close-all paths.
 */
export const emitPositionClosedEvents = (opts: PositionClosedEventOptions): void => {
  const wsService = getWebSocketService();
  if (!wsService) return;

  const symbol = opts.symbol ?? opts.execution.symbol;
  const exitPriceStr = opts.exitPrice.toString();
  const pnlStr = opts.pnl.toString();
  const pnlPercentStr = opts.pnlPercent.toString();

  wsService.emitOrderUpdate(opts.walletId, {
    id: opts.execution.id,
    symbol,
    status: 'closed',
    exitPrice: exitPriceStr,
    pnl: pnlStr,
    pnlPercent: pnlPercentStr,
    exitReason: opts.exitReason,
  });

  wsService.emitPositionClosed(opts.walletId, {
    positionId: opts.execution.id,
    symbol,
    side: opts.execution.side,
    exitReason: opts.exitReason ?? 'UNKNOWN',
    pnl: opts.pnl,
    pnlPercent: opts.pnlPercent,
    exitPrice: opts.exitPrice,
  });
};
