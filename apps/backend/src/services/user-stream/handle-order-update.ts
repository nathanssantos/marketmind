import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { realizedPnlEvents, tradeExecutions, wallets, orders } from '../../db/schema';
import { calculatePnl } from '../../utils/pnl-calculator';
import { getOrderEntryFee, getAllTradeFeesForPosition, getPosition, cancelFuturesAlgoOrder } from '../binance-futures-client';
import { createStopLossOrder, createTakeProfitOrder } from '../protection-orders';
import { generateEntityId } from '../../utils/id';
import { detectExitReason, isClosingSide } from '../execution-manager';
import { logger, serializeError } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import { getPositionEventBus } from '../scalping/position-event-bus';
import type { UserStreamContext, FuturesOrderUpdate } from './types';

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
      await db
        .update(tradeExecutions)
        .set({ status: 'cancelled', pnl: '0', pnlPercent: '0', fees: '0', entryFee: '0', exitFee: '0', updatedAt: new Date() })
        .where(
          and(
            eq(tradeExecutions.walletId, walletId),
            eq(tradeExecutions.status, 'pending'),
            eq(tradeExecutions.entryOrderId, String(orderId))
          )
        );
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

        if (existingOpen && existingOpen.side === pendingExecution.side) {
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
        } else {
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
            } catch {}
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

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(walletId, {
              ...pendingExecution,
              status: 'open',
              entryPrice: fillPrice.toString(),
            });
          }

          return;
        }
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
        const rp = parseFloat(realizedProfit || '0');
        if (rp !== 0) {
          const reduceDirection: 'LONG' | 'SHORT' = orderSide === 'BUY' ? 'SHORT' : 'LONG';
          const [oppositeExec] = await db
            .select()
            .from(tradeExecutions)
            .where(
              and(
                eq(tradeExecutions.walletId, walletId),
                eq(tradeExecutions.symbol, symbol),
                eq(tradeExecutions.side, reduceDirection),
                eq(tradeExecutions.status, 'open'),
                eq(tradeExecutions.marketType, 'FUTURES')
              )
            )
            .limit(1);

          if (!oppositeExec) {
            logger.warn({ walletId, symbol, orderId, rp }, '[FuturesUserStream] Untracked close fill — no opposite execution found, ignoring');
            return;
          }

          const exitPrice = parseFloat(avgPrice || lastFilledPrice);
          const closedQty = parseFloat(executedQty);
          const entryPrice = parseFloat(oppositeExec.entryPrice);
          const execQty = parseFloat(oppositeExec.quantity);

          const partialPnl = oppositeExec.side === 'LONG'
            ? (exitPrice - entryPrice) * closedQty
            : (entryPrice - exitPrice) * closedQty;

          const connection = ctx.connections.get(walletId);
          let remainingQty = execQty - closedQty;
          let exchangeEntryPrice = entryPrice;

          if (connection) {
            try {
              const exchangePos = await getPosition(connection.apiClient, symbol);
              if (exchangePos) {
                remainingQty = Math.abs(parseFloat(exchangePos.positionAmt));
                exchangeEntryPrice = parseFloat(exchangePos.entryPrice) || entryPrice;
              }
            } catch (_e) {
              logger.warn({ walletId, symbol }, '[FuturesUserStream] Failed to fetch exchange position for untracked reduce fill');
            }
          }

          if (remainingQty > 0 && remainingQty < execQty) {
            const existingPartialPnl = parseFloat(oppositeExec.partialClosePnl || '0');
            const newPartialClosePnl = existingPartialPnl + partialPnl;

            await db
              .update(tradeExecutions)
              .set({
                quantity: remainingQty.toString(),
                entryPrice: exchangeEntryPrice.toString(),
                partialClosePnl: newPartialClosePnl.toString(),
                updatedAt: new Date(),
              })
              .where(eq(tradeExecutions.id, oppositeExec.id));

            await db
              .update(wallets)
              .set({
                currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${partialPnl}`,
                updatedAt: new Date(),
              })
              .where(eq(wallets.id, walletId));

            await db.insert(realizedPnlEvents).values({
              walletId,
              userId: oppositeExec.userId,
              executionId: oppositeExec.id,
              symbol,
              eventType: 'partial_close',
              pnl: partialPnl.toString(),
              fees: '0',
              quantity: closedQty.toString(),
              price: exitPrice.toString(),
            });

            logger.info(
              { executionId: oppositeExec.id, symbol, closedQty, remainingQty, partialPnl: partialPnl.toFixed(4) },
              '[FuturesUserStream] Untracked reduce fill — partial close applied'
            );

            const hasProtection = oppositeExec.stopLoss || oppositeExec.takeProfit;
            if (hasProtection) ctx.scheduleDebouncedSlTpUpdate(oppositeExec.id, walletId, symbol);

            binancePriceStreamService.invalidateExecutionCache(symbol);

            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitPositionUpdate(walletId, {
                ...oppositeExec,
                quantity: remainingQty.toString(),
                entryPrice: exchangeEntryPrice.toString(),
              });
            }
          } else {
            const existingPartialPnl = parseFloat(oppositeExec.partialClosePnl || '0');
            const totalPnl = partialPnl + existingPartialPnl;
            const exitFee = parseFloat(commission || '0');

            await db
              .update(tradeExecutions)
              .set({
                status: 'closed',
                exitPrice: exitPrice.toString(),
                closedAt: new Date(),
                pnl: totalPnl.toString(),
                fees: exitFee.toString(),
                exitFee: exitFee.toString(),
                exitSource: 'MANUAL',
                exitReason: 'REDUCE_ORDER',
                stopLossAlgoId: null,
                stopLossOrderId: null,
                takeProfitAlgoId: null,
                takeProfitOrderId: null,
                updatedAt: new Date(),
              })
              .where(and(eq(tradeExecutions.id, oppositeExec.id), eq(tradeExecutions.status, 'open')));

            await db.insert(realizedPnlEvents).values({
              walletId,
              userId: oppositeExec.userId,
              executionId: oppositeExec.id,
              symbol,
              eventType: 'full_close',
              pnl: partialPnl.toString(),
              fees: exitFee.toString(),
              quantity: closedQty.toString(),
              price: exitPrice.toString(),
            });

            await db
              .update(wallets)
              .set({
                currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${partialPnl}`,
                updatedAt: new Date(),
              })
              .where(eq(wallets.id, walletId));

            logger.info(
              { executionId: oppositeExec.id, symbol, totalPnl: totalPnl.toFixed(4), exitPrice },
              '[FuturesUserStream] Untracked reduce fill — full close applied'
            );

            binancePriceStreamService.invalidateExecutionCache(symbol);

            const wsService = getWebSocketService();
            if (wsService) {
              wsService.emitPositionUpdate(walletId, {
                ...oppositeExec,
                status: 'closed',
                exitPrice: exitPrice.toString(),
                pnl: totalPnl.toString(),
              });

              wsService.emitPositionClosed(walletId, {
                positionId: oppositeExec.id,
                symbol,
                side: oppositeExec.side,
                exitReason: 'REDUCE_ORDER',
                pnl: totalPnl,
                pnlPercent: 0,
              });
            }

            getPositionEventBus().emitPositionClosed({
              walletId,
              symbol,
              side: oppositeExec.side as 'LONG' | 'SHORT',
              pnl: totalPnl,
              executionId: oppositeExec.id,
            });

            void ctx.cancelPendingEntryOrders(walletId, symbol, oppositeExec.id);
            setTimeout(() => {
              void ctx.closeResidualPosition(walletId, symbol, oppositeExec.id);
            }, 3000);
          }

          return;
        }

        const [manualOrder] = await db
          .select()
          .from(orders)
          .where(and(eq(orders.walletId, walletId), eq(orders.orderId, String(orderId))))
          .limit(1);

        if (!manualOrder) {
          logger.warn({ walletId, symbol, orderId, openCount: openExecutions.length }, '[FuturesUserStream] No open execution found');
          return;
        }

        const direction: 'LONG' | 'SHORT' = orderSide === 'BUY' ? 'LONG' : 'SHORT';
        const oppositeDirection = direction === 'LONG' ? 'SHORT' : 'LONG';
        const fillPrice = parseFloat(avgPrice || lastFilledPrice);
        const fillQty = parseFloat(executedQty || manualOrder.origQty || '0');

        const [existingOpposite] = await db
          .select({ id: tradeExecutions.id })
          .from(tradeExecutions)
          .where(
            and(
              eq(tradeExecutions.walletId, walletId),
              eq(tradeExecutions.symbol, symbol),
              eq(tradeExecutions.side, oppositeDirection),
              eq(tradeExecutions.status, 'open'),
              eq(tradeExecutions.marketType, 'FUTURES')
            )
          )
          .limit(1);

        if (existingOpposite) {
          logger.info({ symbol, orderId, direction, existingOpposite: existingOpposite.id }, '[FuturesUserStream] Skipped execution creation — reduce fill against existing opposite position');
          return;
        }

        const walletRow = await ctx.getCachedWallet(walletId);
        if (!walletRow) return;

        let manualLeverage = 1;
        let manualLiquidationPrice: string | undefined;
        const conn = ctx.connections.get(walletId);
        if (conn) {
          try {
            const pos = await getPosition(conn.apiClient, symbol);
            if (pos) {
              manualLeverage = Number(pos.leverage) || 1;
              const lp = parseFloat(pos.liquidationPrice || '0');
              if (lp > 0) manualLiquidationPrice = lp.toString();
            }
          } catch {}
        }

        await db.insert(tradeExecutions).values({
          id: generateEntityId(),
          userId: walletRow.userId,
          walletId,
          symbol,
          side: direction,
          entryOrderId: String(orderId),
          entryPrice: fillPrice.toString(),
          quantity: fillQty.toString(),
          status: 'open',
          openedAt: new Date(),
          entryOrderType: manualOrder.type === 'MARKET' ? 'MARKET' : 'LIMIT',
          marketType: 'FUTURES',
          leverage: manualLeverage,
          liquidationPrice: manualLiquidationPrice,
        });

        logger.info({ symbol, orderId, direction, fillPrice, fillQty }, '[FuturesUserStream] Created tradeExecution for manual order fill');
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
      const leverage = execution.leverage || 1;
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

              const existingPartialPnl = parseFloat(execution.partialClosePnl || '0');
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

              await db.insert(realizedPnlEvents).values({
                walletId,
                userId: execution.userId,
                executionId: execution.id,
                symbol,
                eventType: 'partial_close',
                pnl: partialPnl.toString(),
                fees: '0',
                quantity: closedQty.toString(),
                price: exitPrice.toString(),
              });

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

              const hasProtection = execution.stopLoss || execution.takeProfit;
              if (hasProtection) ctx.scheduleDebouncedSlTpUpdate(execution.id, walletId, symbol);

              binancePriceStreamService.invalidateExecutionCache(symbol);

              const wsService = getWebSocketService();
              if (wsService) {
                wsService.emitPositionUpdate(walletId, {
                  ...execution,
                  quantity: remainingQty.toString(),
                  entryPrice: exchangeEntryPrice.toString(),
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
      let actualEntryFee = parseFloat(execution.entryFee || '0');

      try {
        const connection = ctx.connections.get(walletId);
        if (connection) {
          const openedAt = execution.openedAt?.getTime() || execution.createdAt.getTime();
          const allFees = await getAllTradeFeesForPosition(connection.apiClient, symbol, execution.side, openedAt);
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
          const connection = ctx.connections.get(walletId);
          if (connection) {
            const feeResult = await getOrderEntryFee(connection.apiClient, symbol, execution.entryOrderId);
            if (feeResult) actualEntryFee = feeResult.entryFee;
          }
        } catch (_e) { /* entry fee fetch is best-effort */ }
      }

      const accumulatedFunding = parseFloat(execution.accumulatedFunding || '0');

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
      const partialClosePnl = parseFloat(execution.partialClosePnl || '0');
      const pnl = pnlResult.netPnl + partialClosePnl;
      const pnlPercent = pnlResult.pnlPercent;
      const totalFees = actualEntryFee + actualExitFee;

      const determinedExitReason = isAlgoTriggerFill
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

      await db.insert(realizedPnlEvents).values({
        walletId,
        userId: execution.userId,
        executionId: execution.id,
        symbol,
        eventType: 'full_close',
        pnl: pnlResult.netPnl.toString(),
        fees: totalFees.toString(),
        quantity: quantity.toString(),
        price: exitPrice.toString(),
      });

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
      }

      getPositionEventBus().emitPositionClosed({
        walletId,
        symbol,
        side: execution.side as 'LONG' | 'SHORT',
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
