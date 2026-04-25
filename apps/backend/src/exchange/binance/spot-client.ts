import { MainClient } from 'binance';
import type {
  CancelOrderResult,
  IExchangeSpotClient,
  OcoOrderParams,
  OcoOrderResult,
  SpotAccountInfo,
  SpotOrderParams,
  SpotOrderResult,
  SpotTradeFees,
} from '../spot-client';
import type { ExchangeCredentials, ExchangeId } from '../types';

export class BinanceSpotExchangeClient implements IExchangeSpotClient {
  readonly exchangeId: ExchangeId = 'BINANCE';
  private client: MainClient;

  constructor(credentials: ExchangeCredentials) {
    this.client = new MainClient({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      testnet: credentials.testnet,
      disableTimeSync: true,
    });
  }

  async submitOrder(params: SpotOrderParams): Promise<SpotOrderResult> {
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

  async getOpenOrders(symbol?: string): Promise<SpotOrderResult[]> {
    const orders = symbol
      ? await this.client.getOpenOrders({ symbol })
      : await this.client.getOpenOrders();
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

  async getAllOrders(symbol: string, limit = 100): Promise<SpotOrderResult[]> {
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

  async submitOcoOrder(params: OcoOrderParams): Promise<OcoOrderResult> {
    const result = await this.client.submitNewOCO({
      symbol: params.symbol,
      side: params.side,
      quantity: params.quantity,
      price: params.price,
      stopPrice: params.stopPrice,
      stopLimitPrice: params.stopLimitPrice,
      stopLimitTimeInForce: params.stopLimitTimeInForce,
    });
    return {
      orderListId: String(result.orderListId),
      contingencyType: result.contingencyType,
      listStatusType: result.listStatusType,
      listOrderStatus: result.listOrderStatus,
      symbol: result.symbol,
      orders: result.orders.map((o: { symbol: string; orderId: number; clientOrderId: string }) => ({
        symbol: o.symbol,
        orderId: String(o.orderId),
        clientOrderId: o.clientOrderId,
      })),
    };
  }

  async getAccountInfo(): Promise<SpotAccountInfo> {
    const account = await this.client.getAccountInformation();
    return {
      makerCommission: account.makerCommission,
      takerCommission: account.takerCommission,
      canTrade: account.canTrade,
      balances: account.balances.map((b) => ({
        asset: b.asset,
        free: String(b.free),
        locked: String(b.locked),
      })),
    };
  }

  async getTradeFees(symbol?: string): Promise<SpotTradeFees[]> {
    const params = symbol ? { symbol } : undefined;
    const fees = await this.client.getTradeFee(params);
    return fees.map((f) => ({
      symbol: f.symbol,
      makerCommission: parseFloat(String(f.makerCommission)),
      takerCommission: parseFloat(String(f.takerCommission)),
    }));
  }
}
