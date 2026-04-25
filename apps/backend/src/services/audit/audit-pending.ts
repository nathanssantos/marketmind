import type { PositionSide } from '@marketmind/types';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { orders, tradeExecutions } from '../../db/schema';
import { logger } from '../logger';
import type { AuditContext } from './audit-types';
import { generateExecutionId, PENDING_GRACE_PERIOD_MS } from './audit-types';

export async function auditPending(ctx: AuditContext): Promise<void> {
  const { wallet, dryRun, summary, dbPendingExecutions, openOrderIds, openAlgoOrderIds, openAlgoOrders, linkedAlgoIds } = ctx;

  const now = Date.now();
  for (const dbPending of dbPendingExecutions) {
    const entryOrderId = dbPending.entryOrderId;
    if (!entryOrderId) continue;

    const createdAt = dbPending.createdAt.getTime();
    const age = now - createdAt;
    if (age < PENDING_GRACE_PERIOD_MS) continue;

    if (!openOrderIds.has(entryOrderId) && !openAlgoOrderIds.has(entryOrderId)) {
      logger.info(
        { walletId: wallet.id, symbol: dbPending.symbol, executionId: dbPending.id, entryOrderId },
        '[startup-audit] Cancelled orphaned pending execution (entry order gone)'
      );

      if (!dryRun) {
        await db
          .update(tradeExecutions)
          .set({ status: 'cancelled', updatedAt: new Date() })
          .where(eq(tradeExecutions.id, dbPending.id));
      }

      summary.fixed++;
    }
  }

  const pendingEntryOrderIds = new Set(
    dbPendingExecutions.map((e) => e.entryOrderId).filter(Boolean) as string[]
  );

  const entryLimitOrders = ctx.openOrders.filter(
    (o) => !o.reduceOnly && !o.closePosition && o.type === 'LIMIT'
  );

  for (const openOrder of entryLimitOrders) {
    if (pendingEntryOrderIds.has(openOrder.orderId)) continue;

    const [existingPending] = await db
      .select({ id: tradeExecutions.id })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.entryOrderId, openOrder.orderId)
        )
      )
      .limit(1);

    if (existingPending) continue;

    const side: PositionSide = openOrder.side === 'BUY' ? 'LONG' : 'SHORT';
    const executionId = generateExecutionId();

    logger.info(
      { walletId: wallet.id, symbol: openOrder.symbol, orderId: openOrder.orderId, side, executionId },
      '[startup-audit] Open LIMIT entry order has no pending execution — creating'
    );

    if (!dryRun) {
      const [existingOrder] = await db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(eq(orders.orderId, openOrder.orderId))
        .limit(1);

      if (!existingOrder) {
        await db.insert(orders).values({
          orderId: openOrder.orderId,
          userId: wallet.userId,
          walletId: wallet.id,
          symbol: openOrder.symbol,
          side: openOrder.side,
          type: openOrder.type,
          price: openOrder.price,
          origQty: openOrder.origQty,
          executedQty: openOrder.executedQty,
          status: openOrder.status,
          timeInForce: openOrder.timeInForce,
          time: openOrder.time,
          updateTime: openOrder.updateTime,
          marketType: 'FUTURES',
          reduceOnly: openOrder.reduceOnly,
        });
      }

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: wallet.userId,
        walletId: wallet.id,
        symbol: openOrder.symbol,
        side,
        entryOrderId: openOrder.orderId,
        entryPrice: openOrder.price,
        limitEntryPrice: openOrder.price,
        quantity: openOrder.origQty,
        status: 'pending',
        openedAt: new Date(openOrder.time ?? Date.now()),
        entryOrderType: 'LIMIT',
        marketType: 'FUTURES',
        exitSource: 'MANUAL',
      });
    }

    summary.fixed++;
  }

  const pendingAlgoEntryIds = new Set(
    dbPendingExecutions.map((e) => e.entryOrderId).filter(Boolean) as string[]
  );

  const algoEntryOrders = openAlgoOrders.filter(
    (o) =>
      !o.reduceOnly &&
      !o.closePosition &&
      (o.type === 'STOP_MARKET' || o.type === 'TAKE_PROFIT_MARKET') &&
      !linkedAlgoIds.has(o.algoId)
  );

  for (const algoOrder of algoEntryOrders) {
    if (pendingAlgoEntryIds.has(algoOrder.algoId)) continue;

    const [existingPending] = await db
      .select({ id: tradeExecutions.id })
      .from(tradeExecutions)
      .where(
        and(
          eq(tradeExecutions.walletId, wallet.id),
          eq(tradeExecutions.entryOrderId, algoOrder.algoId)
        )
      )
      .limit(1);

    if (existingPending) continue;

    const side: PositionSide = algoOrder.side === 'BUY' ? 'LONG' : 'SHORT';
    const executionId = generateExecutionId();
    const entryOrderType = algoOrder.type === 'STOP_MARKET' ? 'STOP_MARKET' : 'TAKE_PROFIT_MARKET';

    logger.info(
      { walletId: wallet.id, symbol: algoOrder.symbol, algoId: algoOrder.algoId, side, executionId, entryOrderType },
      '[startup-audit] Open algo entry order has no pending execution — creating'
    );

    if (!dryRun) {
      const [existingOrder] = await db
        .select({ orderId: orders.orderId })
        .from(orders)
        .where(eq(orders.orderId, algoOrder.algoId))
        .limit(1);

      if (!existingOrder) {
        await db.insert(orders).values({
          orderId: algoOrder.algoId,
          userId: wallet.userId,
          walletId: wallet.id,
          symbol: algoOrder.symbol,
          side: algoOrder.side,
          type: algoOrder.type,
          price: algoOrder.triggerPrice ?? null,
          origQty: algoOrder.quantity,
          executedQty: '0',
          status: algoOrder.algoStatus ?? 'NEW',
          marketType: 'FUTURES',
          reduceOnly: algoOrder.reduceOnly,
        });
      }

      await db.insert(tradeExecutions).values({
        id: executionId,
        userId: wallet.userId,
        walletId: wallet.id,
        symbol: algoOrder.symbol,
        side,
        entryOrderId: algoOrder.algoId,
        entryPrice: algoOrder.triggerPrice ?? '0',
        limitEntryPrice: algoOrder.triggerPrice,
        quantity: algoOrder.quantity,
        status: 'pending',
        openedAt: new Date(algoOrder.createTime ?? Date.now()),
        entryOrderType,
        marketType: 'FUTURES',
        exitSource: 'MANUAL',
      });
    }

    summary.fixed++;
  }
}
