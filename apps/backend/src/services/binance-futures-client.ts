import { USDMClient } from 'binance';
import { decryptApiKey } from './encryption';
import type { Wallet } from '../db/schema';
import type {
  FuturesPosition,
  FuturesAccount,
  FuturesLeverage,
  MarginType,
  FuturesOrder,
} from '@marketmind/types';
import { logger, serializeError } from './logger';
import { isPaperWallet, getWalletType, type WalletType } from './binance-client';

export { isPaperWallet, getWalletType, type WalletType };

export function createBinanceFuturesClient(wallet: Wallet): USDMClient {
  const walletType = getWalletType(wallet);

  if (walletType === 'paper') {
    throw new Error('Paper wallets cannot execute real orders on Binance Futures');
  }

  const apiKey = decryptApiKey(wallet.apiKeyEncrypted);
  const apiSecret = decryptApiKey(wallet.apiSecretEncrypted);

  return new USDMClient({
    api_key: apiKey,
    api_secret: apiSecret,
    testnet: walletType === 'testnet',
  });
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  return new USDMClient();
}

export async function setLeverage(
  client: USDMClient,
  symbol: string,
  leverage: number
): Promise<FuturesLeverage> {
  try {
    const result = await client.setLeverage({ symbol, leverage });
    return {
      leverage: result.leverage,
      maxNotionalValue: String(result.maxNotionalValue),
      symbol: result.symbol,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, leverage }, 'Failed to set leverage');
    throw error;
  }
}

export async function setMarginType(
  client: USDMClient,
  symbol: string,
  marginType: MarginType
): Promise<void> {
  try {
    await client.setMarginType({ symbol, marginType });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('No need to change margin type')) {
      return;
    }
    logger.error({ error: serializeError(error), symbol, marginType }, 'Failed to set margin type');
    throw error;
  }
}

export async function modifyIsolatedPositionMargin(
  client: USDMClient,
  symbol: string,
  amount: number,
  type: '0' | '1',
  positionSide?: 'LONG' | 'SHORT' | 'BOTH'
): Promise<{ amount: string; type: number; code: number; msg: string }> {
  try {
    const result = await client.setIsolatedPositionMargin({
      symbol,
      amount,
      type,
      positionSide,
    });
    logger.info(
      { symbol, amount, type: type === '1' ? 'ADD' : 'REDUCE', positionSide },
      '[Futures] Isolated margin modified successfully'
    );
    return {
      amount: String(result.amount),
      type: result.type,
      code: result.code,
      msg: result.msg,
    };
  } catch (error) {
    logger.error(
      { error: serializeError(error), symbol, amount, type },
      'Failed to modify isolated position margin'
    );
    throw error;
  }
}

export async function getPositions(client: USDMClient): Promise<FuturesPosition[]> {
  try {
    const positions = await client.getPositions();
    return positions
      .filter((p) => parseFloat(String(p.positionAmt)) !== 0)
      .map((p) => ({
        symbol: p.symbol,
        positionSide: p.positionSide as 'LONG' | 'SHORT' | 'BOTH',
        positionAmt: String(p.positionAmt),
        entryPrice: String(p.entryPrice),
        markPrice: String(p.markPrice || '0'),
        unrealizedPnl: String(p.unRealizedProfit),
        liquidationPrice: String(p.liquidationPrice),
        leverage: Number(p.leverage),
        marginType: p.marginType as MarginType,
        isolatedMargin: String(p.isolatedMargin),
        notional: String(p.notional),
        isolatedWallet: String(p.isolatedWallet),
        updateTime: p.updateTime,
      }));
  } catch (error) {
    logger.error({ error }, 'Failed to get futures positions');
    throw error;
  }
}

