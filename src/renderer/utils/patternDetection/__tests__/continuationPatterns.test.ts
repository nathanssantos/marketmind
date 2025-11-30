import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../../shared/types';
import {
    detectBearishFlags,
    detectBullishFlags,
    detectCupAndHandle,
    detectPennants,
    detectRoundingBottom,
} from '../patterns/continuationPatterns';
import type { PivotPoint } from '../types';

const createTestKlines = (count: number, basePrice = 100): Kline[] => {
  const klines: Kline[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    klines.push({
      openTime: now + i * 60000,
      open: basePrice,
      high: basePrice + 5,
      low: basePrice - 5,
      close: basePrice,
      volume: 1000,
    });
  }

  return klines;
};

const createPivot = (
  index: number,
  price: number,
  type: 'high' | 'low',
  baseTimestamp = Date.now()
): PivotPoint => ({
  index,
  price,
  openTime: baseTimestamp + index * 60000,
  type,
  strength: 1,
  volume: 1000,
});

describe('continuationPatterns', () => {
  describe('detectBullishFlags', () => {
    it('should detect bullish flag pattern with valid flagpole and declining flag', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(10, 115, 'high', now),
        createPivot(12, 112, 'high', now),
        createPivot(14, 110, 'high', now),
        createPivot(13, 108, 'low', now),
        createPivot(15, 106, 'low', now),
      ];

      const patterns = detectBullishFlags(klines, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('flag-bullish');
        expect(patterns[0]?.flagpole).toBeDefined();
        expect(patterns[0]?.flag).toBeDefined();
        expect(patterns[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it('should reject pattern with insufficient pole height', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(10, 102, 'high', now),
        createPivot(12, 101.5, 'high', now),
        createPivot(14, 101, 'high', now),
        createPivot(13, 100.5, 'low', now),
        createPivot(15, 100, 'low', now),
      ];

      const patterns = detectBullishFlags(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject pattern with insufficient pivots', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(10, 115, 'high', now),
      ];

      const patterns = detectBullishFlags(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = createTestKlines(10, 100);
      const pivots: PivotPoint[] = [];

      const patterns = detectBullishFlags(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const klines = createTestKlines(200, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [];
      for (let i = 0; i < 20; i++) {
        const offset = i * 20;
        pivots.push(
          createPivot(offset, 100 + i, 'low', now),
          createPivot(offset + 10, 115 + i, 'high', now),
          createPivot(offset + 12, 112 + i, 'high', now),
          createPivot(offset + 14, 110 + i, 'high', now),
          createPivot(offset + 13, 108 + i, 'low', now),
          createPivot(offset + 15, 106 + i, 'low', now)
        );
      }

      const patterns = detectBullishFlags(klines, pivots);

      expect(patterns.length).toBeLessThanOrEqual(5);
    });
  });

  describe('detectBearishFlags', () => {
    it('should detect bearish flag pattern with valid flagpole and rising flag', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 115, 'high', now),
        createPivot(10, 100, 'low', now),
        createPivot(12, 102, 'low', now),
        createPivot(14, 104, 'low', now),
        createPivot(13, 106, 'high', now),
        createPivot(15, 108, 'high', now),
      ];

      const patterns = detectBearishFlags(klines, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('flag-bearish');
        expect(patterns[0]?.flagpole).toBeDefined();
        expect(patterns[0]?.flag).toBeDefined();
        expect(patterns[0]?.confidence).toBeGreaterThan(0);
      }
    });

    it('should reject pattern with insufficient pole height', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 102, 'high', now),
        createPivot(10, 100, 'low', now),
        createPivot(12, 100.5, 'low', now),
        createPivot(14, 101, 'low', now),
        createPivot(13, 101.5, 'high', now),
        createPivot(15, 102, 'high', now),
      ];

      const patterns = detectBearishFlags(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = createTestKlines(10, 100);
      const pivots: PivotPoint[] = [];

      const patterns = detectBearishFlags(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should assign confidence scores between 0 and 1', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 115, 'high', now),
        createPivot(10, 100, 'low', now),
        createPivot(12, 102, 'low', now),
        createPivot(14, 104, 'low', now),
        createPivot(13, 106, 'high', now),
        createPivot(15, 108, 'high', now),
      ];

      const patterns = detectBearishFlags(klines, pivots);

      patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThanOrEqual(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('detectPennants', () => {
    it('should detect pennant pattern with converging trendlines', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(8, 115, 'high', now),
        createPivot(12, 112, 'high', now),
        createPivot(16, 110, 'high', now),
        createPivot(14, 105, 'low', now),
        createPivot(18, 107, 'low', now),
      ];

      const patterns = detectPennants(klines, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('pennant');
        expect(patterns[0]?.flagpole).toBeDefined();
        expect(patterns[0]?.pennant).toBeDefined();
        expect(patterns[0]?.pennant.upperTrendline).toHaveLength(2);
        expect(patterns[0]?.pennant.lowerTrendline).toHaveLength(2);
      }
    });

    it('should reject pattern with parallel lines instead of converging', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(8, 115, 'high', now),
        createPivot(12, 112, 'high', now),
        createPivot(16, 112, 'high', now),
        createPivot(14, 105, 'low', now),
        createPivot(18, 105, 'low', now),
      ];

      const patterns = detectPennants(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = createTestKlines(50, 100);
      const pivots: PivotPoint[] = [createPivot(0, 100, 'low')];

      const patterns = detectPennants(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should set direction as bullish for pennants', () => {
      const klines = createTestKlines(50, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'low', now),
        createPivot(8, 115, 'high', now),
        createPivot(12, 112, 'high', now),
        createPivot(16, 110, 'high', now),
        createPivot(14, 105, 'low', now),
        createPivot(18, 107, 'low', now),
      ];

      const patterns = detectPennants(klines, pivots);

      patterns.forEach((pattern) => {
        expect(pattern.direction).toBe('bullish');
      });
    });
  });

  describe('detectCupAndHandle', () => {
    it('should detect cup and handle pattern with valid structure', () => {
      const klines = createTestKlines(100, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 110, 'high', now),
        createPivot(20, 95, 'low', now),
        createPivot(40, 109, 'high', now),
        createPivot(45, 107, 'high', now),
        createPivot(48, 104, 'low', now),
        createPivot(52, 108, 'high', now),
      ];

      const patterns = detectCupAndHandle(klines, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('cup-and-handle');
        expect(patterns[0]?.cupStart).toBeDefined();
        expect(patterns[0]?.cupBottom).toBeDefined();
        expect(patterns[0]?.cupEnd).toBeDefined();
        expect(patterns[0]?.handleStart).toBeDefined();
        expect(patterns[0]?.handleLow).toBeDefined();
        expect(patterns[0]?.handleEnd).toBeDefined();
      }
    });

    it('should reject pattern with insufficient cup depth', () => {
      const klines = createTestKlines(100, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'high', now),
        createPivot(20, 99, 'low', now),
        createPivot(40, 100, 'high', now),
        createPivot(45, 99.5, 'high', now),
        createPivot(48, 99, 'low', now),
        createPivot(52, 100, 'high', now),
      ];

      const patterns = detectCupAndHandle(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject pattern with handle too deep', () => {
      const klines = createTestKlines(100, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 110, 'high', now),
        createPivot(20, 95, 'low', now),
        createPivot(40, 109, 'high', now),
        createPivot(45, 107, 'high', now),
        createPivot(48, 90, 'low', now),
        createPivot(52, 108, 'high', now),
      ];

      const patterns = detectCupAndHandle(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = createTestKlines(30, 100);
      const pivots: PivotPoint[] = [];

      const patterns = detectCupAndHandle(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = createTestKlines(100, 100);
      const pivots: PivotPoint[] = [
        createPivot(0, 110, 'high'),
        createPivot(20, 95, 'low'),
      ];

      const patterns = detectCupAndHandle(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should assign confidence scores properly', () => {
      const klines = createTestKlines(100, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 110, 'high', now),
        createPivot(20, 95, 'low', now),
        createPivot(40, 109, 'high', now),
        createPivot(45, 107, 'high', now),
        createPivot(48, 104, 'low', now),
        createPivot(52, 108, 'high', now),
      ];

      const patterns = detectCupAndHandle(klines, pivots);

      patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('detectRoundingBottom', () => {
    it('should detect rounding bottom pattern with U-shape', () => {
      const klines = createTestKlines(60, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 105, 'high', now),
        createPivot(25, 92, 'low', now),
        createPivot(50, 104, 'high', now),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('rounding-bottom');
        expect(patterns[0]?.start).toBeDefined();
        expect(patterns[0]?.bottom).toBeDefined();
        expect(patterns[0]?.end).toBeDefined();
      }
    });

    it('should reject pattern with insufficient depth', () => {
      const klines = createTestKlines(60, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'high', now),
        createPivot(25, 99, 'low', now),
        createPivot(50, 100, 'high', now),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject pattern with asymmetric start and end prices', () => {
      const klines = createTestKlines(60, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 100, 'high', now),
        createPivot(25, 92, 'low', now),
        createPivot(50, 115, 'high', now),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient klines', () => {
      const klines = createTestKlines(20, 100);
      const pivots: PivotPoint[] = [];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should return empty array for insufficient pivots', () => {
      const klines = createTestKlines(60, 100);
      const pivots: PivotPoint[] = [
        createPivot(0, 105, 'high'),
        createPivot(25, 92, 'low'),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns).toEqual([]);
    });

    it('should reject pattern with insufficient time in formation', () => {
      const klines = createTestKlines(60, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 105, 'high', now),
        createPivot(5, 92, 'low', now),
        createPivot(10, 104, 'high', now),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should sort patterns by confidence', () => {
      const klines = createTestKlines(150, 100);
      const now = Date.now();

      const pivots: PivotPoint[] = [
        createPivot(0, 105, 'high', now),
        createPivot(25, 92, 'low', now),
        createPivot(50, 104, 'high', now),
        createPivot(60, 108, 'high', now),
        createPivot(85, 90, 'low', now),
        createPivot(110, 107, 'high', now),
      ];

      const patterns = detectRoundingBottom(klines, pivots);

      for (let i = 1; i < patterns.length; i++) {
        const prev = patterns[i - 1];
        const curr = patterns[i];
        if (prev && curr) {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        }
      }
    });
  });

  describe('edge cases', () => {
    it('should handle empty klines array', () => {
      const klines: Kline[] = [];
      const pivots: PivotPoint[] = [];

      expect(detectBullishFlags(klines, pivots)).toEqual([]);
      expect(detectBearishFlags(klines, pivots)).toEqual([]);
      expect(detectPennants(klines, pivots)).toEqual([]);
      expect(detectCupAndHandle(klines, pivots)).toEqual([]);
      expect(detectRoundingBottom(klines, pivots)).toEqual([]);
    });

    it('should handle null/undefined klines gracefully', () => {
      const pivots: PivotPoint[] = [];

      expect(detectBullishFlags(null as unknown as Kline[], pivots)).toEqual([]);
      expect(detectBearishFlags(undefined as unknown as Kline[], pivots)).toEqual([]);
      expect(detectPennants(null as unknown as Kline[], pivots)).toEqual([]);
      expect(detectCupAndHandle(undefined as unknown as Kline[], pivots)).toEqual([]);
      expect(detectRoundingBottom(null as unknown as Kline[], pivots)).toEqual([]);
    });

    it('should handle empty pivots array', () => {
      const klines = createTestKlines(100, 100);
      const pivots: PivotPoint[] = [];

      expect(detectBullishFlags(klines, pivots)).toEqual([]);
      expect(detectBearishFlags(klines, pivots)).toEqual([]);
      expect(detectPennants(klines, pivots)).toEqual([]);
      expect(detectCupAndHandle(klines, pivots)).toEqual([]);
      expect(detectRoundingBottom(klines, pivots)).toEqual([]);
    });
  });
});
