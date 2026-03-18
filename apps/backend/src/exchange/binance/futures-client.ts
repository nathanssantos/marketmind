import type {
  FuturesAccount,
  FuturesLeverage,
  FuturesOrder,
  FuturesPosition,
  MarginType,
} from '@marketmind/types';
import { USDMClient } from 'binance';
import type {
  AccountTradeRecord,
  AllTradeFeesResult,
  ClosingTradeResult,
  CommissionRate,
  FuturesAlgoOrder,
  FuturesAlgoOrderParams,
  FuturesOrderParams,
  IExchangeFuturesClient,
  IncomeHistoryParams,
  IncomeHistoryRecord,
  LeverageBracket,
  MarginModifyResult,
  OrderEntryFeeResult,
} from '../futures-client';
import type { ExchangeCredentials, ExchangeId } from '../types';
import {
  cancelAllFuturesAlgoOrders,
  cancelAllFuturesOrders,
  cancelFuturesAlgoOrder,
  cancelFuturesOrder,
  closePosition as binanceClosePosition,
  getAccountInfo as binanceGetAccountInfo,
  getAlgoOrder as binanceGetAlgoOrder,
  getAllTradeFeesForPosition as binanceGetAllTradeFeesForPosition,
  getIncomeHistory as binanceGetIncomeHistory,
  getLastClosingTrade as binanceGetLastClosingTrade,
  getOpenAlgoOrders as binanceGetOpenAlgoOrders,
  getOpenOrders as binanceGetOpenOrders,
  getOrderEntryFee as binanceGetOrderEntryFee,
  getPosition as binanceGetPosition,
  getPositions as binanceGetPositions,
  getRecentTrades as binanceGetRecentTrades,
  getSymbolLeverageBrackets,
  modifyIsolatedPositionMargin,
  setLeverage as binanceSetLeverage,
  setMarginType as binanceSetMarginType,
  submitFuturesAlgoOrder,
  submitFuturesOrder,
} from '../../services/binance-futures-client';

const MARGIN_MODIFY_TYPE_MAP: Record<string, '0' | '1'> = {
  ADD: '1',
  REDUCE: '0',
};

export class BinanceFuturesExchangeClient implements IExchangeFuturesClient {
  readonly exchangeId: ExchangeId = 'BINANCE';
  private client: USDMClient;

  constructor(credentials: ExchangeCredentials) {
    this.client = new USDMClient({
      api_key: credentials.apiKey,
      api_secret: credentials.apiSecret,
      testnet: credentials.testnet,
      disableTimeSync: true,
    });
  }

  async getAccountInfo(): Promise<FuturesAccount> {
    return binanceGetAccountInfo(this.client);
  }

  async getPositions(): Promise<FuturesPosition[]> {
    return binanceGetPositions(this.client);
  }

  async getPosition(symbol: string): Promise<FuturesPosition | null> {
    return binanceGetPosition(this.client, symbol);
  }

  async setLeverage(symbol: string, leverage: number): Promise<FuturesLeverage> {
    return binanceSetLeverage(this.client, symbol, leverage);
  }

  async setMarginType(symbol: string, marginType: MarginType): Promise<void> {
    return binanceSetMarginType(this.client, symbol, marginType);
  }

  async setPositionMode(dualSidePosition: boolean): Promise<void> {
    await this.client.setPositionMode({ dualSidePosition: dualSidePosition ? 'true' : 'false' });
  }

  async modifyIsolatedMargin(
    symbol: string,
    amount: number,
    type: 'ADD' | 'REDUCE',
    positionSide?: string
  ): Promise<MarginModifyResult> {
    const binanceType = MARGIN_MODIFY_TYPE_MAP[type] ?? '1';
    return modifyIsolatedPositionMargin(
      this.client,
      symbol,
      amount,
      binanceType,
      positionSide as 'LONG' | 'SHORT' | 'BOTH' | undefined
    );
  }

  async submitOrder(params: FuturesOrderParams): Promise<FuturesOrder> {
    return submitFuturesOrder(this.client, params);
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    return cancelFuturesOrder(this.client, symbol, orderId);
  }

  async cancelAllOrders(symbol: string): Promise<void> {
    return cancelAllFuturesOrders(this.client, symbol);
  }

  async getOpenOrders(symbol?: string): Promise<FuturesOrder[]> {
    return binanceGetOpenOrders(this.client, symbol);
  }

  async closePosition(
    symbol: string,
    positionAmt: string,
    stepSize?: string
  ): Promise<FuturesOrder> {
    return binanceClosePosition(this.client, symbol, positionAmt, stepSize);
  }

  async submitAlgoOrder(params: FuturesAlgoOrderParams): Promise<FuturesAlgoOrder> {
    return submitFuturesAlgoOrder(this.client, params);
  }

  async cancelAlgoOrder(algoId: string): Promise<void> {
    return cancelFuturesAlgoOrder(this.client, algoId);
  }

  async cancelAllAlgoOrders(symbol: string): Promise<void> {
    return cancelAllFuturesAlgoOrders(this.client, symbol);
  }

  async getOpenAlgoOrders(symbol?: string): Promise<FuturesAlgoOrder[]> {
    return binanceGetOpenAlgoOrders(this.client, symbol);
  }

  async getAlgoOrder(algoId: string): Promise<FuturesAlgoOrder | null> {
    return binanceGetAlgoOrder(this.client, algoId);
  }

  async getIncomeHistory(params?: IncomeHistoryParams): Promise<IncomeHistoryRecord[]> {
    return binanceGetIncomeHistory(this.client, params);
  }

  async getRecentTrades(symbol: string, limit?: number): Promise<AccountTradeRecord[]> {
    return binanceGetRecentTrades(this.client, symbol, limit);
  }

  async getLastClosingTrade(
    symbol: string,
    side: 'LONG' | 'SHORT',
    openedAt: number
  ): Promise<ClosingTradeResult | null> {
    return binanceGetLastClosingTrade(this.client, symbol, side, openedAt);
  }

  async getAllTradeFeesForPosition(
    symbol: string,
    side: 'LONG' | 'SHORT',
    openedAt: number,
    closedAt?: number
  ): Promise<AllTradeFeesResult | null> {
    return binanceGetAllTradeFeesForPosition(this.client, symbol, side, openedAt, closedAt);
  }

  async getOrderEntryFee(
    symbol: string,
    orderId: string
  ): Promise<OrderEntryFeeResult | null> {
    return binanceGetOrderEntryFee(this.client, symbol, orderId);
  }

  async getLeverageBrackets(symbol: string): Promise<LeverageBracket[]> {
    return getSymbolLeverageBrackets(this.client, symbol);
  }

  async getCommissionRate(): Promise<CommissionRate> {
    const result = await this.client.getAccountCommissionRate({ symbol: 'BTCUSDT' });
    return {
      makerCommissionRate: parseFloat(String(result.makerCommissionRate)),
      takerCommissionRate: parseFloat(String(result.takerCommissionRate)),
    };
  }
}