export async function getPosition(
  client: USDMClient,
  symbol: string
): Promise<FuturesPosition | null> {
  try {
    const positions = await client.getPositions({ symbol });
    const position = positions.find(
      (p) => p.symbol === symbol && parseFloat(String(p.positionAmt)) !== 0
    );

    if (!position) return null;

    return {
      symbol: position.symbol,
      positionSide: position.positionSide as 'LONG' | 'SHORT' | 'BOTH',
      positionAmt: String(position.positionAmt),
      entryPrice: String(position.entryPrice),
      markPrice: String(position.markPrice || '0'),
      unrealizedPnl: String(position.unRealizedProfit),
      liquidationPrice: String(position.liquidationPrice),
      leverage: Number(position.leverage),
      marginType: position.marginType as MarginType,
      isolatedMargin: String(position.isolatedMargin),
      notional: String(position.notional),
      isolatedWallet: String(position.isolatedWallet),
      updateTime: position.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to get futures position');
    throw error;
  }
}

export async function getAccountInfo(client: USDMClient): Promise<FuturesAccount> {
  try {
    const account = await client.getAccountInformation();
    return {
      feeTier: Number(account.feeTier),
      canTrade: account.canTrade,
      canDeposit: account.canDeposit,
      canWithdraw: account.canWithdraw,
      updateTime: Number(account.updateTime),
      totalInitialMargin: String(account.totalInitialMargin),
      totalMaintMargin: String(account.totalMaintMargin),
      totalWalletBalance: String(account.totalWalletBalance),
      totalUnrealizedProfit: String(account.totalUnrealizedProfit),
      totalMarginBalance: String(account.totalMarginBalance),
      totalPositionInitialMargin: String(account.totalPositionInitialMargin),
      totalOpenOrderInitialMargin: String(account.totalOpenOrderInitialMargin),
      totalCrossWalletBalance: String(account.totalCrossWalletBalance),
      totalCrossUnPnl: String(account.totalCrossUnPnl),
      availableBalance: String(account.availableBalance),
      maxWithdrawAmount: String(account.maxWithdrawAmount),
      assets: account.assets.map((a) => ({
        asset: a.asset,
        walletBalance: String(a.walletBalance),
        unrealizedProfit: String(a.unrealizedProfit),
        marginBalance: String(a.marginBalance),
        maintMargin: String(a.maintMargin),
        initialMargin: String(a.initialMargin),
        positionInitialMargin: String(a.positionInitialMargin),
        openOrderInitialMargin: String(a.openOrderInitialMargin),
        crossWalletBalance: String(a.crossWalletBalance),
        crossUnPnl: String(a.crossUnPnl),
        availableBalance: String(a.availableBalance),
        maxWithdrawAmount: String(a.maxWithdrawAmount),
        marginAvailable: a.marginAvailable,
        updateTime: a.updateTime,
      })),
      positions: account.positions
        .filter((p) => parseFloat(String(p.positionAmt)) !== 0)
        .map((p) => ({
          symbol: p.symbol,
          positionSide: p.positionSide as 'LONG' | 'SHORT' | 'BOTH',
          positionAmt: String(p.positionAmt),
          entryPrice: String(p.entryPrice),
          markPrice: '0',
          unrealizedPnl: String(p.unrealizedProfit),
          liquidationPrice: '0',
          leverage: Number(p.leverage),
          marginType: 'ISOLATED' as MarginType,
          isolatedMargin: '0',
          notional: String(p.notional),
          isolatedWallet: String(p.isolatedWallet),
          updateTime: p.updateTime,
        })),
    };
  } catch (error) {
    logger.error({ error }, 'Failed to get futures account info');
    throw error;
  }
}

export interface FuturesOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
  quantity: string;
  price?: string;
  stopPrice?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  closePosition?: boolean;
  newClientOrderId?: string;
}

export async function submitFuturesOrder(
  client: USDMClient,
  params: FuturesOrderParams
): Promise<FuturesOrder> {
  try {
    const orderParams: Parameters<typeof client.submitNewOrder>[0] = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      quantity: Number(params.quantity),
    };

    if (params.price) orderParams.price = Number(params.price);
    if (params.stopPrice) orderParams.stopPrice = Number(params.stopPrice);
    if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
    if (params.reduceOnly !== undefined) orderParams.reduceOnly = params.reduceOnly ? 'true' : 'false';
    if (params.closePosition !== undefined) orderParams.closePosition = params.closePosition ? 'true' : 'false';
    if (params.newClientOrderId) orderParams.newClientOrderId = params.newClientOrderId;

    const result = await client.submitNewOrder(orderParams);

    return {
      orderId: result.orderId,
      symbol: result.symbol,
      status: result.status,
      clientOrderId: result.clientOrderId,
      price: String(result.price),
      avgPrice: String(result.avgPrice),
      origQty: String(result.origQty),
      executedQty: String(result.executedQty),
      cumQuote: String(result.cumQuote || '0'),
      timeInForce: result.timeInForce,
      type: result.type,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      stopPrice: String(result.stopPrice || '0'),
      workingType: result.workingType || 'CONTRACT_PRICE',
      priceProtect: result.priceProtect || false,
      origType: result.origType || result.type,
      time: result.updateTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), params }, 'Failed to submit futures order');
    throw error;
  }
}

export async function cancelFuturesOrder(
  client: USDMClient,
  symbol: string,
  orderId: number
): Promise<void> {
  try {
    await client.cancelOrder({ symbol, orderId });
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, orderId }, 'Failed to cancel futures order');
    throw error;
  }
}

