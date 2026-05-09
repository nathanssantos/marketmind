import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { cancelFuturesAlgoOrder } from '../binance-futures-client';
import { cancelAllProtectionOrders } from '../protection-orders';
import { clearProtectionOrderIds, type ProtectionOrderField } from '../execution-manager';
import { logger, serializeError } from '../logger';
import { closeExecutionAndBroadcast } from '../wallet-broadcast';
import { getWebSocketService } from '../websocket';
import { applyTransferDelta } from '../wallet-balance';
import { isTransferReason } from '../../constants/income-types';

// Tolerance for considering a Binance position-update to be a real
// change vs noise. Same thresholds position-sync uses.
const QTY_TOLERANCE = 0.00001;
const PRICE_TOLERANCE = 0.01;
import type {
  UserStreamContext,
  FuturesAccountUpdate,
  FuturesMarginCall,
  FuturesAccountConfigUpdate,
  FuturesConditionalOrderReject,
} from './types';

export async function handleAccountUpdate(
  ctx: UserStreamContext,
  walletId: string,
  event: FuturesAccountUpdate
): Promise<void> {
  try {
    const { E: eventTime, a: accountData } = event;
    const { m: reason, B: balances, P: positionUpdates } = accountData;

    logger.info(
      {
        walletId,
        reason,
        balanceCount: balances.length,
        positionCount: positionUpdates.length,
      },
      '[FuturesUserStream] Account update received'
    );

    const usdtBalance = balances.find((b) => b.a === 'USDT');
    const wallet = usdtBalance ? await ctx.getCachedWallet(walletId) : null;

    if (usdtBalance && wallet) {
      const newBalance = parseFloat(usdtBalance.wb);
      const previousBalance = wallet.currentBalance ? parseFloat(wallet.currentBalance) : 0;
      const delta = newBalance - previousBalance;

      ctx.invalidateWalletCache(walletId);

      if (isTransferReason(reason) && delta !== 0) {
        await applyTransferDelta({
          walletId,
          userId: wallet.userId,
          asset: 'USDT',
          deltaAmount: delta,
          eventTime: eventTime ?? Date.now(),
          reason,
          newBalance,
        });
      } else {
        await db
          .update(wallets)
          .set({
            currentBalance: newBalance.toString(),
            updatedAt: new Date(),
          })
          .where(eq(wallets.id, walletId));

        logger.trace(
          { walletId, newBalance, reason },
          '[FuturesUserStream] Wallet balance synced from account update'
        );
      }
    }

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitWalletUpdate(walletId, { reason, balances, positions: positionUpdates });
    }

    // Position drift sync: ACCOUNT_UPDATE carries the live qty/entryPrice
    // for every position that changed. Loop and reconcile against our
    // tradeExecutions table — covers manual pyramid / manual close /
    // reduce-only fills done outside MarketMind that handleOrderUpdate
    // can't classify (those don't get an ORDER_TRADE_UPDATE). Without
    // this sync, DB drifts and only resolves on the periodic
    // positionSyncService run (30s).
    if (positionUpdates.length > 0 && !!ctx.connections.get(walletId)) {
      await syncPositionsFromAccountUpdate(walletId, positionUpdates);
    }
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling account update'
    );
  }
}

/**
 * Reconcile open tradeExecutions against the live position state from
 * a Binance ACCOUNT_UPDATE event. For each Binance position:
 *
 *   - `pa === 0` (flat) AND we have an open exec for the symbol →
 *     route through `closeExecutionAndBroadcast` so the renderer's
 *     close cascade fires. Without this, manual closes done via
 *     Binance's UI leave the exec open in our DB until the periodic
 *     position-sync run picks them up.
 *
 *   - `pa` or `ep` drift beyond tolerance → patch the exec quantity /
 *     entryPrice and emit `position:update`. Catches manual pyramid,
 *     reduce-only fills outside MarketMind.
 *
 * The function is idempotent — concurrent ACCOUNT_UPDATEs within ms of
 * each other reach the same end state because the close path uses a
 * status-guarded UPDATE and the patch path applies tolerances.
 */
