import { eq } from 'drizzle-orm';
import { db } from '../db';
import { tradeExecutions, wallets, type TradeExecution, type Wallet } from '../db/schema';
import { cancelProtectionOrder } from './protection-orders';
import { logger } from './logger';

export const PROTECTION_ORDER_TYPES = {
  STOP_LOSS: 'STOP_MARKET',
  TAKE_PROFIT: 'TAKE_PROFIT_MARKET',
} as const;

export type ProtectionOrderField = 'stopLoss' | 'takeProfit';

export interface PnLResult {
  pnl: number;
  pnlPercent: number;
}

export function detectExitReason(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  exitPrice: number
): 'STOP_LOSS' | 'TAKE_PROFIT' {
  if (side === 'LONG') {
    return exitPrice < entryPrice ? 'STOP_LOSS' : 'TAKE_PROFIT';
  }
  return exitPrice > entryPrice ? 'STOP_LOSS' : 'TAKE_PROFIT';
}

export function calculatePnL(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  leverage: number,
  exitFee: number = 0,
  entryFee: number = 0
): PnLResult {
  const priceDiff = side === 'LONG'
    ? exitPrice - entryPrice
    : entryPrice - exitPrice;

  const rawPnl = priceDiff * quantity;
  const totalFees = entryFee + exitFee;
  const pnl = rawPnl - totalFees;

  const positionValue = entryPrice * quantity;
  const margin = positionValue / leverage;
  const pnlPercent = margin > 0 ? (pnl / margin) * 100 : 0;

  return { pnl, pnlPercent };
}

export async function clearProtectionOrderIds(
  executionId: string,
  field: ProtectionOrderField | 'both'
): Promise<void> {
  const updates: Partial<TradeExecution> = { updatedAt: new Date() };

  if (field === 'stopLoss' || field === 'both') {
    updates.stopLossAlgoId = null;
    updates.stopLossOrderId = null;
    updates.stopLoss = null;
  }

  if (field === 'takeProfit' || field === 'both') {
    updates.takeProfitAlgoId = null;
    updates.takeProfitOrderId = null;
    updates.takeProfit = null;
  }

  await db
    .update(tradeExecutions)
    .set(updates)
    .where(eq(tradeExecutions.id, executionId));

  logger.debug({ executionId, field }, '[ExecutionManager] Cleared protection order IDs');
}

export async function updateProtectionOrderId(
  executionId: string,
  field: ProtectionOrderField,
  newAlgoId: number | null,
  newTriggerPrice?: number
): Promise<void> {
  const updates: Partial<TradeExecution> = { updatedAt: new Date() };

  if (field === 'stopLoss') {
    updates.stopLossAlgoId = newAlgoId;
    if (newTriggerPrice !== undefined) {
      updates.stopLoss = newTriggerPrice.toString();
    }
  } else {
    updates.takeProfitAlgoId = newAlgoId;
    if (newTriggerPrice !== undefined) {
      updates.takeProfit = newTriggerPrice.toString();
    }
  }

  await db
    .update(tradeExecutions)
    .set(updates)
    .where(eq(tradeExecutions.id, executionId));

  logger.debug({ executionId, field, newAlgoId, newTriggerPrice }, '[ExecutionManager] Updated protection order ID');
}

export interface CloseExecutionParams {
  executionId: string;
  exitPrice: number;
  exitReason: string;
  exitSource?: string;
  exitFee?: number;
  realizedPnl?: number;
}

export async function closeExecutionWithPnL(params: CloseExecutionParams): Promise<TradeExecution | null> {
  const { executionId, exitPrice, exitReason, exitSource, exitFee = 0, realizedPnl } = params;

  const [execution] = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.id, executionId));

  if (!execution) {
    logger.warn({ executionId }, '[ExecutionManager] Execution not found for closing');
    return null;
  }

  if (execution.status === 'closed') {
    logger.warn({ executionId }, '[ExecutionManager] Execution already closed');
    return execution;
  }

  let pnl: number;
  let pnlPercent: number;

  if (realizedPnl !== undefined) {
    pnl = realizedPnl;
    const entryPrice = parseFloat(execution.entryPrice);
    const quantity = parseFloat(execution.quantity);
    const positionValue = entryPrice * quantity;
    pnlPercent = positionValue > 0 ? (pnl / positionValue) * 100 * (execution.leverage || 1) : 0;
  } else {
    const result = calculatePnL(
      execution.side,
      parseFloat(execution.entryPrice),
      exitPrice,
      parseFloat(execution.quantity),
      execution.leverage || 1,
      exitFee,
      parseFloat(execution.entryFee || '0')
    );
    pnl = result.pnl;
    pnlPercent = result.pnlPercent;
  }

  const [updated] = await db
    .update(tradeExecutions)
    .set({
      status: 'closed',
      exitPrice: exitPrice.toString(),
      exitReason,
      exitSource: exitSource || exitReason,
      pnl: pnl.toString(),
      pnlPercent: pnlPercent.toString(),
      exitFee: exitFee.toString(),
      closedAt: new Date(),
      stopLossAlgoId: null,
      stopLossOrderId: null,
      takeProfitAlgoId: null,
      takeProfitOrderId: null,
      updatedAt: new Date(),
    })
    .where(eq(tradeExecutions.id, executionId))
    .returning();

  logger.info({
    executionId,
    symbol: execution.symbol,
    exitPrice,
    exitReason,
    pnl,
    pnlPercent,
  }, '[ExecutionManager] Closed execution with PnL');

  return updated || null;
}

