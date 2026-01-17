import { serializeError } from '../utils/errors';
import type { Wallet } from '../db/schema';
import { createBinanceClient } from './binance-client';
import { createBinanceFuturesClient, submitFuturesAlgoOrder, cancelFuturesAlgoOrder } from './binance-futures-client';
import { logger } from './logger';

export interface TrailingStopParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  activationPrice?: number;
  callbackRate: number;
}

export interface FuturesTrailingStopParams extends TrailingStopParams {
  positionSide?: 'LONG' | 'SHORT';
}

export interface TrailingStopResult {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
}

export interface FuturesTrailingStopResult {
  algoId: number;
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

      const orderParams = {
        symbol: params.symbol,
        side: params.side,
        type: 'TRAILING_STOP_MARKET',
        quantity: params.quantity,
        callbackRate: params.callbackRate.toString(),
        ...(params.activationPrice && { activationPrice: params.activationPrice.toString() }),
      };
      const result = await client.submitNewOrder(orderParams as never);

      logger.info({
        symbol: params.symbol,
        orderId: result.orderId,
        callbackRate: params.callbackRate,
      }, 'Exchange trailing stop placed');

      return result as TrailingStopResult;
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
    orderId: number
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const client = createBinanceClient(wallet);

      await client.cancelOrder({
        symbol,
        orderId,
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

      const result = await submitFuturesAlgoOrder(client, {
        symbol: params.symbol,
        side: params.side,
        type: 'TRAILING_STOP_MARKET',
        quantity: params.quantity.toString(),
        callbackRate: params.callbackRate.toString(),
        ...(params.activationPrice && { activationPrice: params.activationPrice.toString() }),
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
    algoId: number
  ): Promise<boolean> {
    try {
      const client = createBinanceFuturesClient(wallet);
      await cancelFuturesAlgoOrder(client, algoId);

      logger.info({
        algoId,
      }, 'Futures exchange trailing stop cancelled via Algo API');

      return true;
    } catch (error) {
      logger.error({
        error: serializeError(error),
        algoId,
      }, 'Failed to cancel futures exchange trailing stop');
      return false;
    }
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
