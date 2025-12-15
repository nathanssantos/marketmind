import type { Wallet } from '../db/schema';
import { createBinanceClient } from './binance-client';
import { logger } from './logger';

export interface TrailingStopParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  activationPrice?: number;
  callbackRate: number;
}

export interface TrailingStopResult {
  orderId: number;
  symbol: string;
  status: string;
  clientOrderId: string;
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

      const orderParams: Record<string, string> = {
        symbol: params.symbol,
        side: params.side,
        type: 'TRAILING_STOP_MARKET',
        quantity: params.quantity.toString(),
        callbackRate: params.callbackRate.toString(),
      };

      if (params.activationPrice) {
        orderParams.activationPrice = params.activationPrice.toString();
      }

      const result = await client.submitNewOrder(orderParams);

      logger.info({
        symbol: params.symbol,
        orderId: result.orderId,
        callbackRate: params.callbackRate,
      }, 'Exchange trailing stop placed');

      return result as TrailingStopResult;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
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
        error: error instanceof Error ? error.message : String(error),
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
}

export const exchangeTrailingStopService = new ExchangeTrailingStopService();