async function syncPositionsFromAccountUpdate(
  walletId: string,
  positionUpdates: FuturesAccountUpdate['a']['P'],
): Promise<void> {
  const wsService = getWebSocketService();

  for (const pos of positionUpdates) {
    try {
      const symbol = pos.s;
      const exchangeQty = parseFloat(pos.pa);
      const exchangeAbsQty = Math.abs(exchangeQty);
      const exchangeEntryPrice = parseFloat(pos.ep);

      // Determine the side we'd be looking up for this symbol's open
      // exec. Binance's one-way mode reports ps='BOTH'; hedge mode
      // reports 'LONG' / 'SHORT'. We support one-way mode primarily,
      // so use the sign of `pa` as the canonical side. If the exec
      // is flat (pa=0), we don't know which side closed — query for
      // ANY open exec on this symbol.
      const closingSide = exchangeQty === 0
        ? null
        : (exchangeQty > 0 ? 'LONG' : 'SHORT');

      const openExecs = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES'),
          ),
        );

      if (openExecs.length === 0) {
        // No DB exec to reconcile. If exchange has a position we
        // didn't track, position-sync's "unknownPositions" path will
        // handle it on the next run — out of scope here.
        continue;
      }

      // Flat on exchange → close every matching open exec. Use the
      // side filter when we have a previous side hint; otherwise
      // close all open execs on this symbol (rare; happens when our
      // ACCOUNT_UPDATE arrives after a flip + close in quick
      // succession).
      if (exchangeAbsQty === 0) {
        for (const exec of openExecs) {
          // We don't know exit_price from ACCOUNT_UPDATE alone;
          // pnl=0 is a placeholder. The handleExitFill path that
          // arrives in the same event burst computes the real PnL.
          // The status-guarded UPDATE in closeExecutionAndBroadcast
          // means whichever path wins, the OTHER one becomes a
          // no-op (closed: false return).
          await closeExecutionAndBroadcast(exec, {
            exitPrice: null,
            exitReason: 'EXCHANGE_FLAT',
            exitSource: 'EXCHANGE_SYNC',
            pnl: 0,
            pnlPercent: 0,
          });
        }
        continue;
      }

      // Non-zero on exchange — find the open exec matching the side
      // and reconcile qty/entryPrice if drift exceeds tolerance.
      const matchingExec = openExecs.find((e) => e.side === closingSide);
      if (!matchingExec) continue;

      const dbQty = parseFloat(matchingExec.quantity);
      const dbEntryPrice = parseFloat(matchingExec.entryPrice);
      const qtyChanged = Math.abs(dbQty - exchangeAbsQty) > QTY_TOLERANCE;
      const priceChanged = Math.abs(dbEntryPrice - exchangeEntryPrice) > PRICE_TOLERANCE;

      if (!qtyChanged && !priceChanged) continue;

      const updated = await db
        .update(tradeExecutions)
        .set({
          ...(qtyChanged ? { quantity: exchangeAbsQty.toString() } : {}),
          ...(priceChanged ? { entryPrice: exchangeEntryPrice.toString() } : {}),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(tradeExecutions.id, matchingExec.id),
            eq(tradeExecutions.status, 'open'),
          ),
        )
        .returning();

      logger.info(
        {
          walletId,
          symbol,
          executionId: matchingExec.id,
          dbQty,
          exchangeQty: exchangeAbsQty,
          dbEntryPrice,
          exchangeEntryPrice,
          qtyChanged,
          priceChanged,
        },
        '[FuturesUserStream] Reconciled exec qty/entryPrice from ACCOUNT_UPDATE',
      );

      if (wsService && updated[0]) {
        wsService.emitPositionUpdate(walletId, updated[0]);
      }
    } catch (err) {
      logger.error(
        { walletId, symbol: pos.s, error: serializeError(err) },
        '[FuturesUserStream] Failed to sync position from ACCOUNT_UPDATE',
      );
    }
  }
}

export async function handleMarginCall(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesMarginCall
): Promise<void> {
  try {
    const { cw: crossWalletBalance, p: positionsAtRisk } = event;

    logger.warn(
      {
        walletId,
        crossWalletBalance,
        positionsAtRiskCount: positionsAtRisk.length,
      },
      '[FuturesUserStream] ! MARGIN CALL received'
    );

    const wsService = getWebSocketService();
    if (wsService) {
      for (const pos of positionsAtRisk) {
        wsService.emitRiskAlert(walletId, {
          type: 'LIQUIDATION_RISK',
          level: 'critical',
          positionId: undefined,
          symbol: pos.s,
          message: `Margin call: ${pos.s} at risk. Maintenance margin: ${pos.mm}, Mark price: ${pos.mp}`,
          data: {
            symbol: pos.s,
            positionSide: pos.ps,
            positionAmount: pos.pa,
            marginType: pos.mt,
            isolatedWallet: pos.iw,
            markPrice: pos.mp,
            unrealizedPnl: pos.up,
            maintenanceMargin: pos.mm,
          },
          timestamp: Date.now(),
        });
      }
    }
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling margin call'
    );
  }
}

export function handleConfigUpdate(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesAccountConfigUpdate
): void {
  if (event.ac) {
    const newLeverage = event.ac.l;
    const symbol = event.ac.s;
    logger.info(
      { walletId, symbol, leverage: newLeverage },
      '[FuturesUserStream] Leverage updated'
    );

    void db.update(tradeExecutions)
      .set({ leverage: newLeverage })
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      )
      .returning()
      .then((updatedRows) => {
        logger.info({ walletId, symbol, newLeverage, rowsUpdated: updatedRows.length }, '[FuturesUserStream] Updated leverage on open executions');
        const wsService = getWebSocketService();
        if (wsService) {
          for (const row of updatedRows) {
            wsService.emitPositionUpdate(walletId, row);
          }
        }
      })
      .catch((err) => {
        logger.error({ walletId, symbol, error: serializeError(err) }, '[FuturesUserStream] Failed to update leverage on open executions');
      });
  }

  if (event.ai) {
    logger.info(
      {
        walletId,
        multiAssetMode: event.ai.j,
      },
      '[FuturesUserStream] Multi-asset mode updated'
    );
  }
}

