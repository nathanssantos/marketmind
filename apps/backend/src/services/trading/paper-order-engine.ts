import type { EntryOrderType, MarketType, PositionSide } from '@marketmind/types';
import { calculateLiquidationPrice, getDefaultFee } from '@marketmind/types';
import { calculateBreakevenPrice, calculatePnl } from '@marketmind/utils';
import { and, eq, inArray } from 'drizzle-orm';
import { PAPER_TRADING } from '../../constants/paper-trading';
import { db } from '../../db';
import { orders, tradeExecutions, wallets } from '../../db/schema';
import { serializeError } from '../../utils/errors';
import { formatPrice } from '../../utils/formatters';
import { generateEntityId } from '../../utils/id';
import { badRequest } from '../../utils/trpc-errors';
import { logger } from '../logger';
import { getCurrentPrice } from '../position-monitor/price-service';
import { closeExecutionAndBroadcast, incrementWalletBalanceAndBroadcast } from '../wallet-broadcast';
import { getWebSocketService } from '../websocket';
import { withWriteLock } from '../write-op-mutex';

type OrderSide = 'BUY' | 'SELL';
type TriggerKind = 'LIMIT' | 'STOP' | 'TAKE_PROFIT';
type ExecutionRow = typeof tradeExecutions.$inferSelect;
type OrderRow = typeof orders.$inferSelect;

export interface PaperOrderRequest {
  userId: string;
  walletId: string;
  symbol: string;
  side: OrderSide;
  type: string;
  quantity: string;
  marketType: MarketType;
  price?: string;
  stopPrice?: string;
  reduceOnly?: boolean;
  setupId?: string;
  setupType?: string;
  stopLoss?: string;
  takeProfit?: string;
  leverage?: number;
}

export interface PaperOrderResult {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: string;
  status: 'FILLED' | 'NEW';
  price: string;
  quantity: string;
  executedQty: string;
  marketType: MarketType;
}

interface PaperFill {
  userId: string;
  walletId: string;
  symbol: string;
  side: OrderSide;
  marketType: MarketType;
  quantity: number;
  price: number;
  orderId: string;
  entryOrderType: EntryOrderType;
  reduceOnly: boolean;
  leverage: number;
  setupId?: string | null;
  setupType?: string | null;
  stopLoss?: string | null;
  takeProfit?: string | null;
  pendingExecutionId?: string;
}

export interface PaperOrderCancellation {
  walletId: string;
  symbol?: string;
  orderId?: string;
}

const TRIGGER_KIND_BY_ORDER_TYPE: Record<string, TriggerKind> = {
  LIMIT: 'LIMIT',
  STOP: 'STOP',
  STOP_MARKET: 'STOP',
  STOP_LOSS: 'STOP',
  STOP_LOSS_LIMIT: 'STOP',
  TAKE_PROFIT: 'TAKE_PROFIT',
  TAKE_PROFIT_MARKET: 'TAKE_PROFIT',
  TAKE_PROFIT_LIMIT: 'TAKE_PROFIT',
};

const ENTRY_ORDER_TYPE_BY_TRIGGER_KIND: Record<TriggerKind, EntryOrderType> = {
  LIMIT: 'LIMIT',
  STOP: 'STOP_MARKET',
  TAKE_PROFIT: 'TAKE_PROFIT_MARKET',
};

let paperOrderSequence = 0;

export const generatePaperOrderId = (): string => {
  paperOrderSequence = (paperOrderSequence + 1) % PAPER_TRADING.ORDER_ID_SEQUENCE_SIZE;
  return String(Date.now() * PAPER_TRADING.ORDER_ID_SEQUENCE_SIZE + paperOrderSequence);
};

const toPositionSide = (side: OrderSide): PositionSide => (side === 'BUY' ? 'LONG' : 'SHORT');

const oppositeOf = (side: PositionSide): PositionSide => (side === 'LONG' ? 'SHORT' : 'LONG');

const formatQuantity = (quantity: number): string => quantity.toFixed(PAPER_TRADING.QUANTITY_DECIMALS);

const takerFee = (notional: number, marketType: MarketType): number => notional * getDefaultFee(marketType, 'TAKER');

