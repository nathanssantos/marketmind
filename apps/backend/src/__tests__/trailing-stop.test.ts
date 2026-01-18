import type { FibonacciProjectionData, TrailingStopOptimizationConfig } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    calculateATRTrailingStop,
    calculateBreakevenPrice,
    calculateFeesCoveredPrice,
    calculateNewStopLoss,
    calculateProfitPercent,
    calculateProgressiveFloor,
    computeTrailingStop,
    DEFAULT_TRAILING_STOP_CONFIG,
    findBestSwingStop,
    shouldUpdateStopLoss,
    TrailingStopService,
    type TrailingStopInput,
} from '../services/trailing-stop';
import {
    getFibonacciLevelPrice,
    hasReachedFibonacciLevel,
} from '../services/trailing-stop-core';

describe('Trailing Stop Pure Functions', () => {
  describe('calculateProfitPercent', () => {
    it('should calculate positive profit for LONG when price increases', () => {
      const result = calculateProfitPercent(100, 110, true);
      expect(result).toBe(0.1);
    });

    it('should calculate negative profit for LONG when price decreases', () => {
      const result = calculateProfitPercent(100, 90, true);
      expect(result).toBe(-0.1);
    });

    it('should calculate positive profit for SHORT when price decreases', () => {
      const result = calculateProfitPercent(100, 90, false);
      expect(result).toBe(0.1);
    });

    it('should calculate negative profit for SHORT when price increases', () => {
      const result = calculateProfitPercent(100, 110, false);
      expect(result).toBe(-0.1);
    });

    it('should return 0 when price equals entry', () => {
      expect(calculateProfitPercent(100, 100, true)).toBe(0);
      expect(calculateProfitPercent(100, 100, false)).toBe(0);
    });

    it('should handle small price changes accurately', () => {
      const result = calculateProfitPercent(100, 100.5, true);
      expect(result).toBeCloseTo(0.005, 6);
    });
  });

  describe('calculateBreakevenPrice', () => {
    it('should add buffer above entry for LONG positions', () => {
      const result = calculateBreakevenPrice(100, true, 0.001);
      expect(result).toBe(100.1);
    });

    it('should subtract buffer below entry for SHORT positions', () => {
      const result = calculateBreakevenPrice(100, false, 0.001);
      expect(result).toBe(99.9);
    });

    it('should use default buffer of 0 when not specified (pure breakeven)', () => {
      const longResult = calculateBreakevenPrice(100, true);
      const shortResult = calculateBreakevenPrice(100, false);
      expect(longResult).toBe(100);
      expect(shortResult).toBe(100);
    });

    it('should handle custom buffer values', () => {
      const result = calculateBreakevenPrice(1000, true, 0.005);
      expect(result).toBeCloseTo(1005, 4);
    });

    it('should handle zero buffer', () => {
      expect(calculateBreakevenPrice(100, true, 0)).toBe(100);
      expect(calculateBreakevenPrice(100, false, 0)).toBe(100);
    });
  });

  describe('findBestSwingStop', () => {
    const swingPoints = [
      { price: 95, type: 'low' as const },
      { price: 105, type: 'high' as const },
      { price: 97, type: 'low' as const },
      { price: 108, type: 'high' as const },
      { price: 99, type: 'low' as const },
    ];

    it('should find best swing low for LONG position', () => {
      const result = findBestSwingStop(swingPoints, 110, 94, true, 0.002);
      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(99 - 99 * 0.002, 4);
    });

    it('should find best swing high for SHORT position', () => {
      const result = findBestSwingStop(swingPoints, 90, 115, false, 0.002);
      expect(result).not.toBeNull();
      expect(result).toBeCloseTo(105 + 105 * 0.002, 4);
    });

    it('should return null when no valid swing points exist for LONG', () => {
      const result = findBestSwingStop(swingPoints, 110, 100, true, 0.002);
      expect(result).toBeNull();
    });

    it('should return null when no valid swing points exist for SHORT', () => {
      const result = findBestSwingStop(swingPoints, 90, 100, false, 0.002);
      expect(result).toBeNull();
    });

    it('should filter by correct swing type (lows for LONG, highs for SHORT)', () => {
      const mixedSwings = [
        { price: 98, type: 'low' as const },
        { price: 102, type: 'high' as const },
      ];
      const longResult = findBestSwingStop(mixedSwings, 105, 95, true, 0.001);
      expect(longResult).not.toBeNull();
      expect(longResult).toBeCloseTo(98 - 98 * 0.001, 4);
    });

    it('should handle empty swing points array', () => {
      expect(findBestSwingStop([], 100, 90, true, 0.002)).toBeNull();
      expect(findBestSwingStop([], 100, 110, false, 0.002)).toBeNull();
    });

    it('should only consider last 5 swing points', () => {
      const manySwings = [
        { price: 80, type: 'low' as const },
        { price: 85, type: 'low' as const },
        { price: 90, type: 'low' as const },
        { price: 92, type: 'low' as const },
        { price: 94, type: 'low' as const },
        { price: 96, type: 'low' as const },
        { price: 98, type: 'low' as const },
      ];
      const result = findBestSwingStop(manySwings, 105, 89, true, 0.001);
      expect(result).not.toBeNull();
    });
  });

  describe('calculateATRTrailingStop', () => {
    it('should calculate trailing stop below highest price for LONG', () => {
      const result = calculateATRTrailingStop(110, 2, true, 2.0);
      expect(result).toBe(106);
    });

    it('should calculate trailing stop above lowest price for SHORT', () => {
      const result = calculateATRTrailingStop(90, 2, false, 2.0);
      expect(result).toBe(94);
    });

    it('should respect ATR multiplier', () => {
      const result1x = calculateATRTrailingStop(100, 2, true, 1.0);
      const result3x = calculateATRTrailingStop(100, 2, true, 3.0);
      expect(result1x).toBe(98);
      expect(result3x).toBe(94);
    });

    it('should handle large ATR values', () => {
      const result = calculateATRTrailingStop(1000, 50, true, 2.0);
      expect(result).toBe(900);
    });
  });

  describe('shouldUpdateStopLoss', () => {
    it('should always return true when current stop is null', () => {
      expect(shouldUpdateStopLoss(100, null, true)).toBe(true);
      expect(shouldUpdateStopLoss(100, null, false)).toBe(true);
    });

    it('should return true for LONG when new stop is higher', () => {
      expect(shouldUpdateStopLoss(105, 100, true)).toBe(true);
    });

    it('should return false for LONG when new stop is lower', () => {
      expect(shouldUpdateStopLoss(95, 100, true)).toBe(false);
    });

    it('should return true for SHORT when new stop is lower', () => {
      expect(shouldUpdateStopLoss(95, 100, false)).toBe(true);
    });

    it('should return false for SHORT when new stop is higher', () => {
      expect(shouldUpdateStopLoss(105, 100, false)).toBe(false);
    });

    it('should return false when stops are equal', () => {
      expect(shouldUpdateStopLoss(100, 100, true)).toBe(false);
      expect(shouldUpdateStopLoss(100, 100, false)).toBe(false);
    });
  });

  describe('calculateNewStopLoss', () => {
    it('should return breakeven when swing stop is null', () => {
      expect(calculateNewStopLoss(100, null, true)).toBe(100);
      expect(calculateNewStopLoss(100, null, false)).toBe(100);
    });

    it('should return max of breakeven and swing for LONG', () => {
      expect(calculateNewStopLoss(100, 105, true)).toBe(105);
      expect(calculateNewStopLoss(100, 95, true)).toBe(100);
    });

    it('should return min of breakeven and swing for SHORT', () => {
      expect(calculateNewStopLoss(100, 95, false)).toBe(95);
      expect(calculateNewStopLoss(100, 105, false)).toBe(100);
    });
  });

  describe('computeTrailingStop', () => {
    const config: TrailingStopOptimizationConfig = {
      breakevenProfitThreshold: 0.005,
      minTrailingDistancePercent: 0.002,
      swingLookback: 3,
      useATRMultiplier: false,
      atrMultiplier: 2.5,
    };

    it('should return null when profit is below threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.3,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };
      expect(computeTrailingStop(input, config)).toBeNull();
    });

    it('should return fees_covered stop when profit exceeds fees threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 101,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };
      const configWithFees = { ...config, breakevenWithFeesThreshold: 0.0075, feePercent: 0.002 };
      const result = computeTrailingStop(input, configWithFees);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('fees_covered');
      expect(result!.newStopLoss).toBeCloseTo(100.2, 4);
    });

    it('should return swing trail stop when swing point is better and above 75% TP', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 110,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [{ price: 108, type: 'low' }],
        highestPrice: 110,
        takeProfit: 112,
      };
      const configWithFees = { ...config, breakevenWithFeesThreshold: 0.0075, feePercent: 0.002 };
      const result = computeTrailingStop(input, configWithFees);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('swing_trail');
    });

    it('should return null when new stop would be worse than current', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 101,
        currentStopLoss: 100.5,
        side: 'LONG',
        swingPoints: [],
      };
      expect(computeTrailingStop(input, config)).toBeNull();
    });

    it('should handle SHORT positions correctly', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 99,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [],
      };
      const configWithFees = { ...config, breakevenWithFeesThreshold: 0.0075, feePercent: 0.002 };
      const result = computeTrailingStop(input, configWithFees);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('fees_covered');
      expect(result!.newStopLoss).toBeCloseTo(99.8, 4);
    });

    it('should use swing high for SHORT trailing when above 75% TP', () => {
      const input: TrailingStopInput = {
        entryPrice: 110,
        currentPrice: 100,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [{ price: 102, type: 'high' }],
        lowestPrice: 100,
        takeProfit: 98,
      };
      const configWithFees = { ...config, breakevenWithFeesThreshold: 0.0075, feePercent: 0.002 };
      const result = computeTrailingStop(input, configWithFees);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('swing_trail');
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBe(0.01);
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenWithFeesThreshold).toBe(0.015);
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.feePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBe(0.4);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useVolatilityBasedThresholds).toBe(true);
    });
  });
});

