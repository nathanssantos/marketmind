import type { MarketType } from '@marketmind/types';
import { AUTO_TRADING_ORDER } from '../constants';
import type { Wallet } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPriceForBinance, formatQuantityForBinance } from '../utils/formatters';
import { getFuturesClient, getSpotClient } from '../exchange';
import type { FuturesOrderParams, SpotOrderParams } from '../exchange';
import { isPaperWallet } from './binance-client';
import { logger } from './logger';
import { getMinNotionalFilterService } from './min-notional-filter';
import type { OrderParams } from './auto-trading';

export const executeBinanceOrder = async (
  wallet: Wallet,
  orderParams: OrderParams,
  marketType: MarketType = 'FUTURES'
): Promise<{ orderId: string; executedQty: string; price: string }> => {
  if (isPaperWallet(wallet)) {
    throw new Error('Paper wallets cannot execute real orders on Binance');
  }

  try {
    const minNotionalFilter = getMinNotionalFilterService();
    const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
    const filters = symbolFilters.get(orderParams.symbol);
    const stepSize = filters?.stepSize?.toString();
    const tickSize = filters?.tickSize?.toString();

    const formattedQuantity = parseFloat(formatQuantityForBinance(orderParams.quantity, stepSize));

    const minNotional = filters?.minNotional ?? AUTO_TRADING_ORDER.DEFAULT_MIN_NOTIONAL;
    const MIN_NOTIONAL_BUFFER = AUTO_TRADING_ORDER.MIN_NOTIONAL_BUFFER;
    const requiredNotional = minNotional * MIN_NOTIONAL_BUFFER;
    const orderPrice = orderParams.price ?? 0;
    const estimatedNotional = formattedQuantity * orderPrice;

    if (orderPrice > 0 && estimatedNotional < requiredNotional) {
      const errorMsg = `Order notional ${estimatedNotional.toFixed(2)} is below minimum ${requiredNotional.toFixed(2)} (minNotional: ${minNotional}, buffer: 10%)`;
      logger.warn({
        symbol: orderParams.symbol,
        quantity: formattedQuantity,
        price: orderPrice,
        notional: estimatedNotional,
        minNotional,
        requiredNotional,
      }, errorMsg);
      throw new Error(errorMsg);
    }

    if (marketType === 'FUTURES') {
      const client = getFuturesClient(wallet);

      const futuresParams: FuturesOrderParams = {
        symbol: orderParams.symbol,
        side: orderParams.side,
        type: orderParams.type as 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
        quantity: String(formattedQuantity),
        newOrderRespType: 'RESULT',
      };

      if (orderParams.price !== undefined && orderParams.type !== 'MARKET') {
        futuresParams.price = formatPriceForBinance(orderParams.price, tickSize);
      }
      if (orderParams.stopPrice !== undefined) {
        futuresParams.stopPrice = formatPriceForBinance(orderParams.stopPrice, tickSize);
      }
      if (orderParams.timeInForce) {
        futuresParams.timeInForce = orderParams.timeInForce;
      }
      if (orderParams.reduceOnly) {
        futuresParams.reduceOnly = true;
      }

      logger.trace({
        symbol: orderParams.symbol,
        originalQuantity: orderParams.quantity,
        formattedQuantity,
        stepSize,
        tickSize,
      }, 'Formatted order parameters');

      const order = await client.submitOrder(futuresParams);

      logger.info({
        orderId: order.orderId,
        symbol: order.symbol,
        side: order.side,
        quantity: order.origQty,
        price: order.price,
        walletType: wallet.walletType,
        marketType: 'FUTURES',
      }, 'Futures order executed');

      const effectivePrice = parseFloat(order.price?.toString() || '0') > 0
        ? order.price?.toString() || '0'
        : order.avgPrice?.toString() || '0';

      return {
        orderId: order.orderId,
        executedQty: order.executedQty?.toString() || '0',
        price: effectivePrice,
      };
    }

    const client = getSpotClient(wallet);

    const spotParams: SpotOrderParams = {
      symbol: orderParams.symbol,
      side: orderParams.side,
      type: orderParams.type as SpotOrderParams['type'],
      quantity: formattedQuantity,
    };

    if (orderParams.price !== undefined && orderParams.type !== 'MARKET') {
      spotParams.price = parseFloat(formatPriceForBinance(orderParams.price, tickSize));
    }
    if (orderParams.stopPrice !== undefined) {
      spotParams.stopPrice = parseFloat(formatPriceForBinance(orderParams.stopPrice, tickSize));
    }
    if (orderParams.timeInForce) {
      spotParams.timeInForce = orderParams.timeInForce;
    }

    const order = await client.submitOrder(spotParams);

    logger.info({
      orderId: order.orderId,
      symbol: order.symbol,
      side: order.side,
      quantity: order.origQty,
      price: order.price,
      walletType: wallet.walletType,
      marketType: 'FUTURES',
    }, 'Spot order executed');

    return {
      orderId: order.orderId,
      executedQty: order.executedQty?.toString() || '0',
      price: order.price?.toString() || '0',
    };
  } catch (error) {
    logger.error({
      error: serializeError(error),
      orderParams,
      walletType: wallet.walletType,
      marketType,
    }, 'Failed to execute Binance order');
    throw error;
  }
};

