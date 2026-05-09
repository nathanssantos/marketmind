import { and, eq, sql } from 'drizzle-orm';
import { tradeExecutions, type tradeExecutions as tradeExecutionsTable } from '../db/schema';
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

interface CloseExecutionPatch {
  exitPrice: number | null;
  exitReason: string;
  // Free-form by design — the schema column is varchar(50) and we use
  // multiple narrative tags (ALGORITHM, MANUAL, SYNC, EXCHANGE_SYNC,
  // OPPORTUNITY_COST, ALGO_VERIFICATION). Each call site picks the
  // value that best describes what triggered the close.
  exitSource: string;
  pnl: number;
  pnlPercent: number;
  fees?: number;
  entryFee?: number;
  exitFee?: number;
  exitOrderId?: string | null;
  partialClosePnl?: number;
}

interface CloseExecutionResult {
  /** True when the exec was newly closed by this call. False on race-loss. */
  closed: boolean;
  /** Authoritative wallet balance after the increment, when broadcast fired. */
  walletBalance: WalletBroadcastResult | null;
}

/**
 * Single canonical "close a tradeExecution" operation.
 *
 * Every site that wants to mark an exec as closed MUST go through this
 * helper. It consolidates the three-step ritual that was duplicated
 * across position-monitor, auto-trading emergency stop, manual close
 * mutations, paper close, etc. — and which silently dropped one or
 * more emits in 5 of the 6 sites we audited:
 *
 *   1. UPDATE tradeExecutions SET status='closed', ... WHERE id=? AND status='open'
 *      (status guard makes concurrent closes safe — only one wins)
 *   2. If we won the race, increment wallet balance + emit `wallet:update`
 *      (skipped when delta is 0 — see incrementWalletBalanceAndBroadcast)
 *   3. Emit `order:update` (status=closed) + `position:closed` so the
 *      renderer cascade fires (close in-cache + invalidate analytics)
 *
 * Returns `{ closed: false }` when another process already closed the
 * exec (e.g. position-sync raced the user-stream handler). Callers
 * should branch on this — log/skip downstream side effects like
 * cancelling protection orders that the winner already handled.
 *
 * Toasts (`emitTradeNotification`) are deliberately NOT included here
 * because they have UX-specific copy that varies by exit source. Call
 * the toast helper inline AFTER `closeExecutionAndBroadcast` returns
 * `closed: true`.
 */
export const closeExecutionAndBroadcast = async (
  execution: ExecutionRow,
  patch: CloseExecutionPatch,
): Promise<CloseExecutionResult> => {
  const closeResult = await db
    .update(tradeExecutions)
    .set({
      status: 'closed',
      exitPrice: patch.exitPrice !== null ? patch.exitPrice.toString() : null,
      exitReason: patch.exitReason,
      exitSource: patch.exitSource,
      pnl: patch.pnl.toString(),
      pnlPercent: patch.pnlPercent.toString(),
      ...(patch.fees !== undefined ? { fees: patch.fees.toString() } : {}),
      ...(patch.entryFee !== undefined ? { entryFee: patch.entryFee.toString() } : {}),
      ...(patch.exitFee !== undefined ? { exitFee: patch.exitFee.toString() } : {}),
      ...(patch.exitOrderId !== undefined ? { exitOrderId: patch.exitOrderId } : {}),
      ...(patch.partialClosePnl !== undefined
        ? { partialClosePnl: patch.partialClosePnl.toString() }
        : {}),
      stopLossAlgoId: null,
      stopLossOrderId: null,
      takeProfitAlgoId: null,
      takeProfitOrderId: null,
      closedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(tradeExecutions.id, execution.id),
        eq(tradeExecutions.status, 'open'),
      ),
    )
    .returning({ id: tradeExecutions.id });

  if (closeResult.length === 0) {
    logger.info(
      { executionId: execution.id, symbol: execution.symbol, exitSource: patch.exitSource },
      '[closeExecutionAndBroadcast] Already closed by another process — skipping wallet broadcast and emit',
    );
    return { closed: false, walletBalance: null };
  }

  // Audit log — every successful close passes through here. After
  // shipping this helper, grep'ing this line confirms no silent paths
  // remain in production. See plan: "monitor for absence of this log
  // entry on a close path; spike means a regression."
  logger.info(
    {
      executionId: execution.id,
      walletId: execution.walletId,
      symbol: execution.symbol,
      exitSource: patch.exitSource,
      exitReason: patch.exitReason,
      pnl: patch.pnl,
    },
    '[closeExecutionAndBroadcast] Closed exec',
  );

  // Wallet broadcast: fires `wallet:update` so the renderer patches
  // wallet.list in the same render frame. The helper itself is a no-op
  // when delta is 0, returning null — that's fine for SYNC_INCOMPLETE-
  // style closes that don't move balance.
  const walletBalance = patch.pnl !== 0
    ? await incrementWalletBalanceAndBroadcast(execution.walletId, patch.pnl)
    : null;

  // Close trio: order:update (status=closed) + position:closed. Drives
  // markExecutionClosedInAllCaches on the renderer, which patches both
  // getTradeExecutions and getActiveExecutions caches in the same frame
  // and schedules wallet/setupStats/equityCurve invalidation.
  emitPositionClosedEvents({
    walletId: execution.walletId,
    execution,
    symbol: execution.symbol,
    exitPrice: patch.exitPrice ?? 0,
    pnl: patch.pnl,
    pnlPercent: patch.pnlPercent,
    exitReason: patch.exitReason,
  });

  return { closed: true, walletBalance };
};
