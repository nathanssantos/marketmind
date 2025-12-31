import { useCallback, useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

export const useOrderUpdates = (walletId: string, enabled = true) => {
  const utils = trpc.useUtils();
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({
    autoConnect: enabled,
  });

  const handleOrderEvent = useCallback(() => {
    utils.autoTrading.getActiveExecutions.invalidate();
    utils.trading.getOrders.invalidate();
    utils.trading.getPositions.invalidate();
  }, [utils]);

  useEffect(() => {
    if (!enabled || !isConnected || !walletId) return;

    subscribe.orders(walletId);

    on('order:created', handleOrderEvent);
    on('order:update', handleOrderEvent);
    on('order:cancelled', handleOrderEvent);

    return () => {
      off('order:created', handleOrderEvent);
      off('order:update', handleOrderEvent);
      off('order:cancelled', handleOrderEvent);
      unsubscribe.orders(walletId);
    };
  }, [enabled, isConnected, walletId, subscribe, unsubscribe, on, off, handleOrderEvent]);

  return {
    isConnected,
  };
};
