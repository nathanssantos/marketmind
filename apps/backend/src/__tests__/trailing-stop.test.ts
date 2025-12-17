import type { TrailingStopOptimizationConfig } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    calculateATRTrailingStop,
    calculateBreakevenPrice,
    calculateNewStopLoss,
    calculateProfitPercent,
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

    it('should use default buffer when not specified', () => {
      const longResult = calculateBreakevenPrice(100, true);
      const shortResult = calculateBreakevenPrice(100, false);
      expect(longResult).toBe(100.1);
      expect(shortResult).toBe(99.9);
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

    it('should return breakeven stop when profit exceeds threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 101,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('breakeven');
      expect(result!.newStopLoss).toBeCloseTo(100.1, 4);
    });

    it('should return swing trail stop when swing point is better', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 110,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [{ price: 105, type: 'low' }],
      };
      const result = computeTrailingStop(input, config);
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
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('breakeven');
      expect(result!.newStopLoss).toBeCloseTo(99.9, 4);
    });

    it('should use swing high for SHORT trailing', () => {
      const input: TrailingStopInput = {
        entryPrice: 110,
        currentPrice: 100,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [{ price: 105, type: 'high' }],
      };
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('swing_trail');
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBe(0.005);
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
    });
  });
});

describe('TrailingStopService', () => {
  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const service = new TrailingStopService();
      const config = service.getConfig();

      expect(config.breakevenProfitThreshold).toBe(0.005);
      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
      expect(config.useATRMultiplier).toBe(true);
      expect(config.atrMultiplier).toBe(2.0);
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
      expect(freshConfig.breakevenProfitThreshold).toBe(0.005);
    });
  });

  describe('Two-Stage Breakeven System', () => {
    describe('calculateBreakevenWithFeesPrice', () => {
      it('should calculate breakeven with fees for LONG position', () => {
        const result = calculateBreakevenPrice(100, true, 0.002);
        expect(result).toBeCloseTo(100.2, 4);
      });

      it('should calculate breakeven with fees for SHORT position', () => {
        const result = calculateBreakevenPrice(100, false, 0.002);
        expect(result).toBeCloseTo(99.8, 4);
      });

      it('should handle custom fee percentage', () => {
        const result = calculateBreakevenPrice(1000, true, 0.003);
        expect(result).toBeCloseTo(1003, 4);
      });

      it('should handle zero fee', () => {
        expect(calculateBreakevenPrice(100, true, 0)).toBe(100);
        expect(calculateBreakevenPrice(100, false, 0)).toBe(100);
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

        expect(result.newStopLoss).not.toBe(100);
      });
    });

    describe('computeTrailingStop - Stage 2: Breakeven with Fees at 0.7%', () => {
      it('should move stop to entry + fees for LONG when profit >= 0.7%', () => {
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

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(result.reason).toBe('breakeven_with_fees');
      });

      it('should move stop to entry + fees for SHORT when profit >= 0.7%', () => {
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

        expect(result.newStopLoss).toBeLessThanOrEqual(99.8);
        expect(result.reason).toBe('breakeven_with_fees');
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

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['swing_trail', 'breakeven_with_fees']).toContain(result.reason);
      });

      it('should not trigger breakeven with fees if profit between 0.5% and 0.7%', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.6,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.6,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result.newStopLoss).toBeCloseTo(100, 4);
        expect(result.reason).toBe('breakeven');
      });
    });

    describe('computeTrailingStop - ATR Trailing with Breakeven Floor', () => {
      it('should use ATR trailing but not below breakeven with fees', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 103,
          currentStopLoss: 100.2,
          side: 'LONG',
          swingPoints: [],
          atr: 2,
          highestPrice: 103,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['atr_trail', 'breakeven_with_fees']).toContain(result.reason);
      });

      it('should prefer ATR over swing when ATR is higher', () => {
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

        expect(result.newStopLoss).toBeGreaterThan(100.2);
        expect(result.reason).toBe('atr_trail');
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

        expect(result.reason).toBe('breakeven');
      });

      it('should handle exactly 0.7% profit', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.7,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.7,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(['breakeven_with_fees', 'swing_trail', 'atr_trail']).toContain(result.reason);
      });

      it('should not lower stop loss once at breakeven', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.4,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.8,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100);
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

        expect(result.newStopLoss).toBeGreaterThan(100.2);
        expect(result.newStopLoss).toBeLessThan(150);
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

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100.2);
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

        expect(result.newStopLoss).toBeCloseTo(100, 4);
        expect(result.reason).toBe('breakeven');
      });

      it('should respect custom fee percentage', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          feePercent: 0.003,
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

        expect(result.newStopLoss).toBeGreaterThanOrEqual(100.3);
      });
    });
  });
});
