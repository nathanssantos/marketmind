import { useCallback, useMemo, useRef } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePricesForSymbols } from '../store/priceStore';
import { usePollingInterval } from './usePollingInterval';
export const useBackendTrading = (walletId: string, symbol?: string, marketType: 'SPOT' | 'FUTURES' = 'FUTURES') => {
  const utils = trpc.useUtils();
  const pollingInterval = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL);

  const { data: orders, isLoading: isLoadingOrders } = trpc.trading.getOrders.useQuery(
    { walletId, symbol, limit: 100 },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );
  const { data: positions, isLoading: isLoadingPositions } = trpc.trading.getPositions.useQuery(
    { walletId, limit: 100 },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );
  const { data: tradeExecutions, isLoading: isLoadingExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId, symbol, limit: 100 },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );

  const openPositionSymbols = useMemo(() => {
    const openExecutions = tradeExecutions?.filter((e) => e.status === 'open' || e.status === 'pending') ?? [];
    return [...new Set(openExecutions.map((e) => e.symbol))];
  }, [tradeExecutions]);

  const realtimePrices = usePricesForSymbols(openPositionSymbols);

  const { data: tickerPrices, isLoading: isLoadingPrices } = trpc.trading.getTickerPrices.useQuery(
    { symbols: openPositionSymbols, marketType },
    { enabled: openPositionSymbols.length > 0, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );

  const prevMergedRef = useRef<Record<string, number>>({});

  const mergedTickerPrices = useMemo(() => {
    const base = tickerPrices ?? {};
    const merged: Record<string, number> = {};
    for (const [k, v] of Object.entries(base)) merged[k] = typeof v === 'string' ? parseFloat(v) : v;
    for (const [k, v] of Object.entries(realtimePrices)) merged[k] = v;
    const prev = prevMergedRef.current;
    const keys = Object.keys(merged);
    if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === merged[k]))
      return prev;
    prevMergedRef.current = merged;
    return merged;
  }, [tickerPrices, realtimePrices]);

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

  const syncOrdersMutation = trpc.trading.syncOrders.useMutation({
    onSuccess: () => {

      utils.trading.getOrders.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const createPositionMutation = trpc.trading.createPosition.useMutation({
    onSuccess: () => {

      utils.trading.getPositions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const closePositionMutation = trpc.trading.closePosition.useMutation({
    onSuccess: () => {

      utils.trading.getPositions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const closeExecutionMutation = trpc.trading.closeTradeExecution.useMutation({
    onSuccess: () => {

      utils.trading.getTradeExecutions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.trading.cancelTradeExecution.useMutation({
    onSuccess: () => {

      utils.trading.getTradeExecutions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
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

  return {
    orders: orders ?? [],
    positions: positions ?? [],
    tradeExecutions: tradeExecutions ?? [],
    tickerPrices: mergedTickerPrices,
    isLoadingOrders,
    isLoadingPositions,
    isLoadingExecutions,
    isLoadingPrices,
    createOrder,
    cancelOrder,
    syncOrders,
    createPosition,
    closePosition,
    closeExecution,
    cancelExecution,
    updateExecutionSLTP,
    isCreatingOrder: createOrderMutation.isPending,
    isCancelingOrder: cancelOrderMutation.isPending,
    isSyncingOrders: syncOrdersMutation.isPending,
    isCreatingPosition: createPositionMutation.isPending,
    isClosingPosition: closePositionMutation.isPending,
    isClosingExecution: closeExecutionMutation.isPending,
    isCancelingExecution: cancelExecutionMutation.isPending,
    isUpdatingExecutionSLTP: updateExecutionSLTPMutation.isPending,
    createOrderError: createOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
    syncOrdersError: syncOrdersMutation.error,
    createPositionError: createPositionMutation.error,
    closePositionError: closePositionMutation.error,
    closeExecutionError: closeExecutionMutation.error,
    cancelExecutionError: cancelExecutionMutation.error,
    updateExecutionSLTPError: updateExecutionSLTPMutation.error,
  };
};
