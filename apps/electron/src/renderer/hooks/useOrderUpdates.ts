import { useEffect } from 'react';
import { trpc } from '../utils/trpc';
import { useWebSocket } from './useWebSocket';

export const useOrderUpdates = (walletId: string, enabled = true) => {
  const utils = trpc.useUtils();
  const { isConnected, subscribe, unsubscribe, on, off } = useWebSocket({
    autoConnect: enabled,
  });

  useEffect(() => {
    if (!enabled || !isConnected || !walletId) return;

    subscribe.orders(walletId);

    const handleOrderCreated = (_order: unknown) => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.trading.getOrders.invalidate();
      utils.trading.getPositions.invalidate();
    };

    const handleOrderUpdate = (_order: unknown) => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.trading.getOrders.invalidate();
      utils.trading.getPositions.invalidate();
    };

    const handleOrderCancelled = (_order: unknown) => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.trading.getOrders.invalidate();
      utils.trading.getPositions.invalidate();
    };

    on('order:created', handleOrderCreated);
    on('order:update', handleOrderUpdate);
    on('order:cancelled', handleOrderCancelled);

    return () => {
      off('order:created', handleOrderCreated);
      off('order:update', handleOrderUpdate);
      off('order:cancelled', handleOrderCancelled);
      unsubscribe.orders(walletId);
    };
  }, [enabled, isConnected, walletId, utils]);

  return {
    isConnected,
  };
};
