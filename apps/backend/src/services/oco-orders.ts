import type { Wallet } from '../db/schema';
import { createBinanceClient, isPaperWallet } from './binance-client';
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
  listStatusType: string;
  listOrderStatus: string;
  orders: Array<{
    orderId: number;
    symbol: string;
  }>;
  orderReports: Array<{
    orderId: number;
    clientOrderId: string;
    type: string;
    side: string;
    status: string;
    price: string;
    stopPrice?: string;
  }>;
}

export interface ExitOCOResult {
  orderListId: number;
  stopLossOrderId: number;
  takeProfitOrderId: number;
}

export class OCOOrderService {
  private enabled = false;

  constructor() {
    const testnetEnabled = process.env['BINANCE_TESTNET_ENABLED'] === 'true';
    const hasTestnetKey = !!process.env['BINANCE_TESTNET_API_KEY'];

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

  async createExitOCO(
    wallet: Wallet,
    symbol: string,
    quantity: number,
    stopLoss: number,
    takeProfit: number,
    side: 'LONG' | 'SHORT'
  ): Promise<ExitOCOResult | null> {
    if (isPaperWallet(wallet)) {
      logger.warn({ symbol }, 'Paper wallet cannot place real OCO orders');
      return null;
    }

    const orderSide = side === 'LONG' ? 'SELL' : 'BUY';
    const slLimitPrice = stopLoss * (orderSide === 'SELL' ? 0.995 : 1.005);

    try {
      const client = createBinanceClient(wallet);

      const result = await client.submitNewOCO({
        symbol,
        side: orderSide,
        quantity,
        price: takeProfit,
        stopPrice: stopLoss,
        stopLimitPrice: slLimitPrice,
        stopLimitTimeInForce: 'GTC',
      });

      const ocoResult = result as unknown as OCOOrderResult;

      const stopLossOrder = ocoResult.orderReports.find(o => o.type === 'STOP_LOSS_LIMIT');
      const takeProfitOrder = ocoResult.orderReports.find(o => o.type === 'LIMIT_MAKER' || o.type === 'LIMIT');

      logger.info({
        symbol,
        side,
        orderListId: ocoResult.orderListId,
        stopLossOrderId: stopLossOrder?.orderId,
        takeProfitOrderId: takeProfitOrder?.orderId,
        stopLoss,
        takeProfit,
        quantity,
      }, '✅ OCO exit orders placed successfully');

      return {
        orderListId: ocoResult.orderListId,
        stopLossOrderId: stopLossOrder?.orderId ?? 0,
        takeProfitOrderId: takeProfitOrder?.orderId ?? 0,
      };
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol,
        side,
        stopLoss,
        takeProfit,
        quantity,
      }, '❌ Failed to place OCO exit orders');
      return null;
    }
  }

  async cancelOCO(
    wallet: Wallet,
    symbol: string,
    orderListId: number
  ): Promise<boolean> {
    if (isPaperWallet(wallet)) {
      return false;
    }

    try {
      const client = createBinanceClient(wallet);

      await client.cancelOCO({
        symbol,
        orderListId,
      });

      logger.info({
        symbol,
        orderListId,
      }, '✅ OCO order cancelled');

      return true;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol,
        orderListId,
      }, '❌ Failed to cancel OCO order');
      return false;
    }
  }

  async placeOCO(
    wallet: Wallet,
    params: OCOOrderParams
  ): Promise<OCOOrderResult | null> {
    if (isPaperWallet(wallet)) {
      logger.warn({
        symbol: params.symbol,
        reason: 'Paper wallet cannot place real OCO orders',
      }, 'Skipped OCO order placement');
      return null;
    }

    try {
      const client = createBinanceClient(wallet);

      const result = await client.submitNewOCO({
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice,
        stopLimitPrice: params.stopLimitPrice,
        stopLimitTimeInForce: 'GTC',
      });

      const ocoResult = result as unknown as OCOOrderResult;

      logger.info({
        symbol: params.symbol,
        orderListId: ocoResult.orderListId,
        orders: ocoResult.orders?.length ?? 0,
      }, '✅ OCO order placed successfully');

      return ocoResult;
    } catch (error) {
      logger.error({
        error: error instanceof Error ? error.message : String(error),
        symbol: params.symbol,
      }, '❌ Failed to place OCO order');
      return null;
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
        stopLimitPrice: stopLoss * 0.995,
      };
    }

    return {
      symbol: '',
      side: 'BUY',
      quantity: 0,
      price: takeProfit,
      stopPrice: stopLoss,
      stopLimitPrice: stopLoss * 1.005,
    };
  }
}

export const ocoOrderService = new OCOOrderService();
