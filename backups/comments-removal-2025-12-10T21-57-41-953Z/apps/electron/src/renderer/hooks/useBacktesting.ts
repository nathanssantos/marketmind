import { useCallback, useState } from 'react';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestSummary,
} from '@marketmind/types';
import { trpc } from '../utils/trpc';

export const useBacktesting = () => {
  const utils = trpc.useUtils();

  // Track if we should fetch backtests (lazy loading)
  const [shouldFetchBacktests, setShouldFetchBacktests] = useState(false);

  // Query: List all backtest results - only fetch when explicitly requested
  const { data: backtests, isLoading: isLoadingBacktests } = trpc.backtest.list.useQuery(
    undefined,
    { enabled: shouldFetchBacktests }
  );

  // Mutation: Run backtest
  const runBacktestMutation = trpc.backtest.run.useMutation({
    onSuccess: () => {
      utils.backtest.list.invalidate();
    },
  });

  // Mutation: Delete backtest
  const deleteBacktestMutation = trpc.backtest.delete.useMutation({
    onSuccess: () => {
      utils.backtest.list.invalidate();
    },
  });

  // Function: Run a new backtest
  const runBacktest = useCallback(
    async (config: BacktestConfig) => {
      return runBacktestMutation.mutateAsync(config);
    },
    [runBacktestMutation]
  );

  // Function: Get a specific backtest result
  const getBacktestResult = useCallback(
    async (id: string): Promise<BacktestResult | null> => {
      try {
        const result = await utils.client.backtest.getResult.query({ id });
        return result;
      } catch (error) {
        console.error('Error fetching backtest result:', error);
        return null;
      }
    },
    [utils]
  );

  // Function: Delete a backtest
  const deleteBacktest = useCallback(
    async (id: string) => {
      return deleteBacktestMutation.mutateAsync({ id });
    },
    [deleteBacktestMutation]
  );

  // Function: Load backtest history (lazy loading to avoid fetching on modal open)
  const loadBacktestHistory = useCallback(() => {
    setShouldFetchBacktests(true);
  }, []);

  return {
    // Data
    backtests: (backtests ?? []) as BacktestSummary[],

    // Loading states
    isLoadingBacktests,
    isRunningBacktest: runBacktestMutation.isPending,
    isDeletingBacktest: deleteBacktestMutation.isPending,

    // Functions
    runBacktest,
    getBacktestResult,
    deleteBacktest,
    loadBacktestHistory,

    // Errors
    runBacktestError: runBacktestMutation.error,
    deleteBacktestError: deleteBacktestMutation.error,
  };
};