export async function cancelAllFuturesOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await client.cancelAllOpenOrders({ symbol });
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to cancel all futures orders');
    throw error;
  }
}

export async function closePosition(
  client: USDMClient,
  symbol: string,
  positionAmt: string
): Promise<FuturesOrder> {
  const quantity = Math.abs(parseFloat(positionAmt));
  const side = parseFloat(positionAmt) > 0 ? 'SELL' : 'BUY';

  return submitFuturesOrder(client, {
    symbol,
    side,
    type: 'MARKET',
    quantity: quantity.toString(),
    reduceOnly: true,
  });
}

export async function getOpenOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesOrder[]> {
  try {
    const orders = symbol
      ? await client.getAllOpenOrders({ symbol })
      : await client.getAllOpenOrders();

    return orders.map((o) => ({
      orderId: o.orderId,
      symbol: o.symbol,
      status: o.status,
      clientOrderId: o.clientOrderId,
      price: String(o.price),
      avgPrice: String(o.avgPrice),
      origQty: String(o.origQty),
      executedQty: String(o.executedQty),
      cumQuote: String(o.cumQuote || '0'),
      timeInForce: o.timeInForce,
      type: o.type,
      reduceOnly: o.reduceOnly,
      closePosition: o.closePosition,
      side: o.side as 'BUY' | 'SELL',
      positionSide: (o.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      stopPrice: String(o.stopPrice || '0'),
      workingType: o.workingType || 'CONTRACT_PRICE',
      priceProtect: o.priceProtect || false,
      origType: o.origType || o.type,
      time: o.time,
      updateTime: o.updateTime,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to get open futures orders');
    throw error;
  }
}

export async function getSymbolLeverageBrackets(
  client: USDMClient,
  symbol: string
): Promise<{ bracket: number; initialLeverage: number; notionalCap: number; notionalFloor: number; maintMarginRatio: number; cum: number }[]> {
  try {
    const brackets = await client.getNotionalAndLeverageBrackets({ symbol });
    const symbolBrackets = brackets.find((b) => b.symbol === symbol);
    if (!symbolBrackets) return [];

    return symbolBrackets.brackets.map((b) => ({
      bracket: b.bracket,
      initialLeverage: b.initialLeverage,
      notionalCap: b.notionalCap,
      notionalFloor: b.notionalFloor,
      maintMarginRatio: b.maintMarginRatio,
      cum: b.cum,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to get leverage brackets');
    throw error;
  }
}

export interface FuturesAlgoOrderParams {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'STOP_MARKET' | 'TAKE_PROFIT_MARKET' | 'STOP' | 'TAKE_PROFIT' | 'TRAILING_STOP_MARKET';
  quantity?: string;
  triggerPrice?: string;
  price?: string;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  reduceOnly?: boolean;
  closePosition?: boolean;
  activationPrice?: string;
  callbackRate?: string;
  clientAlgoId?: string;
  workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
  positionSide?: 'LONG' | 'SHORT' | 'BOTH';
}

export interface FuturesAlgoOrder {
  algoId: number;
  clientAlgoId: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  positionSide: 'LONG' | 'SHORT' | 'BOTH';
  type: string;
  quantity: string;
  triggerPrice?: string;
  price?: string;
  activationPrice?: string;
  callbackRate?: string;
  algoStatus: string;
  reduceOnly: boolean;
  closePosition: boolean;
  createTime: number;
  updateTime: number;
}

export async function submitFuturesAlgoOrder(
  client: USDMClient,
  params: FuturesAlgoOrderParams
): Promise<FuturesAlgoOrder> {
  try {
    const algoParams: Parameters<typeof client.submitNewAlgoOrder>[0] = {
      algoType: 'CONDITIONAL',
      symbol: params.symbol,
      side: params.side,
      type: params.type,
    };

    if (params.quantity) algoParams.quantity = params.quantity;
    if (params.triggerPrice) algoParams.triggerPrice = params.triggerPrice;
    if (params.price) algoParams.price = params.price;
    if (params.timeInForce) algoParams.timeInForce = params.timeInForce;
    if (params.reduceOnly !== undefined) algoParams.reduceOnly = params.reduceOnly ? 'true' : 'false';
    if (params.closePosition !== undefined) algoParams.closePosition = params.closePosition ? 'true' : 'false';
    if (params.activationPrice) algoParams.activationPrice = params.activationPrice;
    if (params.callbackRate) algoParams.callbackRate = params.callbackRate;
    if (params.clientAlgoId) algoParams.clientAlgoId = params.clientAlgoId;
    if (params.workingType) algoParams.workingType = params.workingType;
    if (params.positionSide) algoParams.positionSide = params.positionSide;

    const result = await client.submitNewAlgoOrder(algoParams);

    logger.info({
      algoId: result.algoId,
      symbol: result.symbol,
      side: result.side,
      type: result.orderType,
      triggerPrice: result.triggerPrice,
      quantity: result.quantity,
    }, '[Futures] Algo order submitted successfully');

    return {
      algoId: result.algoId,
      clientAlgoId: result.clientAlgoId,
      symbol: result.symbol,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: result.orderType,
      quantity: String(result.quantity),
      triggerPrice: result.triggerPrice ? String(result.triggerPrice) : undefined,
      price: result.price ? String(result.price) : undefined,
      activationPrice: result.activatePrice ? String(result.activatePrice) : undefined,
      callbackRate: result.callbackRate ? String(result.callbackRate) : undefined,
      algoStatus: result.algoStatus,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      createTime: result.createTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), params }, '[Futures] Failed to submit algo order');
    throw error;
  }
}

export async function cancelFuturesAlgoOrder(
  client: USDMClient,
  algoId: number
): Promise<void> {
  try {
    await client.cancelAlgoOrder({ algoId });
    logger.info({ algoId }, '[Futures] Algo order cancelled successfully');
  } catch (error) {
    logger.error({ error: serializeError(error), algoId }, '[Futures] Failed to cancel algo order');
    throw error;
  }
}

export async function cancelAllFuturesAlgoOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await client.cancelAllAlgoOpenOrders({ symbol });
    logger.info({ symbol }, '[Futures] All algo orders cancelled successfully');
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to cancel all algo orders');
    throw error;
  }
}

export async function getOpenAlgoOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesAlgoOrder[]> {
  try {
    const orders = await client.getOpenAlgoOrders(symbol ? { symbol } : undefined);

    return orders.map((o) => ({
      algoId: o.algoId,
      clientAlgoId: o.clientAlgoId,
      symbol: o.symbol,
      side: o.side as 'BUY' | 'SELL',
      positionSide: (o.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: o.orderType,
      quantity: String(o.quantity),
      triggerPrice: o.triggerPrice ? String(o.triggerPrice) : undefined,
      price: o.price ? String(o.price) : undefined,
      activationPrice: o.activatePrice ? String(o.activatePrice) : undefined,
      callbackRate: o.callbackRate ? String(o.callbackRate) : undefined,
      algoStatus: o.algoStatus,
      reduceOnly: o.reduceOnly,
      closePosition: o.closePosition,
      createTime: o.createTime,
      updateTime: o.updateTime,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to get open algo orders');
    throw error;
  }
}

export async function getAlgoOrder(
  client: USDMClient,
  algoId: number
): Promise<FuturesAlgoOrder | null> {
  try {
    const result = await client.getAlgoOrder({ algoId });

    if (!result) return null;

    return {
      algoId: result.algoId,
      clientAlgoId: result.clientAlgoId,
      symbol: result.symbol,
      side: result.side as 'BUY' | 'SELL',
      positionSide: (result.positionSide || 'BOTH') as 'LONG' | 'SHORT' | 'BOTH',
      type: result.orderType,
      quantity: String(result.quantity),
      triggerPrice: result.triggerPrice ? String(result.triggerPrice) : undefined,
      price: result.price ? String(result.price) : undefined,
      activationPrice: result.activatePrice ? String(result.activatePrice) : undefined,
      callbackRate: result.callbackRate ? String(result.callbackRate) : undefined,
      algoStatus: result.algoStatus,
      reduceOnly: result.reduceOnly,
      closePosition: result.closePosition,
      createTime: result.createTime,
      updateTime: result.updateTime,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), algoId }, '[Futures] Failed to get algo order');
    throw error;
  }
}

export interface IncomeHistoryRecord {
  symbol?: string;
  incomeType: string;
  income: string;
  asset: string;
  time: number;
  info: string;
  tranId: number;
  tradeId: string;
}

export async function getIncomeHistory(
  client: USDMClient,
  params?: {
    symbol?: string;
    incomeType?: string;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }
): Promise<IncomeHistoryRecord[]> {
  try {
    const result = await client.getIncomeHistory(params as Parameters<typeof client.getIncomeHistory>[0]);

    return result.map((r) => ({
      symbol: r.symbol,
      incomeType: r.incomeType,
      income: r.income,
      asset: r.asset,
      time: r.time,
      info: r.info,
      tranId: r.tranId,
      tradeId: r.tradeId,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), params }, '[Futures] Failed to get income history');
    throw error;
  }
}
