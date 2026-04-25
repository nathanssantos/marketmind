import type { MarketType, PositionSide } from '@marketmind/types';
import type { Wallet } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPriceForBinance, formatQuantityForBinance } from '../utils/formatters';
import { getFuturesClient, getSpotClient } from '../exchange';
import { BinanceIpBannedError } from './binance-api-cache';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';
import { ALGO_ORDER_DEFAULTS } from '../constants/algo-orders';
import { SCALPING_EXECUTION } from '../constants/scalping';

export interface ProtectionOrderParams {
  wallet: Wallet;
  symbol: string;
  side: PositionSide;
  quantity: number;
  triggerPrice: number;
  marketType: MarketType;
}

export interface UpdateProtectionOrderParams extends ProtectionOrderParams {
  currentAlgoId?: string | null;
  currentOrderId?: string | null;
}

export interface ProtectionOrderResult {
  algoId?: string | null;
  orderId?: string | null;
  isAlgoOrder: boolean;
}

export interface CancelProtectionOrderParams {
  wallet: Wallet;
  symbol: string;
  marketType: MarketType;
  algoId?: string | null;
  orderId?: string | null;
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
        if (error instanceof BinanceIpBannedError) throw error;
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
        if (error instanceof BinanceIpBannedError) throw error;
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
    if (error instanceof BinanceIpBannedError) throw error;
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
      workingType: ALGO_ORDER_DEFAULTS.workingType,
      priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
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
      workingType: ALGO_ORDER_DEFAULTS.workingType,
      priceProtect: ALGO_ORDER_DEFAULTS.priceProtect,
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

async function cancelWithRetry(params: CancelProtectionOrderParams, label: string): Promise<boolean> {
  try {
    const cancelled = await cancelProtectionOrder(params);
    if (cancelled || (!params.algoId && !params.orderId)) return true;

    logger.warn({ symbol: params.symbol, algoId: params.algoId, orderId: params.orderId }, `[ProtectionOrders] Old ${label} cancel failed — retrying`);
    const retried = await cancelProtectionOrder(params);
    if (!retried) {
      logger.error({ symbol: params.symbol, algoId: params.algoId, orderId: params.orderId }, `[ProtectionOrders] Old ${label} cancel failed after retry — creating new anyway (ghost risk)`);
    }
    return retried;
  } catch (error) {
    if (error instanceof BinanceIpBannedError) throw error;
    throw error;
  }
}

const MARGIN_RELEASE_DELAY_MS = 300;

export async function updateStopLossOrder(params: UpdateProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { currentAlgoId, currentOrderId, ...createParams } = params;

  await cancelWithRetry({
    wallet: params.wallet,
    symbol: params.symbol,
    marketType: params.marketType,
    algoId: currentAlgoId,
    orderId: currentOrderId,
  }, 'SL');

  if (currentAlgoId || currentOrderId) await new Promise(r => setTimeout(r, MARGIN_RELEASE_DELAY_MS));

  try {
    return await createStopLossOrder(createParams);
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('margin') || msg.includes('Margin') || msg.includes('insufficient')) {
      logger.warn({ symbol: params.symbol, error: msg }, '[ProtectionOrders] SL creation failed (margin) — retrying after delay');
      await new Promise(r => setTimeout(r, SCALPING_EXECUTION.MARGIN_RETRY_DELAY_MS));
      try {
        return await createStopLossOrder(createParams);
      } catch (_retryErr) {
        logger.error({ symbol: params.symbol }, '[ProtectionOrders] SL creation retry failed — position may be unprotected');
      }
    }
    throw error;
  }
}

export async function updateTakeProfitOrder(params: UpdateProtectionOrderParams): Promise<ProtectionOrderResult> {
  const { currentAlgoId, currentOrderId, ...createParams } = params;

  await cancelWithRetry({
    wallet: params.wallet,
    symbol: params.symbol,
    marketType: params.marketType,
    algoId: currentAlgoId,
    orderId: currentOrderId,
  }, 'TP');

  if (currentAlgoId || currentOrderId) await new Promise(r => setTimeout(r, MARGIN_RELEASE_DELAY_MS));

  try {
    return await createTakeProfitOrder(createParams);
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('margin') || msg.includes('Margin') || msg.includes('insufficient')) {
      logger.warn({ symbol: params.symbol, error: msg }, '[ProtectionOrders] TP creation failed (margin) — retrying after delay');
      await new Promise(r => setTimeout(r, SCALPING_EXECUTION.MARGIN_RETRY_DELAY_MS));
      try {
        return await createTakeProfitOrder(createParams);
      } catch (_retryErr) {
        logger.error({ symbol: params.symbol }, '[ProtectionOrders] TP creation retry failed — position may be unprotected');
      }
    }
    throw error;
  }
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

    const protectionOrders = openAlgoOrders.filter((order) => order.reduceOnly);
    if (protectionOrders.length === 0) return;

    await Promise.allSettled(
      protectionOrders.map((order) =>
        client.cancelAlgoOrder(order.algoId).catch((_e) => {})
      )
    );
    logger.info({ symbol, cancelled: protectionOrders.length, total: openAlgoOrders.length }, '[ProtectionOrders] Cancelled reduceOnly algo orders on exchange (pyramid cleanup)');
  } catch (error) {
    logger.warn({ symbol, error: serializeError(error) }, '[ProtectionOrders] Failed to fetch/cancel open algo orders on exchange');
  }
}

export async function cancelAllProtectionOrders(params: {
  wallet: Wallet;
  symbol: string;
  marketType: MarketType;
  stopLossAlgoId?: string | null;
  stopLossOrderId?: string | null;
  takeProfitAlgoId?: string | null;
  takeProfitOrderId?: string | null;
}): Promise<void> {
  const { wallet, symbol, marketType, stopLossAlgoId, stopLossOrderId, takeProfitAlgoId, takeProfitOrderId } = params;

  await Promise.allSettled([
    cancelProtectionOrder({ wallet, symbol, marketType, algoId: stopLossAlgoId, orderId: stopLossOrderId }),
    cancelProtectionOrder({ wallet, symbol, marketType, algoId: takeProfitAlgoId, orderId: takeProfitOrderId }),
  ]);
}
