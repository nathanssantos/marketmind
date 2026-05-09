import type { MarketType } from '@marketmind/types';
import { AUTO_TRADING_CONFIG } from '@marketmind/types';
import { QUERY_CONFIG } from '@shared/constants';
import { keepPreviousData } from '@tanstack/react-query';
import { useCallback } from 'react';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';

export const useBackendAutoTrading = (walletId: string) => {
  const utils = trpc.useUtils();
  // WS-backed: watcher start/stop are user-driven mutations that
  // invalidate via onSuccess. Polling only fires while WS is dropped.
  const realtimePolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.REALTIME, { wsBacked: true });

  const { data: config, isLoading: isLoadingConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId }
  );

  const { data: activeExecutions, isLoading: isLoadingActiveExecutions } =
    trpc.autoTrading.getActiveExecutions.useQuery(
      { walletId },
      { enabled: !!walletId }
    );

  const { data: executionHistory, isLoading: isLoadingHistory } =
    trpc.autoTrading.getExecutionHistory.useQuery(
      { walletId, limit: 50 },
      { enabled: !!walletId }
    );

  const updateConfigMutation = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getConfig.invalidate();
    },
  });

  const executeSetupMutation = trpc.autoTrading.executeSetup.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.autoTrading.cancelExecution.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const closeExecutionMutation = trpc.autoTrading.closeExecution.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const startWatcherMutation = trpc.autoTrading.startWatcher.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const stopWatcherMutation = trpc.autoTrading.stopWatcher.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const stopAllWatchersMutation = trpc.autoTrading.stopAllWatchers.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const startWatchersBulkMutation = trpc.autoTrading.startWatchersBulk.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const emergencyStopMutation = trpc.autoTrading.emergencyStop.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
      void utils.autoTrading.getActiveExecutions.invalidate();
      void utils.autoTrading.getConfig.invalidate();
    },
  });

  const { data: watcherStatus, isLoading: isLoadingWatcherStatus } =
    trpc.autoTrading.getWatcherStatus.useQuery(
      { walletId },
      { enabled: !!walletId, refetchInterval: realtimePolling }
    );

  const updateConfig = useCallback(
    async (data: {
      walletId: string;
      isEnabled?: boolean;
      maxConcurrentPositions?: number;
      maxPositionSize?: string;
      dailyLossLimit?: string;
      enabledSetupTypes?: string[];
      positionSizing?: 'fixed' | 'percentage' | 'kelly';
      directionMode?: 'auto' | 'long_only' | 'short_only';
    }) => {
      return updateConfigMutation.mutateAsync(data);
    },
    [updateConfigMutation]
  );

  const executeSetup = useCallback(
    async (setupId: string, walletId: string) => {
      return executeSetupMutation.mutateAsync({ setupId, walletId });
    },
    [executeSetupMutation]
  );

  const cancelExecution = useCallback(
    async (executionId: string) => {
      return cancelExecutionMutation.mutateAsync({ executionId });
    },
    [cancelExecutionMutation]
  );

  const closeExecution = useCallback(
    async (executionId: string, exitPrice: string, exitOrderId?: string) => {
      return closeExecutionMutation.mutateAsync({
        executionId,
        exitPrice,
        exitOrderId,
      });
    },
    [closeExecutionMutation]
  );

  const toggleAutoTrading = useCallback(
    async (isEnabled: boolean) => {
      return updateConfigMutation.mutateAsync({ walletId, isEnabled });
    },
    [walletId, updateConfigMutation]
  );

  const startWatcher = useCallback(
    async (symbol: string, interval: string, profileId?: string, marketType?: MarketType) => {
      return startWatcherMutation.mutateAsync({ walletId, symbol, interval, profileId, marketType });
    },
    [walletId, startWatcherMutation]
  );

  const stopWatcher = useCallback(
    async (symbol: string, interval: string, marketType?: MarketType) => {
      return stopWatcherMutation.mutateAsync({ walletId, symbol, interval, marketType });
    },
    [walletId, stopWatcherMutation]
  );

  const stopAllWatchers = useCallback(
    async () => {
      return stopAllWatchersMutation.mutateAsync({ walletId });
    },
    [walletId, stopAllWatchersMutation]
  );

  const startWatchersBulk = useCallback(
    async (symbols: string[], interval: string, profileId?: string, marketType?: MarketType, targetCount?: number) => {
      return startWatchersBulkMutation.mutateAsync({ walletId, symbols, interval, profileId, marketType, targetCount });
    },
    [walletId, startWatchersBulkMutation]
  );

  const emergencyStop = useCallback(
    async () => {
      return emergencyStopMutation.mutateAsync({ walletId });
    },
    [walletId, emergencyStopMutation]
  );

  return {
    config,
    activeExecutions: activeExecutions ?? [],
    executionHistory: executionHistory ?? [],
    isLoadingConfig,
    isLoadingActiveExecutions,
    isLoadingHistory,
    updateConfig,
    executeSetup,
    cancelExecution,
    closeExecution,
    toggleAutoTrading,
    isUpdatingConfig: updateConfigMutation.isPending,
    isExecutingSetup: executeSetupMutation.isPending,
    isCancelingExecution: cancelExecutionMutation.isPending,
    isClosingExecution: closeExecutionMutation.isPending,
    updateConfigError: updateConfigMutation.error,
    executeSetupError: executeSetupMutation.error,
    cancelExecutionError: cancelExecutionMutation.error,
    closeExecutionError: closeExecutionMutation.error,
    startWatcher,
    stopWatcher,
    stopAllWatchers,
    startWatchersBulk,
    watcherStatus,
    isLoadingWatcherStatus,
    isStartingWatcher: startWatcherMutation.isPending,
    isStoppingWatcher: stopWatcherMutation.isPending,
    isStoppingAllWatchers: stopAllWatchersMutation.isPending,
    isStartingWatchersBulk: startWatchersBulkMutation.isPending,
    startWatcherError: startWatcherMutation.error,
    stopWatcherError: stopWatcherMutation.error,
    stopAllWatchersError: stopAllWatchersMutation.error,
    startWatchersBulkError: startWatchersBulkMutation.error,
    emergencyStop,
    isEmergencyStopping: emergencyStopMutation.isPending,
    emergencyStopError: emergencyStopMutation.error,
  };
};

