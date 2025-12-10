import { describe, it, expect } from 'vitest';
import {
  calculateRelativeStrength,
  calculateRelativeStrengthSeries,
  calculateRelativeStrengthNormalized,
  calculateRelativeStrengthMA,
  detectRelativeStrengthSignal,
  calculatePerformanceComparison,
  findStrongestAssets,
} from './relativeStrength';

describe('Relative Strength', () => {
  const assetCloses = [100, 105, 110, 115, 120, 125, 130];
  const baseCloses = [100, 102, 104, 106, 108, 110, 112];

  describe('calculateRelativeStrength', () => {
    it('should calculate ratio correctly', () => {
      const result = calculateRelativeStrength(assetCloses, baseCloses);
      expect(result.ratio).toBeCloseTo(1.16, 2);
    });

    it('should detect outperforming asset', () => {
      const result = calculateRelativeStrength(assetCloses, baseCloses);
      expect(result.outperforming).toBe(true);
    });

    it('should detect strong strength', () => {
      const strongAsset = [100, 120, 140, 160, 180, 200, 220];
      const result = calculateRelativeStrength(strongAsset, baseCloses);
      expect(result.strength).toBe('strong');
    });

    it('should detect moderate strength', () => {
      const moderateAsset = [100, 108, 116, 124, 132, 140, 148];
      const result = calculateRelativeStrength(moderateAsset, baseCloses);
      expect(result.strength).toBe('moderate');
    });

    it('should detect underperforming', () => {
      const weakAsset = [100, 98, 96, 94, 92, 90, 88];
      const result = calculateRelativeStrength(weakAsset, baseCloses);
      expect(result.strength).toBe('underperforming');
    });

    it('should handle empty arrays', () => {
      const result = calculateRelativeStrength([], []);
      expect(result.ratio).toBeNull();
    });

    it('should handle zero base price', () => {
      const result = calculateRelativeStrength([100], [0]);
      expect(result.ratio).toBeNull();
    });
  });

  describe('calculateRelativeStrengthSeries', () => {
    it('should return series of ratios', () => {
      const result = calculateRelativeStrengthSeries(assetCloses, baseCloses);
      expect(result.length).toBe(7);
      expect(result[0]).toBe(1);
      expect(result[6]).toBeCloseTo(1.16, 2);
    });

    it('should handle different length arrays', () => {
      const result = calculateRelativeStrengthSeries([100, 110, 120], [100, 105]);
      expect(result.length).toBe(2);
    });
  });

  describe('calculateRelativeStrengthNormalized', () => {
    it('should normalize relative strength to start at 0', () => {
      const result = calculateRelativeStrengthNormalized(assetCloses, baseCloses, 0);
      expect(result[0]).toBe(0);
    });

    it('should show outperformance as positive', () => {
      const result = calculateRelativeStrengthNormalized(assetCloses, baseCloses, 0);
      const lastValue = result[result.length - 1];
      expect(lastValue).toBeGreaterThan(0);
    });
  });

  describe('calculateRelativeStrengthMA', () => {
    it('should calculate moving average of ratios', () => {
      const result = calculateRelativeStrengthMA(assetCloses, baseCloses, 3);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).toBeCloseTo(1.03, 2);
    });
  });

  describe('detectRelativeStrengthSignal', () => {
    it('should detect outperform signal', () => {
      const strongAsset = Array(20)
        .fill(100)
        .map((v, i) => v + i * 5);
      const weakBase = Array(20)
        .fill(100)
        .map((v, i) => v + i);
      const result = detectRelativeStrengthSignal(strongAsset, weakBase, { period: 10 });
      expect(result.signal).toBe('outperform');
    });

    it('should detect underperform signal', () => {
      const weakAsset = Array(20)
        .fill(100)
        .map((v, i) => v - i * 2);
      const strongBase = Array(20)
        .fill(100)
        .map((v, i) => v + i * 2);
      const result = detectRelativeStrengthSignal(weakAsset, strongBase, { period: 10 });
      expect(result.signal).toBe('underperform');
    });

    it('should return neutral for similar performance', () => {
      const result = detectRelativeStrengthSignal(baseCloses, baseCloses);
      expect(result.signal).toBe('neutral');
    });
  });

  describe('calculatePerformanceComparison', () => {
    it('should calculate returns for different periods', () => {
      const result = calculatePerformanceComparison(assetCloses, baseCloses, [3, 5]);

      const period3 = result.get(3);
      expect(period3).toBeDefined();
      expect(period3?.outperformance).toBeGreaterThan(0);
    });

    it('should skip periods with insufficient data', () => {
      const result = calculatePerformanceComparison(assetCloses, baseCloses, [100]);
      expect(result.has(100)).toBe(false);
    });
  });

  describe('findStrongestAssets', () => {
    it('should rank assets by relative strength', () => {
      const assetMap = new Map<string, number[]>();
      assetMap.set('ETH', [100, 110, 120, 130, 140]);
      assetMap.set('SOL', [100, 120, 140, 160, 180]);
      assetMap.set('ADA', [100, 105, 110, 115, 120]);

      const btcCloses = [100, 105, 110, 115, 120];

      const result = findStrongestAssets(assetMap, btcCloses, 3, 3);
      expect(result[0]?.symbol).toBe('SOL');
      expect(result.length).toBeLessThanOrEqual(3);
    });

    it('should handle empty map', () => {
      const result = findStrongestAssets(new Map(), baseCloses);
      expect(result).toEqual([]);
    });
  });
});
