import { useBackendTrading } from '@renderer/hooks/useBackendTrading';
import { useActiveWallet } from '@renderer/hooks/useActiveWallet';
import { usePortfolioFilters } from '@renderer/hooks/usePortfolioFilters';
import { usePricesForSymbols } from '@renderer/store/priceStore';
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
import {
  buildPortfolioPositions,
  computeEffectiveCapital,
  computeStopProtectedPnl,
  computeTotalExposure,
  computeTotalMargin,
  computeTpProjectedProfit,
  hasLeveragedPosition,
} from './portfolioPositionMath';

export const usePortfolioData = () => {
  const [summaryExpanded, setSummaryExpanded] = useUIPref('portfolioSummaryExpanded', true);
  const toggleSummary = useCallback(() => setSummaryExpanded(!summaryExpanded), [summaryExpanded, setSummaryExpanded]);

  const { activeWallet: rawActiveWallet, isIB, wallets: backendWallets } = useActiveWallet();
  const activeWalletId = rawActiveWallet?.id;
  const pollingInterval = usePollingInterval(QUERY_CONFIG.BACKUP_POLLING_INTERVAL);
  const { tickerPrices } = useBackendTrading(activeWalletId ?? '', undefined);
  const { data: openTradeExecutions } = trpc.trading.getTradeExecutions.useQuery(
    { walletId: activeWalletId ?? '', status: 'open', limit: 500 },
    { enabled: !!activeWalletId, refetchInterval: pollingInterval, staleTime: QUERY_CONFIG.STALE_TIME.FAST }
  );
  const tradeExecutions = openTradeExecutions ?? [];

  const { cancelOrder: cancelFuturesOrder } = useBackendFuturesTrading(activeWalletId ?? '');
  const { orphanOrders } = useOrphanOrders(activeWalletId ?? '', tradeExecutions);
  const { success: toastSuccess, error: toastError } = useToast();

  const now = new Date();
  const { data: dailyPerformance } = trpc.analytics.getDailyPerformance.useQuery(
    { walletId: activeWalletId ?? '', year: now.getFullYear(), month: now.getMonth() + 1 },
    { enabled: !!activeWalletId, staleTime: QUERY_CONFIG.STALE_TIME.FAST, refetchInterval: pollingInterval }
  );
  const todayKey = now.toISOString().slice(0, 10);
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

  const openExecutionSymbols = useMemo(
    () => [...new Set(tradeExecutions.filter((e) => e.status === 'open').map((e) => e.symbol))],
    [tradeExecutions]
  );
  const centralizedPrices = usePricesForSymbols(openExecutionSymbols);

  const positions: PortfolioPosition[] = useMemo(
    () => buildPortfolioPositions(tradeExecutions, centralizedPrices, tickerPrices),
    [tradeExecutions, tickerPrices, centralizedPrices],
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
    hasLeverage,
    orphanOrders,
    cancelFuturesOrder,
    toastSuccess,
    toastError,
  };
};
