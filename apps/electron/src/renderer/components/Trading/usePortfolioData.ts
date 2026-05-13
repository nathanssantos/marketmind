import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { usePortfolioFilters } from '@renderer/hooks/usePortfolioFilters';
import { trpc } from '@renderer/utils/trpc';
import { QUERY_CONFIG } from '@shared/constants';
import { usePollingInterval } from '@renderer/hooks/usePollingInterval';
import { useUIPref } from '@renderer/store/preferencesStore';
import { useUIStore } from '@renderer/store/uiStore';
import { useCallback, useMemo } from 'react';
import { useOrphanOrders } from '@renderer/hooks/useOrphanOrders';
import { useBackendFuturesTrading } from '@renderer/hooks/useBackendFuturesTrading';
import { useToast } from '@renderer/hooks/useToast';
import { useShallow } from 'zustand/react/shallow';
import type { PortfolioPosition } from './portfolioTypes';
import { getFeeRateForVipLevel } from '@marketmind/types';
import {
  buildPortfolioPositions,
  computeEffectiveCapital,
  computeStopProtectedPnl,
  computeTotalExposure,
  computeTotalFees,
  computeTotalMargin,
  computeTpProjectedProfit,
  hasLeveragedPosition,
} from './portfolioPositionMath';

const DEFAULT_TAKER_RATE = getFeeRateForVipLevel('FUTURES', 0, 'TAKER');

export const usePortfolioData = () => {
  const [summaryExpanded, setSummaryExpanded] = useUIPref('portfolioSummaryExpanded', true);
  const toggleSummary = useCallback(() => setSummaryExpanded(!summaryExpanded), [summaryExpanded, setSummaryExpanded]);

  const { activeWallet: rawActiveWallet, isIB, wallets: backendWallets } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;
  // Open executions are patched in real time via position:update /
  // position:closed events from RealtimeTradingSyncContext. Polling
  // only fires when WS is dropped — eliminating per-5s React-tree
  // refreshes that were stuttering the chart pan via shared parents.
  const pollingInterval = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL, { wsBacked: true });
  // Daily performance: the analytics aggregate is invalidated on
  // wallet:update / position:closed via the same context. Polling
  // here previously fired every 5s in addition to the invalidation.
  const dailyPerformancePolling = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL, { wsBacked: true });
  const { tickerPrices } = useBackendTrading(activeWalletId ?? '', undefined);
  const { data: openTradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: activeWalletId ?? '', status: 'open', limit: 500 },
    { enabled: !!activeWalletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );
  const tradeExecutions = openTradeExecutions ?? [];

  const { cancelOrder: cancelFuturesOrder } = useBackendFuturesTrading(activeWalletId ?? '');
  const { orphanOrders } = useOrphanOrders(activeWalletId ?? '', tradeExecutions);
  const { success: toastSuccess, error: toastError } = useToast();

  // Binance Futures uses UTC for its "Today's Realized PnL" daily
  // bucket reset (00:00 UTC), so we anchor to UTC here too. Using
  // `now.getFullYear()` / `getMonth()` would resolve in local time and
  // drift across the day boundary for non-UTC users (e.g. a BRT user
  // at 22:00 BRT = 01:00 UTC next day would query the previous month
  // for a few hours every month-end). Building year/month from the UTC
  // ISO string keeps the request aligned with the backend's UTC
  // bucketing and with what Binance shows.
  const now = new Date();
  const utcIso = now.toISOString();
  const utcYear = parseInt(utcIso.slice(0, 4), 10);
  const utcMonth = parseInt(utcIso.slice(5, 7), 10);
  const todayKey = utcIso.slice(0, 10);
  const { data: dailyPerformance } = trpc.analytics.getDailyPerformance.useQuery(
    { walletId: activeWalletId ?? '', year: utcYear, month: utcMonth, tz: 'UTC' },
    { enabled: !!activeWalletId, staleTime: QUERY_CONFIG.STALE_TIME.FAST, refetchInterval: dailyPerformancePolling }
  );
  const todayPnl = dailyPerformance?.find((d) => d.date === todayKey);

  const {
    filterOption,
    setFilterOption,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
  } = useUIStore(useShallow((s) => ({
    filterOption: s.portfolioFilterOption,
    setFilterOption: s.setPortfolioFilterOption,
    sortBy: s.portfolioSortBy,
    setSortBy: s.setPortfolioSortBy,
    viewMode: s.portfolioViewMode,
    setViewMode: s.setPortfolioViewMode,
  })));

  // Single price source: useBackendTrading already calls
  // usePricesForSymbols on the same set of open-execution symbols.
  // Subscribing a second time here doubled the throttled re-render
  // rate during pan + tick storm (each subscription has its own
  // throttle timer, both can fire within the same window). Deduped
  // to one subscription via tickerPrices.
  const positions: PortfolioPosition[] = useMemo(
    () => buildPortfolioPositions(tradeExecutions, tickerPrices, tickerPrices),
    [tradeExecutions, tickerPrices],
  );

  const wallets = backendWallets.map((w) => ({
    id: w.id,
    name: w.name,
    balance: parseFloat(w.currentBalance ?? '0'),
    walletBalance: parseFloat(w.totalWalletBalance ?? w.currentBalance ?? '0'),
    initialBalance: parseFloat(w.initialBalance ?? '0'),
    totalDeposits: parseFloat(w.totalDeposits ?? '0'),
    totalWithdrawals: parseFloat(w.totalWithdrawals ?? '0'),
    currency: (w.currency ?? 'USDT'),
    createdAt: new Date(w.createdAt),
  }));

  const activeWallet = wallets.find((w) => w.id === activeWalletId);

  const { positions: filteredPositions, stats } = usePortfolioFilters(positions, filterOption, sortBy);

  const effectiveCapital = computeEffectiveCapital(activeWallet);
  const stopProtectedPnl = useMemo(() => computeStopProtectedPnl(positions), [positions]);
  const tpProjectedProfit = useMemo(() => computeTpProjectedProfit(positions), [positions]);
  const totalExposure = useMemo(() => computeTotalExposure(positions), [positions]);
  const totalMargin = useMemo(() => computeTotalMargin(positions), [positions]);
  const totalFees = useMemo(() => computeTotalFees(positions, DEFAULT_TAKER_RATE), [positions]);
  const hasLeverage = useMemo(() => hasLeveragedPosition(positions), [positions]);

  return {
    isIB,
    activeWallet,
    activeWalletId,
    positions,
    filteredPositions,
    stats,
    todayPnl,
    summaryExpanded,
    toggleSummary,
    filterOption,
    setFilterOption,
    sortBy,
    setSortBy,
    viewMode,
    setViewMode,
    effectiveCapital,
    stopProtectedPnl,
    tpProjectedProfit,
    totalExposure,
    totalMargin,
    totalFees,
    hasLeverage,
    orphanOrders,
    cancelFuturesOrder,
    toastSuccess,
    toastError,
  };
};
