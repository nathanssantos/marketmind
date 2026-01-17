import type {
    BacktestConfig,
    BacktestResult,
    BacktestSummary,
    MultiWatcherBacktestResult,
} from '@marketmind/types';
import { useCallback, useState } from 'react';
import { trpc } from '../utils/trpc';

interface MultiWatcherBacktestInput {
  watchers: Array<{
    symbol: string;
    interval: string;
    setupTypes?: string[];
    marketType?: 'SPOT' | 'FUTURES';
    profileId?: string;
  }>;
  startDate: string;
  endDate: string;
  initialCapital: number;
  exposureMultiplier?: number;
  useStochasticFilter?: boolean;
  useAdxFilter?: boolean;
  onlyWithTrend?: boolean;
  minRiskRewardRatio?: number;
  cooldownMinutes?: number;
  marketType?: 'SPOT' | 'FUTURES';
  leverage?: number;
  tpCalculationMode?: 'default' | 'fibonacci';
  fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.618' | '2' | '2.618';
  useMtfFilter?: boolean;
  useBtcCorrelationFilter?: boolean;
  useMarketRegimeFilter?: boolean;
  useVolumeFilter?: boolean;
  useFundingFilter?: boolean;
  useConfluenceScoring?: boolean;
  confluenceMinScore?: number;
  useMomentumTimingFilter?: boolean;
  useTrendFilter?: boolean;
  trendFilterPeriod?: number;
  useTrailingStop?: boolean;
}

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

  const runMultiWatcherBacktestMutation = trpc.backtest.multiWatcher.useMutation({
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
        return result as BacktestResult | null;
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

  const runMultiWatcherBacktest = useCallback(
    async (input: MultiWatcherBacktestInput): Promise<MultiWatcherBacktestResult | null> => {
      return runMultiWatcherBacktestMutation.mutateAsync(input) as Promise<MultiWatcherBacktestResult | null>;
    },
    [runMultiWatcherBacktestMutation]
  );

  const loadBacktestHistory = useCallback(() => {
    setShouldFetchBacktests(true);
  }, []);

  return {
    backtests: (backtests ?? []) as BacktestSummary[],

    isLoadingBacktests,
    isRunningBacktest: runBacktestMutation.isPending || runMultiWatcherBacktestMutation.isPending,
    isDeletingBacktest: deleteBacktestMutation.isPending,

    runBacktest,
    runMultiWatcherBacktest,
    getBacktestResult,
    deleteBacktest,
    loadBacktestHistory,

    runBacktestError: runBacktestMutation.error ?? runMultiWatcherBacktestMutation.error,
    deleteBacktestError: deleteBacktestMutation.error,
  };
};
