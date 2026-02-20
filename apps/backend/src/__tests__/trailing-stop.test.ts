import type { FibonacciProjectionData, TrailingStopOptimizationConfig } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    calculateATRTrailingStop,
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

  describe('computeTrailingStop', () => {
    const config: TrailingStopOptimizationConfig = {
      minTrailingDistancePercent: 0.002,
      swingLookback: 3,
      useATRMultiplier: false,
      atrMultiplier: 2.5,
      trailingDistancePercent: 0.3,
      forceActivated: true,
    };

    it('should return null when no takeProfit or fibonacci data provided', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.3,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };
      expect(computeTrailingStop(input, config)).toBeNull();
    });

    it('should return progressive_trail when profit exceeds TP progress threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 110,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
        highestPrice: 110,
        takeProfit: 112,
      };
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('progressive_trail');
      expect(result!.newStopLoss).toBeGreaterThan(100);
      expect(result!.newStopLoss).toBeLessThan(110);
    });

    it('should return swing trail stop when swing point is better and above TP threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 110,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [{ price: 108, type: 'low' }],
        highestPrice: 110,
        takeProfit: 112,
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
        takeProfit: 102,
      };
      expect(computeTrailingStop(input, config)).toBeNull();
    });

    it('should handle SHORT positions correctly', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 91,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [],
        lowestPrice: 91,
        takeProfit: 90,
      };
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('progressive_trail');
      expect(result!.newStopLoss).toBeLessThan(100);
      expect(result!.newStopLoss).toBeGreaterThan(91);
    });

    it('should use swing high for SHORT trailing when above TP threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 110,
        currentPrice: 100,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [{ price: 102, type: 'high' }],
        lowestPrice: 100,
        takeProfit: 98,
      };
      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('swing_trail');
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should have expected default values', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBeGreaterThan(0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.useVolatilityBasedThresholds).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.marketType).toBe('FUTURES');
      expect(DEFAULT_TRAILING_STOP_CONFIG.useBnbDiscount).toBe(false);
    });
  });
});

