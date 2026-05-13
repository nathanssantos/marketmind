import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { detectExitReason, isClosingSide } from '../execution-manager';
import { logHandlerAction, logHandlerError } from '../binance-event-logger';
import { logger, serializeError } from '../logger';
import { getWebSocketService } from '../websocket';
import type { UserStreamContext, FuturesOrderUpdate } from './types';
import { handlePendingFill } from './handle-pending-fill';
import { handleUntrackedReduceFill, handleManualOrderFill } from './handle-untracked-fill';
import { handleExitFill } from './handle-exit-fill';

export async function handleOrderUpdate(
  ctx: UserStreamContext,
  walletId: string,
  event: FuturesOrderUpdate
): Promise<void> {
  const handlerStartedAt = Date.now();
  try {
    const {
      o: {
        s: symbol,
        S: orderSide,
        X: status,
        x: execType,
        i: orderId,
        L: lastFilledPrice,
        z: executedQty,
        ap: avgPrice,
        rp: realizedProfit,
        ps: positionSide,
        n: commission,
        N: commissionAsset,
        o: orderType,
      },
    } = event;

    logHandlerAction({
      handler: 'order-update',
      walletId,
      orderId,
      action: 'received',
      extra: {
        symbol, orderSide, status, execType, orderType,
        lastFilledPrice, executedQty, avgPrice, realizedProfit, commission, positionSide,
      },
    });

    // Binance reports liquidation fills with orderType='LIQUIDATION'.
    // Without this, the fill would be misclassified as TAKE_PROFIT
    // (the SL/TP fallback in handleExitFill).
    const isLiquidation = orderType === 'LIQUIDATION';

    logger.info(
      {
        walletId,
        symbol,
        orderId,
        status,
        execType,
        positionSide,
      },
      '[FuturesUserStream] Order update received'
    );

    // EXPIRED / REJECTED have the same effect on the DB as CANCELED:
    // the order is dead, no fills will arrive. Previously only CANCELED
    // was handled, which left a pending tradeExecution + a phantom
    // order line on the chart whenever a STOP_MARKET / LIMIT order
    // expired (e.g. STOP-trigger price crossed before placement, GTX
    // post-only rejected, time-in-force expired). The renderer only
    // saw the eventual order:update with status=EXPIRED from
    // reconcileOrdersTable 30s later — but that didn't cascade to
    // the tradeExecution, so the chart line stayed visible.
    if (status === 'CANCELED' || status === 'EXPIRED' || status === 'REJECTED') {
      const cancelled = await db
        .update(tradeExecutions)
        .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.entryOrderId, String(orderId))
          )
        )
        .returning();

      const wsService = getWebSocketService();
      if (wsService) {
        wsService.emitOrderCancelled(walletId, String(orderId));
        for (const exec of cancelled) {
          wsService.emitOrderUpdate(walletId, { id: exec.id, status: 'cancelled' });
          wsService.emitPositionUpdate(walletId, exec);
        }
      }
      return;
    }

    if (execType === 'TRADE' && status === 'PARTIALLY_FILLED') {
      const {
        o: { q: origQty },
      } = event;
      const filledQty = parseFloat(executedQty);
      const originalQty = parseFloat(origQty);

      const [pendingExec] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.marketType, 'FUTURES'),
            eq(tradeExecutions.entryOrderId, String(orderId))
          )
        )
        .limit(1);

      if (pendingExec) {
        await db.update(tradeExecutions).set({
          quantity: filledQty.toString(),
          updatedAt: new Date(),
        }).where(eq(tradeExecutions.id, pendingExec.id));

        logger.info({
          executionId: pendingExec.id,
          symbol,
          filledQty,
          originalQty,
          remaining: originalQty - filledQty,
        }, '[FuturesUserStream] Partial fill - updated quantity with filled amount');

        // Emit so the renderer paints the new size immediately rather
        // than waiting for the next refetch tick. Without this the user
        // sees the order line at the original qty until the periodic
        // poll catches up.
        const wsService = getWebSocketService();
        if (wsService) {
          wsService.emitPositionUpdate(walletId, {
            ...pendingExec,
            quantity: filledQty.toString(),
          });
        }
      }
      return;
    }

    if (execType === 'TRADE' && status === 'FILLED') {
      const [pendingExecution] = await db
        .select()
        .from(tradeExecutions)
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.symbol, symbol),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.marketType, 'FUTURES'),
            eq(tradeExecutions.entryOrderId, String(orderId))
          )
        )
        .limit(1);

      if (pendingExecution) {
        await handlePendingFill(ctx, walletId, pendingExecution, symbol, orderSide, orderId, avgPrice, lastFilledPrice, executedQty, commission, commissionAsset);
        return;
      }

      const openExecutions = await db
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

      const orderIdStr = String(orderId);
      // CRITICAL: use `||` not `??`. The previous chain `(field && field === id) ?? next`
      // was buggy: when `field` is set but doesn't match, the expression evaluates to
      // `false`, which `??` treats as "non-nullish" and short-circuits — never checking
      // the remaining fields. Real-world impact: a position with BOTH stopLossOrderId
      // (e.g. "100") AND takeProfitOrderId (e.g. "200") set — when TP fills with
      // orderId="200", the SL check returned false, the chain stopped, and the TP match
      // was never tested. Position stayed open in the DB even though Binance had closed it.
      // Direct equality with `||` chains correctly: null === "200" is false (skip), and
      // we don't need the `field &&` guard since equality with null/undefined is always false.
      const executionByOrderId = openExecutions.find(e =>
        e.stopLossOrderId === orderIdStr ||
        e.stopLossAlgoId === orderIdStr ||
        e.takeProfitOrderId === orderIdStr ||
        e.takeProfitAlgoId === orderIdStr
      );

      const executionByExitReason = !executionByOrderId
        ? openExecutions.find(e => e.exitReason === 'STOP_LOSS' || e.exitReason === 'TAKE_PROFIT')
        : undefined;

      const execution = executionByOrderId ?? executionByExitReason ?? openExecutions[0];

      if (!execution) {
        const handled = await handleUntrackedReduceFill(ctx, walletId, symbol, orderSide, orderId, avgPrice, lastFilledPrice, executedQty, realizedProfit, commission);
        if (handled) return;

        await handleManualOrderFill(ctx, walletId, symbol, orderSide, orderId, avgPrice, lastFilledPrice, executedQty, openExecutions.length);
        return;
      }

      // Same `||` reasoning as above — `??` here would let a SL match wrongly suppress
      // a TP check (or vice versa) on positions with both legs set.
      let isSLOrder =
        execution.stopLossOrderId === orderIdStr ||
        execution.stopLossAlgoId === orderIdStr;
      let isTPOrder =
        execution.takeProfitOrderId === orderIdStr ||
        execution.takeProfitAlgoId === orderIdStr;
      const isAlgoTriggerFill = !isSLOrder && !isTPOrder && execution.exitReason;

      if (!isSLOrder && !isTPOrder && !isAlgoTriggerFill) {
        const rpValue = parseFloat(realizedProfit || '0');
        const isClosingOrder = isClosingSide(execution.side, orderSide);

        if (rpValue !== 0 && isClosingOrder) {
          const exitPrice = parseFloat(avgPrice || lastFilledPrice);
          const entryPrice = parseFloat(execution.entryPrice);

          const detectedExitReason = detectExitReason(execution.side, entryPrice, exitPrice);

          isSLOrder = detectedExitReason === 'STOP_LOSS';
          isTPOrder = detectedExitReason === 'TAKE_PROFIT';

          logger.warn(
            {
              executionId: execution.id,
              symbol,
              orderId,
              realizedProfit: rpValue,
              exitPrice,
              entryPrice,
              detectedExitReason,
            },
            '[FuturesUserStream] ! Detected closing order via realizedProfit fallback - ALGO_UPDATE may have been missed'
          );
        } else {
          const isEntryFill = !isClosingOrder && rpValue === 0;

          if (isEntryFill && execution.entryOrderId && execution.entryOrderId === orderIdStr) {
            // Previously this branch returned without doing anything,
            // but createOrder may have inserted the exec with a
            // placeholder entry_price (when Binance's submit response
            // had avgPrice=0). The WS ORDER_TRADE_UPDATE that arrives
            // here carries the AUTHORITATIVE avgPrice + cumulative
            // commission for the order. Use it to overwrite the
            // placeholder so position-sync / orphan-close downstream
            // computes correct PnL.
            const wsAvgPrice = parseFloat(avgPrice || lastFilledPrice || '0');
            const wsCommission = parseFloat(commission || '0');
            const dbEntryPrice = parseFloat(execution.entryPrice ?? '0');
            const priceDelta = Math.abs(wsAvgPrice - dbEntryPrice);
            const needsCorrection = wsAvgPrice > 0 && (dbEntryPrice <= 0 || priceDelta / dbEntryPrice > 0.0001);
            if (needsCorrection) {
              await db.update(tradeExecutions).set({
                entryPrice: wsAvgPrice.toString(),
                entryFee: wsCommission > 0 ? wsCommission.toString() : execution.entryFee,
                updatedAt: new Date(),
              }).where(eq(tradeExecutions.id, execution.id));
              logger.info(
                { executionId: execution.id, orderId, oldEntry: dbEntryPrice, newEntry: wsAvgPrice, deltaPct: ((priceDelta / dbEntryPrice) * 100).toFixed(3) },
                '[FuturesUserStream] Corrected entry price for tracked exec from WS avgPrice',
              );
            } else {
              logger.info({ executionId: execution.id, orderId }, '[FuturesUserStream] Entry fill for already-tracked manual execution - within tolerance, skipping');
            }
            return;
          }

          if (isEntryFill) {
            const recentKey = `${walletId}:${symbol}`;
            const recentAlgoTime = ctx.recentAlgoEntrySymbols.get(recentKey);
            if (recentAlgoTime && Date.now() - recentAlgoTime < 10000) {
              ctx.recentAlgoEntrySymbols.delete(recentKey);
              await ctx.withPyramidLock(walletId, symbol, async () => {
                await ctx.syncPositionFromExchange(walletId, symbol, execution.id, 'Synced position from exchange (algo entry fill followup)');
              });
              return;
            }

            await ctx.withPyramidLock(walletId, symbol, async () => {
              const fillPrice = parseFloat(avgPrice || lastFilledPrice);
              const fillQty = parseFloat(executedQty || '0');
              await ctx.mergeIntoExistingPosition(walletId, symbol, execution.id, fillQty, fillPrice, undefined, 'Pyramided into existing position');
            });
            return;
          }

          logger.warn(
            { walletId, symbol, orderId, executionId: execution.id },
            '[FuturesUserStream] Order not recognized as SL or TP'
          );
          return;
        }
      }

      await handleExitFill(ctx, walletId, execution, symbol, orderId, avgPrice, lastFilledPrice, executedQty, commission, !!isSLOrder, !!isTPOrder, !!isAlgoTriggerFill, isLiquidation, realizedProfit, commissionAsset, event.o.t, event.o.T);
    }
    logHandlerAction({
      handler: 'order-update',
      walletId,
      orderId: event.o.i,
      action: 'completed',
      latencyMs: Date.now() - handlerStartedAt,
    });
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling order update'
    );
    logHandlerError('order-update', walletId, error, { orderId: event.o.i, latencyMs: Date.now() - handlerStartedAt });
  }
}
