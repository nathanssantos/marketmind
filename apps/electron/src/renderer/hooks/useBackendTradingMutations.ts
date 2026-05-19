import type { MarketType } from '@marketmind/types';
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { trpc } from '../utils/trpc';
import { replaceOpenExecutionsInAllCaches } from '../services/executionCacheSync';
import { useOptimisticOrderOverrides } from '../context/OptimisticOrderOverridesContext';

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
  const { blockOrderId, unblockOrderId } = useOptimisticOrderOverrides();

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

  // Helper: every mutation whose response carries `data.openExecutions`
  // funnels the snapshot through `replaceOpenExecutionsInAllCaches`,
  // which fans out across both `trading.getTradeExecutions` and
  // `autoTrading.getActiveExecutions` (chart consumer) and across every
  // input variant (status+limit+pagination). Earlier we patched a
  // single hardcoded variant — sibling chart instances waited 200–500ms
  // for the socket event to land before they reflected the change.
  const fanOutOpenExecutions = (
    data: {
      walletId?: string | null;
      openExecutions?: Array<{ walletId?: string | null; [k: string]: unknown }>;
    }
  ) => {
    if (!data.openExecutions) return;
    const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
    if (!wId) return;
    replaceOpenExecutionsInAllCaches(queryClient, wId, data.openExecutions as never);
  };

  // Single source for the analytics invalidation cascade triggered by
  // any trading mutation. closeExecution-style flows additionally need
  // getDailyPerformance (one row materializes for the close); pass
  // { daily: true } for those.
  const invalidateTradingAnalytics = (opts: { daily?: boolean } = {}) => {
    void utils.analytics.getPerformance.invalidate();
    if (opts.daily) void utils.analytics.getDailyPerformance.invalidate();
  };

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: (data) => {
      // Backend returns authoritative open-executions list. Fan it out
      // to every cache variant so charts/Portfolio/dialogs all reflect
      // the new entry in the same render frame.
      fanOutOpenExecutions(data);
      invalidateTradingAnalytics();
    },
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onMutate: ({ orderId }) => {
      // Optimistically drop the order from every open-orders cache
      // variant the renderer may be holding (orphan-orders panel,
      // chart's pending lines, etc.). Without this the cancelled
      // order's entry line lingers on the chart for the 200–500ms
      // refetch round-trip after the cancel ACKs.
      // Also block-list the orderId so any concurrent refetch during
      // the Binance cancel ack window (it's eventually-consistent and
      // keeps listing the cancelled order for several seconds) can't
      // re-surface the order via useOrphanOrders. Auto-cleanup effect
      // in useChartTradingData unblocks when Binance stops listing it;
      // 30s safety TTL backstops a hung cancel.
      if (orderId) {
        removeOrderFromAllOpenOrderCaches(String(orderId));
        blockOrderId(String(orderId));
        setTimeout(() => unblockOrderId(String(orderId)), 30_000);
      }
    },
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      invalidateTradingAnalytics();
    },
  });

  const closeExecutionMutation = trpc.trading.closeTradeExecution.useMutation({
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      invalidateTradingAnalytics({ daily: true });
    },
  });

  const cancelExecutionMutation = trpc.trading.cancelTradeExecution.useMutation({
    onMutate: ({ id }) => {
      // Look up the exec's underlying entry/SL/TP orderIds in the
      // autoTrading cache and block-list them. Without this, a
      // concurrent refetch of getOpenOrders/getOpenAlgoOrders during
      // the cancel ack window re-pulls the still-listed orders from
      // Binance (eventually-consistent) and the chart renders them as
      // orphan/tracked lines until the cancel fully propagates.
      const activeExecCaches = queryClient.getQueriesData<Array<{
        id: string;
        entryOrderId?: string | null;
        stopLossOrderId?: string | null;
        stopLossAlgoId?: string | null;
        takeProfitOrderId?: string | null;
        takeProfitAlgoId?: string | null;
      }>>({
        queryKey: getQueryKey(trpc.autoTrading.getActiveExecutions),
      });
      for (const [, rows] of activeExecCaches) {
        if (!Array.isArray(rows)) continue;
        const target = rows.find((r) => r.id === id);
        if (!target) continue;
        const idsToBlock = [
          target.entryOrderId,
          target.stopLossOrderId,
          target.stopLossAlgoId,
          target.takeProfitOrderId,
          target.takeProfitAlgoId,
        ].filter((x): x is string => !!x).map(String);
        for (const oid of idsToBlock) {
          blockOrderId(oid);
          setTimeout(() => unblockOrderId(oid), 30_000);
        }
        break;
      }
    },
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      invalidateTradingAnalytics();
    },
  });

  const updateExecutionSLTPMutation = trpc.trading.updateTradeExecutionSLTP.useMutation({
    onMutate: ({ id }) => {
      // SL/TP move = backend cancels the old algo + creates a new one.
      // Block-list the OLD SL/TP algoIds so concurrent refetches during
      // the cancel ack window can't surface them as phantom lines.
      const activeExecCaches = queryClient.getQueriesData<Array<{
        id: string;
        stopLossOrderId?: string | null;
        stopLossAlgoId?: string | null;
        takeProfitOrderId?: string | null;
        takeProfitAlgoId?: string | null;
      }>>({
        queryKey: getQueryKey(trpc.autoTrading.getActiveExecutions),
      });
      for (const [, rows] of activeExecCaches) {
        if (!Array.isArray(rows)) continue;
        const target = rows.find((r) => r.id === id);
        if (!target) continue;
        const ids = [target.stopLossOrderId, target.stopLossAlgoId, target.takeProfitOrderId, target.takeProfitAlgoId]
          .filter((x): x is string => !!x).map(String);
        for (const oid of ids) {
          blockOrderId(oid);
          setTimeout(() => unblockOrderId(oid), 30_000);
        }
        break;
      }
    },
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      // SL/TP changes mutate algo-orders that have no socket coverage
      // (algo events fire on their own private channel and aren't part
      // of the user-stream we patch). Refresh the algo-order caches to
      // reflect the new SL/TP price; execution caches handled by the
      // fanout above + position:update sockets.
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
    },
  });

  const cancelProtectionOrderMutation = trpc.trading.cancelIndividualProtectionOrder.useMutation({
    onMutate: ({ executionIds, type }) => {
      // Block the SL/TP algoId for each exec being patched. Same race
      // as cancelOrder — Binance keeps listing the cancelled algo for
      // a few seconds; without blocking, a concurrent refetch turns
      // it into a phantom orphan order line on the chart.
      const activeExecCaches = queryClient.getQueriesData<Array<{
        id: string;
        stopLossOrderId?: string | null;
        stopLossAlgoId?: string | null;
        takeProfitOrderId?: string | null;
        takeProfitAlgoId?: string | null;
      }>>({
        queryKey: getQueryKey(trpc.autoTrading.getActiveExecutions),
      });
      for (const [, rows] of activeExecCaches) {
        if (!Array.isArray(rows)) continue;
        for (const execId of executionIds) {
          const target = rows.find((r) => r.id === execId);
          if (!target) continue;
          const ids = type === 'stopLoss'
            ? [target.stopLossOrderId, target.stopLossAlgoId]
            : [target.takeProfitOrderId, target.takeProfitAlgoId];
          for (const oid of ids.filter((x): x is string => !!x).map(String)) {
            blockOrderId(oid);
            setTimeout(() => unblockOrderId(oid), 30_000);
          }
        }
      }
    },
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getOpenAlgoOrders.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
    },
  });

  const updatePendingEntryMutation = trpc.trading.updatePendingEntry.useMutation({
    onMutate: ({ id }) => {
      // Drop the OLD orderId from the orphan-classifier REST caches the
      // instant the drag-release fires — BEFORE the mutation roundtrip
      // begins. Look up the exec in the autoTrading.getActiveExecutions
      // cache to read its current entryOrderId.
      //
      // Without this drop, during the ~100–500ms cancel+create roundtrip:
      //   1. The exec's optimistic-patched entryPrice renders the line
      //      at the NEW price (good).
      //   2. The OLD order is still in `futuresTrading.getOpenOrders`
      //      cache (REST hasn't refetched).
      //   3. If the exec's `entryOrderId` ever drifts away from the OLD
      //      orderId in cache (backend detach, refetch with NULL during
      //      the mutation window), the orphan classifier stops skipping
      //      the OLD order — it surfaces as a `trackedOrder` / `orphan`
      //      line at the OLD price.
      //   4. Chart paints both: optimistic NEW + phantom OLD → user sees
      //      two pending lines until the next refetch reconciles.
      // Dropping the OLD orderId upfront eliminates the phantom source.
      const activeExecCaches = queryClient.getQueriesData<Array<{ id: string; entryOrderId?: string | null }>>({
        queryKey: getQueryKey(trpc.autoTrading.getActiveExecutions),
      });
      for (const [, rows] of activeExecCaches) {
        if (!Array.isArray(rows)) continue;
        const target = rows.find((r) => r.id === id);
        if (target?.entryOrderId) {
          const oid = String(target.entryOrderId);
          removeOrderFromAllOpenOrderCaches(oid);
          // Block-list survives concurrent refetches that re-pull the
          // still-listed cancelled orderId from Binance.
          blockOrderId(oid);
          setTimeout(() => unblockOrderId(oid), 30_000);
          break;
        }
      }
    },
    onSuccess: (data) => {
      // Belt-and-suspenders: the cancel ack from Binance might bring a
      // new snapshot that re-includes the old order briefly between
      // onMutate's drop and Binance's actual cancellation. Drop again
      // on the authoritative server-returned oldOrderId.
      if (data?.oldOrderId) {
        removeOrderFromAllOpenOrderCaches(String(data.oldOrderId));
      }
      // The new orderId only enters these caches once Binance returns
      // it on the next list call.
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
