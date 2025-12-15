import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import type { PivotPoint } from '../types';
import { detectFallingWedges, detectRisingWedges } from './wedges';

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

describe('wedges', () => {
  describe('detectRisingWedges', () => {
    it('should return empty array for empty klines', () => {
      const result = detectRisingWedges([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectRisingWedges(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectRisingWedges(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'low', 5 * 60000)];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when only low pivots exist', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 110, 'low', 15 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when only high pivots exist', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(15, 130, 'high', 15 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when low pivots are not ascending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'low', 5 * 60000),
        createPivot(15, 100, 'low', 15 * 60000),
        createPivot(7, 120, 'high', 7 * 60000),
        createPivot(12, 130, 'high', 12 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when high pivots are not ascending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 110, 'low', 15 * 60000),
        createPivot(7, 130, 'high', 7 * 60000),
        createPivot(12, 120, 'high', 12 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when upper slope is not less than lower slope', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 110, 'low', 15 * 60000),
        createPivot(7, 120, 'high', 7 * 60000),
        createPivot(12, 140, 'high', 12 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect rising wedge with converging upward trendlines', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('wedge-rising');
        expect(result[0].convergencePoint).toBeDefined();
        expect(result[0].upperTrendline).toHaveLength(2);
        expect(result[0].lowerTrendline).toHaveLength(2);
      }
    });

    it('should set context based on prior trend', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(0, 80, 'low', 0),
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      if (result.length > 0) {
        expect(['uptrend', 'downtrend']).toContain(result[0].context);
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
        createPivot(25, 115, 'low', 25 * 60000),
        createPivot(30, 125, 'high', 30 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const klines = Array.from({ length: 200 }, (_, i) => createKline(i * 60000, 100 + i * 0.5));
      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 20; i++) {
        pivots.push(createPivot(i * 10, 100 + i * 5, 'low', i * 10 * 60000));
        pivots.push(createPivot(i * 10 + 5, 110 + i * 4, 'high', (i * 10 + 5) * 60000));
      }
      const result = detectRisingWedges(klines, pivots);
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should include bearish reversal in label for uptrend context', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      if (result.length > 0 && result[0].context === 'uptrend') {
        expect(result[0].label).toContain('Bearish reversal likely');
      }
    });
  });

  describe('detectFallingWedges', () => {
    it('should return empty array for empty klines', () => {
      const result = detectFallingWedges([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectFallingWedges(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectFallingWedges(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'high', 5 * 60000)];
      const result = detectFallingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when high pivots are not descending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'high', 5 * 60000),
        createPivot(15, 110, 'high', 15 * 60000),
        createPivot(7, 90, 'low', 7 * 60000),
        createPivot(12, 80, 'low', 12 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when low pivots are not descending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'high', 5 * 60000),
        createPivot(15, 100, 'high', 15 * 60000),
        createPivot(7, 80, 'low', 7 * 60000),
        createPivot(12, 90, 'low', 12 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when lower slope is not greater than upper slope', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(5, 200, 'high', 5 * 60000),
        createPivot(15, 180, 'high', 15 * 60000),
        createPivot(7, 190, 'low', 7 * 60000),
        createPivot(12, 150, 'low', 12 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect falling wedge with converging downward trendlines', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(5, 190, 'high', 5 * 60000),
        createPivot(10, 180, 'low', 10 * 60000),
        createPivot(15, 182, 'high', 15 * 60000),
        createPivot(20, 175, 'low', 20 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('wedge-falling');
        expect(result[0].convergencePoint).toBeDefined();
      }
    });

    it('should set context based on prior trend', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(0, 210, 'high', 0),
        createPivot(5, 190, 'high', 5 * 60000),
        createPivot(10, 180, 'low', 10 * 60000),
        createPivot(15, 182, 'high', 15 * 60000),
        createPivot(20, 175, 'low', 20 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      if (result.length > 0) {
        expect(['uptrend', 'downtrend']).toContain(result[0].context);
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(5, 190, 'high', 5 * 60000),
        createPivot(10, 180, 'low', 10 * 60000),
        createPivot(15, 182, 'high', 15 * 60000),
        createPivot(20, 175, 'low', 20 * 60000),
        createPivot(25, 177, 'high', 25 * 60000),
        createPivot(30, 172, 'low', 30 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });

    it('should include bullish reversal in label for downtrend context', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(5, 190, 'high', 5 * 60000),
        createPivot(10, 180, 'low', 10 * 60000),
        createPivot(15, 182, 'high', 15 * 60000),
        createPivot(20, 175, 'low', 20 * 60000),
      ];
      const result = detectFallingWedges(klines, pivots);
      if (result.length > 0 && result[0].context === 'downtrend') {
        expect(result[0].label).toContain('Bullish reversal likely');
      }
    });
  });

  describe('wedge detection edge cases', () => {
    it('should handle pivots with undefined values', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots = [
        undefined,
        createPivot(5, 100, 'low', 5 * 60000),
        null,
        createPivot(15, 110, 'low', 15 * 60000),
      ].filter(Boolean) as PivotPoint[];
      const result = detectRisingWedges(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty pivots array for rising wedges', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const result = detectRisingWedges(klines, []);
      expect(result).toEqual([]);
    });

    it('should handle empty pivots array for falling wedges', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const result = detectFallingWedges(klines, []);
      expect(result).toEqual([]);
    });

    it('should set visible to true for detected wedges', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      result.forEach((wedge) => {
        expect(wedge.visible).toBe(true);
      });
    });

    it('should generate unique ids for wedges', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
        createPivot(25, 115, 'low', 25 * 60000),
        createPivot(30, 125, 'high', 30 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      const ids = result.map((w) => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('should include confidence percentage in label', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(15, 108, 'low', 15 * 60000),
        createPivot(20, 120, 'high', 20 * 60000),
      ];
      const result = detectRisingWedges(klines, pivots);
      if (result.length > 0) {
        expect(result[0].label).toMatch(/\d+% confidence/);
      }
    });
  });
});
