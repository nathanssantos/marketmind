import { SecType, OrderAction, OrderType, TimeInForce } from '@stoqey/ib';
import type { Contract, Order } from '@stoqey/ib';
import { firstValueFrom, take } from 'rxjs';
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
import type { IBConnectionManager} from './connection-manager';
import { createConnectionManager } from './connection-manager';
import {
  IB_ACCOUNT_SUMMARY_TAGS,
  IB_PORTS,
} from './constants';
import { estimateCommissionRate, type IBAccountType } from './fee-calculator';
import type { IBAccountSummary } from './types';

export class IBStockClient implements IExchangeSpotClient {
  readonly exchangeId: ExchangeId = 'INTERACTIVE_BROKERS';
  private connectionManager: IBConnectionManager;
  private accountType: IBAccountType;

  constructor(credentials: ExchangeCredentials) {
    this.connectionManager = createConnectionManager({
      port: credentials.testnet ? IB_PORTS.GATEWAY_PAPER : IB_PORTS.GATEWAY_LIVE,
    });
    this.accountType = (credentials as any).accountType ?? 'PRO';
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connectionManager.isConnected) {
      await this.connectionManager.connect();
    }
  }

  private createStockContract(symbol: string): Contract {
    return {
      symbol: symbol.toUpperCase(),
      secType: SecType.STK,
      exchange: 'SMART',
      currency: 'USD',
    };
  }

  private mapOrderTypeToIB(type: SpotOrderParams['type']): OrderType {
    const mapping: Record<SpotOrderParams['type'], OrderType> = {
      MARKET: OrderType.MKT,
      LIMIT: OrderType.LMT,
      STOP_LOSS: OrderType.STP,
      STOP_LOSS_LIMIT: OrderType.STP_LMT,
      TAKE_PROFIT: OrderType.LMT,
      TAKE_PROFIT_LIMIT: OrderType.LMT,
      LIMIT_MAKER: OrderType.LMT,
    };
    return mapping[type];
  }

  private mapTimeInForceToIB(tif?: 'GTC' | 'IOC' | 'FOK'): TimeInForce {
    if (!tif) return TimeInForce.DAY;
    const mapping: Record<string, TimeInForce> = {
      GTC: TimeInForce.GTC,
      IOC: TimeInForce.IOC,
      FOK: TimeInForce.FOK,
    };
    return mapping[tif] ?? TimeInForce.DAY;
  }

  async submitOrder(params: SpotOrderParams): Promise<SpotOrderResult> {
    await this.ensureConnected();

    const contract: Contract = this.createStockContract(params.symbol);
    const order: Order = {
      action: params.side === 'BUY' ? OrderAction.BUY : OrderAction.SELL,
      orderType: this.mapOrderTypeToIB(params.type),
      totalQuantity: params.quantity,
      tif: this.mapTimeInForceToIB(params.timeInForce),
      transmit: true,
    };

    if (params.price !== undefined) {
      order.lmtPrice = params.price;
    }

    if (params.stopPrice !== undefined) {
      order.auxPrice = params.stopPrice;
    }

    const orderId = await this.connectionManager.client.placeNewOrder(contract, order);

    return {
      orderId: String(orderId),
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      status: 'SUBMITTED',
      price: params.price?.toString(),
      origQty: params.quantity.toString(),
      executedQty: '0',
      timeInForce: params.timeInForce,
      time: Date.now(),
      updateTime: Date.now(),
    };
  }

  async cancelOrder(symbol: string, orderId: string): Promise<CancelOrderResult> {
    await this.ensureConnected();

    this.connectionManager.client.cancelOrder(Number(orderId));

    return {
      orderId,
      symbol,
      status: 'CANCELED',
    };
  }

  async getOpenOrders(symbol?: string): Promise<SpotOrderResult[]> {
    await this.ensureConnected();

    const openOrders = await this.connectionManager.client.getAllOpenOrders();

    const filtered = symbol
      ? openOrders.filter((o) => o.contract.symbol === symbol.toUpperCase())
      : openOrders;

    return filtered.map((o) => ({
      orderId: String(o.orderId),
      symbol: o.contract.symbol ?? '',
      side: (o.order.action === OrderAction.BUY ? 'BUY' : 'SELL'),
      type: o.order.orderType ?? 'LIMIT',
      status: o.orderState?.status ?? 'UNKNOWN',
      price: o.order.lmtPrice?.toString(),
      origQty: o.order.totalQuantity?.toString(),
      executedQty: '0',
      timeInForce: o.order.tif,
      time: Date.now(),
      updateTime: Date.now(),
    }));
  }

  async getAllOrders(symbol: string, _limit = 100): Promise<SpotOrderResult[]> {
    await this.ensureConnected();
    return this.getOpenOrders(symbol);
  }

  async submitOcoOrder(params: OcoOrderParams): Promise<OcoOrderResult> {
    await this.ensureConnected();

    const contract: Contract = this.createStockContract(params.symbol);
    const ocaGroup = `OCA_${Date.now()}`;

    const limitOrder: Order = {
      action: params.side === 'BUY' ? OrderAction.BUY : OrderAction.SELL,
      orderType: OrderType.LMT,
      totalQuantity: params.quantity,
      lmtPrice: params.price,
      ocaGroup,
      ocaType: 1,
      transmit: false,
    };

    const stopOrder: Order = {
      action: params.side === 'BUY' ? OrderAction.BUY : OrderAction.SELL,
      orderType: params.stopLimitPrice ? OrderType.STP_LMT : OrderType.STP,
      totalQuantity: params.quantity,
      auxPrice: params.stopPrice,
      lmtPrice: params.stopLimitPrice,
      tif: this.mapTimeInForceToIB(params.stopLimitTimeInForce),
      ocaGroup,
      ocaType: 1,
      transmit: true,
    };

    const limitOrderId = await this.connectionManager.client.placeNewOrder(contract, limitOrder);
    const stopOrderId = await this.connectionManager.client.placeNewOrder(contract, stopOrder);

    return {
      orderListId: String(Date.now()),
      contingencyType: 'OCO',
      listStatusType: 'EXEC_STARTED',
      listOrderStatus: 'EXECUTING',
      symbol: params.symbol,
      orders: [
        { symbol: params.symbol, orderId: String(limitOrderId), clientOrderId: `limit_${limitOrderId}` },
        { symbol: params.symbol, orderId: String(stopOrderId), clientOrderId: `stop_${stopOrderId}` },
      ],
    };
  }

  async getAccountInfo(): Promise<SpotAccountInfo> {
    await this.ensureConnected();

    const summary = await this.getAccountSummary();

    const baseRate = estimateCommissionRate(0, this.accountType);

    return {
      makerCommission: baseRate * 10000,
      takerCommission: baseRate * 10000,
      canTrade: summary.availableFunds > 0 && summary.cushion > 0,
      balances: [
        { asset: 'USD', free: summary.availableFunds.toString(), locked: '0' },
        { asset: 'TOTAL', free: summary.netLiquidation.toString(), locked: '0' },
      ],
    };
  }

  async getAccountSummary(): Promise<IBAccountSummary> {
    await this.ensureConnected();

    const tagsString = IB_ACCOUNT_SUMMARY_TAGS.join(',');
    const summaryObservable = this.connectionManager.client.getAccountSummary('All', tagsString);
    const summaryUpdate = await firstValueFrom(summaryObservable.pipe(take(1)));

    const values: Record<string, number> = {};
    for (const [_accountId, accountTagValues] of summaryUpdate.all) {
      for (const [tag, currencyValues] of accountTagValues) {
        for (const [_currency, summaryValue] of currencyValues) {
          if (summaryValue.value !== undefined) {
            values[tag] = parseFloat(summaryValue.value) || 0;
          }
        }
      }
    }

    return {
      netLiquidation: values['NetLiquidation'] ?? 0,
      buyingPower: values['BuyingPower'] ?? 0,
      availableFunds: values['AvailableFunds'] ?? 0,
      excessLiquidity: values['ExcessLiquidity'] ?? 0,
      initMarginReq: values['InitMarginReq'] ?? 0,
      maintMarginReq: values['MaintMarginReq'] ?? 0,
      equityWithLoanValue: values['EquityWithLoanValue'] ?? 0,
      grossPositionValue: values['GrossPositionValue'] ?? 0,
      sma: values['SMA'] ?? 0,
      leverage: values['Leverage'] ?? 0,
      cushion: values['Cushion'] ?? 0,
      dayTradesRemaining: values['DayTradesRemaining'] ?? -1,
      fullInitMarginReq: values['FullInitMarginReq'] ?? 0,
      fullMaintMarginReq: values['FullMaintMarginReq'] ?? 0,
      fullAvailableFunds: values['FullAvailableFunds'] ?? 0,
      fullExcessLiquidity: values['FullExcessLiquidity'] ?? 0,
    };
  }

  async getTradeFees(_symbol?: string): Promise<SpotTradeFees[]> {
    const rate = estimateCommissionRate(0, this.accountType);

    return [
      {
        symbol: 'DEFAULT',
        makerCommission: rate,
        takerCommission: rate,
      },
    ];
  }

  async disconnect(): Promise<void> {
    await this.connectionManager.disconnect();
  }
}
