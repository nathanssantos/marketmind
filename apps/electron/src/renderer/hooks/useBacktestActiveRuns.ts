import { trpc } from '../utils/trpc';

const ACTIVE_RUNS_POLL_MS = 5_000;

/**
 * Polls `backtest.getActiveRuns` so the UI can show an in-flight
 * indicator on the toolbar even after a page reload (state in
 * `useBacktestRun` is in-memory only). 5s cadence is a balance between
 * a snappy "I just clicked Run" sensation and not hammering the server
 * for what's normally an empty list.
 */
export const useBacktestActiveRuns = () => {
  const query = trpc.backtest.getActiveRuns.useQuery(undefined, {
    refetchInterval: ACTIVE_RUNS_POLL_MS,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  return {
    activeRuns: query.data ?? [],
    hasActiveRuns: (query.data?.length ?? 0) > 0,
    isLoading: query.isLoading,
  };
};
