import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { orders, tradeExecutions } from '../../db/schema';
import { getOrderEntryFee, getPosition } from '../binance-futures-client';
import { createStopLossOrder, createTakeProfitOrder } from '../protection-orders';
import { logger, serializeError } from '../logger';
import { getWebSocketService } from '../websocket';
import type { UserStreamContext } from './types';
import { emitPositionOpenedToast } from './emit-position-toast';

export async function handlePendingFill(
  ctx: UserStreamContext,
  walletId: string,
  pendingExecution: typeof tradeExecutions.$inferSelect,
  symbol: string,
  _orderSide: 'BUY' | 'SELL',
  orderId: number,
  avgPrice: string,
  lastFilledPrice: string,
  executedQty: string,
  commission: string,
  commissionAsset: string,
): Promise<void> {
  const fillPrice = parseFloat(avgPrice || lastFilledPrice);
  const fillQty = parseFloat(executedQty || pendingExecution.quantity);
  let entryFee = parseFloat(commission || '0');

  try {
    const connection = ctx.connections.get(walletId);
    if (connection) {
      const feeResult = await getOrderEntryFee(connection.apiClient, symbol, String(orderId));
      if (feeResult && feeResult.entryFee > 0) entryFee = feeResult.entryFee;
    }
  } catch (_e) { /* entry fee fetch is best-effort */ }

  const [existingOpen] = await db
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

  if (existingOpen?.side === pendingExecution.side) {
    await ctx.withPyramidLock(walletId, symbol, async () => {
      await ctx.mergeIntoExistingPosition(walletId, symbol, existingOpen.id, fillQty, fillPrice, pendingExecution.id, 'Pyramided via LIMIT order into existing position');
    });
    return;
  }

  if (existingOpen && existingOpen.side !== pendingExecution.side) {
    await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingExecution.id));
    logger.info(
      { executionId: pendingExecution.id, symbol, orderId, existingSide: existingOpen.side },
      '[FuturesUserStream] Reduce order filled — deleted pending execution, close handled via rp path'
    );
    return;
  }

  logger.info(
    {
      executionId: pendingExecution.id,
      symbol,
      orderId,
      fillPrice,
      entryFee,
      commissionAsset,
    },
    '[FuturesUserStream] ✓ Pending LIMIT order FILLED - activating position'
  );

  let activationSlAlgoId = pendingExecution.stopLossAlgoId;
  let activationTpAlgoId = pendingExecution.takeProfitAlgoId;
  let activationSlOrderId = pendingExecution.stopLossOrderId;
  let activationTpOrderId = pendingExecution.takeProfitOrderId;
  let activationSlIsAlgo = pendingExecution.stopLossIsAlgo;
  let activationTpIsAlgo = pendingExecution.takeProfitIsAlgo;

  const needsSlPlacement = !!pendingExecution.setupId && !pendingExecution.stopLossAlgoId && !pendingExecution.stopLossOrderId && pendingExecution.stopLoss;
  const needsTpPlacement = !!pendingExecution.setupId && !pendingExecution.takeProfitAlgoId && !pendingExecution.takeProfitOrderId && pendingExecution.takeProfit;

  if (needsSlPlacement || needsTpPlacement) {
    const walletForActivation = await ctx.getCachedWallet(walletId);
    if (walletForActivation) {
      if (needsSlPlacement) {
        try {
          const slRes = await createStopLossOrder({ wallet: walletForActivation, symbol, side: pendingExecution.side, quantity: parseFloat(pendingExecution.quantity), triggerPrice: parseFloat(pendingExecution.stopLoss!), marketType: 'FUTURES' });
          activationSlAlgoId = slRes.isAlgoOrder ? (slRes.algoId ?? null) : null;
          activationSlOrderId = !slRes.isAlgoOrder ? (slRes.orderId ?? null) : null;
          activationSlIsAlgo = slRes.isAlgoOrder;
        } catch (e) {
          logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place SL on manual LIMIT activation');
        }
      }
      if (needsTpPlacement) {
        try {
          const tpRes = await createTakeProfitOrder({ wallet: walletForActivation, symbol, side: pendingExecution.side, quantity: parseFloat(pendingExecution.quantity), triggerPrice: parseFloat(pendingExecution.takeProfit!), marketType: 'FUTURES' });
          activationTpAlgoId = tpRes.isAlgoOrder ? (tpRes.algoId ?? null) : null;
          activationTpOrderId = !tpRes.isAlgoOrder ? (tpRes.orderId ?? null) : null;
          activationTpIsAlgo = tpRes.isAlgoOrder;
        } catch (e) {
          logger.error({ error: serializeError(e), symbol }, '[FuturesUserStream] Failed to place TP on manual LIMIT activation');
        }
      }
    }
  }

  let activationLiquidationPrice: string | undefined;
  const activationConn = ctx.connections.get(walletId);
  if (activationConn) {
    try {
      const pos = await getPosition(activationConn.apiClient, symbol);
      if (pos) {
        const lp = parseFloat(pos.liquidationPrice || '0');
        if (lp > 0) activationLiquidationPrice = lp.toString();
      }
    } catch { /* best-effort */ }
  }

  await db
    .update(tradeExecutions)
    .set({
      status: 'open',
      entryPrice: fillPrice.toString(),
      quantity: fillQty.toString(),
      entryFee: entryFee.toString(),
      commissionAsset: commissionAsset || 'USDT',
      openedAt: new Date(),
      updatedAt: new Date(),
      stopLossAlgoId: activationSlAlgoId,
      takeProfitAlgoId: activationTpAlgoId,
      stopLossOrderId: activationSlOrderId,
      takeProfitOrderId: activationTpOrderId,
      stopLossIsAlgo: activationSlIsAlgo,
      takeProfitIsAlgo: activationTpIsAlgo,
      liquidationPrice: activationLiquidationPrice,
    })
    .where(eq(tradeExecutions.id, pendingExecution.id));

  // Mark the underlying orders row FILLED so the renderer's getOrders
  // refetch (fired by the 500ms invalidation debounce after order:update)
  // doesn't read NEW and momentarily re-render the pending line on the
  // chart. Without this, the WS-driven cache patch (status: 'FILLED')
  // got overwritten by the refetch result and the line bounced back
  // until order-sync.reconcileOrdersTable caught up ~30s later.
  await db
    .update(orders)
    .set({ status: 'FILLED', executedQty: fillQty.toString(), updateTime: Date.now() })
    .where(and(eq(orders.walletId, walletId), eq(orders.orderId, String(orderId))));

  const wsService = getWebSocketService();
  if (wsService) {
    // Emit the fully-merged post-update shape — pendingExecution was
    // selected before the db.update above so spreading it alone leaves
    // stale qty/fee/algo-ids in the payload, which then misleads the
    // renderer's setData merge into showing the old quantity until the
    // next refetch reconciles.
    wsService.emitPositionUpdate(walletId, {
      ...pendingExecution,
      status: 'open',
      entryPrice: fillPrice.toString(),
      quantity: fillQty.toString(),
      entryFee: entryFee.toString(),
      commissionAsset: commissionAsset || 'USDT',
      openedAt: new Date(),
      stopLossAlgoId: activationSlAlgoId,
      takeProfitAlgoId: activationTpAlgoId,
      stopLossOrderId: activationSlOrderId,
      takeProfitOrderId: activationTpOrderId,
      stopLossIsAlgo: activationSlIsAlgo,
      takeProfitIsAlgo: activationTpIsAlgo,
      liquidationPrice: activationLiquidationPrice ?? null,
    });

    // v1.6 Track F.4 — POSITION_OPENED toast for limit-entry fills.
    // Mirror of the close toast (PR #366) so the user gets explicit
    // feedback when a pending limit order activates a position.
    emitPositionOpenedToast(wsService, walletId, {
      executionId: pendingExecution.id,
      symbol,
      side: pendingExecution.side,
      entryPrice: fillPrice,
      quantity: fillQty,
      source: 'LIMIT_FILL',
    });

    // Patch the orders cache so the pending limit-order line on the chart
    // disappears the same render frame the position appears. Without this
    // the orders table still shows the row as NEW until
    // `order-sync.reconcileOrdersTable` catches up ~30s later, leaving a
    // phantom pending-order line stacked on the new open-position line.
    wsService.emitOrderUpdate(walletId, {
      orderId: String(orderId),
      symbol,
      status: 'FILLED',
      executedQty: fillQty.toString(),
      avgPrice: fillPrice.toString(),
    });
  }
}
