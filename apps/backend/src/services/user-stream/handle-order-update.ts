import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { detectExitReason, isClosingSide } from '../execution-manager';
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
      },
    } = event;

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

    if (status === 'CANCELED') {
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
      const executionByOrderId = openExecutions.find(e =>
        (e.stopLossOrderId && e.stopLossOrderId === orderIdStr) ||
        (e.stopLossAlgoId && e.stopLossAlgoId === orderIdStr) ||
        (e.takeProfitOrderId && e.takeProfitOrderId === orderIdStr) ||
        (e.takeProfitAlgoId && e.takeProfitAlgoId === orderIdStr)
      );

      const executionByExitReason = !executionByOrderId
        ? openExecutions.find(e => e.exitReason === 'STOP_LOSS' || e.exitReason === 'TAKE_PROFIT')
        : undefined;

      const execution = executionByOrderId || executionByExitReason || openExecutions[0];

      if (!execution) {
        const handled = await handleUntrackedReduceFill(ctx, walletId, symbol, orderSide, orderId, avgPrice, lastFilledPrice, executedQty, realizedProfit, commission);
        if (handled) return;

        await handleManualOrderFill(ctx, walletId, symbol, orderSide, orderId, avgPrice, lastFilledPrice, executedQty, openExecutions.length);
        return;
      }

      let isSLOrder = (execution.stopLossOrderId && execution.stopLossOrderId === orderIdStr) ||
        (execution.stopLossAlgoId && execution.stopLossAlgoId === orderIdStr);
      let isTPOrder = (execution.takeProfitOrderId && execution.takeProfitOrderId === orderIdStr) ||
        (execution.takeProfitAlgoId && execution.takeProfitAlgoId === orderIdStr);
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
            logger.info({ executionId: execution.id, orderId }, '[FuturesUserStream] Entry fill for already-tracked manual execution - skipping');
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

      await handleExitFill(ctx, walletId, execution, symbol, orderId, avgPrice, lastFilledPrice, executedQty, commission, !!isSLOrder, !!isTPOrder, !!isAlgoTriggerFill);
    }
  } catch (error) {
    logger.error(
      {
        walletId,
        error: serializeError(error),
      },
      '[FuturesUserStream] Error handling order update'
    );
  }
}
