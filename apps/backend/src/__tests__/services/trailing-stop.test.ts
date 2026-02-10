import { beforeEach, describe, expect, it, vi } from 'vitest';
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
  getFeesThresholdForMarketType,
  getRoundTripFee,
  shouldUpdateStopLoss,
  TrailingStopService,
  type TrailingStopInput,
} from '../../services/trailing-stop';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
  },
}));

vi.mock('../../services/websocket', () => ({
  getWebSocketService: vi.fn(() => null),
}));

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    query: {
      priceCache: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      klines: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      setupDetections: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      autoTradingConfig: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => Promise.resolve()),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve()),
      })),
    })),
  },
}));

describe('TrailingStop Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getRoundTripFee', () => {
    it('should return spot round-trip fee', () => {
      const fee = getRoundTripFee({ marketType: 'SPOT' });
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(0.01);
    });

    it('should return futures round-trip fee', () => {
      const fee = getRoundTripFee({ marketType: 'FUTURES' });
      expect(fee).toBeGreaterThan(0);
      expect(fee).toBeLessThan(0.01);
    });

    it('should apply BNB discount when enabled', () => {
      const feeWithoutDiscount = getRoundTripFee({ marketType: 'SPOT', useBnbDiscount: false });
      const feeWithDiscount = getRoundTripFee({ marketType: 'SPOT', useBnbDiscount: true });

      expect(feeWithDiscount).toBeLessThan(feeWithoutDiscount);
    });
  });

  describe('getFeesThresholdForMarketType', () => {
    it('should return threshold for spot market', () => {
      const threshold = getFeesThresholdForMarketType('SPOT');
      expect(threshold).toBeGreaterThan(0);
    });

    it('should return threshold for futures market', () => {
      const threshold = getFeesThresholdForMarketType('FUTURES');
      expect(threshold).toBeGreaterThan(0);
    });

    it('should return lower threshold with BNB discount', () => {
      const thresholdWithoutDiscount = getFeesThresholdForMarketType('SPOT', false);
      const thresholdWithDiscount = getFeesThresholdForMarketType('SPOT', true);

      expect(thresholdWithDiscount).toBeLessThan(thresholdWithoutDiscount);
    });
  });

  describe('calculateProfitPercent', () => {
    it('should calculate profit for long position with gain', () => {
      const profit = calculateProfitPercent(100, 110, true);
      expect(profit).toBe(0.1);
    });

    it('should calculate loss for long position with loss', () => {
      const profit = calculateProfitPercent(100, 90, true);
      expect(profit).toBe(-0.1);
    });

    it('should calculate profit for short position with gain', () => {
      const profit = calculateProfitPercent(100, 90, false);
      expect(profit).toBe(0.1);
    });

    it('should calculate loss for short position with loss', () => {
      const profit = calculateProfitPercent(100, 110, false);
      expect(profit).toBe(-0.1);
    });

    it('should return 0 for no price change', () => {
      const profitLong = calculateProfitPercent(100, 100, true);
      const profitShort = calculateProfitPercent(100, 100, false);

      expect(profitLong).toBe(0);
      expect(profitShort).toBe(0);
    });
  });

  describe('calculateBreakevenPrice', () => {
    it('should calculate breakeven for long position', () => {
      const breakeven = calculateBreakevenPrice(100, true);
      expect(breakeven).toBe(100);
    });

    it('should calculate breakeven for short position', () => {
      const breakeven = calculateBreakevenPrice(100, false);
      expect(breakeven).toBe(100);
    });

    it('should apply buffer for long position', () => {
      const breakeven = calculateBreakevenPrice(100, true, 0.001);
      expect(breakeven).toBe(100.1);
    });

    it('should apply buffer for short position', () => {
      const breakeven = calculateBreakevenPrice(100, false, 0.001);
      expect(breakeven).toBe(99.9);
    });
  });

  describe('calculateFeesCoveredPrice', () => {
    it('should calculate fees covered price for long position', () => {
      const price = calculateFeesCoveredPrice(100, true, 0.002);
      expect(price).toBe(100.2);
    });

    it('should calculate fees covered price for short position', () => {
      const price = calculateFeesCoveredPrice(100, false, 0.002);
      expect(price).toBe(99.8);
    });

    it('should use default fee when not provided', () => {
      const price = calculateFeesCoveredPrice(100, true, undefined, 'SPOT');
      expect(price).toBeGreaterThan(100);
    });
  });

  describe('calculateProgressiveFloor', () => {
    it('should calculate floor for profitable long position', () => {
      const floor = calculateProgressiveFloor(100, 110, undefined, true, 0.5);
      expect(floor).toBe(105);
    });

    it('should calculate floor for profitable short position', () => {
      const floor = calculateProgressiveFloor(100, undefined, 90, false, 0.5);
      expect(floor).toBe(95);
    });

    it('should return null when long has no profit', () => {
      const floor = calculateProgressiveFloor(100, 100, undefined, true, 0.5);
      expect(floor).toBeNull();
    });

    it('should return null when short has no profit', () => {
      const floor = calculateProgressiveFloor(100, undefined, 100, false, 0.5);
      expect(floor).toBeNull();
    });

    it('should return null when highestPrice is undefined for long', () => {
      const floor = calculateProgressiveFloor(100, undefined, undefined, true, 0.5);
      expect(floor).toBeNull();
    });

    it('should return null when lowestPrice is undefined for short', () => {
      const floor = calculateProgressiveFloor(100, undefined, undefined, false, 0.5);
      expect(floor).toBeNull();
    });

    it('should return null when long highestPrice is below entry', () => {
      const floor = calculateProgressiveFloor(100, 95, undefined, true, 0.5);
      expect(floor).toBeNull();
    });

    it('should return null when short lowestPrice is above entry', () => {
      const floor = calculateProgressiveFloor(100, undefined, 105, false, 0.5);
      expect(floor).toBeNull();
    });
  });

  describe('findBestSwingStop', () => {
    const swingPoints = [
      { price: 95, type: 'low' as const },
      { price: 105, type: 'high' as const },
      { price: 98, type: 'low' as const },
      { price: 108, type: 'high' as const },
      { price: 101, type: 'low' as const },
      { price: 112, type: 'high' as const },
    ];

    it('should find best swing low for long position', () => {
      const stop = findBestSwingStop(swingPoints, 110, 100, true, 0.002);
      expect(stop).not.toBeNull();
      expect(stop).toBeLessThan(110);
      expect(stop).toBeGreaterThan(100);
    });

    it('should find best swing high for short position', () => {
      const shortSwingPoints = [
        { price: 95, type: 'low' as const },
        { price: 102, type: 'high' as const },
        { price: 98, type: 'low' as const },
        { price: 100, type: 'high' as const },
      ];
      const stop = findBestSwingStop(shortSwingPoints, 95, 105, false, 0.002);
      expect(stop).not.toBeNull();
      expect(stop).toBeGreaterThan(95);
      expect(stop).toBeLessThan(105);
    });

    it('should return null when no valid swing points for long', () => {
      const stop = findBestSwingStop(swingPoints, 100, 100, true, 0.002);
      expect(stop).toBeNull();
    });

    it('should return null when no valid swing points for short', () => {
      const stop = findBestSwingStop(swingPoints, 115, 105, false, 0.002);
      expect(stop).toBeNull();
    });

    it('should return null for empty swing points', () => {
      const stop = findBestSwingStop([], 110, 100, true, 0.002);
      expect(stop).toBeNull();
    });
  });

  describe('shouldUpdateStopLoss', () => {
    it('should return true when no current stop loss', () => {
      expect(shouldUpdateStopLoss(100, null, true)).toBe(true);
      expect(shouldUpdateStopLoss(100, null, false)).toBe(true);
    });

    it('should return true when new stop is better for long', () => {
      expect(shouldUpdateStopLoss(102, 100, true)).toBe(true);
    });

    it('should return false when new stop is worse for long', () => {
      expect(shouldUpdateStopLoss(98, 100, true)).toBe(false);
    });

    it('should return true when new stop is better for short', () => {
      expect(shouldUpdateStopLoss(98, 100, false)).toBe(true);
    });

    it('should return false when new stop is worse for short', () => {
      expect(shouldUpdateStopLoss(102, 100, false)).toBe(false);
    });

    it('should return false when stops are equal', () => {
      expect(shouldUpdateStopLoss(100, 100, true)).toBe(false);
      expect(shouldUpdateStopLoss(100, 100, false)).toBe(false);
    });
  });

  describe('calculateNewStopLoss', () => {
    it('should return breakeven when no swing stop for long', () => {
      const stop = calculateNewStopLoss(100, null, true);
      expect(stop).toBe(100);
    });

    it('should return breakeven when no swing stop for short', () => {
      const stop = calculateNewStopLoss(100, null, false);
      expect(stop).toBe(100);
    });

    it('should return higher value for long', () => {
      const stop = calculateNewStopLoss(100, 102, true);
      expect(stop).toBe(102);
    });

    it('should return lower value for short', () => {
      const stop = calculateNewStopLoss(100, 98, false);
      expect(stop).toBe(98);
    });

    it('should prefer breakeven when it is better for long', () => {
      const stop = calculateNewStopLoss(102, 100, true);
      expect(stop).toBe(102);
    });

    it('should prefer breakeven when it is better for short', () => {
      const stop = calculateNewStopLoss(98, 100, false);
      expect(stop).toBe(98);
    });
  });

  describe('calculateATRTrailingStop', () => {
    it('should calculate ATR stop for long position', () => {
      const stop = calculateATRTrailingStop(110, 5, true, 2);
      expect(stop).toBe(100);
    });

    it('should calculate ATR stop for short position', () => {
      const stop = calculateATRTrailingStop(90, 5, false, 2);
      expect(stop).toBe(100);
    });

    it('should scale with ATR multiplier', () => {
      const stopMultiplier2 = calculateATRTrailingStop(110, 5, true, 2);
      const stopMultiplier3 = calculateATRTrailingStop(110, 5, true, 3);

      expect(stopMultiplier3).toBeLessThan(stopMultiplier2);
    });
  });

  describe('computeTrailingStop', () => {
    const defaultConfig: TrailingStopOptimizationConfig = {
      ...DEFAULT_TRAILING_STOP_CONFIG,
      breakevenProfitThreshold: 0.005,
      breakevenWithFeesThreshold: 0.01,
    };

    it('should return null when profit is below threshold', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.2,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).toBeNull();
    });

    it('should return fees_covered for 1% profit (new tier logic)', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 101,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('fees_covered');
      expect(result!.newStopLoss).toBeGreaterThan(100);
      expect(result!.newStopLoss).toBeLessThan(100.5);
    });

    it('should return fees_covered for higher profit', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 102,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('fees_covered');
    });

    it('should return null when stop loss would not improve', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.6,
        currentStopLoss: 100,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).toBeNull();
    });

    it('should use swing stop when available for long', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [{ price: 103, type: 'low' }],
        highestPrice: 105,
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).not.toBeNull();
    });

    it('should use ATR stop when configured', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
        atr: 1,
        highestPrice: 105,
      };

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        useATRMultiplier: true,
        atrMultiplier: 2,
      };

      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
    });

    it('should handle short positions correctly', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 99,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).not.toBeNull();
      expect(result!.reason).toBe('fees_covered');
      expect(result!.newStopLoss).toBeLessThan(100);
      expect(result!.newStopLoss).toBeGreaterThan(99.5);
    });

    it('should use progressive trail when highest price set', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 108,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
        highestPrice: 110,
      };

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        trailingDistancePercent: 0.5,
      };

      const result = computeTrailingStop(input, config);
      expect(result).not.toBeNull();
    });
  });

  describe('TrailingStopService', () => {
    describe('constructor', () => {
      it('should create service with default config', () => {
        const service = new TrailingStopService();
        const config = service.getConfig();

        expect(config.breakevenProfitThreshold).toBeDefined();
        expect(config.minTrailingDistancePercent).toBeDefined();
        expect(config.useATRMultiplier).toBeDefined();
      });

      it('should create service with custom config', () => {
        const service = new TrailingStopService({
          atrMultiplier: 3,
          marketType: 'FUTURES',
        });

        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(3);
        expect(config.marketType).toBe('FUTURES');
      });
    });

    describe('updateConfig', () => {
      it('should update config values', () => {
        const service = new TrailingStopService();
        service.updateConfig({ atrMultiplier: 4 });

        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(4);
      });

      it('should preserve existing config values', () => {
        const service = new TrailingStopService({ marketType: 'FUTURES' });
        service.updateConfig({ atrMultiplier: 4 });

        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(4);
        expect(config.marketType).toBe('FUTURES');
      });
    });

    describe('getConfig', () => {
      it('should return a copy of config', () => {
        const service = new TrailingStopService();
        const config1 = service.getConfig();
        const config2 = service.getConfig();

        expect(config1).toEqual(config2);
        expect(config1).not.toBe(config2);
      });
    });

    describe('updateTrailingStops', () => {
      it('should return empty array when no open executions', async () => {
        const service = new TrailingStopService();
        const updates = await service.updateTrailingStops();

        expect(updates).toEqual([]);
      });
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should have valid breakeven threshold', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBeGreaterThan(0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBeLessThan(0.1);
    });

    it('should have valid min trailing distance', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBeGreaterThan(0);
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBeLessThan(0.1);
    });

    it('should have valid swing lookback', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBeGreaterThan(0);
    });

    it('should have valid ATR multiplier', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBeGreaterThan(0);
    });

    it('should default to FUTURES market', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.marketType).toBe('FUTURES');
    });

    it('should default to no BNB discount', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useBnbDiscount).toBe(false);
    });
  });
});