describe('TrailingStopService', () => {
  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const service = new TrailingStopService();
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.01);
      expect(config.breakevenWithFeesThreshold).toBe(0.015);
      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
      expect(config.useATRMultiplier).toBe(true);
      expect(config.atrMultiplier).toBe(2.0);
      expect(config.feePercent).toBe(0.002);
      expect(config.trailingDistancePercent).toBe(0.4);
      expect(config.useVolatilityBasedThresholds).toBe(true);
    });

    it('should merge partial config with defaults', () => {
      const service = new TrailingStopService({
        breakevenProfitThreshold: 0.01,
        atrMultiplier: 3.0,
      });
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.01);
      expect(config.atrMultiplier).toBe(3.0);
      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
    });

    it('should override all default values when full config provided', () => {
      const customConfig: TrailingStopOptimizationConfig = {
        breakevenProfitThreshold: 0.02,
        minTrailingDistancePercent: 0.005,
        swingLookback: 5,
        useATRMultiplier: false,
        atrMultiplier: 1.5,
      };
      const service = new TrailingStopService(customConfig);
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.02);
      expect(config.minTrailingDistancePercent).toBe(0.005);
      expect(config.swingLookback).toBe(5);
      expect(config.useATRMultiplier).toBe(false);
      expect(config.atrMultiplier).toBe(1.5);
    });
  });

  describe('updateConfig', () => {
    it('should update single config value', () => {
      const service = new TrailingStopService();
      service.updateConfig({ breakevenProfitThreshold: 0.015 });
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.015);
      expect(config.minTrailingDistancePercent).toBe(0.002);
    });

    it('should update multiple config values', () => {
      const service = new TrailingStopService();
      service.updateConfig({
        breakevenProfitThreshold: 0.02,
        atrMultiplier: 2.5,
        useATRMultiplier: false,
      });
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.02);
      expect(config.atrMultiplier).toBe(2.5);
      expect(config.useATRMultiplier).toBe(false);
    });

    it('should preserve existing values when updating', () => {
      const service = new TrailingStopService({
        breakevenProfitThreshold: 0.01,
        swingLookback: 4,
      });

      service.updateConfig({ atrMultiplier: 3.0 });
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.01);
      expect(config.swingLookback).toBe(4);
      expect(config.atrMultiplier).toBe(3.0);
    });

    it('should allow chaining multiple updates', () => {
      const service = new TrailingStopService();

      service.updateConfig({ breakevenProfitThreshold: 0.01 });
      service.updateConfig({ atrMultiplier: 2.5 });
      service.updateConfig({ swingLookback: 5 });

      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.01);
      expect(config.atrMultiplier).toBe(2.5);
      expect(config.swingLookback).toBe(5);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the config', () => {
      const service = new TrailingStopService();
      const config1 = service.getConfig();
      const config2 = service.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it('should not allow external mutation of internal config', () => {
      const service = new TrailingStopService();
      const config = service.getConfig();

      config.breakevenProfitThreshold = 0.999;

      const freshConfig = service.getConfig();
      expect(freshConfig.breakevenProfitThreshold).toBe(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold);
    });
  });

  describe('Three-Tier Trailing Stop System', () => {
    describe('calculateFeesCoveredPrice', () => {
      it('should calculate fees covered price for LONG position', () => {
        const result = calculateFeesCoveredPrice(100, true, 0.002);
        expect(result).toBeCloseTo(100.2, 4);
      });

      it('should calculate fees covered price for SHORT position', () => {
        const result = calculateFeesCoveredPrice(100, false, 0.002);
        expect(result).toBeCloseTo(99.8, 4);
      });

      it('should handle custom fee percentage', () => {
        const result = calculateFeesCoveredPrice(1000, true, 0.003);
        expect(result).toBeCloseTo(1003, 4);
      });

      it('should use default fee of 0.2% when not specified', () => {
        expect(calculateFeesCoveredPrice(100, true)).toBeCloseTo(100.2, 4);
        expect(calculateFeesCoveredPrice(100, false)).toBeCloseTo(99.8, 4);
      });
    });

    describe('calculateProgressiveFloor', () => {
      it('should calculate progressive floor for LONG position', () => {
        const result = calculateProgressiveFloor(100, 110, undefined, true, 0.5);
        expect(result).toBeCloseTo(105, 4);
      });

      it('should calculate progressive floor for SHORT position', () => {
        const result = calculateProgressiveFloor(100, undefined, 90, false, 0.5);
        expect(result).toBeCloseTo(95, 4);
      });

      it('should return null when no peak profit for LONG', () => {
        const result = calculateProgressiveFloor(100, undefined, undefined, true, 0.5);
        expect(result).toBeNull();
      });

      it('should return null when highest price equals entry for LONG', () => {
        const result = calculateProgressiveFloor(100, 100, undefined, true, 0.5);
        expect(result).toBeNull();
      });

      it('should return null when no peak profit for SHORT', () => {
        const result = calculateProgressiveFloor(100, undefined, undefined, false, 0.5);
        expect(result).toBeNull();
      });

      it('should return null when lowest price equals entry for SHORT', () => {
        const result = calculateProgressiveFloor(100, undefined, 100, false, 0.5);
        expect(result).toBeNull();
      });

      it('should handle different trailing distance percentages', () => {
        const floor25 = calculateProgressiveFloor(100, 110, undefined, true, 0.25);
        const floor50 = calculateProgressiveFloor(100, 110, undefined, true, 0.5);
        const floor75 = calculateProgressiveFloor(100, 110, undefined, true, 0.75);
        expect(floor25).toBeCloseTo(107.5, 4);
        expect(floor50).toBeCloseTo(105, 4);
        expect(floor75).toBeCloseTo(102.5, 4);
      });

      it('should handle 0% trailing distance (no trail)', () => {
        const result = calculateProgressiveFloor(100, 110, undefined, true, 0);
        expect(result).toBeCloseTo(110, 4);
      });

      it('should handle 100% trailing distance (maximum trail)', () => {
        const result = calculateProgressiveFloor(100, 110, undefined, true, 1);
        expect(result).toBeCloseTo(100, 4);
      });
    });

    describe('computeTrailingStop - Progressive Trail', () => {
      it('should use progressive trail when profit exceeds 75% of TP', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 105,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 105,
          takeProfit: 106,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should use progressive trail for SHORT position above 75% TP', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 95,
          currentStopLoss: 99.8,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 95,
          takeProfit: 94,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeLessThan(99.8);
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should prefer swing trail when it provides better stop than progressive', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 110,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 108, type: 'low' }],
          highestPrice: 110,
          takeProfit: 112,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(105);
        expect(result!.reason).toBe('swing_trail');
      });

      it('should lock in more profit as price moves higher with takeProfit', () => {
        const config = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        };

        const input1: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 108,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 108,
          takeProfit: 110,
        };

        const input2: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 110,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 110,
          takeProfit: 112,
        };

        const result1 = computeTrailingStop(input1, config);
        const result2 = computeTrailingStop(input2, config);

        expect(result1).not.toBeNull();
        expect(result2).not.toBeNull();
        expect(result1!.newStopLoss).toBeGreaterThan(100.2);
        expect(result2!.newStopLoss).toBeGreaterThan(result1!.newStopLoss);
      });
    });

    describe('computeTrailingStop - Stage 1: Fees Covered at 1.0%', () => {
      it('should move stop to fees covered price for LONG when profit >= 1.0%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100.2, 1);
        expect(result!.reason).toBe('fees_covered');
      });

      it('should move stop to fees covered price for SHORT when profit >= 1.0%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 99,
          currentStopLoss: 102,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 99,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(99.8, 1);
        expect(result!.reason).toBe('fees_covered');
      });

      it('should not trigger trailing if profit < 1.0%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.8,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.8,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).toBeNull();
      });
    });

    describe('computeTrailingStop - Stage 2: Fees Covered at 1.5%', () => {
      it('should move stop to entry + fees for LONG when profit >= 1.5%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101.6,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [{ price: 100.5, type: 'low' }],
          atr: 0.5,
          highestPrice: 101.6,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['fees_covered', 'swing_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should move stop to entry + fees for SHORT when profit >= 1.5%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 98.4,
          currentStopLoss: 100,
          side: 'SHORT',
          swingPoints: [{ price: 99.5, type: 'high' }],
          atr: 0.5,
          lowestPrice: 98.4,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeLessThanOrEqual(99.8);
        expect(['fees_covered', 'swing_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should use swing trailing above fees covered with takeProfit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 104,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 103, type: 'low' }],
          highestPrice: 104,
          takeProfit: 105,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['swing_trail', 'fees_covered', 'progressive_trail']).toContain(result!.reason);
      });

      it('should stay at fees_covered if profit between 50% and 75% of TP', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 106,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 106,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100.2, 1);
        expect(result!.reason).toBe('fees_covered');
      });

      it('should return null if profit below 50% of TP', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101.2,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101.2,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).toBeNull();
      });
    });

    describe('computeTrailingStop - ATR Trailing with Fees Covered Floor', () => {
      it('should use ATR trailing but not below fees covered level', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 103,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          atr: 0.5,
          highestPrice: 103,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['atr_trail', 'fees_covered', 'progressive_trail']).toContain(result!.reason);
      });

      it('should use swing trail when swing is available and above 75% TP', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 105,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 104, type: 'low' }],
          atr: 1,
          highestPrice: 105,
          takeProfit: 106,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(['swing_trail', 'fees_covered', 'progressive_trail', 'atr_trail']).toContain(result!.reason);
      });
    });

    describe('computeTrailingStop - Edge Cases', () => {
      it('should handle exactly 1.0% profit (fees covered threshold)', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.reason).toBe('fees_covered');
      });

      it('should handle exactly 1.5% profit (fees covered threshold)', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101.5,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101.5,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(['fees_covered', 'atr_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should return null when profit below threshold and stop already at breakeven', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.4,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.8,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).toBeNull();
      });

      it('should handle large price movements with takeProfit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 150,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 145, type: 'low' }],
          atr: 3,
          highestPrice: 150,
          takeProfit: 160,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(result!.newStopLoss).toBeLessThan(150);
      });

      it('should handle volatile conditions with multiple swings and takeProfit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 104,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [
            { price: 99, type: 'low' },
            { price: 103, type: 'high' },
            { price: 100.5, type: 'low' },
            { price: 104, type: 'high' },
            { price: 103, type: 'low' },
          ],
          atr: 1.5,
          highestPrice: 104,
          takeProfit: 105,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
      });
    });

    describe('Custom Configuration', () => {
      it('should respect custom fee percentage', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          feePercent: 0.003,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
        };

        const result = computeTrailingStop(input, customConfig);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100.3, 1);
        expect(result!.reason).toBe('fees_covered');
      });

      it('should apply custom fee when stop is below fees covered level', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          feePercent: 0.003,
          trailingDistancePercent: 1,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101.6,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101.6,
        };

        const result = computeTrailingStop(input, customConfig);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100.3, 1);
      });
    });
  });

  describe('Fibonacci-Based Trailing Stop', () => {
    const createFibonacciProjection = (swingLow: number, swingHigh: number): FibonacciProjectionData => {
      const range = swingHigh - swingLow;
      return {
        swingLow: { price: swingLow, index: 0, timestamp: Date.now() - 10000 },
        swingHigh: { price: swingHigh, index: 10, timestamp: Date.now() },
        range,
        primaryLevel: 1.618,
        levels: [
          { level: 0, price: swingLow, label: '0%' },
          { level: 0.5, price: swingLow + range * 0.5, label: '50%' },
          { level: 1.0, price: swingHigh, label: '100%' },
          { level: 1.272, price: swingLow + range * 1.272, label: '127.2%' },
          { level: 1.618, price: swingLow + range * 1.618, label: '161.8%' },
          { level: 2.0, price: swingLow + range * 2.0, label: '200%' },
        ],
      };
    };

    describe('getFibonacciLevelPrice', () => {
      it('should return price for existing Fibonacci level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(getFibonacciLevelPrice(fib, 1.0)).toBe(100);
        expect(getFibonacciLevelPrice(fib, 1.272)).toBeCloseTo(102.72, 2);
      });

      it('should return null for non-existent level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(getFibonacciLevelPrice(fib, 0.786)).toBeNull();
      });

      it('should return null for null/undefined projection', () => {
        expect(getFibonacciLevelPrice(null, 1.0)).toBeNull();
        expect(getFibonacciLevelPrice(undefined, 1.0)).toBeNull();
      });
    });

    describe('hasReachedFibonacciLevel', () => {
      it('should return true for LONG when price reaches level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(hasReachedFibonacciLevel(100, fib, 1.0, true)).toBe(true);
        expect(hasReachedFibonacciLevel(105, fib, 1.0, true)).toBe(true);
      });

      it('should return false for LONG when price below level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(hasReachedFibonacciLevel(99, fib, 1.0, true)).toBe(false);
      });

      it('should return true for SHORT when price reaches level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(hasReachedFibonacciLevel(100, fib, 1.0, false)).toBe(true);
        expect(hasReachedFibonacciLevel(95, fib, 1.0, false)).toBe(true);
      });

      it('should return false for SHORT when price above level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(hasReachedFibonacciLevel(101, fib, 1.0, false)).toBe(false);
      });
    });

    describe('computeTrailingStop with Fibonacci thresholds', () => {
      it('should not trigger trailing if price below 100% Fibo level', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 92,
          currentPrice: 99,
          currentStopLoss: 89,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 99,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).toBeNull();
      });

      it('should return null when price reaches 100% Fibo but not 161.8% (breakeven disabled)', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
          feePercent: 0.002,
        };

        const input: TrailingStopInput = {
          entryPrice: 92,
          currentPrice: 101,
          currentStopLoss: 89,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).toBeNull();
      });

      it('should enter progressive mode when price reaches 161.8% Fibo', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
          feePercent: 0.002,
          trailingDistancePercent: 0.4,
        };

        const input: TrailingStopInput = {
          entryPrice: 92,
          currentPrice: 107,
          currentStopLoss: 92.184,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 107,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).not.toBeNull();
        expect(['fees_covered', 'progressive_trail']).toContain(result!.reason);
        expect(result!.newStopLoss).toBeGreaterThan(92);
      });

      it('should fall back to percentage thresholds when Fibonacci data missing', () => {
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
          fibonacciProjection: null,
        };

        const result = computeTrailingStop(input, config);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('fees_covered');
      });
    });
  });
});
