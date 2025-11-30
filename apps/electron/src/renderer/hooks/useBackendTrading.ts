import { useCallback } from 'react';
import { trpc } from '../utils/trpc';

export const useBackendTrading = () => {
  const utils = trpc.useUtils();
  
  const { data: orders, isLoading: isLoadingOrders } = trpc.trading.getOrders.useQuery();
  const { data: positions, isLoading: isLoadingPositions } = trpc.trading.getPositions.useQuery();
  
  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: () => {
      utils.trading.getOrders.invalidate();
      utils.trading.getPositions.invalidate();
    },
  });
  
  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onSuccess: () => {
      utils.trading.getOrders.invalidate();
    },
  });
  
  const syncOrdersMutation = trpc.trading.syncOrders.useMutation({
    onSuccess: () => {
      utils.trading.getOrders.invalidate();
    },
  });
  
  const createPositionMutation = trpc.trading.createPosition.useMutation({
    onSuccess: () => {
      utils.trading.getPositions.invalidate();
    },
  });
  
  const closePositionMutation = trpc.trading.closePosition.useMutation({
    onSuccess: () => {
      utils.trading.getPositions.invalidate();
    },
  });
  
  const createOrder = useCallback(
    async (data: {
      walletId: number;
      symbol: string;
      side: 'BUY' | 'SELL';
      type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
      quantity: number;
      price?: number;
      stopPrice?: number;
    }) => {
      return createOrderMutation.mutateAsync(data);
    },
    [createOrderMutation]
  );
  
  const cancelOrder = useCallback(
    async (id: number) => {
      return cancelOrderMutation.mutateAsync({ id });
    },
    [cancelOrderMutation]
  );
  
  const syncOrders = useCallback(
    async (walletId: number) => {
      return syncOrdersMutation.mutateAsync({ walletId });
    },
    [syncOrdersMutation]
  );
  
  const createPosition = useCallback(
    async (data: {
      walletId: number;
      symbol: string;
      side: 'LONG' | 'SHORT';
      entryPrice: number;
      quantity: number;
      stopLoss?: number;
      takeProfit?: number;
    }) => {
      return createPositionMutation.mutateAsync(data);
    },
    [createPositionMutation]
  );
  
  const closePosition = useCallback(
    async (id: number, exitPrice: number) => {
      return closePositionMutation.mutateAsync({ id, exitPrice });
    },
    [closePositionMutation]
  );
  
  return {
    orders: orders ?? [],
    positions: positions ?? [],
    isLoadingOrders,
    isLoadingPositions,
    createOrder,
    cancelOrder,
    syncOrders,
    createPosition,
    closePosition,
    isCreatingOrder: createOrderMutation.isPending,
    isCancelingOrder: cancelOrderMutation.isPending,
    isSyncingOrders: syncOrdersMutation.isPending,
    isCreatingPosition: createPositionMutation.isPending,
    isClosingPosition: closePositionMutation.isPending,
    createOrderError: createOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
    syncOrdersError: syncOrdersMutation.error,
    createPositionError: createPositionMutation.error,
    closePositionError: closePositionMutation.error,
  };
};
