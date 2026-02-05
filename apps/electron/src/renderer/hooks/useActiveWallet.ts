import { useEffect, useMemo } from 'react';
import type { AssetClass, ExchangeId } from '@marketmind/types';
import { useBackendWallet } from './useBackendWallet';
import { useUIStore } from '../store/uiStore';
import { useShallow } from 'zustand/react/shallow';

export const useActiveWallet = () => {
  const { activeWalletId, setActiveWalletId } = useUIStore(useShallow((s) => ({
    activeWalletId: s.activeWalletId,
    setActiveWalletId: s.setActiveWalletId,
  })));

  const { wallets, isLoading } = useBackendWallet();

  const activeWallet = useMemo(
    () => wallets.find((w) => w.id === activeWalletId) ?? wallets[0] ?? null,
    [wallets, activeWalletId]
  );

  const isIB = activeWallet?.exchange === 'INTERACTIVE_BROKERS';
  const assetClass: AssetClass = isIB ? 'STOCKS' : 'CRYPTO';
  const exchangeId: ExchangeId = (activeWallet?.exchange as ExchangeId) ?? 'BINANCE';

  useEffect(() => {
    if (!activeWalletId && wallets.length > 0 && wallets[0]) setActiveWalletId(wallets[0].id);
  }, [wallets, activeWalletId, setActiveWalletId]);

  return { activeWallet, activeWalletId, setActiveWalletId, isIB, assetClass, exchangeId, wallets, isLoading };
};
