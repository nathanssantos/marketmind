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
    // Binance returns the same "wrong" status (-4046 / -4067) regardless of
    // whether the symbol's margin type already matches the request. The
    // message can land on .msg (raw Binance SDK error object) OR .message
    // (Error instance) depending on the call path — extract via serializeError
    // so both shapes match. Earlier code only checked Error.message and
    // missed the SDK's `{ code, msg }` form, producing a noisy ERROR log
    // every time createOrder pre-emptively normalized margin type.
    const errorCode = (error as { code?: number })?.code;
    // Some test mocks return non-string from serializeError; coerce
    // defensively so we never throw on .includes checks below.
    const rawMsg = serializeError(error);
    const errorMsg = typeof rawMsg === 'string'
      ? rawMsg
      : (error instanceof Error ? error.message : String(rawMsg ?? error));
    const benign =
      errorCode === -4046 ||
      errorCode === -4067 ||
      errorMsg.includes('No need to change margin type') ||
      errorMsg.includes('Margin type cannot be changed');
    if (benign) return;
    logger.error({ error: errorMsg, symbol, marginType }, 'Failed to set margin type');
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

// V3 endpoints (positionRisk + accountInformation) no longer carry
// `leverage` or the `isolated` boolean — Binance moved per-symbol
// margin/leverage config to /fapi/v1/symbolConfig (SDK:
// `getFuturesSymbolConfig`). That endpoint returns the user-configured
// leverage and marginType regardless of whether a position is open,
// which is exactly what the renderer needs (chart line PnL%, badges,
// ticket).
//
// We keep a defensive fallback that derives leverage from
// `notional / initialMargin` when symbolConfig is unavailable for a
// symbol (rare; happens for newly listed symbols mid-window). Both are
// quoted in USDT and `initialMargin = notional / leverage` by
// definition, so the math is exact (Binance always rounds leverage to
// integer).
type LeverageInfo = { leverage: number; isolated: boolean };

type SymbolConfigLite = {
  symbol: string;
  marginType?: string;
  leverage?: string | number;
};

type AccountPositionLite = {
  symbol: string;
  positionSide: string;
  notional?: string | number;
  initialMargin?: string | number;
  isolatedWallet?: string | number;
  isolatedMargin?: string | number;
};

const deriveLeverageFromMargin = (
  notional: string | number | undefined,
  initialMargin: string | number | undefined,
): number | undefined => {
  const n = Math.abs(Number(notional));
  const im = Number(initialMargin);
  if (!Number.isFinite(n) || !Number.isFinite(im) || im <= 0) return undefined;
  const computed = n / im;
  if (!Number.isFinite(computed) || computed <= 0) return undefined;
  return Math.round(computed);
};

const symbolConfigToInfo = (cfg: SymbolConfigLite): LeverageInfo | undefined => {
  const leverage = Number(cfg.leverage);
  if (!Number.isFinite(leverage) || leverage <= 0) return undefined;
  const isolated = String(cfg.marginType ?? '').toUpperCase() === 'ISOLATED';
  return { leverage, isolated };
};

const buildLeverageMapFromSymbolConfigs = (
  configs: ReadonlyArray<SymbolConfigLite>,
): Map<string, LeverageInfo> => {
  const bySymbol = new Map<string, LeverageInfo>();
  for (const cfg of configs) {
    const info = symbolConfigToInfo(cfg);
    if (!info) continue;
    bySymbol.set(cfg.symbol, info);
  }
  return bySymbol;
};

// Defensive fallback: when symbolConfig misses a symbol, derive
// leverage and isolated flag from the open position itself.
const fallbackInfoFromAccountPosition = (ap: AccountPositionLite | undefined): LeverageInfo | undefined => {
  if (!ap) return undefined;
  const leverage = deriveLeverageFromMargin(ap.notional, ap.initialMargin);
  if (leverage === undefined) return undefined;
  const isolatedWallet = Number(ap.isolatedWallet);
  const isolatedMargin = Number(ap.isolatedMargin);
  const isolated = (Number.isFinite(isolatedWallet) && isolatedWallet > 0)
    || (Number.isFinite(isolatedMargin) && isolatedMargin > 0);
  return { leverage, isolated };
};

// In-memory cache for symbolConfig responses. The config endpoint is
// cheap to call but returns 700+ rows when unfiltered, so we cache for
// a short TTL to amortize cost across the 30s position-sync ticks and
// the per-fill manual-fill handlers that fire several times in quick
// succession.
const SYMBOL_CONFIG_TTL_MS = 10_000;
type CachedSymbolConfigs = {
  configs: ReadonlyArray<SymbolConfigLite>;
  fetchedAt: number;
};
const symbolConfigCache = new WeakMap<USDMClient, CachedSymbolConfigs>();

export const __resetSymbolConfigCache = (client?: USDMClient) => {
  if (client) symbolConfigCache.delete(client);
  // WeakMap has no .clear(); for tests we just rely on per-client deletion.
};

