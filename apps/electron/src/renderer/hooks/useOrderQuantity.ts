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

  const getQuantity = useCallback((price: number): string => {
    const pct = sizePercent / 100;
    const marginPower = isFutures ? balance * leverage : balance;
    const qty = marginPower > 0 && price > 0 ? (marginPower * pct) / price : 0;
    return roundTradingQty(qty);
  }, [balance, sizePercent, leverage, isFutures]);

  return { getQuantity, leverage, balance, sizePercent };
};
