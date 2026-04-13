import type { PortfolioPosition } from '@renderer/components/Trading/portfolioTypes';
import { type PortfolioFilterOption, type PortfolioSortOption } from '@renderer/store/uiStore';
import { useMemo } from 'react';

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
  const totalExposure = positions.reduce((sum, pos) => sum + pos.avgPrice * pos.quantity, 0);
  const totalMargin = positions.reduce((sum, pos) => sum + (pos.avgPrice * pos.quantity) / (pos.leverage || 1), 0);
  const totalPnLPercent = totalMargin > 0 ? (totalPnL / totalMargin) * 100 : 0;
  const profitableCount = positions.filter((p) => p.pnl > 0).length;
  const losingCount = positions.filter((p) => p.pnl < 0).length;

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
