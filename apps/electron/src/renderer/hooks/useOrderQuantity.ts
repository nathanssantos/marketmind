import type { MarketType } from '@marketmind/types';
import { useCallback } from 'react';
import { useActiveWallet } from './useActiveWallet';
import { useQuickTradeStore } from '../store/quickTradeStore';
import { trpc } from '../utils/trpc';
import { roundTradingQty } from '@shared/utils';

export interface UseOrderQuantityResult {
  getQuantity: (price: number) => string;
  leverage: number;
  balance: number;
  sizePercent: number;
  stepSize: number;
  minNotional: number;
  /**
   * True iff every input needed to size an order is loaded and valid.
   * The Buy/Sell button MUST gate on this — sizing with stale or
   * undefined inputs has historically produced order quantities 1×
   * the intended size on a 15× leverage symbol because an unloaded
   * `getSymbolLeverage` query silently defaulted to 1.
   */
  isReady: boolean;
  /**
   * Why `isReady` is false. The renderer surfaces this verbatim in a
   * tooltip on the disabled Buy/Sell button so the user can act
   * (e.g. set leverage explicitly, fund the wallet).
   */
  notReadyReason: string | null;
}

export const useOrderQuantity = (symbol: string | undefined, marketType: MarketType | undefined): UseOrderQuantityResult => {
  const { activeWallet } = useActiveWallet();
  const sizePercent = useQuickTradeStore((s) => s.sizePercent);

  const balance = parseFloat(activeWallet?.currentBalance ?? '0');
  const isFutures = marketType === 'FUTURES';

  const {
    data: symbolLeverage,
    isLoading: isLoadingLeverage,
    error: leverageError,
  } = trpc.futuresTrading.getSymbolLeverage.useQuery(
    { walletId: activeWallet?.id!, symbol: symbol ?? '' },
    { enabled: !!activeWallet?.id && !!symbol && isFutures, retry: 1 },
  );

  // Symbol filters drive precision: stepSize is the LOT_SIZE step the
  // exchange will accept. We floor the computed qty to it client-side
  // so the ticket displays exactly what will be submitted (no
  // surprise smaller-than-expected fills from server-side floor).
  const { data: symbolFilters } = trpc.trading.getSymbolFilters.useQuery(
    { symbol: symbol ?? '', marketType: marketType ?? 'FUTURES' },
    { enabled: !!symbol, staleTime: 60 * 60 * 1000 },
  );
  const stepSize = symbolFilters?.stepSize ?? 0;
  const minNotional = symbolFilters?.minNotional ?? 0;

  // Determine readiness. For futures, refuse to compute qty until
  // leverage is genuinely loaded — silently defaulting to 1× has
  // produced 0.006 BTC scalp entries when the user intended ~1 BTC at
  // 15×. Failing closed (disabled button + reason) is the correct
  // safety stance.
  let notReadyReason: string | null = null;
  if (!activeWallet?.id) notReadyReason = 'No active wallet';
  else if (!symbol) notReadyReason = 'No symbol selected';
  else if (balance <= 0) notReadyReason = 'Wallet balance is zero';
  else if (isFutures && isLoadingLeverage) notReadyReason = 'Loading leverage…';
  else if (isFutures && leverageError) notReadyReason = leverageError.message ?? 'Could not read leverage';
  else if (isFutures && (symbolLeverage?.leverage ?? 0) <= 0) notReadyReason = 'Leverage unavailable for this symbol';

  const isReady = notReadyReason === null;
  const leverage = isFutures ? (symbolLeverage?.leverage ?? 1) : 1;

  const getQuantity = useCallback((price: number): string => {
    if (!isReady) return '0';
    const pct = sizePercent / 100;
    const marginPower = isFutures ? balance * leverage : balance;
    const qty = marginPower > 0 && price > 0 ? (marginPower * pct) / price : 0;
    return roundTradingQty(qty, stepSize > 0 ? stepSize : undefined);
  }, [balance, sizePercent, leverage, isFutures, stepSize, isReady]);

  return {
    getQuantity,
    leverage,
    balance,
    sizePercent,
    stepSize,
    minNotional,
    isReady,
    notReadyReason,
  };
};
