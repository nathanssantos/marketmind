import { describe, expect, it } from 'vitest';
import { calculateStats, filterPositions, sortPositions } from '../usePortfolioFilters';

const createPosition = (overrides = {}) => ({
  id: '1',
  symbol: 'BTCUSDT',
  side: 'LONG' as const,
  quantity: 1,
  avgPrice: 50000,
  currentPrice: 51000,
  pnl: 1000,
  pnlPercent: 2,
  openedAt: new Date('2025-01-01'),
  ...overrides,
});

describe('usePortfolioFilters', () => {
  describe('filterPositions', () => {
    const positions = [
      createPosition({ id: '1', side: 'LONG', pnl: 1000 }),
      createPosition({ id: '2', side: 'SHORT', pnl: -500 }),
      createPosition({ id: '3', side: 'LONG', pnl: -200 }),
      createPosition({ id: '4', side: 'SHORT', pnl: 300 }),
    ];

    it('should return all positions when filter is "all"', () => {
      const result = filterPositions(positions, 'all');
      expect(result).toHaveLength(4);
    });

    it('should filter only LONG positions', () => {
      const result = filterPositions(positions, 'long');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.side === 'LONG')).toBe(true);
    });

    it('should filter only SHORT positions', () => {
      const result = filterPositions(positions, 'short');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.side === 'SHORT')).toBe(true);
    });

    it('should filter only profitable positions', () => {
      const result = filterPositions(positions, 'profitable');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.pnl > 0)).toBe(true);
    });

    it('should filter only losing positions', () => {
      const result = filterPositions(positions, 'losing');
      expect(result).toHaveLength(2);
      expect(result.every((p) => p.pnl < 0)).toBe(true);
    });

    it('should handle empty positions array', () => {
      const result = filterPositions([], 'all');
      expect(result).toHaveLength(0);
    });

    it('should handle positions with zero PnL', () => {
      const positionsWithZero = [
        createPosition({ id: '1', pnl: 0 }),
        createPosition({ id: '2', pnl: 100 }),
        createPosition({ id: '3', pnl: -100 }),
      ];
      
      const profitable = filterPositions(positionsWithZero, 'profitable');
      expect(profitable).toHaveLength(1);
      
      const losing = filterPositions(positionsWithZero, 'losing');
      expect(losing).toHaveLength(1);
    });
  });

  describe('sortPositions', () => {
    const positions = [
      createPosition({ 
        id: '1', 
        symbol: 'BTCUSDT', 
        pnl: 500, 
        avgPrice: 50000,
        quantity: 1,
        openedAt: new Date('2025-01-03') 
      }),
      createPosition({ 
        id: '2', 
        symbol: 'ETHUSDT', 
        pnl: 1000, 
        avgPrice: 3000,
        quantity: 10,
        openedAt: new Date('2025-01-01') 
      }),
      createPosition({ 
        id: '3', 
        symbol: 'ADAUSDT', 
        pnl: -200, 
        avgPrice: 0.5,
        quantity: 1000,
        openedAt: new Date('2025-01-02') 
      }),
    ];

    it('should sort by newest first', () => {
      const result = sortPositions(positions, 'newest');
      expect(result[0].id).toBe('1');
      expect(result[2].id).toBe('2');
    });

    it('should sort by oldest first', () => {
      const result = sortPositions(positions, 'oldest');
      expect(result[0].id).toBe('2');
      expect(result[2].id).toBe('1');
    });

    it('should sort by symbol ascending', () => {
      const result = sortPositions(positions, 'symbol-asc');
      expect(result[0].symbol).toBe('ADAUSDT');
      expect(result[1].symbol).toBe('BTCUSDT');
      expect(result[2].symbol).toBe('ETHUSDT');
    });

    it('should sort by symbol descending', () => {
      const result = sortPositions(positions, 'symbol-desc');
      expect(result[0].symbol).toBe('ETHUSDT');
      expect(result[1].symbol).toBe('BTCUSDT');
      expect(result[2].symbol).toBe('ADAUSDT');
    });

    it('should sort by PnL descending (highest profit first)', () => {
      const result = sortPositions(positions, 'pnl-desc');
      expect(result[0].pnl).toBe(1000);
      expect(result[1].pnl).toBe(500);
      expect(result[2].pnl).toBe(-200);
    });

    it('should sort by PnL ascending (highest loss first)', () => {
      const result = sortPositions(positions, 'pnl-asc');
      expect(result[0].pnl).toBe(-200);
      expect(result[1].pnl).toBe(500);
      expect(result[2].pnl).toBe(1000);
    });

    it('should sort by exposure descending', () => {
      const result = sortPositions(positions, 'exposure-desc');
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('3');
    });

    it('should sort by exposure ascending', () => {
      const result = sortPositions(positions, 'exposure-asc');
      expect(result[0].id).toBe('3');
      expect(result[1].id).toBe('2');
      expect(result[2].id).toBe('1');
    });

    it('should not mutate original array', () => {
      const original = [...positions];
      sortPositions(positions, 'pnl-desc');
      expect(positions).toEqual(original);
    });

    it('should handle empty array', () => {
      const result = sortPositions([], 'newest');
      expect(result).toHaveLength(0);
    });

    it('should handle single position', () => {
      const single = [createPosition()];
      const result = sortPositions(single, 'pnl-desc');
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateStats', () => {
    it('should calculate stats for multiple positions with weighted P&L percent', () => {
      const positions = [
        createPosition({ id: '1', pnl: 1000, pnlPercent: 2, avgPrice: 50000, quantity: 1 }),
        createPosition({ id: '2', pnl: -500, pnlPercent: -1, avgPrice: 3000, quantity: 10 }),
        createPosition({ id: '3', pnl: 300, pnlPercent: 1.5, avgPrice: 0.5, quantity: 1000 }),
      ];

      const stats = calculateStats(positions);

      expect(stats.totalPnL).toBe(800);
      expect(stats.totalExposure).toBe(80500);
      expect(stats.totalPnLPercent).toBeCloseTo(800 / 80500 * 100, 2);
      expect(stats.profitableCount).toBe(2);
      expect(stats.losingCount).toBe(1);
    });

    it('should handle empty positions', () => {
      const stats = calculateStats([]);

      expect(stats.totalPnL).toBe(0);
      expect(stats.totalPnLPercent).toBe(0);
      expect(stats.profitableCount).toBe(0);
      expect(stats.losingCount).toBe(0);
      expect(stats.totalExposure).toBe(0);
    });

    it('should handle single position', () => {
      const positions = [
        createPosition({ pnl: 1000, pnlPercent: 2, avgPrice: 50000, quantity: 1 })
      ];

      const stats = calculateStats(positions);

      expect(stats.totalPnL).toBe(1000);
      expect(stats.totalPnLPercent).toBe(2);
      expect(stats.profitableCount).toBe(1);
      expect(stats.losingCount).toBe(0);
      expect(stats.totalExposure).toBe(50000);
    });

    it('should handle all losing positions', () => {
      const positions = [
        createPosition({ pnl: -100, pnlPercent: -1 }),
        createPosition({ pnl: -200, pnlPercent: -2 }),
      ];

      const stats = calculateStats(positions);

      expect(stats.totalPnL).toBe(-300);
      expect(stats.profitableCount).toBe(0);
      expect(stats.losingCount).toBe(2);
    });

    it('should handle all profitable positions', () => {
      const positions = [
        createPosition({ pnl: 100, pnlPercent: 1 }),
        createPosition({ pnl: 200, pnlPercent: 2 }),
      ];

      const stats = calculateStats(positions);

      expect(stats.totalPnL).toBe(300);
      expect(stats.profitableCount).toBe(2);
      expect(stats.losingCount).toBe(0);
    });

    it('should handle positions with zero PnL', () => {
      const positions = [
        createPosition({ pnl: 0, pnlPercent: 0 }),
        createPosition({ pnl: 100, pnlPercent: 1 }),
      ];

      const stats = calculateStats(positions);

      expect(stats.profitableCount).toBe(1);
      expect(stats.losingCount).toBe(0);
    });
  });
});
