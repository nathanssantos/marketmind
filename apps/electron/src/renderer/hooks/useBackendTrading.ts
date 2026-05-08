import type { PositionSide, MarketType } from '@marketmind/types';
import { useCallback, useMemo } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePricesForSymbols } from '../store/priceStore';
import { usePollingInterval } from './usePollingInterval';

const EMPTY_SYMBOLS: string[] = [];
export interface UseBackendTradingOptions {
  /**
   * Skip the live-price subscription. Set to `true` from components
   * that consume orders/executions/mutations but never read
   * `tickerPrices` — without this opt-out the hook re-runs on every
   * throttled price tick, which forces every consumer (OrdersList,
   * etc.) to re-render at the price-store cadence even though their
   * visible state didn't change. PR #506 found this dupe drove
   * Portfolio re-renders ~2x; same shape applies to OrdersList.
   *
   * When `skipPrices` is true, the returned `tickerPrices` is the
   * stable empty object (same identity every render).
   */
  skipPrices?: boolean;
}

const EMPTY_TICKER_PRICES: Record<string, number> = Object.freeze({});

export const useBackendTrading = (
  walletId: string,
  symbol?: string,
  _marketType: MarketType = 'FUTURES',
  options: UseBackendTradingOptions = {},
) => {
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

  // Live prices for open positions come from the priceStore (fed by socket
  // price:update events via socketBus). The legacy ticker REST polling has been
  // removed — socket is canonical, REST snapshots are unnecessary churn.
  // Hook order is fixed: usePricesForSymbols ALWAYS runs to honor React's
  // rules-of-hooks. The skipPrices option swaps in an empty symbol list so
  // it never sets up subscriptions or fires setState.
  const subscribedSymbols = options.skipPrices ? EMPTY_SYMBOLS : openPositionSymbols;
  const livePrices = usePricesForSymbols(subscribedSymbols);
  const tickerPrices = options.skipPrices ? EMPTY_TICKER_PRICES : livePrices;
  const isLoadingPrices = false;

  const createOrderMutation = trpc.trading.createOrder.useMutation({
    onSuccess: () => {
      void utils.trading.getOrders.invalidate();
      void utils.trading.getPositions.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const cancelOrderMutation = trpc.trading.cancelOrder.useMutation({
    onSuccess: () => {
      void utils.trading.getOrders.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const syncOrdersMutation = trpc.trading.syncOrders.useMutation({
    onSuccess: () => {
      void utils.trading.getOrders.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const createPositionMutation = trpc.trading.createPosition.useMutation({
    onSuccess: () => {
      void utils.trading.getPositions.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const closePositionMutation = trpc.trading.closePosition.useMutation({
    onSuccess: () => {
      void utils.trading.getPositions.invalidate();
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const closeExecutionMutation = trpc.trading.closeTradeExecution.useMutation({
    onSuccess: () => {
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.analytics.getDailyPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.trading.cancelTradeExecution.useMutation({
    onSuccess: () => {
      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.analytics.getPerformance.invalidate();
      void utils.wallet.list.invalidate();
    },
  });

  const updateExecutionSLTPMutation = trpc.trading.updateTradeExecutionSLTP.useMutation({
    onSuccess: () => {

      void utils.trading.getTradeExecutions.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
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
    async (data: { walletId: string; symbol: string; orderId: string }) => {
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
      side: PositionSide;
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
    tickerPrices,
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