const fetchSymbolConfigs = async (
  client: USDMClient,
  options?: { symbol?: string },
): Promise<ReadonlyArray<SymbolConfigLite>> => {
  // When asking for a single symbol, hit the API directly — the
  // response is tiny and we don't want to wait for or pollute the
  // bulk cache.
  if (options?.symbol) {
    return guardBinanceCall(() => client.getFuturesSymbolConfig({ symbol: options.symbol }));
  }
  const cached = symbolConfigCache.get(client);
  if (cached && Date.now() - cached.fetchedAt < SYMBOL_CONFIG_TTL_MS) {
    return cached.configs;
  }
  const configs = await guardBinanceCall(() => client.getFuturesSymbolConfig({}));
  symbolConfigCache.set(client, { configs, fetchedAt: Date.now() });
  return configs;
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

    // Pull leverage + marginType from symbolConfig (canonical source).
    // Fall back to deriving leverage from notional/initialMargin via
    // accountInformationV3 if symbolConfig misses an entry.
    const [symbolConfigs, accountInfo] = await Promise.all([
      fetchSymbolConfigs(client, options),
      guardBinanceCall(() => client.getAccountInformationV3()),
    ]);
    const leverageMap = buildLeverageMapFromSymbolConfigs(symbolConfigs);
    const accountPositionsBySymbol = new Map<string, AccountPositionLite>(
      (accountInfo.positions ?? []).map((p) => [p.symbol, p as never as AccountPositionLite]),
    );

    return open.map((p) => {
      const info = leverageMap.get(p.symbol)
        ?? fallbackInfoFromAccountPosition(accountPositionsBySymbol.get(p.symbol));
      return {
        symbol: p.symbol,
        positionSide: p.positionSide,
        positionAmt: String(p.positionAmt),
        entryPrice: String(p.entryPrice),
        markPrice: String(p.markPrice || '0'),
        unrealizedPnl: String(p.unRealizedProfit),
        liquidationPrice: String(p.liquidationPrice),
        leverage: info?.leverage ?? 1,
        marginType: (info?.isolated ? 'isolated' : 'cross') as MarginType,
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

/**
 * Thrown when neither symbolConfig nor accountInformationV3.positions
 * yields a usable leverage value for a symbol. Surfaced to callers so
 * the renderer / order-execution layer can refuse to ship a tiny
 * 1× order based on a silently-defaulted value.
 */
export class LeverageUnavailableError extends Error {
  constructor(public readonly symbol: string) {
    super(`Could not determine configured leverage for ${symbol}.`);
    this.name = 'LeverageUnavailableError';
  }
}

/**
 * Reads the configured leverage for `symbol` regardless of whether a
 * position is currently open. Source of truth is
 * `getFuturesSymbolConfig` (/fapi/v1/symbolConfig), which carries the
 * leverage the user has set even when positionAmt is 0. Falls back to
 * deriving from `notional / initialMargin` on accountInformationV3 if
 * symbolConfig comes up empty for the symbol.
 *
 * Throws `LeverageUnavailableError` when both sources fail. Earlier
 * this returned `1` as a "safe" default — it isn't safe: a frontend
 * 95% × intended-15× sizing silently fell to 95% × 1× = 6.3% of the
 * intended notional, producing scalp-killer 0.006 BTC entries. Failing
 * loud lets the caller surface the error and disable the buy button
 * instead of placing a wrong-sized order.
 */
export async function getConfiguredLeverage(
  client: USDMClient,
  symbol: string
): Promise<number> {
  try {
    const configs = await fetchSymbolConfigs(client, { symbol });
    const cfg = configs.find((c) => c.symbol === symbol);
    if (cfg) {
      const info = symbolConfigToInfo(cfg);
      if (info) return info.leverage;
    }
    // Fallback: derive from open-position margin if symbolConfig didn't
    // return an entry for this symbol.
    const accountInfo = await guardBinanceCall(() => client.getAccountInformationV3());
    const acctPos = accountInfo.positions?.find((p) => p.symbol === symbol);
    const fallback = fallbackInfoFromAccountPosition(acctPos)?.leverage;
    if (fallback !== undefined) return fallback;
    throw new LeverageUnavailableError(symbol);
  } catch (error) {
    if (error instanceof LeverageUnavailableError) throw error;
    logger.error({ error: serializeError(error), symbol }, 'Failed to get configured leverage');
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

    const [symbolConfigs, accountInfo] = await Promise.all([
      fetchSymbolConfigs(client, { symbol }),
      guardBinanceCall(() => client.getAccountInformationV3()),
    ]);
    const leverageMap = buildLeverageMapFromSymbolConfigs(symbolConfigs);
    const accountPositionLite = (accountInfo.positions ?? []).find((p) => p.symbol === symbol) as never as AccountPositionLite | undefined;
    const info = leverageMap.get(symbol) ?? fallbackInfoFromAccountPosition(accountPositionLite);

    return {
      symbol: position.symbol,
      positionSide: position.positionSide,
      positionAmt: String(position.positionAmt),
      entryPrice: String(position.entryPrice),
      markPrice: String(position.markPrice || '0'),
      unrealizedPnl: String(position.unRealizedProfit),
      liquidationPrice: String(position.liquidationPrice),
      leverage: info?.leverage ?? 1,
      marginType: (info?.isolated ? 'isolated' : 'cross') as MarginType,
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
    const [account, symbolConfigs] = await Promise.all([
      guardBinanceCall(() => client.getAccountInformationV3()),
      fetchSymbolConfigs(client),
    ]);
    const leverageMap = buildLeverageMapFromSymbolConfigs(symbolConfigs);
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
        .map((p) => {
          const lite = p as never as AccountPositionLite;
          const info = leverageMap.get(p.symbol) ?? fallbackInfoFromAccountPosition(lite);
          return {
            symbol: p.symbol,
            positionSide: p.positionSide,
            positionAmt: String(p.positionAmt),
            entryPrice: String(p.entryPrice),
            markPrice: '0',
            unrealizedPnl: String(p.unrealizedProfit),
            liquidationPrice: '0',
            leverage: info?.leverage ?? 1,
            marginType: (info?.isolated ? 'isolated' : 'cross') as MarginType,
            isolatedMargin: String((p as unknown as { isolatedMargin?: number }).isolatedMargin ?? 0),
            notional: String(p.notional),
            isolatedWallet: String(p.isolatedWallet),
            updateTime: p.updateTime,
          };
        }),
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
