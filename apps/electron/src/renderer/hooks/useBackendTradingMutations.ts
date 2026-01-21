import { useCallback } from 'react';
import { trpc } from '../utils/trpc';

export const useBackendTradingMutations = () => {
  const utils = trpc.useUtils();

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: () => {
      utils.trading.getOrders.invalidate();
      utils.trading.getPositions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onSuccess: () => {
      utils.trading.getOrders.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const closeExecutionMutation = trpc.trading.closeTradeExecution.useMutation({
    onSuccess: () => {
      utils.trading.getTradeExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.trading.cancelTradeExecution.useMutation({
    onSuccess: () => {
      utils.trading.getTradeExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const updateExecutionSLTPMutation = trpc.trading.updateTradeExecutionSLTP.useMutation({
    onSuccess: () => {
      utils.trading.getTradeExecutions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
    },
  });

  const cancelProtectionOrderMutation = trpc.trading.cancelIndividualProtectionOrder.useMutation({
    onSuccess: () => {
      utils.trading.getTradeExecutions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
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

  const closeExecution = useCallback(
    async (id: string, exitPrice: string) => {
      return closeExecutionMutation.mutateAsync({ id, exitPrice });
    },
    [closeExecutionMutation]
  );

  const cancelExecution = useCallback(
    async (id: string) => {
      return cancelExecutionMutation.mutateAsync({ id });
    },
    [cancelExecutionMutation]
  );

  const updateExecutionSLTP = useCallback(
    async (id: string, updates: { stopLoss?: number; takeProfit?: number }) => {
      return updateExecutionSLTPMutation.mutateAsync({ id, ...updates });
    },
    [updateExecutionSLTPMutation]
  );

  const cancelProtectionOrder = useCallback(
    async (executionIds: string[], type: 'stopLoss' | 'takeProfit') => {
      return cancelProtectionOrderMutation.mutateAsync({ executionIds, type });
    },
    [cancelProtectionOrderMutation]
  );

  return {
    createOrder,
    cancelOrder,
    closeExecution,
    cancelExecution,
    updateExecutionSLTP,
    cancelProtectionOrder,
    isCreatingOrder: createOrderMutation.isPending,
    isCancelingOrder: cancelOrderMutation.isPending,
    isClosingExecution: closeExecutionMutation.isPending,
    isCancelingExecution: cancelExecutionMutation.isPending,
    isUpdatingExecutionSLTP: updateExecutionSLTPMutation.isPending,
    isCancelingProtectionOrder: cancelProtectionOrderMutation.isPending,
    createOrderError: createOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
    closeExecutionError: closeExecutionMutation.error,
    cancelExecutionError: cancelExecutionMutation.error,
    updateExecutionSLTPError: updateExecutionSLTPMutation.error,
    cancelProtectionOrderError: cancelProtectionOrderMutation.error,
  };
};