const isAboveZero = (quantity: number): boolean => quantity > PAPER_TRADING.QUANTITY_EPSILON;

const totalQuantity = (executions: ExecutionRow[]): number =>
  executions.reduce((sum, execution) => sum + parseFloat(execution.quantity), 0);

const isTriggered = (kind: TriggerKind, side: OrderSide, triggerPrice: number, marketPrice: number): boolean => {
  const fillsOnDrop = kind === 'STOP' ? side === 'SELL' : side === 'BUY';
  return fillsOnDrop ? marketPrice <= triggerPrice : marketPrice >= triggerPrice;
};

const findOpenExecutions = (
  walletId: string,
  symbol: string,
  marketType: MarketType,
  side: PositionSide,
): Promise<ExecutionRow[]> =>
  db
    .select()
    .from(tradeExecutions)
    .where(
      and(
        eq(tradeExecutions.walletId, walletId),
        eq(tradeExecutions.symbol, symbol),
        eq(tradeExecutions.marketType, marketType),
        eq(tradeExecutions.side, side),
        eq(tradeExecutions.status, 'open'),
      ),
    )
    .orderBy(tradeExecutions.openedAt);

const liquidationPriceFor = (
  marketType: MarketType,
  side: PositionSide,
  entryPrice: number,
  quantity: number,
  leverage: number,
): string | null => {
  if (marketType !== 'FUTURES' || leverage <= 1) return null;
  return calculateLiquidationPrice({ entryPrice, quantity, leverage, side }).toString();
};

const breakevenPriceFor = (marketType: MarketType, side: PositionSide, entryPrice: number): string =>
  calculateBreakevenPrice({ entryPrice, side, takerRate: getDefaultFee(marketType, 'TAKER') }).toString();

const assertProtectionSide = (
  side: PositionSide,
  referencePrice: number,
  stopLoss: string | undefined,
  takeProfit: string | undefined,
): void => {
  const isLong = side === 'LONG';
  if (stopLoss !== undefined) {
    const stopLossPrice = parseFloat(stopLoss);
    const isProtective = isLong ? stopLossPrice < referencePrice : stopLossPrice > referencePrice;
    if (!isProtective) throw badRequest(`Stop loss must be ${isLong ? 'below' : 'above'} the entry price for a ${side} position`);
  }
  if (takeProfit !== undefined) {
    const takeProfitPrice = parseFloat(takeProfit);
    const isProfitable = isLong ? takeProfitPrice > referencePrice : takeProfitPrice < referencePrice;
    if (!isProfitable) throw badRequest(`Take profit must be ${isLong ? 'above' : 'below'} the entry price for a ${side} position`);
  }
};

const reduceExecution = async (execution: ExecutionRow, maxQuantity: number, exitPrice: number): Promise<number> => {
  const executionQuantity = parseFloat(execution.quantity);
  const closedQuantity = Math.min(executionQuantity, maxQuantity);
  const closedShare = closedQuantity / executionQuantity;
  const remainingQuantity = executionQuantity - closedQuantity;
  const isFullClose = !isAboveZero(remainingQuantity);
  const marketType: MarketType = execution.marketType === 'SPOT' ? 'SPOT' : 'FUTURES';
  const entryPrice = parseFloat(execution.entryPrice);
  const recordedEntryFee = execution.entryFee
    ? parseFloat(execution.entryFee)
    : takerFee(entryPrice * executionQuantity, marketType);
  const entryFee = recordedEntryFee * closedShare;
  const exitFee = takerFee(exitPrice * closedQuantity, marketType);

  const { netPnl, pnlPercent } = calculatePnl({
    entryPrice,
    exitPrice,
    quantity: closedQuantity,
    side: execution.side,
    marketType,
    leverage: execution.leverage ?? PAPER_TRADING.DEFAULT_LEVERAGE,
    accumulatedFunding: isFullClose ? parseFloat(execution.accumulatedFunding ?? '0') : 0,
    entryFee,
    exitFee,
  });

  if (isFullClose) {
    await closeExecutionAndBroadcast(execution, {
      exitPrice,
      exitReason: 'MANUAL_CLOSE',
      exitSource: 'MANUAL',
      pnl: netPnl + parseFloat(execution.partialClosePnl ?? '0'),
      pnlPercent,
      fees: entryFee + exitFee,
      entryFee,
      exitFee,
    });
    return closedQuantity;
  }

  const [reduced] = await db
    .update(tradeExecutions)
    .set({
      quantity: formatQuantity(remainingQuantity),
      partialClosePnl: (parseFloat(execution.partialClosePnl ?? '0') + netPnl).toString(),
      entryFee: (recordedEntryFee - entryFee).toString(),
      updatedAt: new Date(),
    })
    .where(and(eq(tradeExecutions.id, execution.id), eq(tradeExecutions.status, 'open')))
    .returning();

  if (!reduced) return 0;

  await incrementWalletBalanceAndBroadcast(execution.walletId, netPnl);
  getWebSocketService()?.emitPositionUpdate(execution.walletId, reduced);

  return closedQuantity;
};

