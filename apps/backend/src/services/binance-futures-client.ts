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
import { logger } from './logger';

export type WalletType = 'live' | 'testnet' | 'paper';

export function isPaperWallet(wallet: Wallet): boolean {
  return wallet.walletType === 'paper' || wallet.apiKeyEncrypted === 'paper-trading';
}

export function getWalletType(wallet: Wallet): WalletType {
  if (wallet.walletType) return wallet.walletType;
  if (wallet.apiKeyEncrypted === 'paper-trading') return 'paper';
  return 'live';
}

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
    logger.error({ error, symbol, leverage }, 'Failed to set leverage');
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
    logger.error({ error, symbol, marginType }, 'Failed to set margin type');
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
    logger.error({ error, symbol }, 'Failed to get futures position');
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
    logger.error({ error, params }, 'Failed to submit futures order');
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
    logger.error({ error, symbol, orderId }, 'Failed to cancel futures order');
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
    logger.error({ error, symbol }, 'Failed to cancel all futures orders');
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
    logger.error({ error, symbol }, 'Failed to get open futures orders');
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
    logger.error({ error, symbol }, 'Failed to get leverage brackets');
    throw error;
  }
}
