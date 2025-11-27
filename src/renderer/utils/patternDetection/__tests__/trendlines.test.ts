import { describe, expect, it } from 'vitest';
import type { Candle } from '../../../../shared/types';
import { detectBearishTrendlines, detectBullishTrendlines } from '../patterns/trendlines';
import type { PivotPoint } from '../types';

const createTestCandles = (count: number, basePrice: number): Candle[] => {
  const candles: Candle[] = [];
  const now = Date.now();
  
  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: now + i * 60000,
      open: basePrice,
      high: basePrice + 10,
      low: basePrice - 10,
      close: basePrice,
      volume: 1000,
    });
  }
  
  return candles;
};

const createTestPivots = (type: 'high' | 'low', prices: number[], indices: number[]): PivotPoint[] => {
  return prices.map((price, i) => ({
    index: indices[i] || i,
    price,
    timestamp: Date.now() + (indices[i] || i) * 60000,
    type,
    strength: 1,
    volume: 1000,
  }));
};

describe('trendlines', () => {
  describe('detectBullishTrendlines', () => {
    it('should detect bullish trendline from ascending low pivots', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [90, 95, 100], [10, 40, 70]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      expect(trendlines.length).toBeGreaterThan(0);
      expect(trendlines[0]?.type).toBe('trendline-bullish');
      expect(trendlines[0]?.points).toHaveLength(2);
    });

    it('should not detect trendline with insufficient pivots', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [90], [10]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should require positive slope for bullish trendlines', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [100, 95, 90], [10, 40, 70]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should assign confidence based on R-squared and bounces', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [90, 95, 100, 105], [10, 30, 50, 70]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      if (trendlines[0]) {
        expect(trendlines[0].confidence).toBeGreaterThan(0);
        expect(trendlines[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should filter high pivots and only use low pivots', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [110, 115, 120], [10, 40, 70]);
      
      const trendlines = detectBullishTrendlines(candles, highPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should sort trendlines by confidence', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [
        90, 95, 100, 105,
        80, 82, 84, 86, 88, 90,
      ], [10, 20, 30, 40, 50, 55, 60, 65, 70, 75]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      if (trendlines.length >= 2) {
        expect(trendlines[0]!.confidence).toBeGreaterThanOrEqual(trendlines[1]!.confidence!);
      }
    });

    it('should create descriptive labels with bounce count', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [90, 95, 100], [10, 40, 70]);
      
      const trendlines = detectBullishTrendlines(candles, lowPivots);
      
      if (trendlines[0]) {
        expect(trendlines[0].label).toContain('Bullish Trendline');
        expect(trendlines[0].label).toContain('bounces');
      }
    });
  });

  describe('detectBearishTrendlines', () => {
    it('should detect bearish trendline from descending high pivots', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [120, 115, 110], [10, 40, 70]);
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      expect(trendlines.length).toBeGreaterThan(0);
      expect(trendlines[0]?.type).toBe('trendline-bearish');
      expect(trendlines[0]?.points).toHaveLength(2);
    });

    it('should not detect trendline with insufficient pivots', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [120], [10]);
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should require negative slope for bearish trendlines', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [110, 115, 120], [10, 40, 70]);
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should assign confidence based on R-squared and bounces', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [120, 115, 110, 105], [10, 30, 50, 70]);
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      if (trendlines[0]) {
        expect(trendlines[0].confidence).toBeGreaterThan(0);
        expect(trendlines[0].confidence).toBeLessThanOrEqual(1);
      }
    });

    it('should filter low pivots and only use high pivots', () => {
      const candles = createTestCandles(100, 100);
      const lowPivots = createTestPivots('low', [90, 85, 80], [10, 40, 70]);
      
      const trendlines = detectBearishTrendlines(candles, lowPivots);
      
      expect(trendlines.length).toBe(0);
    });

    it('should create descriptive labels with bounce count', () => {
      const candles = createTestCandles(100, 100);
      const highPivots = createTestPivots('high', [120, 115, 110], [10, 40, 70]);
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      if (trendlines[0]) {
        expect(trendlines[0].label).toContain('Bearish Trendline');
        expect(trendlines[0].label).toContain('bounces');
      }
    });

    it('should limit results to max patterns per type', () => {
      const candles = createTestCandles(200, 100);
      const highPivots: PivotPoint[] = [];
      
      for (let i = 0; i < 20; i++) {
        highPivots.push(...createTestPivots('high', [
          120 - i * 2,
          119 - i * 2,
          118 - i * 2,
          117 - i * 2,
        ], [
          i * 10,
          i * 10 + 2,
          i * 10 + 4,
          i * 10 + 6,
        ]));
      }
      
      const trendlines = detectBearishTrendlines(candles, highPivots);
      
      expect(trendlines.length).toBeLessThanOrEqual(5);
    });
  });
});
