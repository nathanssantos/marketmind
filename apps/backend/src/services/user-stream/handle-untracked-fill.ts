import type { PositionSide } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions, orders } from '../../db/schema';
import { getConfiguredLeverage, getPosition } from '../binance-futures-client';
import { generateEntityId } from '../../utils/id';
import { logger } from '../logger';
import { binancePriceStreamService } from '../binance-price-stream';
import { getWebSocketService } from '../websocket';
import { getPositionEventBus } from '../scalping/position-event-bus';
import type { UserStreamContext } from './types';
import { emitPositionClosedToast, emitPositionOpenedToast } from './emit-position-toast';
import { emitPositionClosedEvents, incrementWalletBalanceAndBroadcast } from '../wallet-broadcast';

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

  const reduceDirection: PositionSide = orderSide === 'BUY' ? 'SHORT' : 'LONG';
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

  // PnL on the closed portion. When the order's executedQty exceeds
  // the position size (flip case), only the position-size portion
  // realizes PnL; the excess opens a new opposite-side position with
  // realizedPnl=0 on its leg. Use min(closedQty, execQty) so we don't
  // over-attribute PnL on a flip.
  const closedAgainstPosition = Math.min(closedQty, execQty);
  const partialPnl = oppositeExec.side === 'LONG'
    ? (exitPrice - entryPrice) * closedAgainstPosition
    : (entryPrice - exitPrice) * closedAgainstPosition;

  const connection = ctx.connections.get(walletId);
  let remainingQty = execQty - closedQty;
  let exchangeEntryPrice = entryPrice;
  // Sign-aware: positive = LONG, negative = SHORT, 0 = flat. Without
  // this we lost track of position direction on flips — the handler
  // would update the DB exec's quantity to 0.5 while keeping
  // side='LONG' even when Binance had already flipped to SHORT 0.5
  // (this caused phantom-PnL incidents like 2026-05-07T23:38).
  let exchangePositionAmt = oppositeExec.side === 'LONG' ? execQty : -execQty;

  if (connection) {
    try {
      const exchangePos = await getPosition(connection.apiClient, symbol);
      if (exchangePos) {
        exchangePositionAmt = parseFloat(exchangePos.positionAmt);
        remainingQty = Math.abs(exchangePositionAmt);
        exchangeEntryPrice = parseFloat(exchangePos.entryPrice) || entryPrice;
      }
    } catch (_e) {
      logger.warn({ walletId, symbol }, '[FuturesUserStream] Failed to fetch exchange position for untracked reduce fill');
    }
  }

  // Flip detection: Binance's positionAmt sign disagrees with our
  // tracked exec's side. The position closed and re-opened in the
  // opposite direction within the same fill (one-way mode + non-
  // reduceOnly order). Treat as a full close of the existing exec;
  // the new opposite-side position gets picked up by handleManualOrderFill
  // on the next ORDER_TRADE_UPDATE or by position-sync's reconciliation.
  const expectedSign = oppositeExec.side === 'LONG' ? 1 : -1;
  const actualSign = exchangePositionAmt > 0 ? 1 : exchangePositionAmt < 0 ? -1 : 0;
  const flipped = actualSign !== 0 && actualSign !== expectedSign;

  if (flipped) {
    logger.warn(
      { walletId, symbol, executionId: oppositeExec.id, oldSide: oppositeExec.side, exchangeAmt: exchangePositionAmt, closedQty },
      '[FuturesUserStream] Flip detected on untracked reduce fill — closing original exec fully; new opposite-side exec will be created by next ORDER_TRADE_UPDATE / position-sync',
    );
  }

  if (!flipped && remainingQty > 0 && remainingQty < execQty) {
    const existingPartialPnl = parseFloat(oppositeExec.partialClosePnl ?? '0');
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

    await incrementWalletBalanceAndBroadcast(walletId, partialPnl);

    logger.info(
      { executionId: oppositeExec.id, symbol, closedQty, remainingQty, partialPnl: partialPnl.toFixed(4) },
      '[FuturesUserStream] Untracked reduce fill — partial close applied'
    );

    const hasProtection = oppositeExec.stopLoss ?? oppositeExec.takeProfit;
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
    const existingPartialPnl = parseFloat(oppositeExec.partialClosePnl ?? '0');
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

    await incrementWalletBalanceAndBroadcast(walletId, partialPnl);

    logger.info(
      { executionId: oppositeExec.id, symbol, totalPnl: totalPnl.toFixed(4), exitPrice },
      '[FuturesUserStream] Untracked reduce fill — full close applied'
    );

    binancePriceStreamService.invalidateExecutionCache(symbol);

    emitPositionClosedEvents({
      walletId,
      execution: oppositeExec,
      symbol,
      exitPrice,
      pnl: totalPnl,
      pnlPercent: 0,
      exitReason: 'REDUCE_ORDER',
    });

    const wsService = getWebSocketService();
    if (wsService) {
      emitPositionClosedToast(wsService, walletId, {
        executionId: oppositeExec.id,
        symbol,
        side: oppositeExec.side,
        exitPrice,
        pnl: totalPnl,
        pnlPercent: 0,
        exitReason: 'REDUCE_ORDER',
        source: 'UNTRACKED_FILL',
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

  const direction: PositionSide = orderSide === 'BUY' ? 'LONG' : 'SHORT';
  const oppositeDirection = direction === 'LONG' ? 'SHORT' : 'LONG';
  const fillPrice = parseFloat(avgPrice || lastFilledPrice);
  const fillQty = parseFloat(executedQty || (manualOrder.origQty ?? '0'));

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

  // Race guard: position-sync (30s interval + on-reconnect) may have
  // already inserted an "unknown position" exec for this fill while
  // user-stream was processing it. Without this check the Portfolio
  // briefly displayed double exposure (handleManualOrderFill + sync
  // both inserted, summing qty). If a same-side open exec already
  // exists, position-sync owns the row and will keep it in sync; we
  // skip our insert.
  const [existingSameSide] = await db
    .select({ id: tradeExecutions.id })
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, walletId),
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.side, direction),
        eq(tradeExecutions.status, 'open'),
        eq(tradeExecutions.marketType, 'FUTURES')
      )
    )
    .limit(1);

  if (existingSameSide) {
    logger.info(
      { symbol, orderId, direction, existingSameSide: existingSameSide.id },
      '[FuturesUserStream] Skipped execution creation — same-side open exec already exists (likely from position-sync)'
    );
    return;
  }

  const walletRow = await ctx.getCachedWallet(walletId);
  if (!walletRow) return;

  // Leverage and liquidation price are pulled separately:
  // - leverage from getConfiguredLeverage (accountInfoV3 lookup by
  //   symbol — doesn't depend on positionSide matching across V3
  //   endpoints, which can be out of sync immediately after a fill)
  // - liquidationPrice from getPosition (positionRisk has the live
  //   value once the position is opened)
  // Previously both came from getPosition, which delegated leverage
  // through a `${symbol}_${positionSide}` map lookup that fell back
  // to 1 whenever accountInfoV3 hadn't propagated the new position
  // yet. The chart's PnL% then read 1× and showed the raw notional
  // move (e.g. -0.07%) instead of the leveraged equivalent (-0.7%
  // for 10×).
  let manualLeverage = 1;
  let manualLiquidationPrice: string | undefined;
  const conn = ctx.connections.get(walletId);
  if (conn) {
    try {
      manualLeverage = await getConfiguredLeverage(conn.apiClient, symbol);
    } catch { /* best-effort */ }
    try {
      const pos = await getPosition(conn.apiClient, symbol);
      if (pos) {
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

    // v1.6 Track F.4 — POSITION_OPENED toast for manual fills (orders
    // placed directly on Binance UI, not initiated from MarketMind).
    emitPositionOpenedToast(wsService, walletId, {
      executionId: insertedExec.id,
      symbol,
      side: direction,
      entryPrice: fillPrice,
      quantity: fillQty,
      source: 'MANUAL_FILL',
    });
  }

  logger.info({ symbol, orderId, direction, fillPrice, fillQty, executionId: newExecutionId }, '[FuturesUserStream] Created tradeExecution for manual order fill + emitted WS');
}
