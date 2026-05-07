import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { calculatePnl } from '@marketmind/utils';
import { getOrderEntryFee, getAllTradeFeesForPosition, getPosition, cancelFuturesAlgoOrder } from '../binance-futures-client';
import { logger, serializeError } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import { getPositionEventBus } from '../scalping/position-event-bus';
import type { UserStreamContext } from './types';
import { emitPositionClosedToast, emitPositionPartialCloseToast } from './emit-position-toast';

export async function handleExitFill(
  ctx: UserStreamContext,
  walletId: string,
  execution: typeof tradeExecutions.$inferSelect,
  symbol: string,
  orderId: number,
  avgPrice: string,
  lastFilledPrice: string,
  executedQty: string,
  commission: string,
  isSLOrder: boolean,
  _isTPOrder: boolean,
  isAlgoTriggerFill: boolean,
  isLiquidation = false,
): Promise<void> {
  if (isAlgoTriggerFill) {
    logger.info(
      {
        executionId: execution.id,
        orderId,
        exitReason: execution.exitReason,
      },
      '[FuturesUserStream] Processing fill from algo order trigger'
    );
  }

  const wallet = await ctx.getCachedWallet(walletId);

  if (!wallet) {
    throw new Error(`Wallet not found: ${walletId}`);
  }

  const apiClient = ctx.connections.get(walletId)?.apiClient;

  const shouldCancelTP = isSLOrder;
  const oppositeIsAlgo = shouldCancelTP ? execution.takeProfitIsAlgo : execution.stopLossIsAlgo;
  const orderToCancel = shouldCancelTP
    ? (execution.takeProfitIsAlgo ? execution.takeProfitAlgoId : execution.takeProfitOrderId)
    : (execution.stopLossIsAlgo ? execution.stopLossAlgoId : execution.stopLossOrderId);

  if (orderToCancel && apiClient && !isAlgoTriggerFill) {
    const maxRetries = 3;
    let cancelSuccess = false;

    for (let attempt = 1; attempt <= maxRetries && !cancelSuccess; attempt++) {
      try {
        if (oppositeIsAlgo) {
          await cancelFuturesAlgoOrder(apiClient, orderToCancel);
        } else {
          await apiClient.cancelOrder({ symbol, orderId: Number(orderToCancel) });
        }
        cancelSuccess = true;
        logger.info(
          {
            executionId: execution.id,
            cancelledOrderId: orderToCancel,
            isAlgoOrder: oppositeIsAlgo,
            reason: isSLOrder ? 'SL filled, cancelling TP' : 'TP filled, cancelling SL',
          },
          '[FuturesUserStream] Opposite order cancelled'
        );
      } catch (cancelError) {
        const errorMessage = serializeError(cancelError);
        if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist')) {
          cancelSuccess = true;
          logger.info(
            { orderToCancel, isAlgoOrder: oppositeIsAlgo },
            '[FuturesUserStream] Order already cancelled or executed'
          );
        } else if (attempt < maxRetries) {
          logger.warn(
            { error: errorMessage, orderToCancel, attempt, maxRetries },
            '[FuturesUserStream] Retry cancelling opposite order'
          );
          await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        } else {
          logger.error(
            { error: errorMessage, orderToCancel, isAlgoOrder: oppositeIsAlgo },
            '[FuturesUserStream] ! CRITICAL: Failed to cancel opposite order after retries - MANUAL CHECK REQUIRED'
          );
        }
      }
    }
  }

  const exitPrice = parseFloat(avgPrice || lastFilledPrice);
  const closedQty = parseFloat(executedQty);
  const entryPrice = parseFloat(execution.entryPrice);
  const leverage = execution.leverage ?? 1;
  const executionQty = parseFloat(execution.quantity);

  const connection = ctx.connections.get(walletId);
  if (connection) {
    try {
      const exchangePos = await getPosition(connection.apiClient, symbol);
      if (exchangePos) {
        const remainingQty = Math.abs(parseFloat(exchangePos.positionAmt));
        const exchangeEntryPrice = parseFloat(exchangePos.entryPrice);

        if (remainingQty > 0 && remainingQty < executionQty) {
          const partialPnl = execution.side === 'LONG'
            ? (exitPrice - entryPrice) * closedQty
            : (entryPrice - exitPrice) * closedQty;

          const existingPartialPnl = parseFloat(execution.partialClosePnl ?? '0');
          const newPartialClosePnl = existingPartialPnl + partialPnl;

          await db
            .update(tradeExecutions)
            .set({
              quantity: remainingQty.toString(),
              entryPrice: exchangeEntryPrice.toString(),
              partialClosePnl: newPartialClosePnl.toString(),
              updatedAt: new Date(),
            })
            .where(eq(tradeExecutions.id, execution.id));

          await db
            .update(wallets)
            .set({
              currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${partialPnl}`,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, walletId));

          logger.info(
            {
              executionId: execution.id,
              symbol,
              closedQty,
              remainingQty,
              partialPnl: partialPnl.toFixed(4),
              newEntryPrice: exchangeEntryPrice,
            },
            '[FuturesUserStream] Partial close detected — updated quantity, position remains open'
          );

          const hasProtection = execution.stopLoss ?? execution.takeProfit;
          if (hasProtection) ctx.scheduleDebouncedSlTpUpdate(execution.id, walletId, symbol);

          binancePriceStreamService.invalidateExecutionCache(symbol);

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(walletId, {
              ...execution,
              quantity: remainingQty.toString(),
              entryPrice: exchangeEntryPrice.toString(),
            });

            // v1.6 Track F.4 — partial-close toast. Without this, a
            // reduce-only fill that didn't fully close looked
            // identical (chart-wise) to a position-update — user
            // had no audible/visual confirmation.
            emitPositionPartialCloseToast(wsService, walletId, {
              executionId: execution.id,
              symbol,
              side: execution.side,
              closedQuantity: closedQty,
              remainingQuantity: remainingQty,
              exitPrice,
              partialPnl,
            });
          }

          return;
        }
      }
    } catch (_e) {
      logger.warn({ walletId, symbol }, '[FuturesUserStream] Failed to check exchange position for partial close detection');
    }
  }

  const quantity = closedQty;
  let actualExitFee = parseFloat(commission || '0');
  let actualEntryFee = parseFloat(execution.entryFee ?? '0');

  try {
    const feeConnection = ctx.connections.get(walletId);
    if (feeConnection) {
      const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
      const allFees = await getAllTradeFeesForPosition(feeConnection.apiClient, symbol, execution.side, openedAt, undefined, execution.entryOrderId, execution.exitOrderId);
      if (allFees) {
        if (allFees.exitFee > 0) actualExitFee = allFees.exitFee;
        if (allFees.entryFee > 0) actualEntryFee = allFees.entryFee;
        logger.info({
          walletId, symbol, executionId: execution.id,
          eventCommission: parseFloat(commission || '0'),
          actualExitFee, actualEntryFee,
        }, '[FuturesUserStream] Fetched accurate fees from REST API');
      }
    }
  } catch (_e) {
    logger.warn({ walletId, symbol, executionId: execution.id }, '[FuturesUserStream] Failed to fetch accurate fees - using event commission');
  }

  if (actualEntryFee === 0 && execution.entryOrderId) {
    try {
      const entryFeeConnection = ctx.connections.get(walletId);
      if (entryFeeConnection) {
        const feeResult = await getOrderEntryFee(entryFeeConnection.apiClient, symbol, execution.entryOrderId);
        if (feeResult) actualEntryFee = feeResult.entryFee;
      }
    } catch (_e) { /* entry fee fetch is best-effort */ }
  }

  const accumulatedFunding = parseFloat(execution.accumulatedFunding ?? '0');

  const pnlResult = calculatePnl({
    entryPrice,
    exitPrice,
    quantity,
    side: execution.side,
    marketType: 'FUTURES',
    leverage,
    accumulatedFunding,
    entryFee: actualEntryFee,
    exitFee: actualExitFee,
  });
  const partialClosePnl = parseFloat(execution.partialClosePnl ?? '0');
  const pnl = pnlResult.netPnl + partialClosePnl;
  const pnlPercent = pnlResult.pnlPercent;
  const totalFees = actualEntryFee + actualExitFee;

  const determinedExitReason = isLiquidation
    ? 'LIQUIDATION'
    : isAlgoTriggerFill
      ? execution.exitReason
      : isSLOrder
        ? 'STOP_LOSS'
        : 'TAKE_PROFIT';

  const closeResult = await db
    .update(tradeExecutions)
    .set({
      status: 'closed',
      exitPrice: exitPrice.toString(),
      closedAt: new Date(),
      pnl: pnl.toString(),
      pnlPercent: pnlPercent.toString(),
      fees: totalFees.toString(),
      entryFee: actualEntryFee.toString(),
      exitFee: actualExitFee.toString(),
      exitSource: 'ALGORITHM',
      exitReason: determinedExitReason,
      stopLossAlgoId: null,
      stopLossOrderId: null,
      takeProfitAlgoId: null,
      takeProfitOrderId: null,
      updatedAt: new Date(),
    })
    .where(and(eq(tradeExecutions.id, execution.id), eq(tradeExecutions.status, 'open')))
    .returning({ id: tradeExecutions.id });

  if (closeResult.length === 0) {
    logger.info(
      { executionId: execution.id, symbol },
      '[FuturesUserStream] Position already closed by another process - skipping'
    );
    return;
  }

  await db
    .update(wallets)
    .set({
      currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnlResult.netPnl}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId));

  logger.info(
    { walletId, pnl: pnl.toFixed(2), partialClosePnl: partialClosePnl.toFixed(2) },
    '[FuturesUserStream] > Wallet balance updated atomically'
  );

  binancePriceStreamService.invalidateExecutionCache(symbol);

  const wsService = getWebSocketService();
  if (wsService) {
    wsService.emitPositionUpdate(walletId, {
      ...execution,
      status: 'closed',
      exitPrice: exitPrice.toString(),
      pnl: pnl.toString(),
      pnlPercent: pnlPercent.toString(),
    });

    wsService.emitOrderUpdate(walletId, {
      id: execution.id,
      symbol,
      status: 'closed',
      exitPrice: exitPrice.toString(),
      pnl: pnl.toString(),
      pnlPercent: pnlPercent.toString(),
      exitReason: isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT',
    });

    wsService.emitPositionClosed(walletId, {
      positionId: execution.id,
      symbol,
      side: execution.side,
      exitReason: determinedExitReason ?? (isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT'),
      pnl,
      pnlPercent,
    });

    // v1.6 Track F.4 — toast feedback for SL/TP fills. Without this,
    // the user gets zero notification when a position closes via the
    // exchange (only the chart line disappears). The renderer's
    // RealtimeTradingSyncContext already handles `trade:notification`
    // events and renders the toast + native notification.
    emitPositionClosedToast(wsService, walletId, {
      executionId: execution.id,
      symbol,
      side: execution.side,
      exitPrice,
      pnl,
      pnlPercent,
      exitReason: determinedExitReason ?? (isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT'),
      source: 'EXIT_FILL',
    });
  }

  getPositionEventBus().emitPositionClosed({
    walletId,
    symbol,
    side: execution.side,
    pnl,
    executionId: execution.id,
  });

  logger.info(
    {
      executionId: execution.id,
      symbol,
      exitPrice: exitPrice.toFixed(2),
      pnl: pnl.toFixed(2),
      pnlPercent: pnlPercent.toFixed(2),
      exitReason: isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT',
    },
    '[FuturesUserStream] Position closed via order fill'
  );

  void ctx.cancelPendingEntryOrders(walletId, symbol, execution.id);

  setTimeout(() => {
    void ctx.closeResidualPosition(walletId, symbol, execution.id);
  }, 3000);
}
