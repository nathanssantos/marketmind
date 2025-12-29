import { trpc } from '../utils/trpc';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';

export const useBackendAnalytics = (walletId: string, period: AnalyticsPeriod = 'all') => {
  const { data: performance, isLoading: isLoadingPerformance } =
    trpc.analytics.getPerformance.useQuery(
      { walletId, period },
      { enabled: !!walletId, refetchInterval: 5000, staleTime: 0, refetchOnMount: true }
    );

  const { data: setupStats, isLoading: isLoadingSetupStats } =
    trpc.analytics.getSetupStats.useQuery(
      { walletId, period },
      { enabled: !!walletId, refetchInterval: 30000 }
    );

  const { data: equityCurve, isLoading: isLoadingEquityCurve } =
    trpc.analytics.getEquityCurve.useQuery(
      { walletId, interval: '1d' },
      { enabled: !!walletId, refetchInterval: 60000 }
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
