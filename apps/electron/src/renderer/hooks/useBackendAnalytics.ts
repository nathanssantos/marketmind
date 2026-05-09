import { QUERY_CONFIG } from '@shared/constants';
import { trpc } from '../utils/trpc';
import { usePollingInterval } from './usePollingInterval';

export type AnalyticsPeriod = 'day' | 'week' | 'month' | 'all';

// Binance Futures uses UTC (00:00 UTC) for all daily PnL bucketing —
// Today's Realized PnL, daily settlements, funding intervals. Anchoring
// our analytics to UTC too keeps numbers aligned across:
//   - Sidebar "Today's P&L" widget
//   - Analytics modal performance period (day/week/month)
//   - Performance calendar buckets
//   - Equity curve daily points
// Previously this used `Intl.DateTimeFormat().resolvedOptions().timeZone`
// (browser local TZ), which made non-UTC users (e.g. BRT) see different
// "today" boundaries from the Binance app and from the sidebar widget.
const BINANCE_TZ = 'UTC';

export const useBackendAnalytics = (walletId: string, period: AnalyticsPeriod = 'all') => {
  // WS-backed: position:closed + wallet:update fan out to the cold-tier
  // invalidation in RealtimeTradingSyncContext, which already invalidates
  // analytics queries (getPerformance, getSetupStats, getEquityCurve)
  // within 2s of the event. Polling here only fires when WS is dropped.
  const performancePolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.SLOW, { wsBacked: true });
  const statsPolling = usePollingInterval(QUERY_CONFIG.REFETCH_INTERVAL.NORMAL, { wsBacked: true });

  const { data: performance, isLoading: isLoadingPerformance } =
    trpc.analytics.getPerformance.useQuery(
      { walletId, period, tz: BINANCE_TZ },
      { enabled: !!walletId, refetchInterval: performancePolling, staleTime: QUERY_CONFIG.STALE_TIME.MEDIUM, refetchOnMount: true }
    );

  const { data: setupStats, isLoading: isLoadingSetupStats } =
    trpc.analytics.getSetupStats.useQuery(
      { walletId, period, tz: BINANCE_TZ },
      { enabled: !!walletId, refetchInterval: statsPolling }
    );

  const { data: equityCurve, isLoading: isLoadingEquityCurve } =
    trpc.analytics.getEquityCurve.useQuery(
      { walletId, interval: '1d', tz: BINANCE_TZ },
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
