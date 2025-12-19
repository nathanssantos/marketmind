import { useCallback, useEffect, useMemo, useState } from 'react';
import { trpc } from '../utils/trpc';
import { useRealtimeTradingSync } from './useRealtimeTradingSync';

const BACKUP_POLLING_INTERVAL = 30000;

export const useBackendTrading = (walletId: string, symbol?: string) => {
  const utils = trpc.useUtils();
  const { subscribeToPrice } = useRealtimeTradingSync(walletId);
  const [realtimePrices, setRealtimePrices] = useState<Record<string, number>>({});

  const { data: orders, isLoading: isLoadingOrders } = trpc.trading.getOrders.useQuery(
    { walletId, symbol, limit: 50 },
    { enabled: !!walletId, refetchInterval: BACKUP_POLLING_INTERVAL, staleTime: 5000 }
  );
  const { data: positions, isLoading: isLoadingPositions } = trpc.trading.getPositions.useQuery(
    { walletId, limit: 50 },
    { enabled: !!walletId, refetchInterval: BACKUP_POLLING_INTERVAL, staleTime: 5000 }
  );
  const { data: tradeExecutions, isLoading: isLoadingExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId, symbol, limit: 50 },
    { enabled: !!walletId, refetchInterval: BACKUP_POLLING_INTERVAL, staleTime: 5000 }
  );

  const openPositionSymbols = useMemo(() => {
    const openExecutions = tradeExecutions?.filter((e) => e.status === 'open' || e.status === 'pending') ?? [];
    return [...new Set(openExecutions.map((e) => e.symbol))];
  }, [tradeExecutions]);

  const { data: tickerPrices, isLoading: isLoadingPrices } = trpc.trading.getTickerPrices.useQuery(
    { symbols: openPositionSymbols },
    { enabled: openPositionSymbols.length > 0, refetchInterval: BACKUP_POLLING_INTERVAL, staleTime: 5000 }
  );

  useEffect(() => {
    const unsubscribes: Array<() => void> = [];

    for (const sym of openPositionSymbols) {
      const unsub = subscribeToPrice(sym, (price) => {
        setRealtimePrices(prev => ({ ...prev, [sym]: price }));
      });
      unsubscribes.push(unsub);
    }

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [openPositionSymbols, subscribeToPrice]);

  const mergedTickerPrices = useMemo(() => {
    const base = tickerPrices ?? {};
    return { ...base, ...realtimePrices };
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
    isCreatingOrder: createOrderMutation.isPending,
    isCancelingOrder: cancelOrderMutation.isPending,
    isSyncingOrders: syncOrdersMutation.isPending,
    isCreatingPosition: createPositionMutation.isPending,
    isClosingPosition: closePositionMutation.isPending,
    isClosingExecution: closeExecutionMutation.isPending,
    isCancelingExecution: cancelExecutionMutation.isPending,
    createOrderError: createOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
    syncOrdersError: syncOrdersMutation.error,
    createPositionError: createPositionMutation.error,
    closePositionError: closePositionMutation.error,
    closeExecutionError: closeExecutionMutation.error,
    cancelExecutionError: cancelExecutionMutation.error,
  };
};
