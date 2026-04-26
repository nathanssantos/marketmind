import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PortfolioPosition } from '@renderer/components/Trading/portfolioTypes';
import {
  calculateStats,
  filterPositions,
  sortPositions,
  usePortfolioFilters,
} from './usePortfolioFilters';

const makePosition = (overrides: Partial<PortfolioPosition> = {}): PortfolioPosition => ({
  id: overrides.id ?? `p-${Math.random().toString(36).slice(2, 6)}`,
  symbol: 'BTCUSDT',
  side: 'LONG',
  quantity: 0.1,
  avgPrice: 50_000,
  currentPrice: 51_000,
  pnl: 100,
  pnlPercent: 2,
  openedAt: new Date('2026-04-26T10:00:00Z'),
  status: 'open',
  count: 1,
  leverage: 1,
  marketType: 'FUTURES',
  ...overrides,
});

describe('filterPositions', () => {
  const positions = [
    makePosition({ id: 'a', side: 'LONG', pnl: 100 }),
    makePosition({ id: 'b', side: 'SHORT', pnl: -50 }),
    makePosition({ id: 'c', side: 'LONG', pnl: -25 }),
    makePosition({ id: 'd', side: 'SHORT', pnl: 0 }),
  ];

  it('filter "all" returns every position', () => {
    expect(filterPositions(positions, 'all')).toHaveLength(4);
  });

  it('filter "long" returns only LONG positions', () => {
    const out = filterPositions(positions, 'long');
    expect(out).toHaveLength(2);
    expect(out.every((p) => p.side === 'LONG')).toBe(true);
  });

  it('filter "short" returns only SHORT positions', () => {
    const out = filterPositions(positions, 'short');
    expect(out).toHaveLength(2);
    expect(out.every((p) => p.side === 'SHORT')).toBe(true);
  });

  it('filter "profitable" returns only positions with pnl > 0 (excludes zero)', () => {
    const out = filterPositions(positions, 'profitable');
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('filter "losing" returns only positions with pnl < 0 (excludes zero)', () => {
    const out = filterPositions(positions, 'losing');
    expect(out).toHaveLength(2);
    expect(out.map((p) => p.id).sort()).toEqual(['b', 'c']);
  });
});

describe('sortPositions', () => {
  const positions = [
    makePosition({ id: 'a', symbol: 'BTCUSDT', pnl: 50, openedAt: new Date('2026-04-26T08:00:00Z'), avgPrice: 50_000, quantity: 1 }),
    makePosition({ id: 'b', symbol: 'AAVEUSDT', pnl: 200, openedAt: new Date('2026-04-26T10:00:00Z'), avgPrice: 100, quantity: 5 }),
    makePosition({ id: 'c', symbol: 'XRPUSDT', pnl: -100, openedAt: new Date('2026-04-26T09:00:00Z'), avgPrice: 0.5, quantity: 1000 }),
  ];

  it('newest puts the most recently opened first', () => {
    const ids = sortPositions(positions, 'newest').map((p) => p.id);
    expect(ids).toEqual(['b', 'c', 'a']);
  });

  it('oldest puts the earliest opened first', () => {
    const ids = sortPositions(positions, 'oldest').map((p) => p.id);
    expect(ids).toEqual(['a', 'c', 'b']);
  });

  it('symbol-asc orders alphabetically by symbol', () => {
    const ids = sortPositions(positions, 'symbol-asc').map((p) => p.symbol);
    expect(ids).toEqual(['AAVEUSDT', 'BTCUSDT', 'XRPUSDT']);
  });

  it('symbol-desc orders reverse alphabetically', () => {
    const ids = sortPositions(positions, 'symbol-desc').map((p) => p.symbol);
    expect(ids).toEqual(['XRPUSDT', 'BTCUSDT', 'AAVEUSDT']);
  });

  it('pnl-desc orders by PnL descending', () => {
    const pnls = sortPositions(positions, 'pnl-desc').map((p) => p.pnl);
    expect(pnls).toEqual([200, 50, -100]);
  });

  it('pnl-asc orders by PnL ascending', () => {
    const pnls = sortPositions(positions, 'pnl-asc').map((p) => p.pnl);
    expect(pnls).toEqual([-100, 50, 200]);
  });

  it('exposure-desc orders by avgPrice × quantity (notional) descending', () => {
    // BTC: 50_000 × 1 = 50_000; AAVE: 100 × 5 = 500; XRP: 0.5 × 1000 = 500
    const ids = sortPositions(positions, 'exposure-desc').map((p) => p.id);
    expect(ids[0]).toBe('a');
  });

  it('does not mutate the input array', () => {
    const original = [...positions];
    sortPositions(positions, 'pnl-desc');
    expect(positions).toEqual(original);
  });
});

describe('calculateStats', () => {
  it('totals PnL across positions', () => {
    const positions = [
      makePosition({ pnl: 100, avgPrice: 100, quantity: 1, leverage: 1 }),
      makePosition({ pnl: -50, avgPrice: 200, quantity: 0.5, leverage: 1 }),
      makePosition({ pnl: 25, avgPrice: 50, quantity: 2, leverage: 1 }),
    ];
    const stats = calculateStats(positions);
    expect(stats.totalPnL).toBe(75);
    expect(stats.profitableCount).toBe(2);
    expect(stats.losingCount).toBe(1);
  });

  it('totalPnLPercent uses margin (= notional / leverage) as denominator', () => {
    const positions = [
      makePosition({ pnl: 100, avgPrice: 100, quantity: 10, leverage: 10 }),
    ];
    // notional = 100 × 10 = 1000; margin = 1000 / 10 = 100; pnl/margin = 100/100 = 100%
    const stats = calculateStats(positions);
    expect(stats.totalPnLPercent).toBeCloseTo(100, 1);
  });

  it('returns 0% when there are no positions (no division by zero)', () => {
    const stats = calculateStats([]);
    expect(stats.totalPnL).toBe(0);
    expect(stats.totalPnLPercent).toBe(0);
    expect(stats.profitableCount).toBe(0);
    expect(stats.losingCount).toBe(0);
    expect(stats.totalExposure).toBe(0);
  });
});

describe('usePortfolioFilters hook', () => {
  it('memoizes the filter+sort pipeline and exposes stats', () => {
    const positions = [
      makePosition({ id: 'a', side: 'LONG', pnl: 100, openedAt: new Date('2026-04-26T08:00:00Z') }),
      makePosition({ id: 'b', side: 'SHORT', pnl: -30, openedAt: new Date('2026-04-26T10:00:00Z') }),
    ];
    const { result } = renderHook(() => usePortfolioFilters(positions, 'all', 'newest'));
    expect(result.current.positions.map((p) => p.id)).toEqual(['b', 'a']);
    expect(result.current.stats.totalPnL).toBe(70);
    expect(result.current.stats.profitableCount).toBe(1);
    expect(result.current.stats.losingCount).toBe(1);
  });

  it('filter applies before stats — losing-only stats reflect the filtered subset', () => {
    const positions = [
      makePosition({ id: 'a', side: 'LONG', pnl: 100 }),
      makePosition({ id: 'b', side: 'SHORT', pnl: -30 }),
    ];
    const { result } = renderHook(() => usePortfolioFilters(positions, 'losing', 'newest'));
    expect(result.current.positions).toHaveLength(1);
    expect(result.current.stats.totalPnL).toBe(-30);
    expect(result.current.stats.profitableCount).toBe(0);
    expect(result.current.stats.losingCount).toBe(1);
  });
});
