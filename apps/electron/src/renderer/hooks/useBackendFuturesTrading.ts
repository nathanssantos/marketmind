import type { FuturesOrderType, PositionSide } from '@marketmind/types';
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getQueryKey } from '@trpc/react-query';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePricesForSymbols } from '../store/priceStore';
import { replaceOpenExecutionsInAllCaches } from '../services/executionCacheSync';
import { usePollingInterval } from './usePollingInterval';

export const useBackendFuturesTrading = (walletId: string, symbol?: string) => {
  const utils = trpc.useUtils();
  const queryClient = useQueryClient();

  // Optimistic-remove helper: drops an orderId from every variant of
  // futuresTrading.getOpenOrders / getOpenAlgoOrders cache so the
  // chart's pending-order line vanishes the instant the user clicks
  // Cancel — without waiting for the 200–500ms refetch round-trip
  // after the cancel ACKs on Binance. Without this the cancelled
  // order's price line lingers visibly on the chart.
  const dropOrderFromCaches = (orderIdToRemove: string) => {
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

  // Fans out the authoritative open-executions snapshot across both
  // execution-cache procedures (chart's autoTrading.getActiveExecutions
  // included) for every input variant — see executionCacheSync.ts.
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
  const pollingInterval = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL);

  const { data: positions, isLoading: isLoadingPositions } = trpc.futuresTrading.getPositions.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );

  const { data: openOrders, isLoading: isLoadingOrders } = trpc.futuresTrading.getOpenOrders.useQuery(
    { walletId, symbol },
    { enabled: !!walletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );

  const markPricePolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.FAST);
  const fundingRatePolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.SLOW);

  const { data: markPrice, isLoading: isLoadingMarkPrice } = trpc.futuresTrading.getMarkPrice.useQuery(
    { symbol: symbol ?? 'BTCUSDT' },
    { enabled: !!symbol, refetchInterval: markPricePolling, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );

  const { data: fundingRate, isLoading: isLoadingFundingRate } = trpc.futuresTrading.getFundingRate.useQuery(
    { symbol: symbol ?? 'BTCUSDT' },
    { enabled: !!symbol, refetchInterval: fundingRatePolling, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM }
  );

  const openPositionSymbols = useMemo(() => {
    if (!positions || !Array.isArray(positions)) return [];
    const symbols = positions.map((p) => {
      if ('symbol' in p && typeof p.symbol === 'string') return p.symbol;
      return null;
    }).filter((s): s is string => s !== null);
    return [...new Set(symbols)];
  }, [positions]);

  const realtimePrices = usePricesForSymbols(openPositionSymbols);

  const setLeverageMutation = trpc.futuresTrading.setLeverage.useMutation({
    onSuccess: () => {

      void utils.futuresTrading.getPositions.invalidate();
    },
  });

  const setMarginTypeMutation = trpc.futuresTrading.setMarginType.useMutation({
    onSuccess: () => {

      void utils.futuresTrading.getPositions.invalidate();
    },
  });

  const createOrderMutation = trpc.futuresTrading.createOrder.useMutation({
    onSuccess: (data) => {
      // Fan-out covers both trading.getTradeExecutions AND
      // autoTrading.getActiveExecutions across every input variant —
      // sibling charts at other timeframes update in the same render
      // frame as the click.
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.futuresTrading.getOpenDbOrderIds.invalidate();
      void utils.futuresTrading.getPositions.invalidate();
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const cancelOrderMutation = trpc.futuresTrading.cancelOrder.useMutation({
    onMutate: ({ orderId }) => {
      if (orderId) dropOrderFromCaches(String(orderId));
    },
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.futuresTrading.getOpenDbOrderIds.invalidate();
      void utils.trading.getOrders.invalidate();
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const createPositionMutation = trpc.futuresTrading.createPosition.useMutation({
    onSuccess: () => {
      void utils.futuresTrading.getPositions.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const closePositionMutation = trpc.futuresTrading.closePosition.useMutation({
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getPositions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    },
  });

  const reversePositionMutation = trpc.futuresTrading.reversePosition.useMutation({
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getPositions.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.analytics.getPerformance.invalidate();
    },
  });

  const setLeverage = useCallback(
    async (data: { walletId: string; symbol: string; leverage: number }) => {
      return setLeverageMutation.mutateAsync(data);
    },
    [setLeverageMutation]
  );

  const setMarginType = useCallback(
    async (data: { walletId: string; symbol: string; marginType: 'ISOLATED' | 'CROSSED' }) => {
      return setMarginTypeMutation.mutateAsync(data);
    },
    [setMarginTypeMutation]
  );

  const createOrder = useCallback(
    async (data: {
      walletId: string;
      symbol: string;
      side: 'BUY' | 'SELL';
      type: FuturesOrderType;
      quantity: string;
      price?: string;
      stopPrice?: string;
      reduceOnly?: boolean;
      setupId?: string;
      setupType?: string;
      leverage?: number;
      stopLoss?: string;
      takeProfit?: string;
    }) => {
      return createOrderMutation.mutateAsync(data);
    },
    [createOrderMutation]
  );

  const cancelOrder = useCallback(
    async (data: { walletId: string; symbol: string; orderId: string; isAlgo?: boolean }) => {
      return cancelOrderMutation.mutateAsync(data);
    },
    [cancelOrderMutation]
  );

  const createPosition = useCallback(
    async (data: {
      walletId: string;
      symbol: string;
      side: PositionSide;
      entryPrice: string;
      entryQty: string;
      stopLoss?: string;
      takeProfit?: string;
      setupId?: string;
      leverage?: number;
    }) => {
      return createPositionMutation.mutateAsync(data);
    },
    [createPositionMutation]
  );

  const closePosition = useCallback(
    async (data: { walletId: string; symbol: string; positionId?: string }) => {
      return closePositionMutation.mutateAsync(data);
    },
    [closePositionMutation]
  );

  const cancelAllOrdersMutation = trpc.futuresTrading.cancelAllOrders.useMutation({
    onMutate: () => {
      // User-initiated "cancel all" — wipe both open-order caches
      // immediately so all pending entry / SL / TP lines vanish from
      // the chart in the same render frame as the click. Refetches
      // below confirm with Binance.
      const emptyArray = (data: unknown): unknown => (Array.isArray(data) ? [] : data);
      queryClient.setQueriesData(
        { queryKey: getQueryKey(trpc.futuresTrading.getOpenOrders) },
        emptyArray,
      );
      queryClient.setQueriesData(
        { queryKey: getQueryKey(trpc.futuresTrading.getOpenAlgoOrders) },
        emptyArray,
      );
    },
    onSuccess: () => {
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.trading.getOrders.invalidate();
    },
  });

  const closePositionAndCancelOrdersMutation = trpc.futuresTrading.closePositionAndCancelOrders.useMutation({
    onSuccess: (data) => {
      fanOutOpenExecutions(data);
      void utils.futuresTrading.getPositions.invalidate();
      void utils.futuresTrading.getOpenOrders.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
    },
  });

  const reversePosition = useCallback(
    async (data: { walletId: string; symbol: string; positionId?: string }) => {
      return reversePositionMutation.mutateAsync(data);
    },
    [reversePositionMutation]
  );

  const cancelAllOrders = useCallback(
    async (data: { walletId: string; symbol: string }) => {
      return cancelAllOrdersMutation.mutateAsync(data);
    },
    [cancelAllOrdersMutation]
  );

  const closePositionAndCancelOrders = useCallback(
    async (data: { walletId: string; symbol: string; positionId?: string }) => {
      return closePositionAndCancelOrdersMutation.mutateAsync(data);
    },
    [closePositionAndCancelOrdersMutation]
  );

  return {
    positions: positions ?? [],
    openOrders: openOrders ?? [],
    markPrice,
    fundingRate,
    realtimePrices,
    isLoadingPositions,
    isLoadingOrders,
    isLoadingMarkPrice,
    isLoadingFundingRate,
    setLeverage,
    setMarginType,
    createOrder,
    cancelOrder,
    createPosition,
    closePosition,
    reversePosition,
    cancelAllOrders,
    closePositionAndCancelOrders,
    isSettingLeverage: setLeverageMutation.isPending,
    isSettingMarginType: setMarginTypeMutation.isPending,
    isCreatingOrder: createOrderMutation.isPending,
    isCancelingOrder: cancelOrderMutation.isPending,
    isCreatingPosition: createPositionMutation.isPending,
    isClosingPosition: closePositionMutation.isPending,
    isReversingPosition: reversePositionMutation.isPending,
    isCancellingAllOrders: cancelAllOrdersMutation.isPending,
    isClosingPositionAndCancellingOrders: closePositionAndCancelOrdersMutation.isPending,
    setLeverageError: setLeverageMutation.error,
    setMarginTypeError: setMarginTypeMutation.error,
    createOrderError: createOrderMutation.error,
    cancelOrderError: cancelOrderMutation.error,
    createPositionError: createPositionMutation.error,
    closePositionError: closePositionMutation.error,
    reversePositionError: reversePositionMutation.error,
    cancelAllOrdersError: cancelAllOrdersMutation.error,
    closePositionAndCancelOrdersError: closePositionAndCancelOrdersMutation.error,
  };
};