export interface CancelAndClearParams {
  wallet: Wallet;
  execution: TradeExecution;
  field: ProtectionOrderField;
}

export async function cancelAndClearProtectionOrder(params: CancelAndClearParams): Promise<boolean> {
  const { wallet, execution, field } = params;
  const marketType = execution.marketType || 'FUTURES';

  const algoId = field === 'stopLoss' ? execution.stopLossAlgoId : execution.takeProfitAlgoId;
  const orderId = field === 'stopLoss' ? execution.stopLossOrderId : execution.takeProfitOrderId;

  if (!algoId && !orderId) {
    logger.debug({ executionId: execution.id, field }, '[ExecutionManager] No order to cancel');
    return true;
  }

  const cancelled = await cancelProtectionOrder({
    wallet,
    symbol: execution.symbol,
    marketType,
    algoId,
    orderId,
  });

  if (cancelled) {
    await clearProtectionOrderIds(execution.id, field);
    logger.info({ executionId: execution.id, field, algoId, orderId }, '[ExecutionManager] Cancelled and cleared protection order');
  } else {
    logger.warn({ executionId: execution.id, field, algoId, orderId }, '[ExecutionManager] Failed to cancel protection order - may already be filled or cancelled');
  }

  return cancelled;
}

export async function cancelAllExecutionOrders(wallet: Wallet, execution: TradeExecution): Promise<void> {
  const marketType = execution.marketType || 'FUTURES';

  const promises: Promise<boolean>[] = [];

  if (execution.stopLossAlgoId || execution.stopLossOrderId) {
    promises.push(
      cancelProtectionOrder({
        wallet,
        symbol: execution.symbol,
        marketType,
        algoId: execution.stopLossAlgoId,
        orderId: execution.stopLossOrderId,
      })
    );
  }

  if (execution.takeProfitAlgoId || execution.takeProfitOrderId) {
    promises.push(
      cancelProtectionOrder({
        wallet,
        symbol: execution.symbol,
        marketType,
        algoId: execution.takeProfitAlgoId,
        orderId: execution.takeProfitOrderId,
      })
    );
  }

  await Promise.allSettled(promises);

  await clearProtectionOrderIds(execution.id, 'both');

  logger.info({ executionId: execution.id, symbol: execution.symbol }, '[ExecutionManager] Cancelled all protection orders for execution');
}

export async function getWalletById(walletId: string): Promise<Wallet | null> {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, walletId));
  return wallet || null;
}

export async function getExecutionById(executionId: string): Promise<TradeExecution | null> {
  const [execution] = await db
    .select()
    .from(tradeExecutions)
    .where(eq(tradeExecutions.id, executionId));
  return execution || null;
}

export function isClosingSide(executionSide: 'LONG' | 'SHORT', orderSide: 'BUY' | 'SELL'): boolean {
  return (executionSide === 'LONG' && orderSide === 'SELL') ||
         (executionSide === 'SHORT' && orderSide === 'BUY');
}

export async function syncProtectionOrderIdFromExchange(
  executionId: string,
  field: ProtectionOrderField,
  exchangeAlgoId: number,
  exchangeTriggerPrice: number
): Promise<void> {
  await updateProtectionOrderId(executionId, field, exchangeAlgoId, exchangeTriggerPrice);

  logger.info({
    executionId,
    field,
    exchangeAlgoId,
    exchangeTriggerPrice,
  }, '[ExecutionManager] Synced protection order ID from exchange');
}
