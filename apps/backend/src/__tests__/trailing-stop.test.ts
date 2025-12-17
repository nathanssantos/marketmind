import type { TrailingStopOptimizationConfig } from '@marketmind/types';
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

    it('should return swing trail stop when swing point is better', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 110,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [{ price: 105, type: 'low' }],
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

    it('should use swing high for SHORT trailing', () => {
      const input: TrailingStopInput = {
        entryPrice: 110,
        currentPrice: 100,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [{ price: 105, type: 'high' }],
      };
      const configWithFees = { ...config, breakevenWithFeesThreshold: 0.0075, feePercent: 0.002 };
      const result = computeTrailingStop(input, configWithFees);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('swing_trail');
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBe(0.005);
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenWithFeesThreshold).toBe(0.0075);
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.feePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBe(0.5);
    });
  });
});

describe('TrailingStopService', () => {
  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const service = new TrailingStopService();
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.005);
      expect(config.breakevenWithFeesThreshold).toBe(0.0075);
      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
      expect(config.useATRMultiplier).toBe(true);
      expect(config.atrMultiplier).toBe(2.0);
      expect(config.feePercent).toBe(0.002);
      expect(config.trailingDistancePercent).toBe(0.5);
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
      it('should use progressive trail when it provides better stop than fees_covered', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 105,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 105,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(102.5, 4);
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should use progressive trail for SHORT position', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 95,
          currentStopLoss: 99.8,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 95,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(97.5, 4);
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

      it('should lock in more profit as price moves higher', () => {
        const config = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
          trailingDistancePercent: 0.5,
        };

        const input1: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 102,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 102,
        };

        const input2: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 110,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 110,
        };

        const result1 = computeTrailingStop(input1, config);
        const result2 = computeTrailingStop(input2, config);

        expect(result1).not.toBeNull();
        expect(result2).not.toBeNull();
        expect(result1!.newStopLoss).toBeCloseTo(101, 4);
        expect(result2!.newStopLoss).toBeCloseTo(105, 4);
        expect(result2!.newStopLoss).toBeGreaterThan(result1!.newStopLoss);
      });
    });

    describe('computeTrailingStop - Stage 1: Simple Breakeven at 0.5%', () => {
      it('should move stop to entry price for LONG when profit >= 0.5%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.5,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.5,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result.newStopLoss).toBeCloseTo(100, 4);
        expect(result.reason).toBe('breakeven');
      });

      it('should move stop to entry price for SHORT when profit >= 0.5%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 99.5,
          currentStopLoss: 102,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 99.5,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result.newStopLoss).toBeCloseTo(100, 4);
        expect(result.reason).toBe('breakeven');
      });

      it('should not trigger breakeven if profit < 0.5%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.4,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.4,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).toBeNull();
      });
    });

    describe('computeTrailingStop - Stage 2: Fees Covered at 0.75%', () => {
      it('should move stop to entry + fees for LONG when profit >= 0.75%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.8,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [{ price: 100.3, type: 'low' }],
          atr: 0.5,
          highestPrice: 100.8,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['fees_covered', 'swing_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should move stop to entry + fees for SHORT when profit >= 0.75%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 99.2,
          currentStopLoss: 100,
          side: 'SHORT',
          swingPoints: [{ price: 99.7, type: 'high' }],
          atr: 0.5,
          lowestPrice: 99.2,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeLessThanOrEqual(99.8);
        expect(['fees_covered', 'swing_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should use swing trailing above breakeven with fees floor', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 102,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 101, type: 'low' }],
          highestPrice: 102,
        };

        const result = computeTrailingStop(input, {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['swing_trail', 'fees_covered', 'progressive_trail']).toContain(result!.reason);
      });

      it('should stay at breakeven if profit between 0.5% and 0.75%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.6,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.6,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100, 4);
        expect(result!.reason).toBe('breakeven');
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

      it('should use swing trail when swing is available', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 105,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 102, type: 'low' }],
          atr: 1,
          highestPrice: 105,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(['swing_trail', 'fees_covered', 'progressive_trail', 'atr_trail']).toContain(result!.reason);
      });
    });

    describe('computeTrailingStop - Edge Cases', () => {
      it('should handle exactly 0.5% profit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.5,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.5,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.reason).toBe('breakeven');
      });

      it('should handle exactly 0.75% profit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.75,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.75,
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

      it('should handle large price movements', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 150,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [{ price: 145, type: 'low' }],
          atr: 3,
          highestPrice: 150,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(result!.newStopLoss).toBeLessThan(150);
      });

      it('should handle volatile conditions with multiple swings', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 102,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [
            { price: 99, type: 'low' },
            { price: 103, type: 'high' },
            { price: 100.5, type: 'low' },
            { price: 104, type: 'high' },
            { price: 101, type: 'low' },
          ],
          atr: 1.5,
          highestPrice: 104,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
      });
    });

    describe('Custom Configuration', () => {
      it('should respect custom breakeven thresholds', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          breakevenProfitThreshold: 0.01,
          breakevenWithFeesThreshold: 0.015,
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
        expect(result!.newStopLoss).toBeCloseTo(100, 4);
        expect(result!.reason).toBe('breakeven');
      });

      it('should respect custom fee percentage', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          feePercent: 0.003,
          trailingDistancePercent: 1,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.8,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.8,
        };

        const result = computeTrailingStop(input, customConfig);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeCloseTo(100.3, 1);
      });
    });
  });
});