export async function handleConditionalOrderReject(
  _ctx: UserStreamContext,
  walletId: string,
  event: FuturesConditionalOrderReject
): Promise<void> {
  const { or: orderReject } = event;
  const { s: symbol, i: orderId, r: reason } = orderReject;

  try {
    const [pendingEntry] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.entryOrderId, String(orderId))
        )
      )
      .limit(1);

    if (pendingEntry) {
      await db
        .update(tradeExecutions)
        .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
        .where(eq(tradeExecutions.id, pendingEntry.id));
      logger.warn(
        { walletId, symbol, orderId, reason },
        '[FuturesUserStream] Entry conditional order rejected — pending execution cancelled'
      );
      return;
    }
  } catch (error) {
    logger.error({ walletId, orderId, error: serializeError(error) }, '[FuturesUserStream] Error checking entry execution for conditional reject');
  }

  logger.error(
    {
      walletId,
      symbol,
      orderId,
      reason,
    },
    '[FuturesUserStream] ! CRITICAL: Conditional order (TP/SL) was REJECTED'
  );

  const wsService = getWebSocketService();
  if (wsService) {
    wsService.emitRiskAlert(walletId, {
      type: 'ORDER_REJECTED',
      level: 'critical',
      symbol,
      message: `TP/SL order rejected: ${reason}`,
      data: { orderId, reason },
      timestamp: Date.now(),
    });
  }

  try {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      )
      .limit(1);

    if (execution) {
      const rejectOrderIdStr = String(orderId);
      const isSLReject = execution.stopLossOrderId === rejectOrderIdStr || execution.stopLossAlgoId === rejectOrderIdStr;
      const isTPReject = execution.takeProfitOrderId === rejectOrderIdStr || execution.takeProfitAlgoId === rejectOrderIdStr;

      if (isSLReject || isTPReject) {
        const field: ProtectionOrderField = isSLReject ? 'stopLoss' : 'takeProfit';
        await clearProtectionOrderIds(execution.id, field);

        logger.error(
          {
            executionId: execution.id,
            symbol,
            orderId,
            isSLReject,
            isTPReject,
            reason,
            clearedField: field,
          },
          '[FuturesUserStream] ! CRITICAL: Position protection order REJECTED - IDs cleared, MANUAL INTERVENTION REQUIRED'
        );
      }
    }
  } catch (error) {
    logger.error(
      { walletId, orderId, error: serializeError(error) },
      '[FuturesUserStream] Error handling conditional order reject'
    );
  }
}

export async function cancelPendingEntryOrders(
  ctx: UserStreamContext,
  walletId: string,
  symbol: string,
  closedExecutionId: string
): Promise<void> {
  try {
    const pendingEntries = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    if (pendingEntries.length === 0) {
      logger.trace({ walletId, symbol, closedExecutionId }, '[FuturesUserStream] No pending entries to cancel after close');
      return;
    }

    const apiClient = ctx.connections.get(walletId)?.apiClient;
    const walletRow = await ctx.getCachedWallet(walletId);

    for (const pending of pendingEntries) {
      if (apiClient && pending.entryOrderId) {
        try {
          const entryOrderType = pending.entryOrderType;
          const isAlgoEntry = entryOrderType === 'STOP_MARKET' || entryOrderType === 'TAKE_PROFIT_MARKET';
          if (isAlgoEntry) {
            await cancelFuturesAlgoOrder(apiClient, pending.entryOrderId);
          } else {
            await apiClient.cancelOrder({ symbol, orderId: Number(pending.entryOrderId) });
          }
          logger.info({ walletId, symbol, entryOrderId: pending.entryOrderId, isAlgoEntry }, '[FuturesUserStream] Cancelled pending entry order');
        } catch (cancelErr) {
          const msg = serializeError(cancelErr);
          if (!msg.includes('Unknown order') && !msg.includes('Order does not exist') && !msg.includes('not found'))
            {logger.warn({ walletId, symbol, entryOrderId: pending.entryOrderId, error: msg }, '[FuturesUserStream] Failed to cancel pending entry order on exchange');}
        }
      }

      if (walletRow && (pending.stopLossAlgoId || pending.stopLossOrderId || pending.takeProfitAlgoId || pending.takeProfitOrderId)) {
        await cancelAllProtectionOrders({
          wallet: walletRow,
          symbol,
          marketType: 'FUTURES',
          stopLossAlgoId: pending.stopLossAlgoId,
          stopLossOrderId: pending.stopLossOrderId,
          takeProfitAlgoId: pending.takeProfitAlgoId,
          takeProfitOrderId: pending.takeProfitOrderId,
        });
      }

      await db.update(tradeExecutions).set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() }).where(eq(tradeExecutions.id, pending.id));
      logger.info({ walletId, symbol, executionId: pending.id, closedExecutionId }, '[FuturesUserStream] Cancelled pending entry execution after position close');
    }
  } catch (error) {
    logger.error(
      { walletId, symbol, closedExecutionId, error: serializeError(error) },
      '[FuturesUserStream] Failed to cancel pending entry orders'
    );
  }
}
