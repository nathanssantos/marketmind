import { useCallback, useMemo } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePricesForSymbols } from '../store/priceStore';
import { usePollingInterval } from './usePollingInterval';
export const useBackendFuturesTrading = (walletId: string, symbol?: string) => {
  const utils = trpc.useUtils();
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

      utils.futuresTrading.getPositions.invalidate();
    },
  });

  const setMarginTypeMutation = trpc.futuresTrading.setMarginType.useMutation({
    onSuccess: () => {

      utils.futuresTrading.getPositions.invalidate();
    },
  });

  const createOrderMutation = trpc.futuresTrading.createOrder.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.futuresTrading.getOpenDbOrderIds.invalidate();
      utils.futuresTrading.getPositions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const cancelOrderMutation = trpc.futuresTrading.cancelOrder.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.futuresTrading.getOpenDbOrderIds.invalidate();
      utils.trading.getOrders.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
    },
  });

  const createPositionMutation = trpc.futuresTrading.createPosition.useMutation({
    onSuccess: () => {
      utils.futuresTrading.getPositions.invalidate();
      utils.trading.getTradeExecutions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const closePositionMutation = trpc.futuresTrading.closePosition.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getPositions.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.analytics.getDailyPerformance.invalidate();
      utils.wallet.list.invalidate();
    },
  });

  const reversePositionMutation = trpc.futuresTrading.reversePosition.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getPositions.invalidate();
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.wallet.list.invalidate();
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
      type: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_MARKET' | 'TAKE_PROFIT' | 'TAKE_PROFIT_MARKET';
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
      side: 'LONG' | 'SHORT';
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
    onSuccess: () => {
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.trading.getOrders.invalidate();
    },
  });

  const closePositionAndCancelOrdersMutation = trpc.futuresTrading.closePositionAndCancelOrders.useMutation({
    onSuccess: (data) => {
      if (data.openExecutions) {
        const wId = data.walletId ?? data.openExecutions[0]?.walletId ?? '';
        utils.trading.getTradeExecutions.setData(
          { walletId: wId, status: 'open', limit: 500 },
          data.openExecutions,
        );
      } else {
        utils.trading.getTradeExecutions.invalidate();
      }
      utils.futuresTrading.getPositions.invalidate();
      utils.futuresTrading.getOpenOrders.invalidate();
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.analytics.getPerformance.invalidate();
      utils.analytics.getDailyPerformance.invalidate();
      utils.wallet.list.invalidate();
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
