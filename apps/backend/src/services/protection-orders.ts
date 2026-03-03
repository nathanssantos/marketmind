import type { MarketType } from '@marketmind/types';
import type { Wallet } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPriceForBinance, formatQuantityForBinance } from '../utils/formatters';
import { getFuturesClient, getSpotClient } from '../exchange';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';

export interface ProtectionOrderParams {
  wallet: Wallet;
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  triggerPrice: number;
  marketType: MarketType;
}

export interface UpdateProtectionOrderParams extends ProtectionOrderParams {
  currentAlgoId?: number | null;
  currentOrderId?: number | null;
}

export interface ProtectionOrderResult {
  algoId?: number | null;
  orderId?: number | null;
  isAlgoOrder: boolean;
}

export interface CancelProtectionOrderParams {
  wallet: Wallet;
  symbol: string;
  marketType: MarketType;
  algoId?: number | null;
  orderId?: number | null;
}

async function getSymbolFilters(symbol: string, marketType: MarketType) {
  const minNotionalFilter = getMinNotionalFilterService();
  const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
  const filters = symbolFilters.get(symbol);
  return {
    stepSize: filters?.stepSize?.toString(),
    tickSize: filters?.tickSize?.toString(),
  };
}

export async function cancelProtectionOrder(params: CancelProtectionOrderParams): Promise<boolean> {
  const { wallet, symbol, marketType, algoId, orderId } = params;

  if (marketType === 'FUTURES') {
    if (algoId) {
      try {
        const client = getFuturesClient(wallet);
        await client.cancelAlgoOrder(algoId);
        logger.info({ algoId, symbol }, '[ProtectionOrders] Cancelled futures algo order');
        return true;
      } catch (error) {
        const errorMessage = serializeError(error);
        if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist') || errorMessage.includes('not found')) {
          logger.info({ algoId, symbol }, '[ProtectionOrders] Futures algo order already executed or cancelled');
          return true;
        }
        logger.warn({ algoId, symbol, error: errorMessage }, '[ProtectionOrders] Failed to cancel futures algo order');
        return false;
      }
    }

    if (orderId) {
      try {
        const client = getFuturesClient(wallet);
        await client.cancelOrder(symbol, orderId);
        logger.info({ orderId, symbol }, '[ProtectionOrders] Cancelled futures regular order');
        return true;
      } catch (error) {
        const errorMessage = serializeError(error);
        if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist') || errorMessage.includes('not found')) {
          logger.info({ orderId, symbol }, '[ProtectionOrders] Futures order already executed or cancelled');
          return true;
        }
        logger.warn({ orderId, symbol, error: errorMessage }, '[ProtectionOrders] Failed to cancel futures order');
        return false;
      }
    }

    return false;
  }

  if (!orderId) return false;

  try {
    const client = getSpotClient(wallet);
    await client.cancelOrder(symbol, orderId);
    logger.info({ orderId, symbol }, '[ProtectionOrders] Cancelled spot order');
    return true;
  } catch (error) {
    const errorMessage = serializeError(error);
    if (errorMessage.includes('Unknown order') || errorMessage.includes('Order does not exist') || errorMessage.includes('not found')) {
      logger.info({ orderId, symbol }, '[ProtectionOrders] Spot order already executed or cancelled');
      return true;
    }
    logger.warn({ orderId, symbol, error: errorMessage }, '[ProtectionOrders] Failed to cancel spot order');
    return false;
  }
}

export async function createStopLossOrder(params: ProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { wallet, symbol, side, quantity, triggerPrice, marketType } = params;
  const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
  const { stepSize, tickSize } = await getSymbolFilters(symbol, marketType);

  if (marketType === 'FUTURES') {
    const client = getFuturesClient(wallet);
    const formattedQuantity = formatQuantityForBinance(quantity, stepSize);
    const formattedPrice = formatPriceForBinance(triggerPrice, tickSize);

    const order = await client.submitAlgoOrder({
      symbol,
      side: closeSide,
      type: 'STOP_MARKET',
      triggerPrice: formattedPrice,
      quantity: formattedQuantity,
      reduceOnly: true,
      workingType: 'CONTRACT_PRICE',
    });

    logger.info({ algoId: order.algoId, symbol, triggerPrice: formattedPrice }, '[ProtectionOrders] Created futures SL algo order');
    return { algoId: order.algoId, isAlgoOrder: true };
  }

  const client = getSpotClient(wallet);
  const formattedQuantity = parseFloat(formatQuantityForBinance(quantity, stepSize));
  const formattedPrice = parseFloat(formatPriceForBinance(triggerPrice, tickSize));
  const order = await client.submitOrder({
    symbol,
    side: closeSide,
    type: 'STOP_LOSS_LIMIT',
    stopPrice: formattedPrice,
    price: formattedPrice,
    quantity: formattedQuantity,
    timeInForce: 'GTC',
  });

  logger.info({ orderId: order.orderId, symbol, stopPrice: formattedPrice }, '[ProtectionOrders] Created spot SL order');
  return { orderId: order.orderId, isAlgoOrder: false };
}

