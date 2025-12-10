import { describe, it, expect } from 'vitest';
import {
  calculateLiquidations,
  calculateLiquidationSeries,
  calculateLiquidationMA,
  detectLiquidationCascade,
  calculateLiquidationDelta,
  calculateCumulativeLiquidationDelta,
  type LiquidationData,
} from './liquidations';

describe('Liquidations', () => {
  const mockData: LiquidationData[] = [
    { timestamp: 1000, longLiquidations: 10, shortLiquidations: 5, totalLiquidations: 15 },
    { timestamp: 2000, longLiquidations: 15, shortLiquidations: 8, totalLiquidations: 23 },
    { timestamp: 3000, longLiquidations: 20, shortLiquidations: 10, totalLiquidations: 30 },
    { timestamp: 4000, longLiquidations: 5, shortLiquidations: 25, totalLiquidations: 30 },
    { timestamp: 5000, longLiquidations: 8, shortLiquidations: 12, totalLiquidations: 20 },
  ];

  describe('calculateLiquidations', () => {
    it('should sum liquidations over lookback period', () => {
      const result = calculateLiquidations(mockData, { lookbackPeriods: 3 });
      expect(result.longLiquidations).toBe(33);
      expect(result.shortLiquidations).toBe(47);
      expect(result.totalLiquidations).toBe(80);
    });

    it('should detect long dominant side', () => {
      const longDominant: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 80, shortLiquidations: 10, totalLiquidations: 90 },
      ];
      const result = calculateLiquidations(longDominant, { imbalanceThreshold: 0.7 });
      expect(result.dominantSide).toBe('long');
    });

    it('should detect short dominant side', () => {
      const shortDominant: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 10, shortLiquidations: 80, totalLiquidations: 90 },
      ];
      const result = calculateLiquidations(shortDominant, { imbalanceThreshold: 0.7 });
      expect(result.dominantSide).toBe('short');
    });

    it('should detect balanced liquidations', () => {
      const balanced: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 50, shortLiquidations: 50, totalLiquidations: 100 },
      ];
      const result = calculateLiquidations(balanced);
      expect(result.dominantSide).toBe('balanced');
    });

    it('should detect cascade', () => {
      const cascadeData: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 60, shortLiquidations: 10, totalLiquidations: 70 },
      ];
      const result = calculateLiquidations(cascadeData, { cascadeThreshold: 50 });
      expect(result.isCascade).toBe(true);
      expect(result.cascadeStrength).toBeGreaterThan(0);
    });

    it('should handle empty data', () => {
      const result = calculateLiquidations([]);
      expect(result.totalLiquidations).toBe(0);
      expect(result.isCascade).toBe(false);
    });
  });

  describe('calculateLiquidationSeries', () => {
    it('should return series sorted by timestamp', () => {
      const result = calculateLiquidationSeries(mockData);
      expect(result.long).toEqual([10, 15, 20, 5, 8]);
      expect(result.short).toEqual([5, 8, 10, 25, 12]);
      expect(result.total).toEqual([15, 23, 30, 30, 20]);
    });
  });

  describe('calculateLiquidationMA', () => {
    it('should calculate moving averages', () => {
      const data: LiquidationData[] = [];
      for (let i = 0; i < 30; i++) {
        data.push({
          timestamp: i * 1000,
          longLiquidations: 10,
          shortLiquidations: 5,
          totalLiquidations: 15,
        });
      }
      const result = calculateLiquidationMA(data, 7);
      expect(result.longMA[10]).toBeCloseTo(10, 1);
      expect(result.shortMA[10]).toBeCloseTo(5, 1);
    });

    it('should return null for insufficient data', () => {
      const result = calculateLiquidationMA(mockData, 10);
      expect(result.longMA[0]).toBeNull();
    });
  });

  describe('detectLiquidationCascade', () => {
    it('should detect long signal after long liquidation cascade', () => {
      const cascadeData: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 60, shortLiquidations: 10, totalLiquidations: 70 },
      ];
      const priceChanges = [-5];
      const result = detectLiquidationCascade(cascadeData, priceChanges, { cascadeThreshold: 50 });
      expect(result.cascade).toBe(true);
      expect(result.signal).toBe('long');
    });

    it('should detect short signal after short liquidation cascade', () => {
      const cascadeData: LiquidationData[] = [
        { timestamp: 1000, longLiquidations: 10, shortLiquidations: 60, totalLiquidations: 70 },
      ];
      const priceChanges = [5];
      const result = detectLiquidationCascade(cascadeData, priceChanges, { cascadeThreshold: 50 });
      expect(result.cascade).toBe(true);
      expect(result.signal).toBe('short');
    });

    it('should return no signal when no cascade', () => {
      const result = detectLiquidationCascade(mockData.slice(0, 1), [0], { cascadeThreshold: 100 });
      expect(result.cascade).toBe(false);
      expect(result.signal).toBe('none');
    });
  });

  describe('calculateLiquidationDelta', () => {
    it('should calculate delta between long and short', () => {
      const result = calculateLiquidationDelta(mockData);
      expect(result).toEqual([5, 7, 10, -20, -4]);
    });
  });

  describe('calculateCumulativeLiquidationDelta', () => {
    it('should calculate cumulative delta', () => {
      const result = calculateCumulativeLiquidationDelta(mockData);
      expect(result).toEqual([5, 12, 22, 2, -2]);
    });
  });
});
