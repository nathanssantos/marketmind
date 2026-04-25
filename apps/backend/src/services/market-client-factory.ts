import type { MarketType } from '@marketmind/types';

import type { Wallet } from '../db/schema';
import { createBinanceClient, createBinanceFuturesClient } from './binance-client';

export interface OrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
}

export interface OrderResult {
  orderId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: string;
  status: string;
  price?: string;
  origQty?: string;
  executedQty?: string;
  timeInForce?: string;
  time?: number;
  updateTime?: number;
  reduceOnly?: boolean;
}

export interface CancelOrderResult {
  orderId: string;
  symbol: string;
  status: string;
}

export interface MarketClient {
  readonly marketType: MarketType;
  createOrder(params: OrderParams): Promise<OrderResult>;
  cancelOrder(symbol: string, orderId: string): Promise<CancelOrderResult>;
  getAllOrders(symbol: string, limit?: number): Promise<OrderResult[]>;
}

class SpotClient implements MarketClient {
  readonly marketType: MarketType = 'SPOT';
  private client: ReturnType<typeof createBinanceClient>;

  constructor(wallet: Wallet) {
    this.client = createBinanceClient(wallet);
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    const order = await this.client.submitNewOrder({
      symbol: params.symbol,
      side: params.side,
      type: params.type as 'LIMIT' | 'MARKET' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT',
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      timeInForce: params.timeInForce,
    });

    return {
      orderId: String(order.orderId),
      symbol: order.symbol,
      side: ('side' in order ? order.side : params.side),
      type: 'type' in order ? order.type : params.type,
      status: 'status' in order ? order.status : 'NEW',
      price: 'price' in order ? order.price?.toString() : undefined,
      origQty: 'origQty' in order ? order.origQty?.toString() : undefined,
      executedQty: 'executedQty' in order ? order.executedQty?.toString() : undefined,
      timeInForce: 'timeInForce' in order ? order.timeInForce : undefined,
      time: 'transactTime' in order ? order.transactTime : undefined,
      updateTime: 'transactTime' in order ? order.transactTime : undefined,
    };
  }

  async cancelOrder(symbol: string, orderId: string): Promise<CancelOrderResult> {
    const canceledOrder = await this.client.cancelOrder({ symbol, orderId: Number(orderId) });
    return {
      orderId: String(canceledOrder.orderId),
      symbol: canceledOrder.symbol,
      status: 'CANCELED',
    };
  }

  async getAllOrders(symbol: string, limit = 100): Promise<OrderResult[]> {
    const orders = await this.client.getAllOrders({ symbol, limit });
    return orders.map((order) => ({
      orderId: String(order.orderId),
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      price: order.price?.toString(),
      origQty: order.origQty?.toString(),
      executedQty: order.executedQty?.toString(),
      timeInForce: order.timeInForce,
      time: order.time,
      updateTime: order.updateTime,
    }));
  }
}

class FuturesClient implements MarketClient {
  readonly marketType: MarketType = 'FUTURES';
  private client: ReturnType<typeof createBinanceFuturesClient>;

  constructor(wallet: Wallet) {
    this.client = createBinanceFuturesClient(wallet);
  }

  async createOrder(params: OrderParams): Promise<OrderResult> {
    const orderParams: Parameters<typeof this.client.submitNewOrder>[0] = {
      symbol: params.symbol,
      side: params.side,
      type: params.type as 'LIMIT' | 'MARKET' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET',
      quantity: params.quantity,
      newOrderRespType: 'RESULT',
    };
    if (params.price !== undefined) orderParams.price = params.price;
    if (params.stopPrice !== undefined) orderParams.stopPrice = params.stopPrice;
    if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
    if (params.reduceOnly === true) orderParams.reduceOnly = 'true';
    const order = await this.client.submitNewOrder(orderParams);

    return {
      orderId: String(order.orderId),
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      price: order.price?.toString(),
      origQty: order.origQty?.toString(),
      executedQty: order.executedQty?.toString(),
      timeInForce: order.timeInForce,
      time: order.updateTime,
      updateTime: order.updateTime,
      reduceOnly: order.reduceOnly,
    };
  }

  async cancelOrder(symbol: string, orderId: string): Promise<CancelOrderResult> {
    const canceledOrder = await this.client.cancelOrder({ symbol, orderId: Number(orderId) });
    return {
      orderId: String(canceledOrder.orderId),
      symbol: canceledOrder.symbol,
      status: 'CANCELED',
    };
  }

  async getAllOrders(symbol: string, limit = 100): Promise<OrderResult[]> {
    const orders = await this.client.getAllOrders({ symbol, limit });
    return orders.map((order) => ({
      orderId: String(order.orderId),
      symbol: order.symbol,
      side: order.side,
      type: order.type,
      status: order.status,
      price: order.price?.toString(),
      origQty: order.origQty?.toString(),
      executedQty: order.executedQty?.toString(),
      timeInForce: order.timeInForce,
      time: order.time,
      updateTime: order.updateTime,
      reduceOnly: order.reduceOnly,
    }));
  }
}

export const createMarketClient = (wallet: Wallet, marketType: MarketType): MarketClient => {
  return marketType === 'FUTURES'
    ? new FuturesClient(wallet)
    : new SpotClient(wallet);
};
