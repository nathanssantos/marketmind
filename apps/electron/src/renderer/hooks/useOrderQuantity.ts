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
}

export const useOrderQuantity = (symbol: string | undefined, marketType: MarketType | undefined): UseOrderQuantityResult => {
  const { activeWallet } = useActiveWallet();
  const sizePercent = useQuickTradeStore((s) => s.sizePercent);

  const balance = parseFloat(activeWallet?.currentBalance ?? '0');
  const isFutures = marketType === 'FUTURES';

  const { data: symbolLeverage } = trpc.futuresTrading.getSymbolLeverage.useQuery(
    { walletId: activeWallet?.id!, symbol: symbol ?? '' },
    { enabled: !!activeWallet?.id && !!symbol && isFutures },
  );
  const leverage = isFutures ? (symbolLeverage?.leverage ?? 1) : 1;

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

  const getQuantity = useCallback((price: number): string => {
    const pct = sizePercent / 100;
    const marginPower = isFutures ? balance * leverage : balance;
    const qty = marginPower > 0 && price > 0 ? (marginPower * pct) / price : 0;
    return roundTradingQty(qty, stepSize > 0 ? stepSize : undefined);
  }, [balance, sizePercent, leverage, isFutures, stepSize]);

  return { getQuantity, leverage, balance, sizePercent, stepSize, minNotional };
};
