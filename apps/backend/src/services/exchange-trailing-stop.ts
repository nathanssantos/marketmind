import type { Wallet } from '../db/schema';
import { serializeError } from '../utils/errors';
import { formatPriceForBinance, formatQuantityForBinance } from '../utils/formatters';
import { createBinanceClient } from './binance-client';
import { createBinanceFuturesClient, submitFuturesAlgoOrder } from './binance-futures-client';
import { logger } from './logger';
import { cancelProtectionOrder } from './protection-orders';

export interface TrailingStopParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  activationPrice?: number;
  callbackRate: number;
  stepSize?: string;
  tickSize?: string;
}

export interface FuturesTrailingStopParams extends TrailingStopParams {
  positionSide?: 'LONG' | 'SHORT';
  tickSize?: string;
}

export interface TrailingStopResult {
  orderId: string;
  symbol: string;
  status: string;
  clientOrderId: string;
}

export interface FuturesTrailingStopResult {
  algoId: string;
  symbol: string;
  status: string;
}

export class ExchangeTrailingStopService {
  private enabled = false;

  constructor() {
    const testnetEnabled = process.env.BINANCE_TESTNET_ENABLED === 'true';
    const hasTestnetKey = !!process.env.BINANCE_TESTNET_API_KEY;
    
    this.enabled = testnetEnabled && hasTestnetKey;

    if (this.enabled) {
      logger.info('Exchange trailing stops ENABLED - using Binance Testnet');
    } else {
      logger.info('Exchange trailing stops DISABLED - enable with BINANCE_TESTNET_ENABLED=true and BINANCE_TESTNET_API_KEY');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async placeTrailingStop(
    wallet: Wallet,
    params: TrailingStopParams
  ): Promise<TrailingStopResult | null> {
    if (!this.enabled) {
      logger.warn({
        symbol: params.symbol,
        reason: 'Exchange trailing stops disabled',
      }, 'Skipped trailing stop placement - using local trailing stop instead');
      return null;
    }

    try {
      const client = createBinanceClient(wallet);
      const formattedQuantity = formatQuantityForBinance(params.quantity, params.stepSize);
      const formattedActivationPrice = params.activationPrice 
        ? formatPriceForBinance(params.activationPrice, params.tickSize) 
        : undefined;

      const orderParams = {
        symbol: params.symbol,
        side: params.side,
        type: 'TRAILING_STOP_MARKET',
        quantity: formattedQuantity,
        callbackRate: params.callbackRate.toString(),
        ...(formattedActivationPrice && { activationPrice: formattedActivationPrice }),
      };
      const result = await client.submitNewOrder(orderParams as never);

      logger.info({
        symbol: params.symbol,
        orderId: result.orderId,
        callbackRate: params.callbackRate,
      }, 'Exchange trailing stop placed');

      const response = result as unknown as Record<string, unknown>;
      return {
        orderId: String(result.orderId),
        symbol: result.symbol,
        status: String(response.status ?? 'NEW'),
        clientOrderId: result.clientOrderId ?? '',
      };
    } catch (error) {
      logger.error({
        error: serializeError(error),
        symbol: params.symbol,
      }, 'Failed to place exchange trailing stop');
      return null;
    }
  }

  async cancelTrailingStop(
    wallet: Wallet,
    symbol: string,
    orderId: string
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const client = createBinanceClient(wallet);

      await client.cancelOrder({
        symbol,
        orderId: Number(orderId),
      });

      logger.info({
        symbol,
        orderId,
      }, 'Exchange trailing stop cancelled');

      return true;
    } catch (error) {
      logger.error({
        error: serializeError(error),
        symbol,
        orderId,
      }, 'Failed to cancel exchange trailing stop');
      return false;
    }
  }

  calculateCallbackRate(atrPercent: number): number {
    if (atrPercent < 1.0) return 0.5;
    if (atrPercent < 2.0) return 1.0;
    if (atrPercent < 3.0) return 1.5;
    if (atrPercent < 4.0) return 2.0;
    return 2.5;
  }

  async placeTrailingStopFutures(
    wallet: Wallet,
    params: FuturesTrailingStopParams
  ): Promise<FuturesTrailingStopResult | null> {
    try {
      const client = createBinanceFuturesClient(wallet);
      const formattedQuantity = formatQuantityForBinance(params.quantity, params.stepSize);
      const formattedActivationPrice = params.activationPrice 
        ? formatPriceForBinance(params.activationPrice, params.tickSize) 
        : undefined;

      const result = await submitFuturesAlgoOrder(client, {
        symbol: params.symbol,
        side: params.side,
        type: 'TRAILING_STOP_MARKET',
        quantity: formattedQuantity,
        callbackRate: params.callbackRate.toString(),
        ...(formattedActivationPrice && { activationPrice: formattedActivationPrice }),
        ...(params.positionSide && { positionSide: params.positionSide }),
      });

      logger.info({
        symbol: params.symbol,
        algoId: result.algoId,
        callbackRate: params.callbackRate,
        activationPrice: params.activationPrice,
      }, 'Futures exchange trailing stop placed via Algo API');

      return {
        algoId: result.algoId,
        symbol: result.symbol,
        status: result.algoStatus,
      };
    } catch (error) {
      logger.error({
        error: serializeError(error),
        symbol: params.symbol,
      }, 'Failed to place futures exchange trailing stop');
      return null;
    }
  }

  async cancelTrailingStopFutures(
    wallet: Wallet,
    algoId: string
  ): Promise<boolean> {
    const cancelled = await cancelProtectionOrder({
      wallet,
      symbol: '',
      marketType: 'FUTURES',
      algoId,
    });

    if (cancelled) {
      logger.info({ algoId }, 'Futures exchange trailing stop cancelled');
    }

    return cancelled;
  }

  calculateActivationPrice(entryPrice: number, side: 'LONG' | 'SHORT', breakevenThreshold: number = 0.0015): number {
    if (side === 'LONG') {
      return entryPrice * (1 + breakevenThreshold);
    } else {
      return entryPrice * (1 - breakevenThreshold);
    }
  }
}

export const exchangeTrailingStopService = new ExchangeTrailingStopService();
