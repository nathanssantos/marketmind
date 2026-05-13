import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { orders, tradeExecutions } from '../../db/schema';
import { cancelFuturesAlgoOrder } from '../binance-futures-client';
import { logHandlerAction } from '../binance-event-logger';
import { logger, serializeError } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import type { UserStreamContext, FuturesAlgoOrderUpdate } from './types';

export async function handleAlgoOrderUpdate(
  ctx: UserStreamContext,
  walletId: string,
  event: FuturesAlgoOrderUpdate
): Promise<void> {
  const { o: algoData } = event;
  const { s: symbol, aid: algoId, X: status, o: orderType, ps: positionSide } = algoData;

  logger.info(
    {
      walletId,
      symbol,
      algoId,
      status,
      orderType,
      positionSide,
    },
    '[FuturesUserStream] Algo order update received'
  );
  logHandlerAction({
    handler: 'algo-update',
    walletId,
    orderId: algoId,
    action: 'received',
    extra: { symbol, status, orderType, positionSide },
  });

  if (status === 'REJECTED' || status === 'EXPIRED') {
    await db
      .update(tradeExecutions)
      .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.entryOrderId, String(algoId))
        )
      );
    logger.warn({ walletId, symbol, algoId, status }, '[FuturesUserStream] Algo entry order rejected/expired — pending execution cancelled');
    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitRiskAlert(walletId, {
        type: 'ORDER_REJECTED',
        level: 'critical',
        symbol,
        message: status === 'REJECTED'
          ? `Entry order REJECTED by Binance — insufficient margin or invalid price at trigger time. Order for ${symbol} cancelled.`
          : `Entry order EXPIRED for ${symbol}. Order was not filled within its validity window.`,
        data: { algoId, orderType, status },
        timestamp: Date.now(),
      });
      wsService.emitPositionUpdate(walletId, { id: String(algoId), status: 'cancelled' });
    }
    return;
  }

  // Mirror the algo's terminal state into the regular `orders` table row
  // for the same orderId. Without this, the row stays at NEW after the
  // algo fires/cancels and the periodic `OrderSync` sweep sees it as
  // stale, queries `getOrder()` on a regular-orders endpoint (which
  // doesn't know about algo IDs), gets "Order does not exist", and stamps
  // the row EXPIRED. That EXPIRED status propagates to the renderer via
  // `order:update` and shows a false "Order expired" toast on what was
  // actually a successful TRIGGERED+FILLED stop-loss or take-profit.
  if (status === 'FINISHED' || status === 'CANCELED') {
    try {
      const newOrderStatus = status === 'FINISHED' ? 'FILLED' : 'CANCELED';
      const updated = await db
        .update(orders)
        .set({ status: newOrderStatus, updateTime: Date.now() })
        .where(eq(orders.orderId, String(algoId)))
        .returning();
      if (updated.length > 0) {
        const wsServiceForAlgo = getWebSocketService();
        if (wsServiceForAlgo) {
          if (status === 'CANCELED') {
            wsServiceForAlgo.emitOrderCancelled(walletId, String(algoId));
          } else {
            wsServiceForAlgo.emitOrderUpdate(walletId, updated[0]);
          }
        }
      }
    } catch (err) {
      logger.warn(
        { walletId, symbol, algoId, status, error: serializeError(err) },
        '[FuturesUserStream] Failed to mirror algo terminal status into orders table',
      );
    }
  }

  if (status !== 'TRIGGERED') {
    return;
  }

  try {
    const [pendingEntryExecution] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'pending'),
          eq(tradeExecutions.marketType, 'FUTURES'),
          eq(tradeExecutions.entryOrderId, String(algoId))
        )
      )
      .limit(1);

    if (pendingEntryExecution) {
      const [existingOpen] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'open'),
            eq(tradeExecutions.marketType, 'FUTURES'),
            eq(tradeExecutions.side, pendingEntryExecution.side)
          )
        )
        .limit(1);

      if (existingOpen) {
        await ctx.withPyramidLock(walletId, symbol, async () => {
          await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id));
          await ctx.syncPositionFromExchange(walletId, symbol, existingOpen.id, 'Synced after algo pyramid trigger');
          const wsService = getWebSocketService();
          if (wsService) {
            const [updated] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, existingOpen.id)).limit(1);
            if (updated) wsService.emitPositionUpdate(walletId, updated);
          }
        });
        ctx.recentAlgoEntrySymbols.set(`${walletId}:${symbol}`, Date.now());
        return;
      }

      const [existingOpposite] = await db
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

      if (existingOpposite && existingOpposite.side !== pendingEntryExecution.side) {
        await db.delete(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id));
        logger.info(
          { executionId: pendingEntryExecution.id, algoId, symbol, existingSide: existingOpposite.side },
          '[FuturesUserStream] Reduce algo order triggered — deleted pending execution, close handled via ORDER_TRADE_UPDATE'
        );
        return;
      }

      logger.info(
        { executionId: pendingEntryExecution.id, algoId, symbol },
        '[FuturesUserStream] Algo entry order TRIGGERED — activating pending execution'
      );

      await db
        .update(tradeExecutions)
        .set({
          status: 'open',
          openedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, pendingEntryExecution.id));

      try {
        await ctx.syncPositionFromExchange(walletId, symbol, pendingEntryExecution.id, 'Synced fill price after algo activation');
      } catch (_e) { /* ORDER_TRADE_UPDATE will correct */ }

      ctx.recentAlgoEntrySymbols.set(`${walletId}:${symbol}`, Date.now());

      const wsService = getWebSocketService();
      if (wsService) {
        const [activated] = await db.select().from(tradeExecutions).where(eq(tradeExecutions.id, pendingEntryExecution.id)).limit(1);
        if (activated) wsService.emitPositionUpdate(walletId, activated);
      }

      return;
    }

    const algoOpenExecutions = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, walletId),
          eq(tradeExecutions.symbol, symbol),
          eq(tradeExecutions.status, 'open'),
          eq(tradeExecutions.marketType, 'FUTURES')
        )
      );

    const algoIdStr = String(algoId);
    const executionByAlgoId = algoOpenExecutions.find(e =>
      e.stopLossAlgoId === algoIdStr ||
      e.stopLossOrderId === algoIdStr ||
      e.takeProfitAlgoId === algoIdStr ||
      e.takeProfitOrderId === algoIdStr
    );

    const execution = executionByAlgoId ?? algoOpenExecutions[0];

    if (!execution) {
      logger.warn({ walletId, symbol, algoId, openCount: algoOpenExecutions.length }, '[FuturesUserStream] No open execution found for algo order');
      return;
    }

    const isSLOrder = execution.stopLossAlgoId === algoIdStr || execution.stopLossOrderId === algoIdStr;
    const isTPOrder = execution.takeProfitAlgoId === algoIdStr || execution.takeProfitOrderId === algoIdStr;

    if (!isSLOrder && !isTPOrder) {
      logger.trace(
        { walletId, symbol, algoId, stopLossAlgoId: execution.stopLossAlgoId, takeProfitAlgoId: execution.takeProfitAlgoId },
        '[FuturesUserStream] Algo order not recognized as SL or TP for this execution'
      );
      return;
    }

    const orderToCancel = isSLOrder
      ? (execution.takeProfitAlgoId ?? execution.takeProfitOrderId)
      : (execution.stopLossAlgoId ?? execution.stopLossOrderId);
    const exitReason = isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT';

    logger.info(
      {
        executionId: execution.id,
        algoId,
        isSLOrder,
        isTPOrder,
        exitReason,
        orderToCancel,
      },
      `[FuturesUserStream] > Algo ${exitReason} order TRIGGERED`
    );

    const apiClient = ctx.connections.get(walletId)?.apiClient;

    if (orderToCancel) {
      if (apiClient) {
        const maxRetries = 3;
        let cancelSuccess = false;

        for (let attempt = 1; attempt <= maxRetries && !cancelSuccess; attempt++) {
          try {
            await cancelFuturesAlgoOrder(apiClient, orderToCancel);
            cancelSuccess = true;
            logger.info(
              {
                executionId: execution.id,
                cancelledAlgoId: orderToCancel,
                reason: isSLOrder ? 'SL triggered, cancelling TP algo' : 'TP triggered, cancelling SL algo',
              },
              '[FuturesUserStream] Opposite algo order cancelled'
            );
          } catch (cancelError) {
            const errorMessage = serializeError(cancelError);
            if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist') || errorMessage.includes('not found')) {
              cancelSuccess = true;
              logger.info(
                { orderToCancel },
                '[FuturesUserStream] Algo order already cancelled or executed'
              );
            } else if (attempt < maxRetries) {
              logger.warn(
                { error: errorMessage, orderToCancel, attempt, maxRetries },
                '[FuturesUserStream] Retry cancelling opposite algo order'
              );
              await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            } else {
              logger.error(
                { error: errorMessage, orderToCancel },
                '[FuturesUserStream] ! CRITICAL: Failed to cancel opposite algo order after retries - MANUAL CHECK REQUIRED'
              );
            }
          }
        }
      }
    }

    const clearFields = isSLOrder
      ? { stopLossAlgoId: null, stopLossOrderId: null }
      : { takeProfitAlgoId: null, takeProfitOrderId: null };

    await db
      .update(tradeExecutions)
      .set({
        exitReason,
        ...clearFields,
        updatedAt: new Date(),
      })
      .where(eq(tradeExecutions.id, execution.id));

    binancePriceStreamService.invalidateExecutionCache(symbol);

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitPositionUpdate(walletId, {
        ...execution,
        exitReason,
        ...clearFields,
      });
    }

    logger.info(
      {
        executionId: execution.id,
        clearedFields: Object.keys(clearFields),
        exitReason,
      },
      '[FuturesUserStream] Cleared triggered protection order IDs + emitted position update'
    );

    const executionId = execution.id;
    const executionSide = execution.side;
    const openedAt = execution.openedAt ? new Date(execution.openedAt).getTime() : execution.createdAt ? new Date(execution.createdAt).getTime() : 0;

    setTimeout(() => {
      void ctx.verifyAlgoFillProcessed(walletId, executionId, symbol, executionSide, openedAt, exitReason);
    }, 10_000);
  } catch (error) {
    logger.error(
      {
        walletId,
        algoId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling algo order update'
    );
  }
}