export const closePosition = async (
  wallet: Wallet,
  symbol: string,
  quantity: number,
  side: 'BUY' | 'SELL',
  marketType: MarketType
): Promise<{ orderId: string; avgPrice: number } | null> => {
  if (isPaperWallet(wallet)) {
    logger.info({ symbol, quantity, side, marketType }, 'Paper wallet: simulating position close');
    return { orderId: '0', avgPrice: 0 };
  }

  try {
    const minNotionalFilter = getMinNotionalFilterService();
    const symbolFilters = await minNotionalFilter.getSymbolFilters(marketType);
    const filters = symbolFilters.get(symbol);
    const stepSize = filters?.stepSize?.toString();
    const formattedQuantity = parseFloat(formatQuantityForBinance(quantity, stepSize));

    logger.info({ symbol, originalQuantity: quantity, formattedQuantity, stepSize }, 'Formatting quantity for close position');

    if (marketType === 'FUTURES') {
      const client = getFuturesClient(wallet);
      const result = await client.submitOrder({
        symbol,
        side,
        type: 'MARKET',
        quantity: String(formattedQuantity),
        reduceOnly: true,
        newOrderRespType: 'RESULT',
      });
      logger.info({ symbol, orderId: result.orderId, avgPrice: result.avgPrice }, 'Futures position closed');
      return {
        orderId: result.orderId,
        avgPrice: parseFloat(String(result.avgPrice || result.price || '0')),
      };
    }

    const client = getSpotClient(wallet);
    const result = await client.submitOrder({
      symbol,
      side,
      type: 'MARKET',
      quantity: formattedQuantity,
    });
    logger.info({ symbol, orderId: result.orderId, price: result.price }, 'Spot position closed');
    return {
      orderId: result.orderId,
      avgPrice: result.price ? parseFloat(result.price) : 0,
    };
  } catch (error) {
    logger.error({ symbol, quantity, side, marketType, error: serializeError(error) }, 'Failed to close position');
    return null;
  }
};

export const setFuturesLeverage = async (
  wallet: Wallet,
  symbol: string,
  leverage: number
): Promise<void> => {
  if (isPaperWallet(wallet)) {
    logger.info({ symbol, leverage }, 'Paper wallet: simulating leverage setting');
    return;
  }

  const client = getFuturesClient(wallet);
  try {
    await client.setLeverage(symbol, leverage);
    logger.info({ symbol, leverage }, 'Futures leverage set');
  } catch (error) {
    const errorMsg = serializeError(error);
    if (errorMsg.includes('No need to change') || errorMsg.includes('leverage not changed')) {
      logger.info({ symbol, leverage }, 'Leverage already set');
      return;
    }
    logger.error({ symbol, leverage, error: errorMsg }, 'Failed to set futures leverage');
    throw new Error(`Failed to set leverage for ${symbol}: ${errorMsg}`);
  }
};

export const setFuturesMarginType = async (
  wallet: Wallet,
  symbol: string,
  marginType: 'ISOLATED' | 'CROSSED'
): Promise<void> => {
  if (isPaperWallet(wallet)) {
    logger.info({ symbol, marginType }, 'Paper wallet: simulating margin type setting');
    return;
  }

  const client = getFuturesClient(wallet);
  try {
    await client.setMarginType(symbol, marginType);
    logger.info({ symbol, marginType }, 'Futures margin type set');
  } catch (error) {
    const errorMsg = serializeError(error);
    if (errorMsg.includes('No need to change margin type')) {
      logger.info({ symbol, marginType }, 'Margin type already set');
      return;
    }
    logger.error({ symbol, marginType, error: errorMsg }, 'Failed to set futures margin type');
    throw new Error(`Failed to set margin type for ${symbol}: ${errorMsg}`);
  }
};

export const setFuturesPositionMode = async (
  wallet: Wallet,
  dualSidePosition: boolean
): Promise<void> => {
  if (isPaperWallet(wallet)) {
    logger.info({ dualSidePosition }, 'Paper wallet: simulating position mode setting');
    return;
  }

  const client = getFuturesClient(wallet);
  try {
    await client.setPositionMode(dualSidePosition);
    logger.info({ dualSidePosition }, 'Futures position mode set');
  } catch (error) {
    const errorMsg = serializeError(error);
    if (errorMsg.includes('No need to change position side')) {
      logger.info({ dualSidePosition }, 'Position mode already set');
      return;
    }
    logger.error({ dualSidePosition, error: errorMsg }, 'Failed to set futures position mode');
    throw new Error(`Failed to set position mode: ${errorMsg}`);
  }
};