export async function createTakeProfitOrder(params: ProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { wallet, symbol, side, quantity, triggerPrice, marketType } = params;
  const closeSide = side === 'LONG' ? 'SELL' : 'BUY';
  const { stepSize, tickSize } = await getSymbolFilters(symbol, marketType);

  if (marketType === 'FUTURES') {
    const client = getFuturesClient(wallet);
    const formattedQuantity = formatQuantityForBinance(quantity, stepSize);
    const formattedPrice = formatPriceForBinance(triggerPrice, tickSize);

    const order = await client.submitAlgoOrder({
      symbol,
      side: closeSide,
      type: 'TAKE_PROFIT_MARKET',
      triggerPrice: formattedPrice,
      quantity: formattedQuantity,
      reduceOnly: true,
      workingType: 'CONTRACT_PRICE',
    });

    logger.info({ algoId: order.algoId, symbol, triggerPrice: formattedPrice }, '[ProtectionOrders] Created futures TP algo order');
    return { algoId: order.algoId, isAlgoOrder: true };
  }

  const client = getSpotClient(wallet);
  const formattedQuantity = parseFloat(formatQuantityForBinance(quantity, stepSize));
  const formattedPrice = parseFloat(formatPriceForBinance(triggerPrice, tickSize));
  const order = await client.submitOrder({
    symbol,
    side: closeSide,
    type: 'TAKE_PROFIT_LIMIT',
    stopPrice: formattedPrice,
    price: formattedPrice,
    quantity: formattedQuantity,
    timeInForce: 'GTC',
  });

  logger.info({ orderId: order.orderId, symbol, stopPrice: formattedPrice }, '[ProtectionOrders] Created spot TP order');
  return { orderId: order.orderId, isAlgoOrder: false };
}

export async function updateStopLossOrder(params: UpdateProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { currentAlgoId, currentOrderId, ...createParams } = params;

  await cancelProtectionOrder({
    wallet: params.wallet,
    symbol: params.symbol,
    marketType: params.marketType,
    algoId: currentAlgoId,
    orderId: currentOrderId,
  });

  return createStopLossOrder(createParams);
}

export async function updateTakeProfitOrder(params: UpdateProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { currentAlgoId, currentOrderId, ...createParams } = params;

  await cancelProtectionOrder({
    wallet: params.wallet,
    symbol: params.symbol,
    marketType: params.marketType,
    algoId: currentAlgoId,
    orderId: currentOrderId,
  });

  return createTakeProfitOrder(createParams);
}

export async function cancelAllOpenProtectionOrdersOnExchange(params: {
  wallet: Wallet;
  symbol: string;
  marketType: MarketType;
}): Promise<void> {
  const { wallet, symbol, marketType } = params;
  if (marketType !== 'FUTURES') return;

  try {
    const client = getFuturesClient(wallet);
    const openAlgoOrders = await client.getOpenAlgoOrders(symbol);
    if (openAlgoOrders.length === 0) return;

    await Promise.allSettled(
      openAlgoOrders.map((order) =>
        client.cancelAlgoOrder(order.algoId).catch((_e) => {})
      )
    );
    logger.info({ symbol, count: openAlgoOrders.length }, '[ProtectionOrders] Cancelled all open algo orders on exchange (pyramid cleanup)');
  } catch (error) {
    logger.warn({ symbol, error: serializeError(error) }, '[ProtectionOrders] Failed to fetch/cancel open algo orders on exchange');
  }
}

export async function cancelAllProtectionOrders(params: {
  wallet: Wallet;
  symbol: string;
  marketType: MarketType;
  stopLossAlgoId?: number | null;
  stopLossOrderId?: number | null;
  takeProfitAlgoId?: number | null;
  takeProfitOrderId?: number | null;
}): Promise<void> {
  const { wallet, symbol, marketType, stopLossAlgoId, stopLossOrderId, takeProfitAlgoId, takeProfitOrderId } = params;

  await Promise.allSettled([
    cancelProtectionOrder({ wallet, symbol, marketType, algoId: stopLossAlgoId, orderId: stopLossOrderId }),
    cancelProtectionOrder({ wallet, symbol, marketType, algoId: takeProfitAlgoId, orderId: takeProfitOrderId }),
  ]);
}