describe('TrailingStopService', () => {
  describe('constructor', () => {
    it('should initialize with default config when no config provided', () => {
      const service = new TrailingStopService();
      const config = service.getConfig();

      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
      expect(config.useATRMultiplier).toBe(true);
      expect(config.atrMultiplier).toBe(2.0);
      expect(config.trailingDistancePercent).toBeGreaterThan(0);
      expect(config.useVolatilityBasedThresholds).toBe(true);
      expect(config.marketType).toBe('FUTURES');
      expect(config.useBnbDiscount).toBe(false);
    });

    it('should merge partial config with defaults', () => {
      const service = new TrailingStopService({
        atrMultiplier: 3.0,
      });
      const config = service.getConfig();

      expect(config.atrMultiplier).toBe(3.0);
      expect(config.minTrailingDistancePercent).toBe(0.002);
      expect(config.swingLookback).toBe(3);
    });

    it('should override all default values when full config provided', () => {
      const customConfig: TrailingStopOptimizationConfig = {
        minTrailingDistancePercent: 0.005,
        swingLookback: 5,
        useATRMultiplier: false,
        atrMultiplier: 1.5,
      };
      const service = new TrailingStopService(customConfig);
      const config = service.getConfig();

      expect(config.minTrailingDistancePercent).toBe(0.005);
      expect(config.swingLookback).toBe(5);
      expect(config.useATRMultiplier).toBe(false);
      expect(config.atrMultiplier).toBe(1.5);
    });
  });

  describe('updateConfig', () => {
    it('should update single config value', () => {
      const service = new TrailingStopService();
      service.updateConfig({ trailingDistancePercent: 0.5 });
      const config = service.getConfig();

      expect(config.trailingDistancePercent).toBe(0.5);
      expect(config.minTrailingDistancePercent).toBe(0.002);
    });

    it('should update multiple config values', () => {
      const service = new TrailingStopService();
      service.updateConfig({
        atrMultiplier: 2.5,
        useATRMultiplier: false,
      });
      const config = service.getConfig();

      expect(config.atrMultiplier).toBe(2.5);
      expect(config.useATRMultiplier).toBe(false);
    });

    it('should preserve existing values when updating', () => {
      const service = new TrailingStopService({
        swingLookback: 4,
      });

      service.updateConfig({ atrMultiplier: 3.0 });
      const config = service.getConfig();

      expect(config.swingLookback).toBe(4);
      expect(config.atrMultiplier).toBe(3.0);
    });

    it('should allow chaining multiple updates', () => {
      const service = new TrailingStopService();

      service.updateConfig({ trailingDistancePercent: 0.5 });
      service.updateConfig({ atrMultiplier: 2.5 });
      service.updateConfig({ swingLookback: 5 });

      const config = service.getConfig();

      expect(config.trailingDistancePercent).toBe(0.5);
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

      config.atrMultiplier = 999;

      const freshConfig = service.getConfig();
      expect(freshConfig.atrMultiplier).toBe(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier);
    });
  });

  describe('Trailing Stop System', () => {
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
          forceActivated: true,
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
          forceActivated: true,
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
          forceActivated: true,
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
          forceActivated: true,
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

    describe('computeTrailingStop - Progressive Trail with TP Progress', () => {
      it('should activate trailing for LONG when TP progress threshold is reached', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 109,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeGreaterThan(100);
        expect(result!.newStopLoss).toBeLessThan(109);
      });

      it('should activate trailing for SHORT when TP progress threshold is reached', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 91,
          currentStopLoss: 102,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 91,
          takeProfit: 90,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeLessThan(100);
        expect(result!.newStopLoss).toBeGreaterThan(91);
      });

      it('should return null without takeProfit or fibonacci data', () => {
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

    describe('computeTrailingStop - Swing and ATR with TP Progress', () => {
      it('should use swing trailing when swing is available and above TP threshold', () => {
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
          forceActivated: true,
          useATRMultiplier: false,
        });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
        expect(['swing_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should return null if TP progress below activation threshold', () => {
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

    describe('computeTrailingStop - ATR Trailing', () => {
      it('should use ATR trailing when above TP threshold with ATR data', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          atr: 0.5,
          highestPrice: 109,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100);
        expect(['atr_trail', 'progressive_trail']).toContain(result!.reason);
      });

      it('should use swing trail when swing is available and above TP threshold', () => {
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

        const result = computeTrailingStop(input, { ...DEFAULT_TRAILING_STOP_CONFIG, forceActivated: true });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100.2);
        expect(['swing_trail', 'progressive_trail', 'atr_trail']).toContain(result!.reason);
      });
    });

    describe('computeTrailingStop - Edge Cases', () => {
      it('should return null when no takeProfit and no fibonacci data', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 101,
          currentStopLoss: null,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 101,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).toBeNull();
      });

      it('should activate when TP progress is above threshold', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109.5,
          currentStopLoss: 99,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 109.5,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, DEFAULT_TRAILING_STOP_CONFIG);

        expect(result).not.toBeNull();
        expect(['progressive_trail', 'atr_trail']).toContain(result!.reason);
      });

      it('should return null when stop already at a better level', () => {
        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 100.4,
          currentStopLoss: 100,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 100.8,
          takeProfit: 101,
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

        const result = computeTrailingStop(input, { ...DEFAULT_TRAILING_STOP_CONFIG, forceActivated: true });

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

        const result = computeTrailingStop(input, { ...DEFAULT_TRAILING_STOP_CONFIG, forceActivated: true });

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThanOrEqual(100.2);
      });
    });

    describe('Custom Configuration', () => {
      it('should respect custom trailing distance percent', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          trailingDistancePercent: 0.5,
          useATRMultiplier: false,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 109,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, customConfig);

        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeGreaterThan(100);
        expect(result!.newStopLoss).toBeLessThan(109);
      });

      it('should use larger trailing distance to give more room', () => {
        const customConfig: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          trailingDistancePercent: 0.8,
          useATRMultiplier: false,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 109,
          takeProfit: 110,
        };

        const result = computeTrailingStop(input, customConfig);

        expect(result).not.toBeNull();
        expect(result!.newStopLoss).toBeGreaterThan(100);
        expect(result!.newStopLoss).toBeLessThan(109);
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
        expect(hasReachedFibonacciLevel(90, fib, 1.0, false)).toBe(true);
        expect(hasReachedFibonacciLevel(85, fib, 1.0, false)).toBe(true);
      });

      it('should return false for SHORT when price above level', () => {
        const fib = createFibonacciProjection(90, 100);
        expect(hasReachedFibonacciLevel(95, fib, 1.0, false)).toBe(false);
      });
    });

    describe('computeTrailingStop with Fibonacci thresholds', () => {
      it('should not trigger trailing if price below activation Fibo level', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 92,
          currentPrice: 98,
          currentStopLoss: 89,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 98,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).toBeNull();
      });

      it('should return progressive_trail when price reaches activation Fibo level', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
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
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeGreaterThan(92);
        expect(result!.newStopLoss).toBeLessThan(101);
      });

      it('should return null when Fibonacci data missing and no takeProfit', () => {
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
        expect(result).toBeNull();
      });

      it('should fall back to TP progress when Fibonacci data missing but takeProfit provided', () => {
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 100,
          currentPrice: 109,
          currentStopLoss: 98,
          side: 'LONG',
          swingPoints: [],
          highestPrice: 109,
          takeProfit: 110,
          fibonacciProjection: null,
        };

        const result = computeTrailingStop(input, config);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
      });

      it('should activate trailing for SHORT when price reaches activation Fibonacci level', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 99,
          currentPrice: 91,
          currentStopLoss: 103,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 91,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeLessThan(99);
        expect(result!.newStopLoss).toBeGreaterThan(91);
      });

      it('should not activate SHORT trailing before reaching activation level', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 99,
          currentPrice: 95,
          currentStopLoss: 103,
          side: 'SHORT',
          swingPoints: [],
          lowestPrice: 95,
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).toBeNull();
      });

      it('should return null when fibonacci activated but no peak prices for SHORT', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
        };

        const input: TrailingStopInput = {
          entryPrice: 99,
          currentPrice: 91,
          currentStopLoss: 103,
          side: 'SHORT',
          swingPoints: [],
          fibonacciProjection: fib,
        };

        const result = computeTrailingStop(input, config);
        expect(result).toBeNull();
      });

      it('should return progressive_trail when fibonacci activated with peak prices for LONG', () => {
        const fib = createFibonacciProjection(90, 100);
        const config: TrailingStopOptimizationConfig = {
          ...DEFAULT_TRAILING_STOP_CONFIG,
          useFibonacciThresholds: true,
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
        expect(result).not.toBeNull();
        expect(result!.reason).toBe('progressive_trail');
        expect(result!.newStopLoss).toBeGreaterThan(92);
      });
    });
  });
});
