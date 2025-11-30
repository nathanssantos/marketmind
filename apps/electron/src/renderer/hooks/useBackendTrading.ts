import { useCallback } from 'react';
import { trpc } from '../utils/trpc';

export const useBackendTrading = (walletId: string, symbol?: string) => {
  const utils = trpc.useUtils();
  
  const { data: orders, isLoading: isLoadingOrders } = trpc.trading.getOrders.useQuery(
    { walletId, symbol, limit: 50 },
    { enabled: !!walletId }
  );
  const { data: positions, isLoading: isLoadingPositions } = trpc.trading.getPositions.useQuery(
    { walletId, limit: 50 },
    { enabled: !!walletId }
  );
  
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
      walletId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';
      quantity: string;
      price?: string;
      stopPrice?: string;
      setupId?: string;
      setupType?: string;
    }) => {
      return createOrderMutation.mutateAsync(data);
    },
    [createOrderMutation]
  );
  
  const cancelOrder = useCallback(
    async (data: { walletId: string; symbol: string; orderId: number }) => {
      return cancelOrderMutation.mutateAsync(data);
    },
    [cancelOrderMutation]
  );
  
  const syncOrders = useCallback(
    async (walletId: string, symbol: string) => {
      return syncOrdersMutation.mutateAsync({ walletId, symbol });
    },
    [syncOrdersMutation]
  );
  
  const createPosition = useCallback(
    async (data: {
      walletId: string;
      symbol: string;
      side: 'LONG' | 'SHORT';
      entryPrice: string;
      entryQty: string;
      stopLoss?: string;
      takeProfit?: string;
      setupId?: string;
    }) => {
      return createPositionMutation.mutateAsync(data);
    },
    [createPositionMutation]
  );
  
  const closePosition = useCallback(
    async (id: string, exitPrice: string) => {
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
