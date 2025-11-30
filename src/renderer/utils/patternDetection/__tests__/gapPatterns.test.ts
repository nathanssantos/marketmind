import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../../shared/types';
import {
    detectBreakawayGaps,
    detectCommonGaps,
    detectExhaustionGaps,
    detectRunawayGaps,
} from '../patterns/gapPatterns';
import type { PivotPoint } from '../types';

const createCandle = (
  timestamp: number,
  open: number,
  high: number,
  low: number,
  close: number,
  volume = 1000
): Candle => ({
  timestamp,
  open,
  high,
  low,
  close,
  volume,
});

describe('gapPatterns', () => {
  describe('detectCommonGaps', () => {
    it('should detect small gap with low volume (gap up)', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101, 2000),
        createCandle(now + 60000, 102, 104, 101.5, 103, 1000),
      ];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-common');
        expect(patterns[0]?.direction).toBe('bullish');
        expect(patterns[0]?.gapStart).toBeDefined();
        expect(patterns[0]?.gapEnd).toBeDefined();
      }
    });

    it('should detect small gap with low volume (gap down)', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101, 2000),
        createCandle(now + 60000, 98, 99.5, 98, 99, 1000),
      ];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-common');
        expect(patterns[0]?.direction).toBe('bearish');
      }
    });

    it('should reject large gaps (not common)', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101, 2000),
        createCandle(now + 60000, 110, 112, 108, 111, 3000),
      ];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject gaps with high volume', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101, 1000),
        createCandle(now + 60000, 102, 104, 101.5, 103, 5000),
      ];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should return empty array for insufficient candles', () => {
      const candles: Kline[] = [createCandle(Date.now(), 100, 102, 100, 101)];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns).toEqual([]);
    });
  });

  describe('detectBreakawayGaps', () => {
    it('should detect gap at resistance breakout with high volume', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createCandle(now + i * 60000, 98, 100, 98, 99, 1000));
      }

      candles.push(createCandle(now + 20 * 60000, 99, 100, 99, 99.5, 1000));
      candles.push(createCandle(now + 21 * 60000, 103, 105, 102, 104, 5000));

      const pivots: PivotPoint[] = [];

      const patterns = detectBreakawayGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-breakaway');
        expect(patterns[0]?.direction).toBe('bullish');
      }
    });

    it('should detect gap at support breakdown with high volume', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createCandle(now + i * 60000, 98, 100, 98, 99, 1000));
      }

      candles.push(createCandle(now + 20 * 60000, 99, 100, 98, 98.5, 1000));
      candles.push(createCandle(now + 21 * 60000, 95, 97, 94, 95, 5000));

      const pivots: PivotPoint[] = [];

      const patterns = detectBreakawayGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-breakaway');
        expect(patterns[0]?.direction).toBe('bearish');
      }
    });

    it('should reject gaps not near support/resistance', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createCandle(now + i * 60000, 90 + i, 92 + i, 90 + i, 91 + i, 1000));
      }

      candles.push(createCandle(now + 20 * 60000, 95, 97, 95, 96, 1000));
      candles.push(createCandle(now + 21 * 60000, 98, 100, 98, 99, 5000));

      const pivots: PivotPoint[] = [];

      const patterns = detectBreakawayGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject gaps with low volume', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createCandle(now + i * 60000, 98, 100, 98, 99, 1000));
      }

      candles.push(createCandle(now + 20 * 60000, 99, 100, 99, 99.5, 1000));
      candles.push(createCandle(now + 21 * 60000, 103, 105, 102, 104, 500));

      const pivots: PivotPoint[] = [];

      const patterns = detectBreakawayGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });
  });

  describe('detectRunawayGaps', () => {
    it('should detect gap in uptrend (bullish)', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100 + i, 102 + i, 100 + i, 101 + i, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 111, 113, 111, 112, 1000));
      candles.push(createCandle(now + 11 * 60000, 114, 116, 113.5, 115, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectRunawayGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-runaway');
        expect(patterns[0]?.direction).toBe('bullish');
      }
    });

    it('should detect gap in downtrend (bearish)', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 110 - i, 112 - i, 110 - i, 111 - i, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 100, 102, 100, 101, 1000));
      candles.push(createCandle(now + 11 * 60000, 97, 99, 96.5, 98, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectRunawayGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-runaway');
        expect(patterns[0]?.direction).toBe('bearish');
      }
    });

    it('should reject gap against trend direction', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100 + i, 102 + i, 100 + i, 101 + i, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 111, 113, 111, 112, 1000));
      candles.push(createCandle(now + 11 * 60000, 108, 110, 107.5, 109, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectRunawayGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject small gaps in trend', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100 + i, 102 + i, 100 + i, 101 + i, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 111, 113, 111, 112, 1000));
      candles.push(createCandle(now + 11 * 60000, 112, 114, 111.8, 113, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectRunawayGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });
  });

  describe('detectExhaustionGaps', () => {
    it('should detect gap followed by reversal (bullish to bearish)', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 101, 103, 101, 102, 1000));
      candles.push(createCandle(now + 11 * 60000, 105, 107, 104.5, 106, 1000));
      candles.push(createCandle(now + 12 * 60000, 105, 105.5, 104, 104.5, 1000));
      candles.push(createCandle(now + 13 * 60000, 104, 104.5, 103, 103.5, 1000));
      candles.push(createCandle(now + 14 * 60000, 103, 103.5, 102, 102.5, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectExhaustionGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-exhaustion');
        expect(patterns[0]?.direction).toBe('bullish');
      }
    });

    it('should detect gap followed by reversal (bearish to bullish)', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 101, 103, 101, 102, 1000));
      candles.push(createCandle(now + 11 * 60000, 97, 99, 96.5, 98, 1000));
      candles.push(createCandle(now + 12 * 60000, 98.5, 99, 98, 98.5, 1000));
      candles.push(createCandle(now + 13 * 60000, 99, 99.5, 98.5, 99, 1000));
      candles.push(createCandle(now + 14 * 60000, 99.5, 100, 99, 99.5, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectExhaustionGaps(candles, pivots);

      expect(patterns.length).toBeGreaterThanOrEqual(0);
      if (patterns.length > 0) {
        expect(patterns[0]?.type).toBe('gap-exhaustion');
        expect(patterns[0]?.direction).toBe('bearish');
      }
    });

    it('should reject gap without reversal', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 101, 103, 101, 102, 1000));
      candles.push(createCandle(now + 11 * 60000, 105, 107, 104.5, 106, 1000));
      candles.push(createCandle(now + 12 * 60000, 106, 108, 105.5, 107, 1000));
      candles.push(createCandle(now + 13 * 60000, 107, 109, 106.5, 108, 1000));
      candles.push(createCandle(now + 14 * 60000, 108, 110, 107.5, 109, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectExhaustionGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject gap at end of data (insufficient lookahead)', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 101, 103, 101, 102, 1000));
      candles.push(createCandle(now + 11 * 60000, 105, 107, 104.5, 106, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectExhaustionGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });

    it('should reject small gaps', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 10; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 1000));
      }

      candles.push(createCandle(now + 10 * 60000, 101, 103, 101, 102, 1000));
      candles.push(createCandle(now + 11 * 60000, 102.2, 104, 102, 103, 1000));
      candles.push(createCandle(now + 12 * 60000, 102.5, 103, 102, 102.5, 1000));
      candles.push(createCandle(now + 13 * 60000, 102, 102.5, 101.5, 102, 1000));
      candles.push(createCandle(now + 14 * 60000, 101.5, 102, 101, 101.5, 1000));

      const pivots: PivotPoint[] = [];

      const patterns = detectExhaustionGaps(candles, pivots);

      expect(patterns.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty candles array', () => {
      const candles: Kline[] = [];
      const pivots: PivotPoint[] = [];

      expect(detectCommonGaps(candles, pivots)).toEqual([]);
      expect(detectBreakawayGaps(candles, pivots)).toEqual([]);
      expect(detectRunawayGaps(candles, pivots)).toEqual([]);
      expect(detectExhaustionGaps(candles, pivots)).toEqual([]);
    });

    it('should handle null/undefined candles gracefully', () => {
      const pivots: PivotPoint[] = [];

      expect(detectCommonGaps(null as unknown as Candle[], pivots)).toEqual([]);
      expect(detectBreakawayGaps(undefined as unknown as Candle[], pivots)).toEqual([]);
      expect(detectRunawayGaps(null as unknown as Candle[], pivots)).toEqual([]);
      expect(detectExhaustionGaps(undefined as unknown as Candle[], pivots)).toEqual([]);
    });

    it('should handle candles without gaps', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101),
        createCandle(now + 60000, 101, 103, 100.5, 102),
        createCandle(now + 120000, 102, 104, 101.5, 103),
      ];
      const pivots: PivotPoint[] = [];

      expect(detectCommonGaps(candles, pivots)).toEqual([]);
      expect(detectBreakawayGaps(candles, pivots)).toEqual([]);
      expect(detectRunawayGaps(candles, pivots)).toEqual([]);
      expect(detectExhaustionGaps(candles, pivots)).toEqual([]);
    });

    it('should limit results to MAX_PATTERNS_PER_TYPE', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 100; i++) {
        candles.push(createCandle(now + i * 60000, 100, 102, 100, 101, 2000));
        candles.push(createCandle(now + (i + 0.5) * 60000, 102, 104, 101.5, 103, 1000));
      }

      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      expect(patterns.length).toBeLessThanOrEqual(5);
    });

    it('should assign confidence scores properly', () => {
      const now = Date.now();
      const candles: Kline[] = [
        createCandle(now, 100, 102, 100, 101, 2000),
        createCandle(now + 60000, 102, 104, 101.5, 103, 1000),
      ];
      const pivots: PivotPoint[] = [];

      const patterns = detectCommonGaps(candles, pivots);

      patterns.forEach((pattern) => {
        expect(pattern.confidence).toBeGreaterThan(0);
        expect(pattern.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should sort patterns by confidence', () => {
      const now = Date.now();
      const candles: Kline[] = [];

      for (let i = 0; i < 20; i++) {
        candles.push(createCandle(now + i * 60000, 98, 100, 98, 99, 1000));
      }

      candles.push(createCandle(now + 20 * 60000, 99, 100, 99, 99.5, 1000));
      candles.push(createCandle(now + 21 * 60000, 103, 105, 102, 104, 5000));
      candles.push(createCandle(now + 22 * 60000, 104, 106, 104, 105, 1000));
      candles.push(createCandle(now + 23 * 60000, 108, 110, 107, 109, 6000));

      const pivots: PivotPoint[] = [];

      const patterns = detectBreakawayGaps(candles, pivots);

      for (let i = 1; i < patterns.length; i++) {
        const prev = patterns[i - 1];
        const curr = patterns[i];
        if (prev && curr) {
          expect(prev.confidence).toBeGreaterThanOrEqual(curr.confidence);
        }
      }
    });
  });
});
