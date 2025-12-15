import type { Wallet } from '../db/schema';
import { createBinanceClient } from './binance-client';
import { logger } from './logger';

export interface OCOOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  stopPrice: number;
  stopLimitPrice: number;
}

export interface OCOOrderResult {
  orderListId: number;
  contingencyType: string;
  orderReports: Array<{
    orderId: number;
    clientOrderId: string;
    type: string;
    status: string;
  }>;
}

export class OCOOrderService {
  private enabled = false;

  constructor() {
    const testnetEnabled = process.env.BINANCE_TESTNET_ENABLED === 'true';
    const hasTestnetKey = !!process.env.BINANCE_TESTNET_API_KEY;
    
    this.enabled = testnetEnabled && hasTestnetKey;

    if (this.enabled) {
      logger.info('OCO orders ENABLED - using Binance Testnet');
    } else {
      logger.info('OCO orders DISABLED - enable with BINANCE_TESTNET_ENABLED=true and BINANCE_TESTNET_API_KEY');
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async placeOCO(
    wallet: Wallet,
    params: OCOOrderParams
  ): Promise<OCOOrderResult | null> {
    if (!this.enabled) {
      logger.warn({
        symbol: params.symbol,
        reason: 'OCO orders disabled',
      }, 'Skipped OCO order placement');
      return null;
    }

    try {
      const client = createBinanceClient(wallet);

      const result = await client.submitNewOrder({
        symbol: params.symbol,
        side: params.side,
        type: 'LIMIT',
        quantity: params.quantity.toString(),
        price: params.price.toString(),
        timeInForce: 'GTC',
      });

      logger.info({
        symbol: params.symbol,
        orderId: result.orderId,
        orders: 1,
      }, 'Order placed (OCO simulated with single limit order)');

      return result as OCOOrderResult;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol: params.symbol,
      }, 'Failed to place OCO order');
      return null;
    }
  }

  async cancelOCO(
    wallet: Wallet,
    symbol: string,
    orderListId: number
  ): Promise<boolean> {
    if (!this.enabled) {
      return false;
    }

    try {
      const client = createBinanceClient(wallet);

      await client.cancelOCOOrder({
        symbol,
        orderListId,
      });

      logger.info({
        symbol,
        orderListId,
      }, 'OCO order cancelled');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol,
        orderListId,
      }, 'Failed to cancel OCO order');
      return false;
    }
  }

  calculateOCOPrices(params: {
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    side: 'LONG' | 'SHORT';
  }): OCOOrderParams | null {
    const { stopLoss, takeProfit, side } = params;

    if (side === 'LONG') {
      return {
        symbol: '',
        side: 'SELL',
        quantity: 0,
        price: takeProfit,
        stopPrice: stopLoss,
        stopLimitPrice: stopLoss * 0.999,
      };
    }

    return {
      symbol: '',
      side: 'BUY',
      quantity: 0,
      price: takeProfit,
      stopPrice: stopLoss,
      stopLimitPrice: stopLoss * 1.001,
    };
  }
}

export const ocoOrderService = new OCOOrderService();
