import { useCallback } from 'react';
import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';

export const useBackendAutoTrading = (walletId: string) => {
  const utils = trpc.useUtils();

  const { data: config, isLoading: isLoadingConfig } = trpc.autoTrading.getConfig.useQuery(
    { walletId },
    { enabled: !!walletId }
  );

  const { data: activeExecutions, isLoading: isLoadingActiveExecutions } =
    trpc.autoTrading.getActiveExecutions.useQuery(
      { walletId, limit: 50 },
      { enabled: !!walletId }
    );

  const { data: executionHistory, isLoading: isLoadingHistory } =
    trpc.autoTrading.getExecutionHistory.useQuery(
      { walletId, limit: 50 },
      { enabled: !!walletId }
    );

  const updateConfigMutation = trpc.autoTrading.updateConfig.useMutation({
    onSuccess: () => {
      utils.autoTrading.getConfig.invalidate();
    },
  });

  const executeSetupMutation = trpc.autoTrading.executeSetup.useMutation({
    onSuccess: () => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const cancelExecutionMutation = trpc.autoTrading.cancelExecution.useMutation({
    onSuccess: () => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const closeExecutionMutation = trpc.autoTrading.closeExecution.useMutation({
    onSuccess: () => {
      utils.autoTrading.getActiveExecutions.invalidate();
      utils.autoTrading.getExecutionHistory.invalidate();
    },
  });

  const startWatcherMutation = trpc.autoTrading.startWatcher.useMutation({
    onSuccess: () => {
      utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const stopWatcherMutation = trpc.autoTrading.stopWatcher.useMutation({
    onSuccess: () => {
      utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const stopAllWatchersMutation = trpc.autoTrading.stopAllWatchers.useMutation({
    onSuccess: () => {
      utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const startWatchersBulkMutation = trpc.autoTrading.startWatchersBulk.useMutation({
    onSuccess: () => {
      utils.autoTrading.getWatcherStatus.invalidate();
    },
  });

  const { data: watcherStatus, isLoading: isLoadingWatcherStatus } =
    trpc.autoTrading.getWatcherStatus.useQuery(
      { walletId },
      { enabled: !!walletId, refetchInterval: QUERY_CONFIG.REFETCH_INTERVAL.REALTIME }
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
    async (executionId: string, exitPrice: string, exitOrderId?: number) => {
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
    async (symbol: string, interval: string, profileId?: string, marketType?: 'SPOT' | 'FUTURES') => {
      return startWatcherMutation.mutateAsync({ walletId, symbol, interval, profileId, marketType });
    },
    [walletId, startWatcherMutation]
  );

  const stopWatcher = useCallback(
    async (symbol: string, interval: string, marketType?: 'SPOT' | 'FUTURES') => {
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
    async (symbols: string[], interval: string, profileId?: string, marketType?: 'SPOT' | 'FUTURES') => {
      return startWatchersBulkMutation.mutateAsync({ walletId, symbols, interval, profileId, marketType });
    },
    [walletId, startWatchersBulkMutation]
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
  };
};

export const useTopSymbols = (marketType: 'SPOT' | 'FUTURES' = 'SPOT', limit: number = 12) => {
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

export const useDynamicSymbolScores = (marketType: 'SPOT' | 'FUTURES' = 'FUTURES', limit: number = 50) => {
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

export const useTopCoinsByMarketCap = (marketType: 'SPOT' | 'FUTURES' = 'FUTURES', limit: number = 100) => {
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
  const { data, isLoading, error, refetch } = trpc.autoTrading.getRotationStatus.useQuery(
    { walletId },
    { enabled: !!walletId, refetchInterval: QUERY_CONFIG.REFETCH_INTERVAL.REALTIME }
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
      utils.autoTrading.getWatcherStatus.invalidate();
      utils.autoTrading.getRotationStatus.invalidate();
      utils.autoTrading.getRotationHistory.invalidate();
    },
  });

  return {
    triggerRotation: () => mutation.mutateAsync({ walletId }),
    isTriggeringRotation: mutation.isPending,
    triggerRotationError: mutation.error,
  };
};
