import type { PositionSide } from '@marketmind/types';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets } from '../../db/schema';
import { calculatePnl } from '@marketmind/utils';
import { getOrderEntryFee, getLastClosingTrade, getAllTradeFeesForPosition, getPosition, closePosition, cancelAllSymbolOrders } from '../binance-futures-client';
import { logger, serializeError } from '../logger';
import { positionSyncService } from '../position-sync';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import { getPositionEventBus } from '../scalping/position-event-bus';
import type { UserStreamContext } from './types';
import { emitPositionClosedToast } from './emit-position-close-toast';

export async function verifyAlgoFillProcessed(
  ctx: UserStreamContext,
  walletId: string,
  executionId: string,
  symbol: string,
  side: PositionSide,
  openedAt: number,
  exitReason: string
): Promise<void> {
  try {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.id, executionId),
          eq(tradeExecutions.status, 'open')
        )
      )
      .limit(1);

    if (!execution) return;

    logger.warn(
      { walletId, executionId, symbol, exitReason },
      '[FuturesUserStream] ! Position still open 10s after algo trigger - fetching fill from REST API'
    );

    const apiClient = ctx.connections.get(walletId)?.apiClient;
    if (!apiClient) {
      logger.error({ walletId, executionId }, '[FuturesUserStream] No API client for delayed verification - falling back to position sync');
      const wallet = await ctx.getCachedWallet(walletId);
      if (wallet) await positionSyncService.syncWallet(wallet);
      return;
    }

    const closingTrade = await getLastClosingTrade(apiClient, symbol, side, openedAt);

    if (!closingTrade) {
      logger.warn({ walletId, executionId, symbol }, '[FuturesUserStream] No closing trade found yet - scheduling retry');
      setTimeout(() => {
        void ctx.verifyAlgoFillProcessed(walletId, executionId, symbol, side, openedAt, exitReason);
      }, 10_000);
      return;
    }

    const exitPrice = closingTrade.price;
    const exitFee = closingTrade.commission;
    const entryPrice = parseFloat(execution.entryPrice);
    const quantity = parseFloat(execution.quantity);
    const leverage = execution.leverage ?? 1;
    let entryFee = parseFloat(execution.entryFee ?? '0');

    if (entryFee === 0 && execution.entryOrderId) {
      try {
        const feeResult = await getOrderEntryFee(apiClient, symbol, execution.entryOrderId);
        if (feeResult && feeResult.entryFee > 0) entryFee = feeResult.entryFee;
      } catch (_e) { /* entry fee fetch is best-effort */ }
    }

    const accumulatedFunding = parseFloat(execution.accumulatedFunding ?? '0');

    const pnlResult = calculatePnl({
      entryPrice,
      exitPrice,
      quantity,
      side,
      marketType: 'FUTURES',
      leverage,
      accumulatedFunding,
      entryFee: entryFee,
      exitFee,
    });
    const partialClosePnl = parseFloat(execution.partialClosePnl ?? '0');
    const pnl = pnlResult.netPnl + partialClosePnl;
    const pnlPercent = pnlResult.pnlPercent;
    const totalFees = entryFee + exitFee;

    const closeResult = await db
      .update(tradeExecutions)
      .set({
        status: 'closed',
        exitPrice: exitPrice.toString(),
        closedAt: new Date(),
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toString(),
        fees: totalFees.toString(),
        entryFee: entryFee.toString(),
        exitFee: exitFee.toString(),
        exitSource: 'ALGO_VERIFICATION',
        exitReason,
        stopLossAlgoId: null,
        stopLossOrderId: null,
        takeProfitAlgoId: null,
        takeProfitOrderId: null,
        trailingStopAlgoId: null,
        updatedAt: new Date(),
      })
      .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.status, 'open')))
      .returning({ id: tradeExecutions.id });

    if (closeResult.length === 0) {
      logger.info({ executionId }, '[FuturesUserStream] Position already closed by ORDER_TRADE_UPDATE - verification no-op');
      return;
    }

    await db
      .update(wallets)
      .set({
        currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnlResult.netPnl}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId));

    binancePriceStreamService.invalidateExecutionCache(symbol);

    const wsService = getWebSocketService();
    if (wsService) {
      wsService.emitPositionUpdate(walletId, {
        ...execution,
        status: 'closed',
        exitPrice: exitPrice.toString(),
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toString(),
        exitReason,
      });

      wsService.emitOrderUpdate(walletId, {
        id: execution.id,
        symbol,
        status: 'closed',
        exitPrice: exitPrice.toString(),
        pnl: pnl.toString(),
        pnlPercent: pnlPercent.toString(),
        exitReason,
      });

      wsService.emitPositionClosed(walletId, {
        positionId: execution.id,
        symbol,
        side: execution.side,
        exitReason: exitReason ?? 'STOP_LOSS',
        pnl,
        pnlPercent,
      });

      emitPositionClosedToast(wsService, walletId, {
        executionId: execution.id,
        symbol,
        side: execution.side,
        exitPrice,
        pnl,
        pnlPercent,
        exitReason: exitReason ?? 'STOP_LOSS',
        source: 'ALGO_VERIFY',
      });
    }

    getPositionEventBus().emitPositionClosed({
      walletId,
      symbol,
      side: execution.side,
      pnl,
      executionId,
    });

    logger.warn(
      {
        executionId,
        symbol,
        exitPrice: exitPrice.toFixed(4),
        pnl: pnl.toFixed(2),
        pnlPercent: pnlPercent.toFixed(2),
        exitReason,
      },
      '[FuturesUserStream] ! Position closed via ALGO_VERIFICATION (ORDER_TRADE_UPDATE was missed)'
    );

    void ctx.cancelPendingEntryOrders(walletId, symbol, executionId);

    setTimeout(() => {
      void ctx.closeResidualPosition(walletId, symbol, executionId);
    }, 3000);
  } catch (error) {
    logger.error(
      { executionId, symbol, error: serializeError(error) },
      '[FuturesUserStream] Error in algo fill verification'
    );
  }
}

