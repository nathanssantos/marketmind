import { describe, it, expect } from 'vitest';
import {
  calculateStandardPivots,
  calculateFibonacciPivots,
  calculateWoodiePivots,
  calculateCamarillaPivots,
  calculateDemarkPivots,
  calculateFloorPivots,
  calculateFloorPivotSeries,
  type FloorPivotInput,
} from './floorPivots';

describe('Floor Trader Pivot Points', () => {
  const testInput: FloorPivotInput = {
    high: 110,
    low: 90,
    close: 105,
    open: 95,
  };

  describe('calculateStandardPivots', () => {
    it('should calculate standard pivot correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.pivot).toBeCloseTo(101.67, 2);
    });

    it('should calculate R1 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.r1).toBeCloseTo(113.33, 2);
    });

    it('should calculate S1 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.s1).toBeCloseTo(93.33, 2);
    });

    it('should calculate R2 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.r2).toBeCloseTo(121.67, 2);
    });

    it('should calculate S2 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.s2).toBeCloseTo(81.67, 2);
    });

    it('should calculate R3 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.r3).toBeCloseTo(133.33, 2);
    });

    it('should calculate S3 correctly', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.s3).toBeCloseTo(73.33, 2);
    });

    it('should maintain proper level ordering', () => {
      const result = calculateStandardPivots(testInput);
      expect(result.s3).toBeLessThan(result.s2);
      expect(result.s2).toBeLessThan(result.s1);
      expect(result.s1).toBeLessThan(result.pivot);
      expect(result.pivot).toBeLessThan(result.r1);
      expect(result.r1).toBeLessThan(result.r2);
      expect(result.r2).toBeLessThan(result.r3);
    });
  });

  describe('calculateFibonacciPivots', () => {
    it('should calculate pivot same as standard', () => {
      const result = calculateFibonacciPivots(testInput);
      const standard = calculateStandardPivots(testInput);
      expect(result.pivot).toBeCloseTo(standard.pivot, 2);
    });

    it('should use Fibonacci ratios for R1/S1', () => {
      const result = calculateFibonacciPivots(testInput);
      const range = testInput.high - testInput.low;
      expect(result.r1).toBeCloseTo(result.pivot + 0.382 * range, 2);
      expect(result.s1).toBeCloseTo(result.pivot - 0.382 * range, 2);
    });

    it('should use Fibonacci ratios for R2/S2', () => {
      const result = calculateFibonacciPivots(testInput);
      const range = testInput.high - testInput.low;
      expect(result.r2).toBeCloseTo(result.pivot + 0.618 * range, 2);
      expect(result.s2).toBeCloseTo(result.pivot - 0.618 * range, 2);
    });

    it('should use full range for R3/S3', () => {
      const result = calculateFibonacciPivots(testInput);
      const range = testInput.high - testInput.low;
      expect(result.r3).toBeCloseTo(result.pivot + range, 2);
      expect(result.s3).toBeCloseTo(result.pivot - range, 2);
    });
  });

  describe('calculateWoodiePivots', () => {
    it('should weight close more heavily in pivot', () => {
      const result = calculateWoodiePivots(testInput);
      expect(result.pivot).toBeCloseTo(102.5, 2);
    });

    it('should calculate R1 and S1', () => {
      const result = calculateWoodiePivots(testInput);
      expect(result.r1).toBeCloseTo(115, 2);
      expect(result.s1).toBeCloseTo(95, 2);
    });

    it('should give higher pivot when close is high', () => {
      const highClose: FloorPivotInput = { high: 110, low: 90, close: 108 };
      const lowClose: FloorPivotInput = { high: 110, low: 90, close: 92 };

      const highResult = calculateWoodiePivots(highClose);
      const lowResult = calculateWoodiePivots(lowClose);

      expect(highResult.pivot).toBeGreaterThan(lowResult.pivot);
    });
  });

  describe('calculateCamarillaPivots', () => {
    it('should calculate pivot using standard formula', () => {
      const result = calculateCamarillaPivots(testInput);
      expect(result.pivot).toBeCloseTo(101.67, 2);
    });

    it('should calculate tight levels around close', () => {
      const result = calculateCamarillaPivots(testInput);
      const range = testInput.high - testInput.low;

      expect(result.r1).toBeCloseTo(testInput.close + range * 1.1 / 12, 2);
      expect(result.s1).toBeCloseTo(testInput.close - range * 1.1 / 12, 2);
    });

    it('should have R3/S3 as widest levels', () => {
      const result = calculateCamarillaPivots(testInput);

      expect(Math.abs(result.r3 - testInput.close)).toBeGreaterThan(
        Math.abs(result.r2 - testInput.close)
      );
      expect(Math.abs(result.s3 - testInput.close)).toBeGreaterThan(
        Math.abs(result.s2 - testInput.close)
      );
    });
  });

  describe('calculateDemarkPivots', () => {
    it('should use different formula when close < open', () => {
      const bearish: FloorPivotInput = { high: 110, low: 90, close: 92, open: 108 };
      const result = calculateDemarkPivots(bearish);
      const x = bearish.high + 2 * bearish.low + bearish.close;
      expect(result.pivot).toBeCloseTo(x / 4, 2);
    });

    it('should use different formula when close > open', () => {
      const bullish: FloorPivotInput = { high: 110, low: 90, close: 108, open: 92 };
      const result = calculateDemarkPivots(bullish);
      const x = 2 * bullish.high + bullish.low + bullish.close;
      expect(result.pivot).toBeCloseTo(x / 4, 2);
    });

    it('should use neutral formula when close == open', () => {
      const neutral: FloorPivotInput = { high: 110, low: 90, close: 100, open: 100 };
      const result = calculateDemarkPivots(neutral);
      const x = neutral.high + neutral.low + 2 * neutral.close;
      expect(result.pivot).toBeCloseTo(x / 4, 2);
    });

    it('should default open to close if not provided', () => {
      const noOpen: FloorPivotInput = { high: 110, low: 90, close: 100 };
      const result = calculateDemarkPivots(noOpen);
      const x = noOpen.high + noOpen.low + 2 * noOpen.close;
      expect(result.pivot).toBeCloseTo(x / 4, 2);
    });
  });

  describe('calculateFloorPivots', () => {
    it('should default to standard pivots', () => {
      const result = calculateFloorPivots(testInput);
      const standard = calculateStandardPivots(testInput);
      expect(result.pivot).toBeCloseTo(standard.pivot, 2);
    });

    it('should return fibonacci pivots when specified', () => {
      const result = calculateFloorPivots(testInput, 'fibonacci');
      const fibonacci = calculateFibonacciPivots(testInput);
      expect(result.r1).toBeCloseTo(fibonacci.r1, 2);
    });

    it('should return woodie pivots when specified', () => {
      const result = calculateFloorPivots(testInput, 'woodie');
      const woodie = calculateWoodiePivots(testInput);
      expect(result.pivot).toBeCloseTo(woodie.pivot, 2);
    });

    it('should return camarilla pivots when specified', () => {
      const result = calculateFloorPivots(testInput, 'camarilla');
      const camarilla = calculateCamarillaPivots(testInput);
      expect(result.r1).toBeCloseTo(camarilla.r1, 2);
    });

    it('should return demark pivots when specified', () => {
      const result = calculateFloorPivots(testInput, 'demark');
      const demark = calculateDemarkPivots(testInput);
      expect(result.pivot).toBeCloseTo(demark.pivot, 2);
    });
  });

  describe('calculateFloorPivotSeries', () => {
    const highs = [100, 110, 105, 115, 120];
    const lows = [90, 95, 92, 100, 105];
    const closes = [95, 105, 98, 112, 115];
    const opens = [92, 98, 104, 100, 110];

    it('should return null for first element', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes);
      expect(result.pivot[0]).toBeNull();
      expect(result.r1[0]).toBeNull();
      expect(result.s1[0]).toBeNull();
    });

    it('should calculate pivots based on previous bar', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes);
      const expected = calculateStandardPivots({ high: highs[0]!, low: lows[0]!, close: closes[0]! });
      expect(result.pivot[1]).toBeCloseTo(expected.pivot, 2);
    });

    it('should return arrays of same length as input', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes);
      expect(result.pivot.length).toBe(highs.length);
      expect(result.r1.length).toBe(highs.length);
      expect(result.s1.length).toBe(highs.length);
    });

    it('should support fibonacci type', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes, undefined, 'fibonacci');
      const expected = calculateFibonacciPivots({ high: highs[0]!, low: lows[0]!, close: closes[0]! });
      expect(result.r1[1]).toBeCloseTo(expected.r1, 2);
    });

    it('should support woodie type', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes, undefined, 'woodie');
      const expected = calculateWoodiePivots({ high: highs[0]!, low: lows[0]!, close: closes[0]! });
      expect(result.pivot[1]).toBeCloseTo(expected.pivot, 2);
    });

    it('should use opens for demark type', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes, opens, 'demark');
      const expected = calculateDemarkPivots({
        high: highs[0]!, low: lows[0]!, close: closes[0]!, open: opens[0]!
      });
      expect(result.pivot[1]).toBeCloseTo(expected.pivot, 2);
    });

    it('should handle empty arrays', () => {
      const result = calculateFloorPivotSeries([], [], []);
      expect(result.pivot).toEqual([]);
      expect(result.r1).toEqual([]);
    });

    it('should calculate all levels for each bar', () => {
      const result = calculateFloorPivotSeries(highs, lows, closes);

      for (let i = 1; i < highs.length; i++) {
        expect(result.pivot[i]).not.toBeNull();
        expect(result.r1[i]).not.toBeNull();
        expect(result.r2[i]).not.toBeNull();
        expect(result.r3[i]).not.toBeNull();
        expect(result.s1[i]).not.toBeNull();
        expect(result.s2[i]).not.toBeNull();
        expect(result.s3[i]).not.toBeNull();
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero range (doji candle)', () => {
      const doji: FloorPivotInput = { high: 100, low: 100, close: 100 };
      const result = calculateStandardPivots(doji);

      expect(result.pivot).toBe(100);
      expect(result.r1).toBe(100);
      expect(result.s1).toBe(100);
    });

    it('should handle very large values', () => {
      const large: FloorPivotInput = { high: 1000000, low: 900000, close: 950000 };
      const result = calculateStandardPivots(large);

      expect(result.pivot).toBeCloseTo(950000, 0);
      expect(result.r1).toBeGreaterThan(result.pivot);
      expect(result.s1).toBeLessThan(result.pivot);
    });

    it('should handle very small values', () => {
      const small: FloorPivotInput = { high: 0.0001, low: 0.00005, close: 0.00008 };
      const result = calculateStandardPivots(small);

      expect(result.pivot).toBeGreaterThan(0);
      expect(result.r1).toBeGreaterThan(result.pivot);
      expect(result.s1).toBeLessThan(result.pivot);
    });
  });
});
