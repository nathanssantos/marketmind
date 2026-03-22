import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { tradeExecutions } from '../../db/schema';
import { createStopLossOrder, createTakeProfitOrder, cancelAllOpenProtectionOrdersOnExchange } from '../protection-orders';
import type { ProtectionOrderResult } from '../protection-orders';
import { logger, serializeError } from '../logger';
import type { UserStreamContext } from './types';

const placeOrderWithRetry = async (
  placeFn: () => Promise<ProtectionOrderResult>,
  label: string,
  symbol: string,
  executionId: string,
): Promise<ProtectionOrderResult | null> => {
  try {
    return await placeFn();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Unknown order') || msg.includes('-2011')) {
      await new Promise(r => setTimeout(r, 100));
      try {
        return await placeFn();
      } catch (retryErr) {
        logger.error({ error: serializeError(retryErr), symbol, executionId }, `[FuturesUserStream] CRITICAL: Failed to place debounced ${label} after retry`);
      }
    } else {
      logger.error({ error: serializeError(e), symbol, executionId }, `[FuturesUserStream] CRITICAL: Failed to place debounced ${label} — position may be unprotected`);
    }
    return null;
  }
};

const buildProtectionUpdate = (
  result: ProtectionOrderResult | null,
  price: number | null,
  prefix: 'stopLoss' | 'takeProfit',
): Record<string, unknown> => {
  const update: Record<string, unknown> = {};
  if (result) {
    update[`${prefix}AlgoId`] = result.isAlgoOrder ? (result.algoId ?? null) : null;
    update[`${prefix}OrderId`] = result.isAlgoOrder ? null : (result.orderId ?? null);
    update[`${prefix}IsAlgo`] = result.isAlgoOrder;
  } else if (price) {
    update[`${prefix}AlgoId`] = null;
    update[`${prefix}OrderId`] = null;
    update[`${prefix}IsAlgo`] = false;
  }
  return update;
};

export const executeDebouncedSlTpUpdate = async (
  ctx: UserStreamContext,
  executionId: string,
  walletId: string,
  symbol: string,
): Promise<void> => {
  try {
    const [execution] = await db
      .select()
      .from(tradeExecutions)
      .where(and(eq(tradeExecutions.id, executionId), eq(tradeExecutions.status, 'open')))
      .limit(1);
    if (!execution) return;

    const walletRow = await ctx.getCachedWallet(walletId);
    if (!walletRow) return;

    const slPrice = execution.stopLoss ? parseFloat(execution.stopLoss) : null;
    const tpPrice = execution.takeProfit ? parseFloat(execution.takeProfit) : null;
    if (!slPrice && !tpPrice) return;

    const qty = parseFloat(execution.quantity);

    await cancelAllOpenProtectionOrdersOnExchange({ wallet: walletRow, symbol, marketType: 'FUTURES' });

    const newSlResult = slPrice
      ? await placeOrderWithRetry(
          () => createStopLossOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: slPrice, marketType: 'FUTURES' }),
          'SL', symbol, executionId,
        )
      : null;

    const newTpResult = tpPrice
      ? await placeOrderWithRetry(
          () => createTakeProfitOrder({ wallet: walletRow, symbol, side: execution.side, quantity: qty, triggerPrice: tpPrice, marketType: 'FUTURES' }),
          'TP', symbol, executionId,
        )
      : null;

    const slUpdate = buildProtectionUpdate(newSlResult, slPrice, 'stopLoss');
    const tpUpdate = buildProtectionUpdate(newTpResult, tpPrice, 'takeProfit');

    await db.update(tradeExecutions).set({
      ...slUpdate,
      ...tpUpdate,
      updatedAt: new Date(),
    }).where(eq(tradeExecutions.id, executionId));

    logger.info({ executionId, symbol, qty }, '[FuturesUserStream] Debounced SL/TP update after pyramid');
  } catch (e) {
    logger.error({ error: serializeError(e), executionId, symbol }, '[FuturesUserStream] Debounced SL/TP update failed');
  }
};
