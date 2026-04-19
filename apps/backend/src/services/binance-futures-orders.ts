import type { FuturesOrder } from '@marketmind/types';
import type { USDMClient } from 'binance';
import type {
    FuturesAlgoOrder,
    FuturesAlgoOrderParams,
    FuturesOrderParams,
} from '../exchange/futures-client';
import { formatQuantityForBinance } from '../utils/formatters';
import { guardBinanceCall } from './binance-api-cache';
import { logger, serializeError } from './logger';

export async function submitFuturesOrder(
  client: USDMClient,
  params: FuturesOrderParams
): Promise<FuturesOrder> {
  try {
    const orderParams: Parameters<typeof client.submitNewOrder>[0] = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: Number(params.quantity),
      newOrderRespType: 'RESULT',
    };

    if (params.price) orderParams.price = Number(params.price);
    if (params.stopPrice) orderParams.stopPrice = Number(params.stopPrice);
    if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
    if (params.reduceOnly !== undefined) orderParams.reduceOnly = params.reduceOnly ? 'true' : 'false';
    if (params.closePosition !== undefined) orderParams.closePosition = params.closePosition ? 'true' : 'false';
    if (params.newClientOrderId) orderParams.newClientOrderId = params.newClientOrderId;

    logger.info({ params, orderParams }, '[Futures] Submitting order to Binance');

    const result = await guardBinanceCall(() => client.submitNewOrder(orderParams));

    logger.info({
      orderId: result.orderId,
      symbol: result.symbol,
      status: result.status,
      side: result.side,
      type: result.type,
      price: result.price,
      avgPrice: result.avgPrice,
      origQty: result.origQty,
      executedQty: result.executedQty,
      cumQuote: result.cumQuote,
      timeInForce: result.timeInForce,
      reduceOnly: result.reduceOnly,
      positionSide: result.positionSide,
      stopPrice: result.stopPrice,
      workingType: result.workingType,
    }, '[Futures] Order submitted - Binance response');

    return {
      orderId: String(result.orderId),
      symbol: result.symbol,
      status: result.status,
      clientOrderId: result.clientOrderId,
      price: String(result.price),
      avgPrice: String(result.avgPrice),
      origQty: String(result.origQty),
      executedQty: String(result.executedQty),
      cumQuote: String(result.cumQuote || '0'),
      timeInForce: result.timeInForce,
      type: result.type,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      stopPrice: String(result.stopPrice || '0'),
      workingType: result.workingType || 'CONTRACT_PRICE',
      priceProtect: result.priceProtect || false,
      origType: result.origType || result.type,
      time: result.updateTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), params }, 'Failed to submit futures order');
    throw error;
  }
}

export async function cancelFuturesOrder(
  client: USDMClient,
  symbol: string,
  orderId: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelOrder({ symbol, orderId: Number(orderId) }));
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('Unknown order') || msg.includes('Order does not exist') || msg.includes('not found')) {
      logger.info({ symbol, orderId }, '[Futures] Order already cancelled or does not exist');
      return;
    }
    logger.error({ error: msg, symbol, orderId }, 'Failed to cancel futures order');
    throw error;
  }
}

export async function cancelAllFuturesOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelAllOpenOrders({ symbol }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to cancel all futures orders');
    throw error;
  }
}

export async function closePosition(
  client: USDMClient,
  symbol: string,
  positionAmt: string,
  stepSize?: string
): Promise<FuturesOrder> {
  const quantity = Math.abs(parseFloat(positionAmt));
  const side = parseFloat(positionAmt) > 0 ? 'SELL' : 'BUY';
  const formattedQuantity = formatQuantityForBinance(quantity, stepSize);

  return submitFuturesOrder(client, {
    symbol,
    side,
    type: 'MARKET',
    quantity: formattedQuantity,
    reduceOnly: true,
  });
}