const discardPendingExecution = async (walletId: string, pendingExecutionId: string): Promise<void> => {
  const [discarded] = await db
    .update(tradeExecutions)
    .set({ status: 'cancelled', closedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(tradeExecutions.id, pendingExecutionId), eq(tradeExecutions.status, 'pending')))
    .returning();

  if (discarded) getWebSocketService()?.emitPositionUpdate(walletId, discarded);
};

const increasePosition = async (primary: ExecutionRow, fill: PaperFill, quantity: number): Promise<void> => {
  const marketType = fill.marketType;
  const primaryQuantity = parseFloat(primary.quantity);
  const mergedQuantity = primaryQuantity + quantity;
  const mergedEntryPrice = (primaryQuantity * parseFloat(primary.entryPrice) + quantity * fill.price) / mergedQuantity;
  const leverage = primary.leverage ?? PAPER_TRADING.DEFAULT_LEVERAGE;
  const mergedEntryFee = parseFloat(primary.entryFee ?? '0') + takerFee(fill.price * quantity, marketType);

  const [merged] = await db
    .update(tradeExecutions)
    .set({
      quantity: formatQuantity(mergedQuantity),
      entryPrice: mergedEntryPrice.toString(),
      entryFee: mergedEntryFee.toString(),
      liquidationPrice: liquidationPriceFor(marketType, primary.side, mergedEntryPrice, mergedQuantity, leverage),
      breakevenPrice: breakevenPriceFor(marketType, primary.side, mergedEntryPrice),
      stopLoss: fill.stopLoss ?? primary.stopLoss,
      takeProfit: fill.takeProfit ?? primary.takeProfit,
      updatedAt: new Date(),
    })
    .where(eq(tradeExecutions.id, primary.id))
    .returning();

  if (fill.pendingExecutionId) await discardPendingExecution(fill.walletId, fill.pendingExecutionId);
  if (merged) getWebSocketService()?.emitPositionUpdate(fill.walletId, merged);
};

const openPosition = async (fill: PaperFill, quantity: number): Promise<void> => {
  const side = toPositionSide(fill.side);
  const openedAt = new Date();
  const openFields = {
    status: 'open',
    entryPrice: fill.price.toString(),
    quantity: formatQuantity(quantity),
    entryFee: takerFee(fill.price * quantity, fill.marketType).toString(),
    leverage: fill.leverage,
    liquidationPrice: liquidationPriceFor(fill.marketType, side, fill.price, quantity, fill.leverage),
    breakevenPrice: breakevenPriceFor(fill.marketType, side, fill.price),
    highestPriceSinceEntry: fill.price.toString(),
    lowestPriceSinceEntry: fill.price.toString(),
    openedAt,
    updatedAt: openedAt,
  };

  const [opened] = fill.pendingExecutionId
    ? await db
        .update(tradeExecutions)
        .set(openFields)
        .where(and(eq(tradeExecutions.id, fill.pendingExecutionId), eq(tradeExecutions.status, 'pending')))
        .returning()
    : await db
        .insert(tradeExecutions)
        .values({
          ...openFields,
          id: generateEntityId(),
          userId: fill.userId,
          walletId: fill.walletId,
          symbol: fill.symbol,
          side,
          marketType: fill.marketType,
          entryOrderId: fill.orderId,
          entryOrderType: fill.entryOrderType,
          setupId: fill.setupId,
          setupType: fill.setupType,
          stopLoss: fill.stopLoss,
          takeProfit: fill.takeProfit,
          originalStopLoss: fill.stopLoss,
        })
        .returning();

  if (opened) getWebSocketService()?.emitPositionUpdate(fill.walletId, opened);
};

