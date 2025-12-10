import { useCallback } from 'react';
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
  };
};
