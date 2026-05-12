import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { calculatePnl } from '@marketmind/utils';
import { getOrderEntryFee, getAllTradeFeesForPosition, getPosition, cancelFuturesAlgoOrder } from '../binance-futures-client';
import { logger, serializeError } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { emitPositionClosedEvents, incrementWalletBalanceAndBroadcast } from '../wallet-broadcast';
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

  // Cancel opposite SL/TP in the BACKGROUND. The previous shape awaited up
  // to 3 retries × 100-300ms backoff = ~1.5s worst case before the position-
  // closed broadcast could fire. The renderer was paying that latency for
  // every TP/SL fill — perceived as "screen takes seconds to react after a
  // fill". Now the cancel runs in parallel; if every retry fails, the next
  // reconcileOrdersTable cycle picks up the orphan and a CRITICAL log is
  // emitted for ops visibility.
  if (orderToCancel && apiClient && !isAlgoTriggerFill) {
    void (async () => {
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
            '[FuturesUserStream] Opposite order cancelled (background)'
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
              '[FuturesUserStream] Retry cancelling opposite order (background)'
            );
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
          } else {
            logger.error(
              { error: errorMessage, orderToCancel, isAlgoOrder: oppositeIsAlgo },
              '[FuturesUserStream] ! CRITICAL: Failed to cancel opposite order after retries - reconcileOrdersTable will retry, manual check recommended'
            );
          }
        }
      }
    })();
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

          await incrementWalletBalanceAndBroadcast(walletId, partialPnl);

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
  // Use the WS event's commission as the EXIT fee directly — it IS the
  // exact commission Binance charged for this fill. The previous shape
  // re-fetched via `getAllTradeFeesForPosition` (~500-800ms blocking)
  // just to verify the value, then re-fetched the entry fee on top
  // (another ~300ms when entryFee was 0). Combined with the now-async
  // opposite-cancel above, the broadcast goes out in ~50-100ms instead
  // of the previous 1.5-3s.
  //
  // If `execution.entryFee` is 0 (the entry-fill handler didn't have
  // it) the entry fee defaults to 0 — that produces a small PnL
  // inaccuracy (typically a few cents on a futures trade). A background
  // refinement runs after the broadcast and patches the DB with the
  // accurate fees + emits a follow-up `position:update` if the values
  // moved materially. The user sees the close near-instantly with a
  // ballpark PnL, and the precise figure self-corrects within a second
  // or two.
  const actualExitFee = parseFloat(commission || '0');
  const actualEntryFee = parseFloat(execution.entryFee ?? '0');

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

  // Atomic increment + RETURNING + WS broadcast in one call — closes
  // the gap between the order-trade-update event arriving and the
  // renderer's wallet.list cache reflecting the freed capital.
  // Without this broadcast, the renderer waits for the
  // position:closed-driven 250ms invalidation + tRPC round-trip
  // (≈ 400-600ms total) before the ticket can size against the new
  // base.
  await incrementWalletBalanceAndBroadcast(walletId, pnlResult.netPnl);

  logger.info(
    { walletId, pnl: pnl.toFixed(2), partialClosePnl: partialClosePnl.toFixed(2) },
    '[FuturesUserStream] > Wallet balance updated atomically'
  );

  binancePriceStreamService.invalidateExecutionCache(symbol);

  emitPositionClosedEvents({
    walletId,
    execution,
    symbol,
    exitPrice,
    pnl,
    pnlPercent,
    exitReason: determinedExitReason ?? (isSLOrder ? 'STOP_LOSS' : 'TAKE_PROFIT'),
  });

  const wsService = getWebSocketService();
  if (wsService) {
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

  // Background fee refinement — the broadcast above used event-commission
  // for the exit fee and `execution.entryFee` (possibly 0) for the entry.
  // Now pull the authoritative fees from Binance and, if they differ
  // materially, update the DB row + emit a `position:update` so the
  // renderer's PnL cell self-corrects without the user noticing. This
  // path is BEST-EFFORT — every failure is logged and swallowed; the
  // close has already been broadcast with the ballpark figure.
  void (async () => {
    try {
      const feeConnection = ctx.connections.get(walletId);
      if (!feeConnection) return;
      const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
      const allFees = await getAllTradeFeesForPosition(
        feeConnection.apiClient,
        symbol,
        execution.side,
        openedAt,
        undefined,
        execution.entryOrderId,
        execution.exitOrderId,
      );
      let refinedEntryFee = actualEntryFee;
      let refinedExitFee = actualExitFee;
      if (allFees) {
        if (allFees.exitFee > 0) refinedExitFee = allFees.exitFee;
        if (allFees.entryFee > 0) refinedEntryFee = allFees.entryFee;
      }
      if (refinedEntryFee === 0 && execution.entryOrderId) {
        try {
          const feeResult = await getOrderEntryFee(feeConnection.apiClient, symbol, execution.entryOrderId);
          if (feeResult) refinedEntryFee = feeResult.entryFee;
        } catch (_e) { /* best-effort */ }
      }
      const feeDeltaTotal = (refinedEntryFee - actualEntryFee) + (refinedExitFee - actualExitFee);
      // Only patch if the corrected fees move PnL by more than half a cent.
      if (Math.abs(feeDeltaTotal) < 0.005) return;

      const refinedPnlResult = calculatePnl({
        entryPrice,
        exitPrice,
        quantity,
        side: execution.side,
        marketType: 'FUTURES',
        leverage,
        accumulatedFunding,
        entryFee: refinedEntryFee,
        exitFee: refinedExitFee,
      });
      const refinedPnl = refinedPnlResult.netPnl + partialClosePnl;
      const refinedTotalFees = refinedEntryFee + refinedExitFee;

      await db
        .update(tradeExecutions)
        .set({
          pnl: refinedPnl.toString(),
          pnlPercent: refinedPnlResult.pnlPercent.toString(),
          fees: refinedTotalFees.toString(),
          entryFee: refinedEntryFee.toString(),
          exitFee: refinedExitFee.toString(),
          updatedAt: new Date(),
        })
        .where(eq(tradeExecutions.id, execution.id));

      // Also patch the wallet balance with the delta so the running
      // balance reconciles. The initial broadcast already credited
      // `pnl` to the wallet; we only need to add the correction.
      const pnlDelta = refinedPnl - pnl;
      if (Math.abs(pnlDelta) > 0.005) {
        await incrementWalletBalanceAndBroadcast(walletId, pnlDelta);
      }

      const wsServiceBg = getWebSocketService();
      if (wsServiceBg) {
        wsServiceBg.emitPositionUpdate(walletId, {
          id: execution.id,
          status: 'closed',
          pnl: refinedPnl.toString(),
          pnlPercent: refinedPnlResult.pnlPercent.toString(),
          fees: refinedTotalFees.toString(),
        });
      }

      logger.info(
        { executionId: execution.id, oldPnl: pnl.toFixed(4), newPnl: refinedPnl.toFixed(4), delta: pnlDelta.toFixed(4) },
        '[FuturesUserStream] Background fee refinement patched PnL',
      );
    } catch (err) {
      logger.warn(
        { executionId: execution.id, error: serializeError(err) },
        '[FuturesUserStream] Background fee refinement failed — close already broadcast with ballpark PnL',
      );
    }
  })();
}