const applyPaperFill = async (fill: PaperFill): Promise<void> => {
  const side = toPositionSide(fill.side);
  const oppositeExecutions = await findOpenExecutions(fill.walletId, fill.symbol, fill.marketType, oppositeOf(side));

  let remainingQuantity = fill.quantity;
  for (const execution of oppositeExecutions) {
    if (!isAboveZero(remainingQuantity)) break;
    remainingQuantity -= await reduceExecution(execution, remainingQuantity, fill.price);
  }

  const opensPosition = isAboveZero(remainingQuantity) && !fill.reduceOnly && !(fill.marketType === 'SPOT' && fill.side === 'SELL');
  if (!opensPosition) {
    if (fill.pendingExecutionId) await discardPendingExecution(fill.walletId, fill.pendingExecutionId);
    return;
  }

  const [primary] = await findOpenExecutions(fill.walletId, fill.symbol, fill.marketType, side);
  if (primary) {
    await increasePosition(primary, fill, remainingQuantity);
    return;
  }

  await openPosition(fill, remainingQuantity);
};

export const placePaperOrder = async (request: PaperOrderRequest): Promise<PaperOrderResult> => {
  const { walletId, symbol, side, marketType } = request;
  const quantity = parseFloat(request.quantity);
  if (!isAboveZero(quantity)) throw badRequest('Order quantity must be positive');

  const marketPrice = await getCurrentPrice(symbol, marketType);
  if (!(marketPrice > 0)) throw badRequest(`No market price available for ${symbol}`);

  const positionSide = toPositionSide(side);
  const oppositeExecutions = await findOpenExecutions(walletId, symbol, marketType, oppositeOf(positionSide));
  const reducesPosition = oppositeExecutions.length > 0;

  if (request.reduceOnly && !reducesPosition) throw badRequest('Reduce-only order rejected: no open position to reduce');

  if (marketType === 'SPOT' && side === 'SELL') {
    const heldQuantity = totalQuantity(oppositeExecutions);
    if (!isAboveZero(heldQuantity)) throw badRequest('Spot wallets cannot open short positions');
    if (quantity - heldQuantity > PAPER_TRADING.QUANTITY_EPSILON) {
      throw badRequest(`Cannot sell ${request.quantity} ${symbol}: only ${formatQuantity(heldQuantity)} held`);
    }
  }

  const requestedKind = TRIGGER_KIND_BY_ORDER_TYPE[request.type];
  const requestedTrigger = requestedKind === 'LIMIT' ? request.price ?? request.stopPrice : request.stopPrice ?? request.price;
  const triggerPrice = requestedTrigger ? parseFloat(requestedTrigger) : 0;
  if (requestedKind && !(triggerPrice > 0)) throw badRequest(`A price is required for ${request.type} orders`);

  const isMarketableLimit = requestedKind === 'LIMIT' && isTriggered('LIMIT', side, triggerPrice, marketPrice);
  const fillsImmediately = !requestedKind || (isMarketableLimit && marketType === 'SPOT');
  const triggerKind: TriggerKind | undefined = fillsImmediately
    ? undefined
    : isMarketableLimit
      ? 'STOP'
      : requestedKind;

  if (requestedKind && requestedKind !== 'LIMIT' && isTriggered(requestedKind, side, triggerPrice, marketPrice)) {
    throw badRequest('Order would trigger immediately');
  }

  if (!reducesPosition) {
    assertProtectionSide(positionSide, triggerKind ? triggerPrice : marketPrice, request.stopLoss, request.takeProfit);
  }

  const orderId = generatePaperOrderId();
  const placedAt = Date.now();
  const orderType = isMarketableLimit && triggerKind === 'STOP' ? 'STOP_MARKET' : request.type;
  const status = triggerKind ? 'NEW' : 'FILLED';
  const price = (triggerKind ? triggerPrice : marketPrice).toString();
  const executedQty = triggerKind ? '0' : request.quantity;
  const requestedReduceOnly = request.reduceOnly ?? false;
  const reduceOnly = triggerKind ? requestedReduceOnly || reducesPosition : requestedReduceOnly;
  const leverage = request.leverage ?? PAPER_TRADING.DEFAULT_LEVERAGE;

  await db.insert(orders).values({
    orderId,
    userId: request.userId,
    walletId,
    symbol,
    side,
    type: orderType,
    price,
    origQty: request.quantity,
    executedQty,
    status,
    timeInForce: orderType.includes('LIMIT') ? 'GTC' : undefined,
    time: placedAt,
    updateTime: placedAt,
    setupId: request.setupId,
    setupType: request.setupType,
    marketType,
    reduceOnly,
    stopLossIntent: request.stopLoss,
    takeProfitIntent: request.takeProfit,
  });

  if (!triggerKind) {
    await applyPaperFill({
      userId: request.userId,
      walletId,
      symbol,
      side,
      marketType,
      quantity,
      price: marketPrice,
      orderId,
      entryOrderType: 'MARKET',
      reduceOnly: requestedReduceOnly,
      leverage,
      setupId: request.setupId,
      setupType: request.setupType,
      stopLoss: request.stopLoss,
      takeProfit: request.takeProfit,
    });
  } else if (!reduceOnly) {
    const [pending] = await db
      .insert(tradeExecutions)
      .values({
        id: generateEntityId(),
        userId: request.userId,
        walletId,
        symbol,
        side: positionSide,
        marketType,
        entryPrice: price,
        limitEntryPrice: price,
        quantity: formatQuantity(quantity),
        entryOrderId: orderId,
        entryOrderType: ENTRY_ORDER_TYPE_BY_TRIGGER_KIND[triggerKind],
        status: 'pending',
        leverage,
        setupId: request.setupId,
        setupType: request.setupType,
        stopLoss: request.stopLoss,
        takeProfit: request.takeProfit,
        originalStopLoss: request.stopLoss,
        openedAt: new Date(placedAt),
      })
      .returning();

    if (pending) getWebSocketService()?.emitPositionUpdate(walletId, pending);
  }

  const result: PaperOrderResult = {
    orderId,
    symbol,
    side,
    type: orderType,
    status,
    price,
    quantity: request.quantity,
    executedQty,
    marketType,
  };

  getWebSocketService()?.emitOrderCreated(walletId, { ...result, origQty: request.quantity });

  return result;
};

