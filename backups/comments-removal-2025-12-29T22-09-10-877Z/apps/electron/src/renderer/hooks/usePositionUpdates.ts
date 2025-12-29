import { useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

export const usePositionUpdates = (walletId: string, enabled = true) => {
  const utils = trpc.useUtils();
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({
    autoConnect: enabled,
  });

  useEffect(() => {
    if (!enabled || !isConnected || !walletId) return;

    subscribe.positions(walletId);

    const handlePositionUpdate = (_position: unknown) => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.trading.getPositions.invalidate();
    };

    on('position:update', handlePositionUpdate);

    return () => {
      off('position:update', handlePositionUpdate);
      unsubscribe.positions(walletId);
    };
  }, [enabled, isConnected, walletId, utils]);

  return {
    isConnected,
  };
};
