import { describe, it, expect, vi } from 'vitest';
import type { FibonacciProjectionData } from '@marketmind/types';

vi.mock('../../constants', () => ({
  TRAILING_STOP: {
    PEAK_PROFIT_FLOOR: 0.3,
    PEAK_PROFIT_FLOOR_LONG: 0.25,
    PEAK_PROFIT_FLOOR_SHORT: 0.35,
    TP_PROGRESS_THRESHOLD_LONG: 0.886,
    TP_PROGRESS_THRESHOLD_SHORT: 0.786,
  },
}));

import {
  calculateProfitPercent,
  calculateProgressiveFloor,
  calculateATRTrailingStop,
  findBestSwingStop,
  getFibonacciLevelPrice,
  calculateFibonacciPriceAtLevel,
  hasReachedFibonacciLevel,
  calculateTPProgress,
  getImpliedTakeProfit,
  interpolateActivationPrice,
  hasReachedTPProgressThreshold,
  shouldUpdateStopLoss,
  computeTrailingStopCore,
  type TrailingStopCoreInput,
  type TrailingStopCoreConfig,
} from '../trailing-stop-core';

const makeFibProjection = (
  swingLow: number,
  swingHigh: number,
  levels: Array<{ level: number; price: number; label: string }> = []
): FibonacciProjectionData => ({
  swingLow: { price: swingLow, index: 0, timestamp: 1000 },
  swingHigh: { price: swingHigh, index: 10, timestamp: 2000 },
  levels,
  range: Math.abs(swingHigh - swingLow),
  primaryLevel: 1.618,
});