const settlePendingOrder = async (order: OrderRow, status: 'FILLED' | 'CANCELED' | 'EXPIRED'): Promise<void> => {
  const executedQty = status === 'FILLED' ? order.origQty : '0';
  await db
    .update(orders)
    .set({ status, executedQty, updateTime: Date.now() })
    .where(eq(orders.orderId, order.orderId));

  getWebSocketService()?.emitOrderUpdate(order.walletId, { orderId: order.orderId, symbol: order.symbol, status, executedQty });
};

const processPendingPaperOrder = async (orderId: string): Promise<void> => {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderId, orderId), eq(orders.status, 'NEW')))
    .limit(1);
  if (!order) return;

  const triggerKind = TRIGGER_KIND_BY_ORDER_TYPE[order.type];
  const triggerPrice = parseFloat(order.price ?? '0');
  const quantity = parseFloat(order.origQty ?? '0');
  if (!triggerKind || !(triggerPrice > 0) || !isAboveZero(quantity)) {
    await settlePendingOrder(order, 'CANCELED');
    return;
  }

  const marketType: MarketType = order.marketType === 'SPOT' ? 'SPOT' : 'FUTURES';
  const marketPrice = await getCurrentPrice(order.symbol, marketType);
  if (!isTriggered(triggerKind, order.side, triggerPrice, marketPrice)) return;

  const reduceOnly = order.reduceOnly ?? false;
  const [pendingExecution] = await db
    .select()
    .from(tradeExecutions)
    .where(and(eq(tradeExecutions.entryOrderId, order.orderId), eq(tradeExecutions.status, 'pending')))
    .limit(1);

  if (!reduceOnly && !pendingExecution) {
    await settlePendingOrder(order, 'CANCELED');
    return;
  }

  if (reduceOnly) {
    const reducible = await findOpenExecutions(order.walletId, order.symbol, marketType, oppositeOf(toPositionSide(order.side)));
    if (reducible.length === 0) {
      await settlePendingOrder(order, 'EXPIRED');
      return;
    }
  }

  const fillPrice = triggerKind === 'LIMIT' ? triggerPrice : marketPrice;

  await applyPaperFill({
    userId: order.userId,
    walletId: order.walletId,
    symbol: order.symbol,
    side: order.side,
    marketType,
    quantity,
    price: fillPrice,
    orderId: order.orderId,
    entryOrderType: ENTRY_ORDER_TYPE_BY_TRIGGER_KIND[triggerKind],
    reduceOnly,
    leverage: pendingExecution?.leverage ?? PAPER_TRADING.DEFAULT_LEVERAGE,
    setupId: order.setupId,
    setupType: order.setupType,
    stopLoss: pendingExecution?.stopLoss,
    takeProfit: pendingExecution?.takeProfit,
    pendingExecutionId: pendingExecution?.id,
  });

  await settlePendingOrder(order, 'FILLED');

  const sideLabel = order.side === 'BUY' ? 'Buy' : 'Sell';
  getWebSocketService()?.emitTradeNotification(order.walletId, {
    type: 'LIMIT_FILLED',
    title: 'Order Filled',
    body: `${sideLabel} ${order.symbol} @ ${formatPrice(fillPrice)}`,
    urgency: 'normal',
    data: {
      executionId: pendingExecution?.id ?? order.orderId,
      symbol: order.symbol,
      side: toPositionSide(order.side),
      entryPrice: fillPrice.toString(),
    },
  });
};