export const useTopSymbols = (marketType: MarketType = 'FUTURES', limit: number = 12) => {
  const { data: topSymbols, isLoading: isLoadingTopSymbols, error: topSymbolsError } =
    trpc.autoTrading.getTopSymbols.useQuery(
      { marketType, limit },
      { staleTime: 5 * 60 * 1000 }
    );

  return {
    topSymbols: topSymbols ?? [],
    isLoadingTopSymbols,
    topSymbolsError,
  };
};

export const useDynamicSymbolScores = (marketType: MarketType = 'FUTURES', limit: number = 50) => {
  const { data, isLoading, error, refetch } = trpc.autoTrading.getDynamicSymbolScores.useQuery(
    { marketType, limit },
    { staleTime: 5 * 60 * 1000 }
  );

  return {
    symbolScores: data ?? [],
    isLoadingScores: isLoading,
    scoresError: error,
    refetchScores: refetch,
  };
};

export const useFilteredSymbolsForQuickStart = (
  walletId: string,
  marketType: MarketType,
  interval: string,
  limit: number,
  useBtcCorrelationFilter: boolean = true
) => {
  const { data, isLoading, error, refetch } = trpc.autoTrading.getFilteredSymbolsForQuickStart.useQuery(
    { walletId, marketType, interval, limit: Math.max(1, limit), useBtcCorrelationFilter },
    { enabled: !!walletId && limit >= 1, staleTime: 30 * 1000, placeholderData: keepPreviousData }
  );

  return {
    filteredSymbols: data?.symbols ?? [],
    skippedInsufficientCapital: data?.skippedInsufficientCapital ?? [],
    skippedInsufficientKlines: data?.skippedInsufficientKlines ?? [],
    skippedTrend: data?.skippedTrend ?? [],
    capitalPerWatcher: data?.capitalPerWatcher ?? 0,
    maxAffordableWatchers: data?.maxAffordableWatchers,
    btcTrend: data?.btcTrend ?? null,
    isLoadingFiltered: isLoading,
    filteredError: error,
    refetchFiltered: refetch,
  };
};

