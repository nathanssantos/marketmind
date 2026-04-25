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

  const positions: PortfolioPosition[] = useMemo(() => {
    const openExecutions = tradeExecutions.filter((e) => e.status === 'open');
    const groups = new Map<string, typeof openExecutions>();

    for (const e of openExecutions) {
      const key = `${e.symbol}-${e.side}`;
      const group = groups.get(key) ?? [];
      group.push(e);
      groups.set(key, group);
    }

    return Array.from(groups.values()).flatMap((group) => {
      const primary = group[0];
      if (!primary) return [];
      const totalQty = group.reduce((sum, e) => sum + parseFloat(e.quantity || '0'), 0);
      const avgPrice = group.reduce((sum, e) => sum + parseFloat(e.entryPrice || '0') * parseFloat(e.quantity || '0'), 0) / (totalQty || 1);

      const centralPrice = centralizedPrices[primary.symbol];
      const tickerPrice = tickerPrices[primary.symbol];
      const currentPrice = centralPrice ?? (tickerPrice ? parseFloat(String(tickerPrice)) : avgPrice);

      const pnl = primary.side === 'LONG'
        ? (currentPrice - avgPrice) * totalQty
        : (avgPrice - currentPrice) * totalQty;
      const pnlPercent = avgPrice > 0 ? ((currentPrice - avgPrice) / avgPrice) * 100 * (primary.leverage ?? 1) : 0;
      const adjustedPnlPercent = primary.side === 'LONG' ? pnlPercent : -pnlPercent;

      return {
        id: primary.id,
        symbol: primary.symbol,
        side: primary.side,
        quantity: totalQty,
        avgPrice,
        currentPrice,
        pnl,
        pnlPercent: adjustedPnlPercent,
        stopLoss: primary.stopLoss ? parseFloat(primary.stopLoss) : undefined,
        takeProfit: primary.takeProfit ? parseFloat(primary.takeProfit) : undefined,
        setupType: primary.setupType ?? undefined,
        openedAt: new Date(primary.openedAt),
        status: 'open' as const,
        marketType: primary.marketType ?? 'FUTURES',
        isAutoTrade: !!primary.setupType,
        count: group.length,
        leverage: primary.leverage ?? 1,
      };
    });
  }, [tradeExecutions, tickerPrices, centralizedPrices]);

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

  const effectiveCapital = activeWallet
    ? activeWallet.initialBalance + activeWallet.totalDeposits - activeWallet.totalWithdrawals
    : 0;

  const stopProtectedPnl = useMemo(() => {
    let total = 0;
    let positionsWithStops = 0;
    for (const pos of positions) {
      if (!pos.stopLoss) continue;
      positionsWithStops++;
      if (pos.side === 'LONG') total += (pos.stopLoss - pos.avgPrice) * pos.quantity;
      else total += (pos.avgPrice - pos.stopLoss) * pos.quantity;
    }
    return { total, positionsWithStops };
  }, [positions]);

  const tpProjectedProfit = useMemo(() => {
    let total = 0;
    let positionsWithTp = 0;
    for (const pos of positions) {
      if (!pos.takeProfit) continue;
      positionsWithTp++;
      if (pos.side === 'LONG') total += (pos.takeProfit - pos.avgPrice) * pos.quantity;
      else total += (pos.avgPrice - pos.takeProfit) * pos.quantity;
    }
    return { total, positionsWithTp };
  }, [positions]);

  const totalExposure = useMemo(
    () => positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity), 0),
    [positions]
  );

  const totalMargin = useMemo(
    () => positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity) / (pos.leverage || 1), 0),
    [positions]
  );

  const hasLeverage = useMemo(
    () => positions.some((pos) => pos.leverage > 1),
    [positions]
  );

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
