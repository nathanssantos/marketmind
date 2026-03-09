import type {
    FuturesAccount,
    FuturesLeverage,
    FuturesOrder,
    FuturesPosition,
    MarginType,
} from '@marketmind/types';
import type {
    AccountTradeRecord,
    AllTradeFeesResult,
    FuturesAlgoOrder,
    FuturesAlgoOrderParams,
    FuturesOrderParams,
    IncomeHistoryRecord,
} from '../exchange/futures-client';
import { USDMClient } from 'binance';
import type { Wallet } from '../db/schema';
import { formatQuantityForBinance } from '../utils/formatters';
import { guardBinanceCall } from './binance-api-cache';
import { getWalletType, isPaperWallet, type WalletType } from './binance-client';
import { decryptApiKey } from './encryption';
import { logger, serializeError } from './logger';

export { getWalletType, isPaperWallet, type WalletType };

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
    disableTimeSync: true,
  });
}

export function createBinanceFuturesClientForPrices(): USDMClient {
  return new USDMClient({ disableTimeSync: true });
}

export async function setLeverage(
  client: USDMClient,
  symbol: string,
  leverage: number
): Promise<FuturesLeverage> {
  try {
    const result = await guardBinanceCall(() => client.setLeverage({ symbol, leverage }));
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
    await guardBinanceCall(() => client.setMarginType({ symbol, marginType }));
  } catch (error: unknown) {
    const errorCode = (error as { code?: number })?.code;
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes('No need to change margin type') || errorCode === -4067) {
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
    const result = await guardBinanceCall(() => client.setIsolatedPositionMargin({
      symbol,
      amount,
      type,
      positionSide,
    }));
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
    const positions = await guardBinanceCall(() => client.getPositions());
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
    const positions = await guardBinanceCall(() => client.getPositions({ symbol }));
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
    const account = await guardBinanceCall(() => client.getAccountInformation());
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
          marginType: ((p as unknown as { marginType?: string }).marginType as MarginType) ?? 'CROSSED',
          isolatedMargin: String((p as unknown as { isolatedMargin?: number }).isolatedMargin ?? 0),
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

export type { FuturesOrderParams } from '../exchange/futures-client';
export type { FuturesAlgoOrderParams, FuturesAlgoOrder } from '../exchange/futures-client';
export type { IncomeHistoryRecord } from '../exchange/futures-client';
export type { AccountTradeRecord } from '../exchange/futures-client';
export type { AllTradeFeesResult } from '../exchange/futures-client';

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
      newOrderRespType: 'RESULT',
    };

    if (params.price) orderParams.price = Number(params.price);
    if (params.stopPrice) orderParams.stopPrice = Number(params.stopPrice);
    if (params.timeInForce) orderParams.timeInForce = params.timeInForce;
    if (params.reduceOnly !== undefined) orderParams.reduceOnly = params.reduceOnly ? 'true' : 'false';
    if (params.closePosition !== undefined) orderParams.closePosition = params.closePosition ? 'true' : 'false';
    if (params.newClientOrderId) orderParams.newClientOrderId = params.newClientOrderId;

    logger.info({ params, orderParams }, '[Futures] Submitting order to Binance');

    const result = await guardBinanceCall(() => client.submitNewOrder(orderParams));

    logger.info({
      orderId: result.orderId,
      symbol: result.symbol,
      status: result.status,
      side: result.side,
      type: result.type,
      price: result.price,
      avgPrice: result.avgPrice,
      origQty: result.origQty,
      executedQty: result.executedQty,
      cumQuote: result.cumQuote,
      timeInForce: result.timeInForce,
      reduceOnly: result.reduceOnly,
      positionSide: result.positionSide,
      stopPrice: result.stopPrice,
      workingType: result.workingType,
    }, '[Futures] Order submitted - Binance response');

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
    await guardBinanceCall(() => client.cancelOrder({ symbol, orderId }));
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('Unknown order') || msg.includes('Order does not exist') || msg.includes('not found')) {
      logger.info({ symbol, orderId }, '[Futures] Order already cancelled or does not exist');
      return;
    }
    logger.error({ error: msg, symbol, orderId }, 'Failed to cancel futures order');
    throw error;
  }
}

export async function cancelAllFuturesOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelAllOpenOrders({ symbol }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, 'Failed to cancel all futures orders');
    throw error;
  }
}