export const useTopCoinsByMarketCap = (marketType: MarketType = 'FUTURES', limit: number = AUTO_TRADING_CONFIG.TARGET_COUNT.MAX) => {
  const { data, isLoading, error, refetch } = trpc.autoTrading.getTopCoinsByMarketCap.useQuery(
    { marketType, limit },
    { staleTime: 5 * 60 * 1000 }
  );

  return {
    topCoins: data ?? [],
    isLoadingTopCoins: isLoading,
    topCoinsError: error,
    refetchTopCoins: refetch,
  };
};

export const useRotationStatus = (walletId: string) => {
  const rotationPolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.REALTIME);
  const { data, isLoading, error, refetch } = trpc.autoTrading.getRotationStatus.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: rotationPolling }
  );

  return {
    rotationStatus: data,
    isLoadingRotationStatus: isLoading,
    rotationStatusError: error,
    refetchRotationStatus: refetch,
  };
};

export const useRotationHistory = (walletId: string, limit: number = 10) => {
  const { data, isLoading, error } = trpc.autoTrading.getRotationHistory.useQuery(
    { walletId, limit },
    { enabled: !!walletId }
  );

  return {
    rotationHistory: data?.history ?? [],
    isLoadingRotationHistory: isLoading,
    rotationHistoryError: error,
  };
};

export const useTriggerRotation = (walletId: string) => {
  const utils = trpc.useUtils();

  const mutation = trpc.autoTrading.triggerSymbolRotation.useMutation({
    onSuccess: () => {
      void utils.autoTrading.getWatcherStatus.invalidate();
      void utils.autoTrading.getRotationStatus.invalidate();
      void utils.autoTrading.getRotationHistory.invalidate();
    },
  });

  return {
    triggerRotation: () => mutation.mutateAsync({ walletId }),
    isTriggeringRotation: mutation.isPending,
    triggerRotationError: mutation.error,
  };
};

export interface CapitalLimits {
  walletBalance: number;
  leverage: number;
  positionSizePercent: number;
  availableCapital: number;
  maxAffordableWatchers: number;
  capitalPerWatcher: number;
  maxCapitalPerPosition: number;
}

export const useCapitalLimits = (
  walletId: string,
  marketType: MarketType
) => {
  const { data, isLoading, error, refetch } = trpc.autoTrading.getCapitalLimits.useQuery(
    { walletId, marketType },
    { enabled: !!walletId, staleTime: 5000 }
  );

  const capitalLimits: CapitalLimits | null = data ? {
    walletBalance: data.walletBalance,
    leverage: data.leverage,
    positionSizePercent: data.positionSizePercent,
    availableCapital: data.availableCapital,
    maxAffordableWatchers: data.maxAffordableWatchers,
    capitalPerWatcher: data.capitalPerWatcher,
    maxCapitalPerPosition: data.maxCapitalPerPosition,
  } : null;

  const formatCapitalTooltip = (): string => {
    if (!capitalLimits) return '';
    const { walletBalance, leverage, positionSizePercent, maxCapitalPerPosition } = capitalLimits;
    return `$${walletBalance.toFixed(2)} × ${leverage}x × ${positionSizePercent}% | Per position: $${maxCapitalPerPosition.toFixed(2)}`;
  };

  return {
    capitalLimits,
    isLoadingCapitalLimits: isLoading,
    capitalLimitsError: error,
    refetchCapitalLimits: refetch,
    formatCapitalTooltip,
  };
};
