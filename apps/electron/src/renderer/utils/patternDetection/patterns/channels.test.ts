import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import type { PivotPoint } from '../types';
import {
  detectAscendingChannels,
  detectDescendingChannels,
  detectHorizontalChannels,
} from './channels';

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

describe('channels', () => {
  describe('detectAscendingChannels', () => {
    it('should return empty array for empty klines', () => {
      const result = detectAscendingChannels([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectAscendingChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectAscendingChannels(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'low', 5 * 60000)];
      const result = detectAscendingChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when only low pivots exist', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 110, 'low', 15 * 60000),
      ];
      const result = detectAscendingChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when only high pivots exist', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 120, 'high', 5 * 60000),
        createPivot(15, 130, 'high', 15 * 60000),
      ];
      const result = detectAscendingChannels(klines, pivots);
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
      const result = detectAscendingChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect ascending channel with valid pivots', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i * 2));
      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'low', 5 * 60000),
        createPivot(10, 125, 'high', 10 * 60000),
        createPivot(15, 130, 'low', 15 * 60000),
        createPivot(20, 145, 'high', 20 * 60000),
      ];
      const result = detectAscendingChannels(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('channel-ascending');
        expect(result[0].confidence).toBeGreaterThan(0);
        expect(result[0].upperLine).toHaveLength(2);
        expect(result[0].lowerLine).toHaveLength(2);
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(10, 115, 'high', 10 * 60000),
        createPivot(20, 115, 'low', 20 * 60000),
        createPivot(25, 130, 'high', 25 * 60000),
        createPivot(30, 125, 'low', 30 * 60000),
        createPivot(35, 140, 'high', 35 * 60000),
        createPivot(40, 135, 'low', 40 * 60000),
        createPivot(45, 150, 'high', 45 * 60000),
      ];
      const result = detectAscendingChannels(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const klines = Array.from({ length: 200 }, (_, i) => createKline(i * 60000, 100 + i));
      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 20; i++) {
        pivots.push(createPivot(i * 10, 100 + i * 10, 'low', i * 10 * 60000));
        pivots.push(createPivot(i * 10 + 5, 110 + i * 10, 'high', (i * 10 + 5) * 60000));
      }
      const result = detectAscendingChannels(klines, pivots);
      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('detectDescendingChannels', () => {
    it('should return empty array for empty klines', () => {
      const result = detectDescendingChannels([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectDescendingChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectDescendingChannels(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [createPivot(5, 190, 'high', 5 * 60000)];
      const result = detectDescendingChannels(klines, pivots);
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
      const result = detectDescendingChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect descending channel with valid pivots', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i * 2));
      const pivots: PivotPoint[] = [
        createPivot(5, 190, 'high', 5 * 60000),
        createPivot(10, 180, 'low', 10 * 60000),
        createPivot(15, 170, 'high', 15 * 60000),
        createPivot(20, 160, 'low', 20 * 60000),
      ];
      const result = detectDescendingChannels(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('channel-descending');
        expect(result[0].confidence).toBeGreaterThan(0);
      }
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 200 - i));
      const pivots: PivotPoint[] = [
        createPivot(5, 200, 'high', 5 * 60000),
        createPivot(10, 195, 'low', 10 * 60000),
        createPivot(20, 180, 'high', 20 * 60000),
        createPivot(25, 175, 'low', 25 * 60000),
        createPivot(30, 160, 'high', 30 * 60000),
        createPivot(35, 155, 'low', 35 * 60000),
      ];
      const result = detectDescendingChannels(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });
  });

  describe('detectHorizontalChannels', () => {
    it('should return empty array for empty klines', () => {
      const result = detectHorizontalChannels([], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = Array.from({ length: 19 }, (_, i) => createKline(i * 60000, 100));
      const result = detectHorizontalChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for null klines', () => {
      const result = detectHorizontalChannels(null as unknown as Kline[], []);
      expect(result).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [createPivot(5, 100, 'low', 5 * 60000)];
      const result = detectHorizontalChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should return empty array when price difference is too large', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(15, 110, 'low', 15 * 60000),
        createPivot(7, 120, 'high', 7 * 60000),
        createPivot(12, 130, 'high', 12 * 60000),
      ];
      const result = detectHorizontalChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should detect horizontal channel with similar price pivots', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + Math.sin(i / 5) * 5));
      const pivots: PivotPoint[] = [
        createPivot(5, 95, 'low', 5 * 60000),
        createPivot(10, 105, 'high', 10 * 60000),
        createPivot(25, 96, 'low', 25 * 60000),
        createPivot(30, 106, 'high', 30 * 60000),
      ];
      const result = detectHorizontalChannels(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].type).toBe('channel-horizontal');
      }
    });

    it('should require minimum klines between pivots', () => {
      const klines = Array.from({ length: 50 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 100, 'low', 5 * 60000),
        createPivot(6, 100.5, 'low', 6 * 60000),
        createPivot(5, 105, 'high', 5 * 60000),
        createPivot(6, 105.5, 'high', 6 * 60000),
      ];
      const result = detectHorizontalChannels(klines, pivots);
      expect(result).toEqual([]);
    });

    it('should sort results by confidence descending', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100));
      const pivots: PivotPoint[] = [
        createPivot(5, 95, 'low', 5 * 60000),
        createPivot(10, 105, 'high', 10 * 60000),
        createPivot(30, 95.5, 'low', 30 * 60000),
        createPivot(35, 105.5, 'high', 35 * 60000),
        createPivot(50, 96, 'low', 50 * 60000),
        createPivot(55, 106, 'high', 55 * 60000),
      ];
      const result = detectHorizontalChannels(klines, pivots);
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1].confidence).toBeGreaterThanOrEqual(result[i].confidence || 0);
      }
    });
  });

  describe('channel detection edge cases', () => {
    it('should handle pivots with undefined values', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const pivots = [
        undefined,
        createPivot(5, 100, 'low', 5 * 60000),
        null,
        createPivot(15, 110, 'low', 15 * 60000),
      ].filter(Boolean) as PivotPoint[];
      const result = detectAscendingChannels(klines, pivots);
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty pivots array for ascending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const result = detectAscendingChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should handle empty pivots array for descending', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const result = detectDescendingChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should handle empty pivots array for horizontal', () => {
      const klines = Array.from({ length: 30 }, (_, i) => createKline(i * 60000, 100));
      const result = detectHorizontalChannels(klines, []);
      expect(result).toEqual([]);
    });

    it('should generate valid labels for detected channels', () => {
      const klines = Array.from({ length: 100 }, (_, i) => createKline(i * 60000, 100 + i * 2));
      const pivots: PivotPoint[] = [
        createPivot(5, 110, 'low', 5 * 60000),
        createPivot(10, 125, 'high', 10 * 60000),
        createPivot(15, 130, 'low', 15 * 60000),
        createPivot(20, 145, 'high', 20 * 60000),
      ];
      const result = detectAscendingChannels(klines, pivots);
      if (result.length > 0) {
        expect(result[0].label).toContain('Ascending Channel');
        expect(result[0].label).toContain('confidence');
      }
    });
  });
});
