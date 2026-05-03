import type { FuturesAccount, FuturesLeverage, FuturesPosition, MarginType, PositionSide } from '@marketmind/types';
import { USDMClient } from 'binance';
import type { Wallet } from '../db/schema';
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
  positionSide?: PositionSide | 'BOTH'
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

// V3 positionRisk dropped leverage + marginType — they only live on the
// account-info endpoint now. We fetch both and merge by (symbol, side)
// so the public shape stays identical to the legacy V2 wrapper.
type LeverageInfo = { leverage: number; isolated: boolean };

const buildLeverageMap = (
  accountPositions: ReadonlyArray<{ symbol: string; positionSide: string; leverage: string | number; isolated: boolean }>,
): Map<string, LeverageInfo> => {
  const out = new Map<string, LeverageInfo>();
  for (const ap of accountPositions) {
    out.set(`${ap.symbol}_${ap.positionSide}`, {
      leverage: Number(ap.leverage),
      isolated: ap.isolated,
    });
  }
  return out;
};

export async function getPositions(
  client: USDMClient,
  options?: { symbol?: string }
): Promise<FuturesPosition[]> {
  try {
    const positionsV3 = await guardBinanceCall(() =>
      options?.symbol
        ? client.getPositionsV3({ symbol: options.symbol })
        : client.getPositionsV3()
    );
    const open = positionsV3.filter((p) => parseFloat(String(p.positionAmt)) !== 0);
    if (open.length === 0) return [];

    const accountInfo = await guardBinanceCall(() => client.getAccountInformationV3());
    const leverageMap = buildLeverageMap(accountInfo.positions ?? []);

    return open.map((p) => {
      const acct = leverageMap.get(`${p.symbol}_${p.positionSide}`);
      return {
        symbol: p.symbol,
        positionSide: p.positionSide,
        positionAmt: String(p.positionAmt),
        entryPrice: String(p.entryPrice),
        markPrice: String(p.markPrice || '0'),
        unrealizedPnl: String(p.unRealizedProfit),
        liquidationPrice: String(p.liquidationPrice),
        leverage: acct?.leverage ?? 1,
        marginType: (acct?.isolated ? 'isolated' : 'cross') as MarginType,
        isolatedMargin: String(p.isolatedMargin),
        notional: String(p.notional),
        isolatedWallet: String(p.isolatedWallet),
        updateTime: p.updateTime,
      };
    });
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
    const positions = await guardBinanceCall(() => client.getPositionsV3({ symbol }));
    const position = positions.find(
      (p) => p.symbol === symbol && parseFloat(String(p.positionAmt)) !== 0
    );

    if (!position) return null;

    const accountInfo = await guardBinanceCall(() => client.getAccountInformationV3());
    const leverageMap = buildLeverageMap(accountInfo.positions ?? []);
    const acct = leverageMap.get(`${position.symbol}_${position.positionSide}`);

    return {
      symbol: position.symbol,
      positionSide: position.positionSide,
      positionAmt: String(position.positionAmt),
      entryPrice: String(position.entryPrice),
      markPrice: String(position.markPrice || '0'),
      unrealizedPnl: String(position.unRealizedProfit),
      liquidationPrice: String(position.liquidationPrice),
      leverage: acct?.leverage ?? 1,
      marginType: (acct?.isolated ? 'isolated' : 'cross') as MarginType,
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
    const account = await guardBinanceCall(() => client.getAccountInformationV3());
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
          positionSide: p.positionSide,
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

export {
    cancelAllFuturesAlgoOrders,
    cancelAllFuturesOrders,
    cancelAllSymbolOrders,
    cancelFuturesAlgoOrder,
    cancelFuturesOrder,
    closePosition,
    getAlgoOrder,
    getOpenAlgoOrders,
    getOpenOrders,
    submitFuturesAlgoOrder,
    submitFuturesOrder,
} from './binance-futures-orders';

export {
    getAllTradeFeesForPosition,
    getIncomeHistory,
    getLastClosingTrade,
    getOrderEntryFee,
    getRecentTrades,
    getSymbolLeverageBrackets,
} from './binance-futures-queries';