describe('trailing-stop-core', () => {
  describe('calculateProfitPercent', () => {
    it('should return positive profit for LONG when price rises', () => {
      expect(calculateProfitPercent(100, 110, true)).toBe(0.1);
    });

    it('should return negative profit for LONG when price drops', () => {
      expect(calculateProfitPercent(100, 90, true)).toBe(-0.1);
    });

    it('should return positive profit for SHORT when price drops', () => {
      expect(calculateProfitPercent(100, 90, false)).toBe(0.1);
    });

    it('should return negative profit for SHORT when price rises', () => {
      expect(calculateProfitPercent(100, 110, false)).toBe(-0.1);
    });

    it('should return 0 when current price equals entry price', () => {
      expect(calculateProfitPercent(100, 100, true)).toBe(0);
      expect(calculateProfitPercent(100, 100, false)).toBe(0);
    });

    it('should handle small price changes', () => {
      expect(calculateProfitPercent(50000, 50025, true)).toBeCloseTo(0.0005, 6);
    });
  });

  describe('calculateProgressiveFloor', () => {
    it('should return progressive stop for LONG with profit', () => {
      const result = calculateProgressiveFloor(100, 120, undefined, true, 0.3);
      expect(result).not.toBeNull();
      const peakProfit = (120 - 100) / 100;
      const floorProfit = peakProfit * (1 - 0.3);
      expect(result).toBeCloseTo(100 * (1 + floorProfit), 6);
    });

    it('should return progressive stop for SHORT with profit', () => {
      const result = calculateProgressiveFloor(100, undefined, 80, false, 0.3);
      expect(result).not.toBeNull();
      const peakProfit = (100 - 80) / 100;
      const floorProfit = peakProfit * (1 - 0.3);
      expect(result).toBeCloseTo(100 * (1 - floorProfit), 6);
    });

    it('should return null for LONG when highestPrice is undefined', () => {
      expect(calculateProgressiveFloor(100, undefined, undefined, true, 0.3)).toBeNull();
    });

    it('should return null for SHORT when lowestPrice is undefined', () => {
      expect(calculateProgressiveFloor(100, undefined, undefined, false, 0.3)).toBeNull();
    });

    it('should return null for LONG when highestPrice <= entryPrice', () => {
      expect(calculateProgressiveFloor(100, 100, undefined, true, 0.3)).toBeNull();
      expect(calculateProgressiveFloor(100, 99, undefined, true, 0.3)).toBeNull();
    });

    it('should return null for SHORT when lowestPrice >= entryPrice', () => {
      expect(calculateProgressiveFloor(100, undefined, 100, false, 0.3)).toBeNull();
      expect(calculateProgressiveFloor(100, undefined, 101, false, 0.3)).toBeNull();
    });

    it('should use default trailing distance when not provided', () => {
      const result = calculateProgressiveFloor(100, 110, undefined, true);
      expect(result).not.toBeNull();
      const peakProfit = (110 - 100) / 100;
      const floorProfit = peakProfit * (1 - 0.3);
      expect(result).toBeCloseTo(100 * (1 + floorProfit), 6);
    });
  });

  describe('calculateATRTrailingStop', () => {
    it('should subtract ATR distance for LONG', () => {
      expect(calculateATRTrailingStop(110, 5, true, 2)).toBeCloseTo(100, 6);
    });

    it('should add ATR distance for SHORT', () => {
      expect(calculateATRTrailingStop(90, 5, false, 2)).toBeCloseTo(100, 6);
    });

    it('should handle atrMultiplier of 1', () => {
      expect(calculateATRTrailingStop(100, 3, true, 1)).toBeCloseTo(97, 6);
      expect(calculateATRTrailingStop(100, 3, false, 1)).toBeCloseTo(103, 6);
    });

    it('should handle zero ATR', () => {
      expect(calculateATRTrailingStop(100, 0, true, 2)).toBe(100);
      expect(calculateATRTrailingStop(100, 0, false, 2)).toBe(100);
    });
  });

  describe('findBestSwingStop', () => {
    it('should find best swing low for LONG above entry and below current price', () => {
      const swingPoints = [
        { price: 95, type: 'low' as const },
        { price: 105, type: 'low' as const },
        { price: 108, type: 'low' as const },
      ];
      const result = findBestSwingStop(swingPoints, 115, 100, true, 0.002);
      expect(result).not.toBeNull();
      const expectedBuffer = 108 * 0.002;
      expect(result).toBeCloseTo(108 - expectedBuffer, 6);
    });

    it('should find best swing high for SHORT below entry and above current price', () => {
      const swingPoints = [
        { price: 105, type: 'high' as const },
        { price: 95, type: 'high' as const },
        { price: 92, type: 'high' as const },
      ];
      const result = findBestSwingStop(swingPoints, 85, 100, false, 0.002);
      expect(result).not.toBeNull();
      const expectedBuffer = 92 * 0.002;
      expect(result).toBeCloseTo(92 + expectedBuffer, 6);
    });

    it('should return null when no valid swing lows for LONG', () => {
      const swingPoints = [
        { price: 90, type: 'low' as const },
        { price: 95, type: 'low' as const },
      ];
      expect(findBestSwingStop(swingPoints, 115, 100, true, 0.002)).toBeNull();
    });

    it('should return null when no valid swing highs for SHORT', () => {
      const swingPoints = [
        { price: 110, type: 'high' as const },
        { price: 115, type: 'high' as const },
      ];
      expect(findBestSwingStop(swingPoints, 85, 100, false, 0.002)).toBeNull();
    });

    it('should return null for empty swing points', () => {
      expect(findBestSwingStop([], 115, 100, true, 0.002)).toBeNull();
      expect(findBestSwingStop([], 85, 100, false, 0.002)).toBeNull();
    });

    it('should filter by swing type (ignore highs for LONG)', () => {
      const swingPoints = [
        { price: 105, type: 'high' as const },
        { price: 108, type: 'high' as const },
      ];
      expect(findBestSwingStop(swingPoints, 115, 100, true, 0.002)).toBeNull();
    });

    it('should only use last 5 swing points', () => {
      const swingPoints = [
        { price: 101, type: 'low' as const },
        { price: 102, type: 'low' as const },
        { price: 103, type: 'low' as const },
        { price: 104, type: 'low' as const },
        { price: 105, type: 'low' as const },
        { price: 106, type: 'low' as const },
        { price: 107, type: 'low' as const },
      ];
      const result = findBestSwingStop(swingPoints, 115, 100, true, 0.002);
      expect(result).not.toBeNull();
      const expectedBuffer = 107 * 0.002;
      expect(result).toBeCloseTo(107 - expectedBuffer, 6);
    });
  });

  describe('getFibonacciLevelPrice', () => {
    const fibProjection = makeFibProjection(90, 110, [
      { level: 0.618, price: 102.36, label: '61.8%' },
      { level: 1.0, price: 110, label: '100%' },
      { level: 1.272, price: 115.44, label: '127.2%' },
      { level: 1.618, price: 122.36, label: '161.8%' },
    ]);

    it('should return price for existing level', () => {
      expect(getFibonacciLevelPrice(fibProjection, 1.618)).toBe(122.36);
    });

    it('should return null for non-existing level', () => {
      expect(getFibonacciLevelPrice(fibProjection, 2.0)).toBeNull();
    });

    it('should return null for null projection', () => {
      expect(getFibonacciLevelPrice(null, 1.0)).toBeNull();
    });

    it('should return null for undefined projection', () => {
      expect(getFibonacciLevelPrice(undefined, 1.0)).toBeNull();
    });

    it('should match level within 0.001 tolerance', () => {
      expect(getFibonacciLevelPrice(fibProjection, 1.6179)).toBe(122.36);
      expect(getFibonacciLevelPrice(fibProjection, 1.6181)).toBe(122.36);
    });
  });

  describe('calculateFibonacciPriceAtLevel', () => {
    const fibProjection = makeFibProjection(100, 120);

    it('should calculate price for LONG at level <= 1', () => {
      const result = calculateFibonacciPriceAtLevel(fibProjection, 0.5, true);
      expect(result).toBeCloseTo(110, 6);
    });

    it('should calculate price for LONG at level > 1 (extension)', () => {
      const result = calculateFibonacciPriceAtLevel(fibProjection, 1.5, true);
      expect(result).toBeCloseTo(130, 6);
    });

    it('should calculate price for SHORT at level <= 1', () => {
      const result = calculateFibonacciPriceAtLevel(fibProjection, 0.5, false);
      expect(result).toBeCloseTo(110, 6);
    });

    it('should calculate price for SHORT at level > 1 (extension)', () => {
      const result = calculateFibonacciPriceAtLevel(fibProjection, 1.5, false);
      expect(result).toBeCloseTo(90, 6);
    });

    it('should return null for null projection', () => {
      expect(calculateFibonacciPriceAtLevel(null, 1.0, true)).toBeNull();
    });

    it('should return null when swingLow is missing', () => {
      const partial = { ...fibProjection, swingLow: undefined } as unknown as FibonacciProjectionData;
      expect(calculateFibonacciPriceAtLevel(partial, 1.0, true)).toBeNull();
    });

    it('should return null when range is 0', () => {
      const zeroRange = makeFibProjection(100, 100);
      expect(calculateFibonacciPriceAtLevel(zeroRange, 0.5, true)).toBeNull();
    });
  });

  describe('hasReachedFibonacciLevel', () => {
    const fibProjection = makeFibProjection(100, 120);

    it('should return true for LONG when price is at or above level', () => {
      expect(hasReachedFibonacciLevel(115, fibProjection, 0.5, true)).toBe(true);
      expect(hasReachedFibonacciLevel(110, fibProjection, 0.5, true)).toBe(true);
    });

    it('should return false for LONG when price is below level', () => {
      expect(hasReachedFibonacciLevel(109, fibProjection, 0.5, true)).toBe(false);
    });

    it('should return true for SHORT when price is at or below level', () => {
      expect(hasReachedFibonacciLevel(105, fibProjection, 0.5, false)).toBe(true);
      expect(hasReachedFibonacciLevel(110, fibProjection, 0.5, false)).toBe(true);
    });

    it('should return false for SHORT when price is above level', () => {
      expect(hasReachedFibonacciLevel(111, fibProjection, 0.5, false)).toBe(false);
    });

    it('should return false for null projection', () => {
      expect(hasReachedFibonacciLevel(110, null, 0.5, true)).toBe(false);
    });
  });

  describe('calculateTPProgress', () => {
    it('should return 0.5 at midpoint for LONG', () => {
      expect(calculateTPProgress(100, 110, 120, true)).toBeCloseTo(0.5, 6);
    });

    it('should return 0.5 at midpoint for SHORT', () => {
      expect(calculateTPProgress(100, 90, 80, false)).toBeCloseTo(0.5, 6);
    });

    it('should return 1.0 when at take profit', () => {
      expect(calculateTPProgress(100, 120, 120, true)).toBeCloseTo(1.0, 6);
      expect(calculateTPProgress(100, 80, 80, false)).toBeCloseTo(1.0, 6);
    });

    it('should return 0 when at entry', () => {
      expect(calculateTPProgress(100, 100, 120, true)).toBeCloseTo(0, 6);
      expect(calculateTPProgress(100, 100, 80, false)).toBeCloseTo(0, 6);
    });

    it('should return 0 when totalDistance is 0', () => {
      expect(calculateTPProgress(100, 105, 100, true)).toBe(0);
    });

    it('should clamp to 0 when behind entry (no negative)', () => {
      expect(calculateTPProgress(100, 90, 120, true)).toBe(0);
      expect(calculateTPProgress(100, 110, 80, false)).toBe(0);
    });

    it('should return values above 1.0 when beyond take profit', () => {
      expect(calculateTPProgress(100, 130, 120, true)).toBeCloseTo(1.5, 6);
    });
  });

  describe('getImpliedTakeProfit', () => {
    it('should return price at 1.618 level for LONG', () => {
      const fibProjection = makeFibProjection(100, 120, [
        { level: 1.618, price: 132.36, label: '161.8%' },
      ]);
      expect(getImpliedTakeProfit(fibProjection, true)).toBe(132.36);
    });

    it('should return price at 1.272 level for SHORT', () => {
      const fibProjection = makeFibProjection(100, 120, [
        { level: 1.272, price: 94.56, label: '127.2%' },
      ]);
      expect(getImpliedTakeProfit(fibProjection, false)).toBe(94.56);
    });

    it('should return null when levels array is empty', () => {
      const fibProjection = makeFibProjection(100, 120, []);
      expect(getImpliedTakeProfit(fibProjection, true)).toBeNull();
    });

    it('should return null for null projection', () => {
      expect(getImpliedTakeProfit(null, true)).toBeNull();
    });

    it('should return null when target level is not present', () => {
      const fibProjection = makeFibProjection(100, 120, [
        { level: 0.5, price: 110, label: '50%' },
      ]);
      expect(getImpliedTakeProfit(fibProjection, true)).toBeNull();
    });
  });

  describe('interpolateActivationPrice', () => {
    it('should return exact price when level matches', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.886, price: 117.72, label: '88.6%' },
      ]);
      expect(interpolateActivationPrice(fib, 0.886, true)).toBe(117.72);
    });

    it('should interpolate between two levels', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.786, price: 115.72, label: '78.6%' },
        { level: 1.0, price: 120, label: '100%' },
      ]);
      const result = interpolateActivationPrice(fib, 0.886, true);
      expect(result).not.toBeNull();
      const t = (0.886 - 0.786) / (1.0 - 0.786);
      const expected = 115.72 + t * (120 - 115.72);
      expect(result).toBeCloseTo(expected, 4);
    });

    it('should return lower bound price when activation level is below all levels', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.786, price: 115.72, label: '78.6%' },
        { level: 1.0, price: 120, label: '100%' },
      ]);
      const result = interpolateActivationPrice(fib, 0.5, true);
      expect(result).toBe(115.72);
    });

    it('should return upper bound price when activation level is above all levels', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.786, price: 115.72, label: '78.6%' },
        { level: 1.0, price: 120, label: '100%' },
      ]);
      const result = interpolateActivationPrice(fib, 1.5, true);
      expect(result).toBe(120);
    });

    it('should return null for null projection', () => {
      expect(interpolateActivationPrice(null, 0.886, true)).toBeNull();
    });

    it('should return null for projection with empty levels', () => {
      const fib = makeFibProjection(100, 120, []);
      expect(interpolateActivationPrice(fib, 0.886, true)).toBeNull();
    });

    it('should handle single level', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.786, price: 115.72, label: '78.6%' },
      ]);
      expect(interpolateActivationPrice(fib, 0.786, true)).toBe(115.72);
    });
  });

  describe('hasReachedTPProgressThreshold', () => {
    it('should use fibonacci price at activation level as primary check', () => {
      const fib = makeFibProjection(100, 120, []);
      expect(hasReachedTPProgressThreshold(100, 118, 120, fib, true)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, 117, 120, fib, true)).toBe(false);
    });

    it('should use interpolated price as secondary check', () => {
      const fib = makeFibProjection(100, 120, [
        { level: 0.786, price: 115.72, label: '78.6%' },
        { level: 1.0, price: 120, label: '100%' },
      ]);
      const t = (0.886 - 0.786) / (1.0 - 0.786);
      const interpolatedPrice = 115.72 + t * (120 - 115.72);
      expect(hasReachedTPProgressThreshold(100, interpolatedPrice + 0.1, 120, fib, true)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, interpolatedPrice - 0.5, 120, fib, true)).toBe(false);
    });

    it('should fall back to TP progress when no fibonacci data', () => {
      expect(hasReachedTPProgressThreshold(100, 119, 120, null, true)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, 101, 120, null, true)).toBe(false);
    });

    it('should return false when no fibonacci and no takeProfit', () => {
      expect(hasReachedTPProgressThreshold(100, 119, null, null, true)).toBe(false);
    });

    it('should use custom activationPercentLong', () => {
      expect(hasReachedTPProgressThreshold(100, 116, 120, null, true, 0.786)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, 115, 120, null, true, 0.786)).toBe(false);
    });

    it('should use custom activationPercentShort', () => {
      expect(hasReachedTPProgressThreshold(100, 84, 80, null, false, undefined, 0.786)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, 86, 80, null, false, undefined, 0.786)).toBe(false);
    });

    it('should use TP_PROGRESS_THRESHOLD_SHORT default for SHORT', () => {
      expect(hasReachedTPProgressThreshold(100, 84, 80, null, false)).toBe(true);
      expect(hasReachedTPProgressThreshold(100, 86, 80, null, false)).toBe(false);
    });
  });

  describe('shouldUpdateStopLoss', () => {
    it('should return true when currentStopLoss is null', () => {
      expect(shouldUpdateStopLoss(105, null, true)).toBe(true);
      expect(shouldUpdateStopLoss(95, null, false)).toBe(true);
    });

    it('should return true for LONG when new stop is higher', () => {
      expect(shouldUpdateStopLoss(106, 105, true)).toBe(true);
    });

    it('should return false for LONG when new stop is lower', () => {
      expect(shouldUpdateStopLoss(104, 105, true)).toBe(false);
    });

    it('should return true for SHORT when new stop is lower', () => {
      expect(shouldUpdateStopLoss(94, 95, false)).toBe(true);
    });

    it('should return false for SHORT when new stop is higher', () => {
      expect(shouldUpdateStopLoss(96, 95, false)).toBe(false);
    });

    it('should return false when change is below 0.1% threshold', () => {
      expect(shouldUpdateStopLoss(100.05, 100, true)).toBe(false);
      expect(shouldUpdateStopLoss(99.95, 100, false)).toBe(false);
    });

    it('should return true when change clearly exceeds 0.1% threshold', () => {
      expect(shouldUpdateStopLoss(100.2, 100, true)).toBe(true);
      expect(shouldUpdateStopLoss(99.8, 100, false)).toBe(true);
    });
  });

  describe('computeTrailingStopCore', () => {
    const baseInput: TrailingStopCoreInput = {
      entryPrice: 100,
      currentPrice: 110,
      currentStopLoss: null,
      side: 'LONG',
      takeProfit: 120,
    };

    const baseConfig: TrailingStopCoreConfig = {};

    describe('without fibonacci thresholds (TP-based mode)', () => {
      it('should return null when TP progress is below activation threshold', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 101,
          takeProfit: 120,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).toBeNull();
      });

      it('should return progressive_trail when price has passed activation threshold', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should return null when shouldUpdateStopLoss rejects the candidate', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
          currentStopLoss: 120,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).toBeNull();
      });

      it('should use advanced logic when profit exceeds activation threshold', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
          swingPoints: [
            { price: 112, type: 'low' },
          ],
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(['swing_trail', 'atr_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should include swing_trail candidate', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          swingPoints: [
            { price: 112, type: 'low' },
          ],
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('swing_trail');
      });

      it('should include atr_trail candidate', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
          atr: 1.5,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('atr_trail');
        expect(result!.newStopLoss).toBeCloseTo(119 - 1.5 * 2, 4);
      });

      it('should return null when no takeProfit and no fibonacci', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 100.5,
          takeProfit: null,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).toBeNull();
      });

      it('should return null when takeProfit is absent even with profit', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 102,
          takeProfit: null,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).toBeNull();
      });

      it('should select highest candidate for LONG positions', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
          atr: 0.5,
          swingPoints: [
            { price: 112, type: 'low' },
          ],
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100);
      });
    });

    describe('SHORT positions without fibonacci thresholds', () => {
      const shortInput: TrailingStopCoreInput = {
        entryPrice: 100,
        currentPrice: 88,
        currentStopLoss: null,
        side: 'SHORT',
        takeProfit: 80,
      };

      it('should return null when SHORT TP progress is below activation threshold', () => {
        const input: TrailingStopCoreInput = {
          ...shortInput,
          currentPrice: 99,
          takeProfit: 80,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).toBeNull();
      });

      it('should return progressive_trail for SHORT at activation level', () => {
        const input: TrailingStopCoreInput = {
          ...shortInput,
          currentPrice: 84,
          takeProfit: 80,
          lowestPrice: 83,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should select lowest candidate for SHORT positions', () => {
        const input: TrailingStopCoreInput = {
          ...shortInput,
          currentPrice: 84,
          takeProfit: 80,
          lowestPrice: 83,
          atr: 1,
          swingPoints: [
            { price: 92, type: 'high' },
          ],
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeLessThan(100);
      });
    });

    describe('with fibonacci thresholds', () => {
      const fibLevels = [
        { level: 0.786, price: 115.72, label: '78.6%' },
        { level: 0.886, price: 117.72, label: '88.6%' },
        { level: 1.0, price: 120, label: '100%' },
        { level: 1.272, price: 125.44, label: '127.2%' },
        { level: 1.618, price: 132.36, label: '161.8%' },
      ];

      const fibProjection = makeFibProjection(100, 120, fibLevels);

      const fibConfig: TrailingStopCoreConfig = {
        useFibonacciThresholds: true,
      };

      it('should return null when fibonacci activation threshold is not reached for LONG', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 115,
          fibonacciProjection: fibProjection,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).toBeNull();
      });

      it('should activate when LONG price reaches fibonacci threshold level', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          highestPrice: 119,
          fibonacciProjection: fibProjection,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).not.toBeNull();
      });

      it('should return progressive_trail when fibonacci thresholds enabled and progressive floor is best', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 119,
          highestPrice: 120,
          fibonacciProjection: fibProjection,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should include swing_trail in fibonacci mode candidates', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 119,
          highestPrice: 120,
          fibonacciProjection: fibProjection,
          swingPoints: [
            { price: 117, type: 'low' },
          ],
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).not.toBeNull();
        expect(['progressive_trail', 'swing_trail']).toContain(result!.reason);
      });

      it('should include atr_trail in fibonacci mode candidates', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 119,
          highestPrice: 120,
          fibonacciProjection: fibProjection,
          atr: 0.3,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).not.toBeNull();
      });

      it('should respect shouldUpdateStopLoss in fibonacci mode', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          highestPrice: 119,
          fibonacciProjection: fibProjection,
          currentStopLoss: 120,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).toBeNull();
      });

      it('should use custom activationPercentLong', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 116,
          highestPrice: 117,
          fibonacciProjection: fibProjection,
        };
        const customConfig: TrailingStopCoreConfig = {
          ...fibConfig,
          activationPercentLong: 0.786,
        };
        const result = computeTrailingStopCore(input, customConfig);
        expect(result).not.toBeNull();
      });

      it('should handle SHORT with fibonacci thresholds', () => {
        const shortFibLevels = [
          { level: 0.786, price: 84.28, label: '78.6%' },
          { level: 0.886, price: 82.28, label: '88.6%' },
          { level: 1.272, price: 74.56, label: '127.2%' },
        ];
        const shortFibProjection = makeFibProjection(80, 100, shortFibLevels);

        const input: TrailingStopCoreInput = {
          entryPrice: 100,
          currentPrice: 82,
          currentStopLoss: null,
          side: 'SHORT',
          takeProfit: 80,
          fibonacciProjection: shortFibProjection,
          lowestPrice: 81,
        };
        const result = computeTrailingStopCore(input, fibConfig);
        expect(result).not.toBeNull();
      });
    });

    describe('config defaults', () => {
      it('should use default atrMultiplier of 2.0', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 118,
          takeProfit: 120,
          highestPrice: 119,
          atr: 2,
        };
        const result = computeTrailingStopCore(input, baseConfig);
        expect(result).not.toBeNull();
        if (result!.reason === 'atr_trail') {
          expect(result!.newStopLoss).toBeCloseTo(119 - 2 * 2, 4);
        }
      });

      it('should use trailingDistancePercentLong for LONG', () => {
        const fibLevels = [
          { level: 0.886, price: 117.72, label: '88.6%' },
        ];
        const fibProjection = makeFibProjection(100, 120, fibLevels);
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 119,
          highestPrice: 120,
          fibonacciProjection: fibProjection,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: true,
          trailingDistancePercentLong: 0.1,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should use trailingDistancePercentShort for SHORT', () => {
        const shortFibLevels = [
          { level: 0.786, price: 84.28, label: '78.6%' },
        ];
        const shortFibProjection = makeFibProjection(80, 100, shortFibLevels);
        const input: TrailingStopCoreInput = {
          entryPrice: 100,
          currentPrice: 82,
          currentStopLoss: null,
          side: 'SHORT',
          lowestPrice: 81,
          fibonacciProjection: shortFibProjection,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: true,
          trailingDistancePercentShort: 0.1,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).not.toBeNull();
      });
    });

    describe('forceActivated', () => {
      it('should skip fibonacci threshold check when forceActivated is true', () => {
        const fibLevels = [
          { level: 0.886, price: 117.72, label: '88.6%' },
        ];
        const fibProjection = makeFibProjection(100, 120, fibLevels);
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 105,
          highestPrice: 106,
          fibonacciProjection: fibProjection,
        };
        const configWithoutForce: TrailingStopCoreConfig = {
          useFibonacciThresholds: true,
        };
        const resultWithout = computeTrailingStopCore(input, configWithoutForce);
        expect(resultWithout).toBeNull();

        const configWithForce: TrailingStopCoreConfig = {
          useFibonacciThresholds: true,
          forceActivated: true,
        };
        const resultWith = computeTrailingStopCore(input, configWithForce);
        expect(resultWith).not.toBeNull();
      });

      it('should return null when forceActivated is false and threshold not reached', () => {
        const fibLevels = [
          { level: 0.886, price: 117.72, label: '88.6%' },
        ];
        const fibProjection = makeFibProjection(100, 120, fibLevels);
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 105,
          highestPrice: 106,
          fibonacciProjection: fibProjection,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: true,
          forceActivated: false,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).toBeNull();
      });

      it('should work without fibonacci data when forceActivated is true', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 110,
          highestPrice: 112,
          fibonacciProjection: null,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: false,
          forceActivated: true,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).not.toBeNull();
      });

      it('should work for SHORT side when forceActivated is true', () => {
        const input: TrailingStopCoreInput = {
          entryPrice: 100,
          currentPrice: 90,
          currentStopLoss: null,
          side: 'SHORT',
          lowestPrice: 88,
          fibonacciProjection: null,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: false,
          forceActivated: true,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).not.toBeNull();
      });

      it('should still respect shouldUpdateStopLoss with forceActivated', () => {
        const input: TrailingStopCoreInput = {
          ...baseInput,
          currentPrice: 110,
          highestPrice: 112,
          currentStopLoss: 115,
          fibonacciProjection: null,
        };
        const config: TrailingStopCoreConfig = {
          useFibonacciThresholds: false,
          forceActivated: true,
        };
        const result = computeTrailingStopCore(input, config);
        expect(result).toBeNull();
      });
    });
  });
});
