import type { MarketType } from '@marketmind/types';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { trpc } from '../utils/trpc';

// Mutation onSuccess invalidations are scoped narrowly: trading caches
// (executions, orders, positions, wallet balance) are kept in sync via
// socket events from the user-stream → RealtimeTradingSyncContext, which
// patches them in the same render frame as Binance reports the change
// AND fires a debounced reconciliation invalidate. Re-firing those
// invalidates here would just trigger a duplicate refetch round-trip
// 100–300ms before the socket-driven patch lands — net effect: 5–7
// extra in-flight tRPC calls per click and a stutter on the ticket
// button. We keep only invalidations the socket layer doesn't cover
// (server-side analytics aggregations).
export const useBackendTradingMutations = () => {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  // Drop a cancelled order from every cached variant of
  // getOpenOrders / getOpenAlgoOrders, regardless of input shape.
  // updatePendingEntry can be invoked across (walletId), (walletId,
  // symbol), and any other future input combo — using setQueriesData
  // with a partial key match keeps each variant in sync without us
  // having to mirror the call site's input.
  const removeOrderFromAllOpenOrderCaches = (orderIdToRemove: string) => {
    const removeFn = (data: unknown): unknown => {
      if (!Array.isArray(data)) return data;
      return (data as Array<{ orderId?: string | number; id?: string }>).filter(
        (o) => String(o.orderId ?? o.id) !== orderIdToRemove,
      );
    };
    queryClient.setQueriesData(
      { queryKey: getQueryKey(trpc.futuresTrading.getOpenOrders) },
      removeFn,
    );
    queryClient.setQueriesData(
      { queryKey: getQueryKey(trpc.futuresTrading.getOpenAlgoOrders) },
      removeFn,
    );
  };

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: (data) => {
      // Patch tradeExecutions cache directly from the mutation response
      // — the backend returns the authoritative open-executions list
      // immediately, so newly-placed entries appear in Orders /
      // Portfolio / chart in the same render frame as the mutation
      // resolves, without waiting 200–500ms for the socket event.
      if (data.openExecutions) {
        const wId = data.openExecutions[0]?.walletId ?? '';
        if (wId) {
          utils.trading.getTradeExecutions.setData(
            { walletId: wId, status: 'open', limit: 500 },
            data.openExecutions,
          );
        }
      }
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onMutate: ({ orderId }) => {
      // Optimistically drop the order from every open-orders cache
      // variant the renderer may be holding (orphan-orders panel,
      // chart's pending lines, etc.). Without this the cancelled
      // order's entry line lingers on the chart for the 200–500ms
      // refetch round-trip after the cancel ACKs.
      if (orderId) removeOrderFromAllOpenOrderCaches(String(orderId));
    },
    onSuccess: (data) => {
      // The cancel response carries the authoritative open-executions
      // list — patch the cache directly. order:cancelled socket event
      // also lands and reconciles via the merge helper.
      if (data.openExecutions) {
        const walletId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      }
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const closeExecutionMutation = trpc.trading.closeTradeExecution.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const walletId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      }
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.trading.cancelTradeExecution.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const walletId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      }
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const updateExecutionSLTPMutation = trpc.trading.updateTradeExecutionSLTP.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const walletId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      }
      // SL/TP changes mutate algo-orders that have no socket coverage
      // (algo events fire on their own private channel and aren't part
      // of the user-stream we patch). Refresh the algo-order caches to
      // reflect the new SL/TP price; trading-execution caches handled
      // by the setData above + position:update sockets.
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
    },
  });

  const cancelProtectionOrderMutation = trpc.trading.cancelIndividualProtectionOrder.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const walletId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      }
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
    },
  });

  const updatePendingEntryMutation = trpc.trading.updatePendingEntry.useMutation({
    onSuccess: (data) => {
      // Drop the cancelled order from getOpenOrders cache immediately
      // so the chart doesn't paint a "ghost copy" at the old price
      // while the cache eventually-consistently catches up. Without
      // this patch, the user sees the old + new entry line side by
      // side for 200–500ms after each chart drag — long enough to
      // misclick.
      if (data?.oldOrderId) {
        removeOrderFromAllOpenOrderCaches(String(data.oldOrderId));
      }
      // Belt-and-suspenders refetch — the new orderId only enters
      // these caches once Binance returns it on the next list call.
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
    },
  });

  const createOrder = useCallback(
    async (data: {
      walletId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT' | 'STOP_MARKET' | 'TAKE_PROFIT_MARKET';
      quantity?: string;
      percent?: number;
      referencePrice?: number;
      price?: string;
      stopPrice?: string;
      reduceOnly?: boolean;
      setupId?: string;
      setupType?: string;
      marketType?: MarketType;
    }) => {
      return createOrderMutation.mutateAsync(data);
    },
    [createOrderMutation]
  );

  const cancelOrder = useCallback(
    async (data: { walletId: string; symbol: string; orderId: string }) => {
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

  const updatePendingEntry = useCallback(
    async (data: { id: string; newPrice: number }) => updatePendingEntryMutation.mutateAsync(data),
    [updatePendingEntryMutation]
  );

  return {
    createOrder,
    cancelOrder,
    closeExecution,
    cancelExecution,
    updateExecutionSLTP,
    cancelProtectionOrder,
    updatePendingEntry,
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