export async function closeResidualPosition(
  ctx: UserStreamContext,
  walletId: string,
  symbol: string,
  executionId: string
): Promise<void> {
  try {
    const apiClient = ctx.connections.get(walletId)?.apiClient;
    if (!apiClient) return;

    const otherOpen = await db
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

    const position = await getPosition(apiClient, symbol);
    const positionAmt = position ? parseFloat(String(position.positionAmt)) : 0;

    if (otherOpen.length > 0 && positionAmt === 0) {
      logger.warn(
        { walletId, symbol, executionId, orphanedCount: otherOpen.length },
        '[FuturesUserStream] Binance position is zero but sibling executions remain open - closing all'
      );

      let actualExitPrice: number | null = null;
      try {
        const firstOrphan = otherOpen[0]!;
        const side = firstOrphan.side === 'LONG' ? 'LONG' : 'SHORT';
        const openedAt = firstOrphan.createdAt ? new Date(firstOrphan.createdAt).getTime() : Date.now() - 86_400_000;
        const fees = await getAllTradeFeesForPosition(apiClient, symbol, side, openedAt);
        if (fees && fees.exitPrice > 0) actualExitPrice = fees.exitPrice;
      } catch (feeErr) {
        logger.warn({ walletId, symbol, error: serializeError(feeErr) }, '[FuturesUserStream] Failed to fetch trade fees for orphaned siblings');
      }

      const [wallet] = await db.select().from(wallets).where(eq(wallets.id, walletId)).limit(1);

      for (const orphan of otherOpen) {
        try {
          const entryPrice = parseFloat(orphan.entryPrice);
          const quantity = parseFloat(orphan.quantity);
          const exitPrice = actualExitPrice ?? entryPrice;
          const accumulatedFunding = parseFloat(orphan.accumulatedFunding ?? '0');
          const actualEntryFee = parseFloat(orphan.entryFee ?? '0');

          const pnlResult = calculatePnl({
            entryPrice,
            exitPrice,
            quantity,
            side: orphan.side,
            marketType: 'FUTURES',
            leverage: orphan.leverage ?? 1,
            accumulatedFunding,
          });
          const partialClosePnl = parseFloat(orphan.partialClosePnl ?? '0');
          const pnl = pnlResult.netPnl + partialClosePnl;
          const totalFees = pnlResult.totalFees;

          const closeResult = await db
            .update(tradeExecutions)
            .set({
              status: 'closed',
              exitPrice: exitPrice.toString(),
              closedAt: new Date(),
              pnl: pnl.toString(),
              pnlPercent: pnlResult.pnlPercent.toString(),
              fees: totalFees.toString(),
              entryFee: actualEntryFee.toString(),
              exitFee: (totalFees - actualEntryFee).toString(),
              exitSource: 'EXCHANGE_SYNC',
              exitReason: 'STOP_LOSS',
              stopLossAlgoId: null,
              stopLossOrderId: null,
              takeProfitAlgoId: null,
              takeProfitOrderId: null,
              updatedAt: new Date(),
            })
            .where(and(eq(tradeExecutions.id, orphan.id), eq(tradeExecutions.status, 'open')))
            .returning({ id: tradeExecutions.id });

          if (closeResult.length === 0) continue;

          if (wallet) {
            await db
              .update(wallets)
              .set({
                currentBalance: sql`CAST(${wallets.currentBalance} AS DECIMAL(20,8)) + ${pnl}`,
                updatedAt: new Date(),
              })
              .where(eq(wallets.id, walletId));
          }

          binancePriceStreamService.invalidateExecutionCache(symbol);

          const wsService = getWebSocketService();
          if (wsService) {
            wsService.emitPositionUpdate(walletId, {
              ...orphan,
              status: 'closed',
              exitPrice: exitPrice.toString(),
              pnl: pnl.toString(),
              pnlPercent: pnlResult.pnlPercent.toString(),
            });

            wsService.emitPositionClosed(walletId, {
              positionId: orphan.id,
              symbol,
              side: orphan.side,
              exitReason: 'STOP_LOSS',
              pnl,
              pnlPercent: pnlResult.pnlPercent,
            });

            emitPositionClosedToast(wsService, walletId, {
              executionId: orphan.id,
              symbol,
              side: orphan.side,
              exitPrice,
              pnl,
              pnlPercent: pnlResult.pnlPercent,
              exitReason: 'STOP_LOSS',
              source: 'ORPHAN_CLEANUP',
            });
          }

          getPositionEventBus().emitPositionClosed({
            walletId,
            symbol,
            side: orphan.side,
            pnl,
            executionId: orphan.id,
          });

          logger.info(
            { executionId: orphan.id, symbol, exitPrice: exitPrice.toFixed(2), pnl: pnl.toFixed(2) },
            '[FuturesUserStream] Orphaned sibling execution closed (Binance position was zero)'
          );
        } catch (orphanErr) {
          logger.error(
            { executionId: orphan.id, symbol, error: serializeError(orphanErr) },
            '[FuturesUserStream] Failed to close orphaned sibling execution'
          );
        }
      }
      return;
    }

    if (otherOpen.length > 0) return;

    if (positionAmt !== 0) {
      logger.warn(
        { walletId, symbol, executionId, residualQty: positionAmt },
        '[FuturesUserStream] Residual position detected after close - closing automatically'
      );
      await closePosition(apiClient, symbol, String(positionAmt));
      logger.info(
        { walletId, symbol, executionId, closedQty: positionAmt },
        '[FuturesUserStream] Residual position closed successfully'
      );
    }

    try {
      await cancelAllSymbolOrders(apiClient, symbol);
      logger.info({ walletId, symbol, executionId }, '[FuturesUserStream] Safety cleanup: cancelled all remaining orders for symbol after close');
    } catch (cleanupErr) {
      const msg = serializeError(cleanupErr);
      if (!msg.includes('No orders') && !msg.includes('not found'))
        {logger.warn({ walletId, symbol, error: msg }, '[FuturesUserStream] Failed to cleanup remaining orders after close');}
    }
  } catch (error) {
    logger.error(
      { walletId, symbol, executionId, error: serializeError(error) },
      '[FuturesUserStream] Failed to close residual position'
    );
  }
}