export const checkPaperPendingOrders = async (): Promise<void> => {
  const pendingOrders = await db
    .select({ orderId: orders.orderId, walletId: orders.walletId, symbol: orders.symbol })
    .from(orders)
    .innerJoin(wallets, eq(orders.walletId, wallets.id))
    .where(and(eq(orders.status, 'NEW'), eq(wallets.walletType, 'paper')));

  for (const pendingOrder of pendingOrders) {
    try {
      await withWriteLock(pendingOrder.walletId, pendingOrder.symbol, () => processPendingPaperOrder(pendingOrder.orderId));
    } catch (error) {
      logger.error({ orderId: pendingOrder.orderId, symbol: pendingOrder.symbol, error: serializeError(error) }, 'Failed to process pending paper order');
    }
  }
};

export const cancelPaperOrders = async (cancellation: PaperOrderCancellation): Promise<OrderRow[]> => {
  const cancelledOrders = await db
    .update(orders)
    .set({ status: 'CANCELED', updateTime: Date.now() })
    .where(
      and(
        eq(orders.walletId, cancellation.walletId),
        eq(orders.status, 'NEW'),
        ...(cancellation.symbol ? [eq(orders.symbol, cancellation.symbol)] : []),
        ...(cancellation.orderId ? [eq(orders.orderId, cancellation.orderId)] : []),
      ),
    )
    .returning();

  if (cancelledOrders.length === 0) return cancelledOrders;

  const cancelledExecutions = await db
    .update(tradeExecutions)
    .set({ status: 'cancelled', closedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(tradeExecutions.walletId, cancellation.walletId),
        eq(tradeExecutions.status, 'pending'),
        inArray(tradeExecutions.entryOrderId, cancelledOrders.map((order) => order.orderId)),
      ),
    )
    .returning();

  const wsService = getWebSocketService();
  if (wsService) {
    for (const order of cancelledOrders) wsService.emitOrderCancelled(cancellation.walletId, order.orderId);
    for (const execution of cancelledExecutions) {
      wsService.emitOrderUpdate(cancellation.walletId, { id: execution.id, status: 'cancelled' });
      wsService.emitPositionUpdate(cancellation.walletId, execution);
    }
  }

  return cancelledOrders;
};
