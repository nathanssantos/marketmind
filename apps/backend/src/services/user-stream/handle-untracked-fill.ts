import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, wallets, orders } from '../../db/schema';
import { getPosition } from '../binance-futures-client';
import { generateEntityId } from '../../utils/id';
import { logger } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import { getPositionEventBus } from '../scalping/position-event-bus';
import type { UserStreamContext } from './types';

export async function handleUntrackedReduceFill(
  ctx: UserStreamContext,
  walletId: string,
  symbol: string,
  orderSide: 'BUY' | 'SELL',
  orderId: number,
  avgPrice: string,
  lastFilledPrice: string,
  executedQty: string,
  realizedProfit: string,
  commission: string,
): Promise<boolean> {
  const rp = parseFloat(realizedProfit || '0');
  if (rp === 0) return false;

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
    return true;
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
      side: oppositeExec.side,
      pnl: totalPnl,
      executionId: oppositeExec.id,
    });

    void ctx.cancelPendingEntryOrders(walletId, symbol, oppositeExec.id);
    setTimeout(() => {
      void ctx.closeResidualPosition(walletId, symbol, oppositeExec.id);
    }, 3000);
  }

  return true;
}

export async function handleManualOrderFill(
  ctx: UserStreamContext,
  walletId: string,
  symbol: string,
  orderSide: 'BUY' | 'SELL',
  orderId: number,
  avgPrice: string,
  lastFilledPrice: string,
  executedQty: string,
  openExecutionCount: number,
): Promise<void> {
  const [manualOrder] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.walletId, walletId), eq(orders.orderId, String(orderId))))
    .limit(1);

  if (!manualOrder) {
    logger.warn({ walletId, symbol, orderId, openCount: openExecutionCount }, '[FuturesUserStream] No open execution found');
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
    } catch { /* best-effort */ }
  }

  const newExecutionId = generateEntityId();
  await db.insert(tradeExecutions).values({
    id: newExecutionId,
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

  binancePriceStreamService.invalidateExecutionCache(symbol);

  const [insertedExec] = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.id, newExecutionId))
    .limit(1);

  const wsService = getWebSocketService();
  if (wsService && insertedExec) {
    wsService.emitPositionUpdate(walletId, insertedExec);
    wsService.emitOrderUpdate(walletId, {
      id: insertedExec.id,
      orderId: String(orderId),
      symbol,
      side: direction,
      status: 'open',
      entryPrice: fillPrice.toString(),
      quantity: fillQty.toString(),
    });
  }

  logger.info({ symbol, orderId, direction, fillPrice, fillQty, executionId: newExecutionId }, '[FuturesUserStream] Created tradeExecution for manual order fill + emitted WS');
}