export async function closePosition(
  client: USDMClient,
  symbol: string,
  positionAmt: string,
  stepSize?: string
): Promise<FuturesOrder> {
  const quantity = Math.abs(parseFloat(positionAmt));
  const side = parseFloat(positionAmt) > 0 ? 'SELL' : 'BUY';
  const formattedQuantity = formatQuantityForBinance(quantity, stepSize);

  return submitFuturesOrder(client, {
    symbol,
    side,
    type: 'MARKET',
    quantity: formattedQuantity,
    reduceOnly: true,
  });
}

export async function getOpenOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesOrder[]> {
  try {
    const orders = symbol
      ? await guardBinanceCall(() => client.getAllOpenOrders({ symbol }))
      : await guardBinanceCall(() => client.getAllOpenOrders());

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
    const brackets = await guardBinanceCall(() => client.getNotionalAndLeverageBrackets({ symbol }));
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

    const result = await guardBinanceCall(() => client.submitNewAlgoOrder(algoParams));

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
    await guardBinanceCall(() => client.cancelAlgoOrder({ algoId }));
    logger.info({ algoId }, '[Futures] Algo order cancelled successfully');
  } catch (error) {
    const msg = serializeError(error);
    if (msg.includes('Unknown order') || msg.includes('Order does not exist') || msg.includes('not found')) {
      logger.info({ algoId }, '[Futures] Algo order already cancelled or does not exist');
      return;
    }
    logger.error({ error: msg, algoId }, '[Futures] Failed to cancel algo order');
    throw error;
  }
}

export async function cancelAllFuturesAlgoOrders(
  client: USDMClient,
  symbol: string
): Promise<void> {
  try {
    await guardBinanceCall(() => client.cancelAllAlgoOpenOrders({ symbol }));
    logger.info({ symbol }, '[Futures] All algo orders cancelled successfully');
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to cancel all algo orders');
    throw error;
  }
}

export async function cancelAllSymbolOrders(client: USDMClient, symbol: string): Promise<void> {
  const results = await Promise.allSettled([
    cancelAllFuturesOrders(client, symbol),
    cancelAllFuturesAlgoOrders(client, symbol),
  ]);
  for (const r of results) {
    if (r.status === 'rejected') {
      const msg = serializeError(r.reason);
      if (!msg.includes('No orders') && !msg.includes('not found'))
        logger.warn({ symbol, error: msg }, '[Futures] Partial failure in cancelAllSymbolOrders');
    }
  }
}

export async function getOpenAlgoOrders(
  client: USDMClient,
  symbol?: string
): Promise<FuturesAlgoOrder[]> {
  try {
    const orders = await guardBinanceCall(() => client.getOpenAlgoOrders(symbol ? { symbol } : undefined));

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
    const result = await guardBinanceCall(() => client.getAlgoOrder({ algoId }));

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
    const result = await guardBinanceCall(() => client.getIncomeHistory(params as Parameters<typeof client.getIncomeHistory>[0]));

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


export async function getRecentTrades(
  client: USDMClient,
  symbol: string,
  limit = 10
): Promise<AccountTradeRecord[]> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({ symbol, limit }));
    return trades.map((t) => ({
      symbol: t.symbol,
      id: t.id,
      orderId: t.orderId,
      side: t.side as 'BUY' | 'SELL',
      price: String(t.price),
      qty: String(t.qty),
      realizedPnl: String(t.realizedPnl),
      quoteQty: String(t.quoteQty),
      commission: String(t.commission),
      commissionAsset: t.commissionAsset,
      time: t.time,
      buyer: t.buyer,
      maker: t.maker,
    }));
  } catch (error) {
    logger.error({ error: serializeError(error), symbol }, '[Futures] Failed to get account trades');
    throw error;
  }
}

