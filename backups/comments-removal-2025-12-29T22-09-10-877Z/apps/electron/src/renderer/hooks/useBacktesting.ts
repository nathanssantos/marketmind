import { useCallback, useState } from 'react';
import type {
  BacktestConfig,
  BacktestResult,
  BacktestSummary,
} from '@marketmind/types';
import { trpc } from '../utils/trpc';

export const useBacktesting = () => {
  const utils = trpc.useUtils();

  const [shouldFetchBacktests, setShouldFetchBacktests] = useState(false);

  const { data: backtests, isLoading: isLoadingBacktests } = trpc.backtest.list.useQuery(
    undefined,
    { enabled: shouldFetchBacktests }
  );

  const runBacktestMutation = trpc.backtest.run.useMutation({
    onSuccess: () => {
      utils.backtest.list.invalidate();
    },
  });

  const deleteBacktestMutation = trpc.backtest.delete.useMutation({
    onSuccess: () => {
      utils.backtest.list.invalidate();
    },
  });

  const runBacktest = useCallback(
    async (config: BacktestConfig) => {
      return runBacktestMutation.mutateAsync(config);
    },
    [runBacktestMutation]
  );

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

  const deleteBacktest = useCallback(
    async (id: string) => {
      return deleteBacktestMutation.mutateAsync({ id });
    },
    [deleteBacktestMutation]
  );

  const loadBacktestHistory = useCallback(() => {
    setShouldFetchBacktests(true);
  }, []);

  return {
    backtests: (backtests ?? []) as BacktestSummary[],

    isLoadingBacktests,
    isRunningBacktest: runBacktestMutation.isPending,
    isDeletingBacktest: deleteBacktestMutation.isPending,

    runBacktest,
    getBacktestResult,
    deleteBacktest,
    loadBacktestHistory,

    runBacktestError: runBacktestMutation.error,
    deleteBacktestError: deleteBacktestMutation.error,
  };
};