export async function getOpenOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesOrder[]> {
  try {
    const orders = symbol
      ? await guardBinanceCall(() => client.getAllOpenOrders({ symbol }))
      : await guardBinanceCall(() => client.getAllOpenOrders());

    return orders.map((o) => ({
      orderId: String(o.orderId),
      symbol: o.symbol,
      status: o.status,
      clientOrderId: o.clientOrderId,
      price: String(o.price),
      avgPrice: String(o.avgPrice),
      origQty: String(o.origQty),
      executedQty: String(o.executedQty),
      cumQuote: String(o.cumQuote || '0'),
      timeInForce: o.timeInForce,
      type: o.type,
      reduceOnly: o.reduceOnly,
      closePosition: o.closePosition,
      side: o.side as 'BUY' | 'SELL',
      positionSide: (o.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      stopPrice: String(o.stopPrice || '0'),
      workingType: o.workingType || 'CONTRACT_PRICE',
      priceProtect: o.priceProtect || false,
      origType: o.origType || o.type,
      time: o.time,
      updateTime: o.updateTime,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to get open futures orders');
    throw error;
  }
}

export async function submitFuturesAlgoOrder(
  client: USDMClient,
  params: FuturesAlgoOrderParams
): Promise<FuturesAlgoOrder> {
  try {
    const algoParams: Parameters<typeof client.submitNewAlgoOrder>[0] = {
      algoType: 'CONDITIONAL',
      symbol: params.symbol,
      side: params.side,
      type: params.type,
    };

    if (params.quantity) algoParams.quantity = params.quantity;
    if (params.triggerPrice) algoParams.triggerPrice = params.triggerPrice;
    if (params.price) algoParams.price = params.price;
    if (params.timeInForce) algoParams.timeInForce = params.timeInForce;
    if (params.reduceOnly !== undefined) algoParams.reduceOnly = params.reduceOnly ? 'true' : 'false';
    if (params.closePosition !== undefined) algoParams.closePosition = params.closePosition ? 'true' : 'false';
    if (params.activationPrice) algoParams.activationPrice = params.activationPrice;
    if (params.callbackRate) algoParams.callbackRate = params.callbackRate;
    if (params.clientAlgoId) algoParams.clientAlgoId = params.clientAlgoId;
    if (params.workingType) algoParams.workingType = params.workingType;
    if (params.priceProtect !== undefined) algoParams.priceProtect = params.priceProtect ? 'true' : 'false';
    if (params.positionSide) algoParams.positionSide = params.positionSide;

    const result = await guardBinanceCall(() => client.submitNewAlgoOrder(algoParams));

    logger.info({
      algoId: result.algoId,
      symbol: result.symbol,
      side: result.side,
      type: result.orderType,
      triggerPrice: result.triggerPrice,
      quantity: result.quantity,
    }, '[Futures] Algo order submitted successfully');

    return {
      algoId: String(result.algoId),
      clientAlgoId: result.clientAlgoId,
      symbol: result.symbol,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: result.orderType,
      quantity: String(result.quantity),
      triggerPrice: result.triggerPrice ? String(result.triggerPrice) : undefined,
      price: result.price ? String(result.price) : undefined,
      activationPrice: result.activatePrice ? String(result.activatePrice) : undefined,
      callbackRate: result.callbackRate ? String(result.callbackRate) : undefined,
      algoStatus: result.algoStatus,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      createTime: result.createTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), params }, '[Futures] Failed to submit algo order');
    throw error;
  }
}

export async function cancelFuturesAlgoOrder(
  client: USDMClient,
  algoId: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelAlgoOrder({ algoId: Number(algoId) }));
    logger.info({ algoId }, '[Futures] Algo order cancelled successfully');
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('Unknown order') || msg.includes('Order does not exist') || msg.includes('not found')) {
      logger.info({ algoId }, '[Futures] Algo order already cancelled or does not exist');
      return;
    }
    logger.error({ error: msg, algoId }, '[Futures] Failed to cancel algo order');
    throw error;
  }
}

export async function cancelAllFuturesAlgoOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelAllAlgoOpenOrders({ symbol }));
    logger.info({ symbol }, '[Futures] All algo orders cancelled successfully');
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to cancel all algo orders');
    throw error;
  }
}

export async function cancelAllSymbolOrders(client: USDMClient, symbol: string): Promise<void> {
  const results = await Promise.allSettled([
    cancelAllFuturesOrders(client, symbol),
    cancelAllFuturesAlgoOrders(client, symbol),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') {
      const msg = serializeError(r.reason);
      if (!msg.includes('No orders') && !msg.includes('not found'))
        {logger.warn({ symbol, error: msg }, '[Futures] Partial failure in cancelAllSymbolOrders');}
    }
  }
}

export async function getOpenAlgoOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesAlgoOrder[]> {
  try {
    const orders = await guardBinanceCall(() => client.getOpenAlgoOrders(symbol ? { symbol } : undefined));

    return orders.map((o) => ({
      algoId: String(o.algoId),
      clientAlgoId: o.clientAlgoId,
      symbol: o.symbol,
      side: o.side as 'BUY' | 'SELL',
      positionSide: (o.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: o.orderType,
      quantity: String(o.quantity),
      triggerPrice: o.triggerPrice ? String(o.triggerPrice) : undefined,
      price: o.price ? String(o.price) : undefined,
      activationPrice: o.activatePrice ? String(o.activatePrice) : undefined,
      callbackRate: o.callbackRate ? String(o.callbackRate) : undefined,
      algoStatus: o.algoStatus,
      reduceOnly: o.reduceOnly,
      closePosition: o.closePosition,
      createTime: o.createTime,
      updateTime: o.updateTime,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to get open algo orders');
    throw error;
  }
}

export async function getAlgoOrder(
  client: USDMClient,
  algoId: string
): Promise<FuturesAlgoOrder | null> {
  try {
    const result = await guardBinanceCall(() => client.getAlgoOrder({ algoId: Number(algoId) }));

    if (!result) return null;

    return {
      algoId: String(result.algoId),
      clientAlgoId: result.clientAlgoId,
      symbol: result.symbol,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: result.orderType,
      quantity: String(result.quantity),
      triggerPrice: result.triggerPrice ? String(result.triggerPrice) : undefined,
      price: result.price ? String(result.price) : undefined,
      activationPrice: result.activatePrice ? String(result.activatePrice) : undefined,
      callbackRate: result.callbackRate ? String(result.callbackRate) : undefined,
      algoStatus: result.algoStatus,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      createTime: result.createTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), algoId }, '[Futures] Failed to get algo order');
    throw error;
  }
}