export async function getLastClosingTrade(
  client: USDMClient,
  symbol: string,
  side: 'LONG' | 'SHORT',
  openedAt: number
): Promise<{ price: number; realizedPnl: number; commission: number } | null> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      startTime: openedAt,
      limit: 100,
    }));

    const closingSide = side === 'LONG' ? 'SELL' : 'BUY';
    const closingTrades = trades.filter(
      (t) => t.side === closingSide && parseFloat(String(t.realizedPnl)) !== 0
    );

    if (closingTrades.length === 0) return null;

    const lastTrade = closingTrades[closingTrades.length - 1];
    if (!lastTrade) return null;

    let totalRealizedPnl = 0;
    let totalCommission = 0;
    let weightedPrice = 0;
    let totalQty = 0;

    for (const trade of closingTrades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      totalRealizedPnl += parseFloat(String(trade.realizedPnl));
      totalCommission += parseFloat(String(trade.commission));
      weightedPrice += price * qty;
      totalQty += qty;
    }

    const avgPrice = totalQty > 0 ? weightedPrice / totalQty : parseFloat(String(lastTrade.price));

    return {
      price: avgPrice,
      realizedPnl: totalRealizedPnl,
      commission: totalCommission,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, side }, '[Futures] Failed to get last closing trade');
    return null;
  }
}


export async function getAllTradeFeesForPosition(
  client: USDMClient,
  symbol: string,
  side: 'LONG' | 'SHORT',
  openedAt: number,
  closedAt?: number
): Promise<AllTradeFeesResult | null> {
  try {
    const endTime = closedAt || Date.now();
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      startTime: openedAt - 5000,
      endTime: endTime + 5000,
      limit: 100,
    }));

    if (trades.length === 0) return null;

    const entrySide = side === 'LONG' ? 'BUY' : 'SELL';
    const closingSide = side === 'LONG' ? 'SELL' : 'BUY';

    let entryFee = 0;
    let exitFee = 0;
    let entryWeightedPrice = 0;
    let entryTotalQty = 0;
    let exitWeightedPrice = 0;
    let exitTotalQty = 0;
    let totalRealizedPnl = 0;

    for (const trade of trades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      const commission = parseFloat(String(trade.commission));
      const realizedPnl = parseFloat(String(trade.realizedPnl));

      if (trade.side === entrySide) {
        entryFee += commission;
        entryWeightedPrice += price * qty;
        entryTotalQty += qty;
      } else if (trade.side === closingSide) {
        exitFee += commission;
        exitWeightedPrice += price * qty;
        exitTotalQty += qty;
        totalRealizedPnl += realizedPnl;
      }
    }

    const avgEntryPrice = entryTotalQty > 0 ? entryWeightedPrice / entryTotalQty : 0;
    const avgExitPrice = exitTotalQty > 0 ? exitWeightedPrice / exitTotalQty : 0;

    logger.info({
      symbol,
      side,
      entryFee,
      exitFee,
      totalFees: entryFee + exitFee,
      entryPrice: avgEntryPrice,
      exitPrice: avgExitPrice,
      realizedPnl: totalRealizedPnl,
      tradesFound: trades.length,
    }, '[Futures] Fetched all trade fees for position');

    return {
      entryFee,
      exitFee,
      totalFees: entryFee + exitFee,
      entryPrice: avgEntryPrice,
      exitPrice: avgExitPrice,
      realizedPnl: totalRealizedPnl,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, side }, '[Futures] Failed to get all trade fees');
    return null;
  }
}

export async function getOrderEntryFee(
  client: USDMClient,
  symbol: string,
  orderId: number
): Promise<{ entryFee: number; avgPrice: number; totalQty: number } | null> {
  try {
    const trades = await guardBinanceCall(() => client.getAccountTrades({
      symbol,
      orderId,
      limit: 50,
    }));

    if (trades.length === 0) return null;

    let totalFee = 0;
    let weightedPrice = 0;
    let totalQty = 0;

    for (const trade of trades) {
      const qty = parseFloat(String(trade.qty));
      const price = parseFloat(String(trade.price));
      const commission = parseFloat(String(trade.commission));

      totalFee += commission;
      weightedPrice += price * qty;
      totalQty += qty;
    }

    const avgPrice = totalQty > 0 ? weightedPrice / totalQty : 0;

    logger.info({
      symbol,
      orderId,
      entryFee: totalFee,
      avgPrice,
      totalQty,
      tradesCount: trades.length,
    }, '[Futures] Fetched entry fee for order');

    return {
      entryFee: totalFee,
      avgPrice,
      totalQty,
    };
  } catch (error) {
    logger.error({ error: serializeError(error), symbol, orderId }, '[Futures] Failed to get order entry fee');
    return null;
  }
}
