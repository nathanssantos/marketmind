import { useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

export const useWalletUpdates = (walletId: string, enabled = true): { isConnected: boolean } => {
  const utils = trpc.useUtils();
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({
    autoConnect: enabled,
  });

  useEffect(() => {
    if (!enabled || !isConnected || !walletId) return;

    subscribe.wallet(walletId);

    const handleWalletUpdate = (_wallet: unknown): void => {
      void utils.wallet.list.invalidate();
      void utils.wallet.getById.invalidate();
    };

    on('wallet:update', handleWalletUpdate);

    return () => {
      off('wallet:update', handleWalletUpdate);
      unsubscribe.wallet(walletId);
    };
  }, [enabled, isConnected, walletId, utils]);

  return {
    isConnected,
  };
};
