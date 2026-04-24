import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';

const getBrowserTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

export const useBackendAnalytics = (walletId: string, period: AnalyticsPeriod = 'all') => {
  const performancePolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.SLOW);
  const statsPolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.NORMAL);
  const tz = getBrowserTimezone();

  const { data: performance, isLoading: isLoadingPerformance } =
    trpc.analytics.getPerformance.useQuery(
      { walletId, period, tz },
      { enabled: !!walletId, refetchInterval: performancePolling, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM, refetchOnMount: true }
    );

  const { data: setupStats, isLoading: isLoadingSetupStats } =
    trpc.analytics.getSetupStats.useQuery(
      { walletId, period },
      { enabled: !!walletId, refetchInterval: statsPolling }
    );

  const { data: equityCurve, isLoading: isLoadingEquityCurve } =
    trpc.analytics.getEquityCurve.useQuery(
      { walletId, interval: '1d' },
      { enabled: !!walletId, refetchInterval: performancePolling }
    );

  const { data: tradeHistory, isLoading: isLoadingTradeHistory } =
    trpc.analytics.getTradeHistory.useQuery(
      { walletId, limit: 100 },
      { enabled: !!walletId }
    );

  return {
    performance,
    setupStats: setupStats ?? [],
    equityCurve: equityCurve ?? [],
    tradeHistory: tradeHistory?.trades ?? [],
    tradeHistoryTotal: tradeHistory?.total ?? 0,
    isLoadingPerformance,
    isLoadingSetupStats,
    isLoadingEquityCurve,
    isLoadingTradeHistory,
    isLoading:
      isLoadingPerformance ||
      isLoadingSetupStats ||
      isLoadingEquityCurve ||
      isLoadingTradeHistory,
  };
};
