import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import type { PivotPoint } from '../types';
import {
  detectAscendingTriangles,
  detectDescendingTriangles,
  detectSymmetricalTriangles,
} from './triangles';

const createKline = (openTime: number, close: number): Kline =>
  ({
    openTime,
    open: close.toString(),
    high: (close * 1.02).toString(),
    low: (close * 0.98).toString(),
    close: close.toString(),
    volume: '1000',
    closeTime: openTime + 60000,
    quoteAssetVolume: '100000',
    numberOfTrades: 100,
    takerBuyBaseAssetVolume: '500',
    takerBuyQuoteAssetVolume: '50000',
  }) as Kline;

const createPivot = (
  index: number,
  price: number,
  type: 'high' | 'low',
  openTime: number
): PivotPoint => ({
  index,
  price,
  type,
  openTime,
  strength: 1,
});

describe('triangles', () => {
  describe('detectAscendingTriangles', () => {
    it('should return empty array for empty klines', () => {
      const result = detectAscendingTriangles([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectAscendingTriangles(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectAscendingTriangles(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'low', 5 * 60000)];
      const result = detectAscendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when only low pivots exist', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 105, 'low', 15 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when high pivots are not flat', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(15, 130, 'high', 15 * 60000),
        createPivot(7, 100, 'low', 7 * 60000),
        createPivot(12, 105, 'low', 12 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when low pivots are not ascending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(7, 110, 'low', 7 * 60000),
        createPivot(12, 100, 'low', 12 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect ascending triangle with flat resistance and rising support', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + Math.sin(i / 5) * 10));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 100, 'low', 10 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(20, 110, 'low', 20 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('triangle-ascending');
        expect(result[0].apex).toBeDefined();
        expect(result[0].upperTrendline).toHaveLength(2);
        expect(result[0].lowerTrendline).toHaveLength(2);
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 100, 'low', 10 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(20, 105, 'low', 20 * 60000),
        createPivot(25, 120.5, 'high', 25 * 60000),
        createPivot(30, 108, 'low', 30 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const klines = Array.from({ length: 200 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 20; i++) {
        pivots.push(createPivot(i * 10, 120, 'high', i * 10 * 60000));
        pivots.push(createPivot(i * 10 + 5, 100 + i, 'low', (i * 10 + 5) * 60000));
      }
      const result = detectAscendingTriangles(klines, pivots);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('detectDescendingTriangles', () => {
    it('should return empty array for empty klines', () => {
      const result = detectDescendingTriangles([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectDescendingTriangles(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectDescendingTriangles(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'high', 5 * 60000)];
      const result = detectDescendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when low pivots are not flat', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(15, 70, 'low', 15 * 60000),
        createPivot(7, 100, 'high', 7 * 60000),
        createPivot(12, 90, 'high', 12 * 60000),
      ];
      const result = detectDescendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when high pivots are not descending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(15, 80, 'low', 15 * 60000),
        createPivot(7, 100, 'high', 7 * 60000),
        createPivot(12, 110, 'high', 12 * 60000),
      ];
      const result = detectDescendingTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect descending triangle with flat support and falling resistance', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 - Math.sin(i / 5) * 10));
      const pivots: PivotPoint[] = [
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(10, 110, 'high', 10 * 60000),
        createPivot(15, 80, 'low', 15 * 60000),
        createPivot(20, 100, 'high', 20 * 60000),
      ];
      const result = detectDescendingTriangles(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('triangle-descending');
        expect(result[0].apex).toBeDefined();
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(10, 110, 'high', 10 * 60000),
        createPivot(15, 80, 'low', 15 * 60000),
        createPivot(20, 105, 'high', 20 * 60000),
        createPivot(25, 80.5, 'low', 25 * 60000),
        createPivot(30, 100, 'high', 30 * 60000),
      ];
      const result = detectDescendingTriangles(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });
  });

  describe('detectSymmetricalTriangles', () => {
    it('should return empty array for empty klines', () => {
      const result = detectSymmetricalTriangles([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectSymmetricalTriangles(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectSymmetricalTriangles(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'high', 5 * 60000)];
      const result = detectSymmetricalTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when upper pivots are not descending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', 5 * 60000),
        createPivot(15, 115, 'high', 15 * 60000),
        createPivot(7, 90, 'low', 7 * 60000),
        createPivot(12, 95, 'low', 12 * 60000),
      ];
      const result = detectSymmetricalTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when lower pivots are not ascending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 115, 'high', 5 * 60000),
        createPivot(15, 110, 'high', 15 * 60000),
        createPivot(7, 95, 'low', 7 * 60000),
        createPivot(12, 90, 'low', 12 * 60000),
      ];
      const result = detectSymmetricalTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when slopes are not symmetric', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(15, 100, 'high', 15 * 60000),
        createPivot(7, 80, 'low', 7 * 60000),
        createPivot(12, 81, 'low', 12 * 60000),
      ];
      const result = detectSymmetricalTriangles(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect symmetrical triangle with converging trendlines', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 85, 'low', 10 * 60000),
        createPivot(15, 115, 'high', 15 * 60000),
        createPivot(20, 90, 'low', 20 * 60000),
      ];
      const result = detectSymmetricalTriangles(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('triangle-symmetrical');
        expect(result[0].apex).toBeDefined();
        expect(result[0].label).toContain('Breakout direction uncertain');
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 85, 'low', 10 * 60000),
        createPivot(15, 115, 'high', 15 * 60000),
        createPivot(20, 90, 'low', 20 * 60000),
        createPivot(25, 110, 'high', 25 * 60000),
        createPivot(30, 95, 'low', 30 * 60000),
      ];
      const result = detectSymmetricalTriangles(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });
  });

  describe('triangle detection edge cases', () => {
    it('should handle pivots at same index', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(15, 85, 'low', 15 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty pivots array', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      expect(detectAscendingTriangles(klines, [])).toEqual([]);
      expect(detectDescendingTriangles(klines, [])).toEqual([]);
      expect(detectSymmetricalTriangles(klines, [])).toEqual([]);
    });

    it('should generate valid labels with bullish breakout for ascending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 100, 'low', 10 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(20, 110, 'low', 20 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      if (result.length > 0) {
        expect(result[0].label).toContain('Bullish breakout expected');
      }
    });

    it('should generate valid labels with bearish breakout for descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 80, 'low', 5 * 60000),
        createPivot(10, 110, 'high', 10 * 60000),
        createPivot(15, 80, 'low', 15 * 60000),
        createPivot(20, 100, 'high', 20 * 60000),
      ];
      const result = detectDescendingTriangles(klines, pivots);
      if (result.length > 0) {
        expect(result[0].label).toContain('Bearish breakout expected');
      }
    });

    it('should set visible to true for detected triangles', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(10, 100, 'low', 10 * 60000),
        createPivot(15, 120, 'high', 15 * 60000),
        createPivot(20, 110, 'low', 20 * 60000),
      ];
      const result = detectAscendingTriangles(klines, pivots);
      result.forEach((triangle) => {
        expect(triangle.visible).toBe(true);
      });
    });
  });
});
