import { type PortfolioFilterOption, type PortfolioSortOption } from '@renderer/store/uiStore';
import { useMemo } from 'react';

interface PortfolioPosition {
  symbol: string;
  side: 'LONG' | 'SHORT';
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercent: number;
  stopLoss?: number;
  takeProfit?: number;
  setupType?: string;
  openedAt: Date;
  id: string;
}

export const filterPositions = (
  positions: PortfolioPosition[],
  filterOption: PortfolioFilterOption
): PortfolioPosition[] => {
  return positions.filter((position) => {
    if (filterOption === 'all') return true;
    if (filterOption === 'long') return position.side === 'LONG';
    if (filterOption === 'short') return position.side === 'SHORT';
    if (filterOption === 'profitable') return position.pnl > 0;
    if (filterOption === 'losing') return position.pnl < 0;
    return true;
  });
};

export const sortPositions = (
  positions: PortfolioPosition[],
  sortBy: PortfolioSortOption
): PortfolioPosition[] => {
  return [...positions].sort((a, b) => {
    switch (sortBy) {
      case 'newest':
        return b.openedAt.getTime() - a.openedAt.getTime();
      case 'oldest':
        return a.openedAt.getTime() - b.openedAt.getTime();
      case 'symbol-asc':
        return a.symbol.localeCompare(b.symbol);
      case 'symbol-desc':
        return b.symbol.localeCompare(a.symbol);
      case 'pnl-desc':
        return b.pnl - a.pnl;
      case 'pnl-asc':
        return a.pnl - b.pnl;
      case 'exposure-desc':
        return b.avgPrice * b.quantity - a.avgPrice * a.quantity;
      case 'exposure-asc':
        return a.avgPrice * a.quantity - b.avgPrice * b.quantity;
      default:
        return b.pnl - a.pnl;
    }
  });
};

export const calculateStats = (positions: PortfolioPosition[]) => {
  const totalPnL = positions.reduce((sum, pos) => sum + pos.pnl, 0);
  const totalPnLPercent =
    positions.reduce((sum, pos) => sum + pos.pnlPercent, 0) / (positions.length || 1);
  const profitableCount = positions.filter((p) => p.pnl > 0).length;
  const losingCount = positions.filter((p) => p.pnl < 0).length;
  const totalExposure = positions.reduce((sum, pos) => sum + pos.avgPrice * pos.quantity, 0);

  return {
    totalPnL,
    totalPnLPercent,
    profitableCount,
    losingCount,
    totalExposure,
  };
};

export const usePortfolioFilters = (
  positions: PortfolioPosition[],
  filterOption: PortfolioFilterOption,
  sortBy: PortfolioSortOption
) => {
  const filteredAndSorted = useMemo(() => {
    const filtered = filterPositions(positions, filterOption);
    return sortPositions(filtered, sortBy);
  }, [positions, filterOption, sortBy]);

  const stats = useMemo(() => calculateStats(filteredAndSorted), [filteredAndSorted]);

  return {
    positions: filteredAndSorted,
    stats,
  };
};
