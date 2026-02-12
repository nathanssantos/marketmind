import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';

const { mockComputeTrailingStopCore } = vi.hoisted(() => ({
  mockComputeTrailingStopCore: vi.fn(),
}));

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getRoundTripFee: vi.fn((params: { marketType: string; useBnbDiscount?: boolean }) => {
      if (params.marketType === 'SPOT') {
        return params.useBnbDiscount ? 0.0015 : 0.002;
      }
      return params.useBnbDiscount ? 0.00054 : 0.0008;
    }),
  };
});

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn(() => []),
  calculateSwingPoints: vi.fn(() => ({ swingPoints: [] })),
}));

vi.mock('../constants', () => ({
  TRAILING_STOP: {
    BREAKEVEN_THRESHOLD: 0.01,
    FEES_COVERAGE_THRESHOLD: 0.015,
    PEAK_PROFIT_FLOOR: 0.4,
    PEAK_PROFIT_FLOOR_LONG: 0.4,
    PEAK_PROFIT_FLOOR_SHORT: 0.3,
    ATR_MULTIPLIER: 0.002,
    TP_THRESHOLD_FOR_BREAKEVEN: 0.50,
    TP_THRESHOLD_FOR_ADVANCED: 0.70,
    MIN_STOP_CHANGE_ABSOLUTE: 0.005,
  },
}));

vi.mock('../db', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([])) })) })),
    query: {
      priceCache: { findFirst: vi.fn().mockResolvedValue(null) },
      klines: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn().mockResolvedValue(null) },
      setupDetections: { findFirst: vi.fn().mockResolvedValue(null) },
      autoTradingConfig: { findFirst: vi.fn().mockResolvedValue(null) },
      symbolTrailingStopOverrides: { findFirst: vi.fn().mockResolvedValue(null) },
    },
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoUpdate: vi.fn(() => Promise.resolve()) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  },
}));

vi.mock('../db/schema', () => ({
  autoTradingConfig: {},
  klines: {},
  priceCache: {},
  setupDetections: {},
  symbolTrailingStopOverrides: {},
  tradeExecutions: {},
  wallets: {},
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((a: unknown, b: unknown) => [a, b]),
  inArray: vi.fn((a: unknown, b: unknown) => [a, b]),
}));

vi.mock('../services/trailing-stop-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    computeTrailingStopCore: mockComputeTrailingStopCore,
  };
});

vi.mock('../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/protection-orders', () => ({
  updateStopLossOrder: vi.fn(),
}));

vi.mock('../services/volatility-profile', () => ({
  calculateATRPercent: vi.fn(),
  getVolatilityProfile: vi.fn(),
}));

vi.mock('../services/websocket', () => ({
  getWebSocketService: vi.fn(() => null),
}));

vi.mock('../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => e),
}));

vi.mock('../utils/formatters', () => ({
  formatPrice: vi.fn((p: number) => p.toString()),
}));

import {
  calculateBreakevenPrice,
  calculateFeesCoveredPrice,
  calculateNewStopLoss,
  computeTrailingStop,
  DEFAULT_TRAILING_STOP_CONFIG,
  getFeesThresholdForMarketType,
  resolveTrailingStopConfig,
  type TrailingStopInput,
} from '../services/trailing-stop';
import type { AutoTradingConfig, SymbolTrailingStopOverride } from '../db/schema';
import { getRoundTripFee } from '@marketmind/types';

const makeSymbolOverride = (overrides: Partial<SymbolTrailingStopOverride> = {}): SymbolTrailingStopOverride => ({
  id: 1,
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  useIndividualConfig: false,
  trailingStopEnabled: null,
  trailingActivationPercentLong: null,
  trailingActivationPercentShort: null,
  trailingDistancePercentLong: null,
  trailingDistancePercentShort: null,
  useAdaptiveTrailing: null,
  useProfitLockDistance: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeWalletConfig = (overrides: Partial<AutoTradingConfig> = {}): AutoTradingConfig => ({
  id: 'config-1',
  userId: 'user-1',
  walletId: 'wallet-1',
  isEnabled: false,
  maxConcurrentPositions: 5,
  maxPositionSize: '15',
  dailyLossLimit: '5',
  enabledSetupTypes: '[]',
  positionSizing: 'percentage',
  leverage: 1,
  marginType: 'ISOLATED',
  positionMode: 'ONE_WAY',
  useLimitOrders: false,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,
  useTrendFilter: false,
  useMtfFilter: false,
  useBtcCorrelationFilter: true,
  useMarketRegimeFilter: false,
  useDirectionFilter: false,
  directionMode: 'auto',
  enableLongInBearMarket: false,
  enableShortInBullMarket: false,
  useVolumeFilter: true,
  trailingStopMode: 'local',
  trailingStopEnabled: true,
  trailingActivationPercentLong: '0.9',
  trailingActivationPercentShort: '0.8',
  trailingDistancePercentLong: '0.4',
  trailingDistancePercentShort: '0.3',
  useAdaptiveTrailing: true,
  useProfitLockDistance: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as AutoTradingConfig);

describe('trailing-stop exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFeesThresholdForMarketType', () => {
    it('should return round trip fee plus buffer for FUTURES', () => {
      const threshold = getFeesThresholdForMarketType('FUTURES');
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'FUTURES', useBnbDiscount: false });
      expect(threshold).toBeCloseTo(0.0008 + 0.005, 6);
    });

    it('should return round trip fee plus buffer for SPOT', () => {
      const threshold = getFeesThresholdForMarketType('SPOT');
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'SPOT', useBnbDiscount: false });
      expect(threshold).toBeCloseTo(0.002 + 0.005, 6);
    });

    it('should return lower threshold with BNB discount for FUTURES', () => {
      const threshold = getFeesThresholdForMarketType('FUTURES', true);
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'FUTURES', useBnbDiscount: true });
      expect(threshold).toBeCloseTo(0.00054 + 0.005, 6);
    });

    it('should return lower threshold with BNB discount for SPOT', () => {
      const threshold = getFeesThresholdForMarketType('SPOT', true);
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'SPOT', useBnbDiscount: true });
      expect(threshold).toBeCloseTo(0.0015 + 0.005, 6);
    });

    it('should default useBnbDiscount to false when omitted', () => {
      getFeesThresholdForMarketType('FUTURES');
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'FUTURES', useBnbDiscount: false });
    });

    it('should produce SPOT threshold higher than FUTURES threshold', () => {
      const spotThreshold = getFeesThresholdForMarketType('SPOT', false);
      const futuresThreshold = getFeesThresholdForMarketType('FUTURES', false);
      expect(spotThreshold).toBeGreaterThan(futuresThreshold);
    });
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should set breakevenProfitThreshold from TRAILING_STOP constant', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenProfitThreshold).toBe(0.01);
    });

    it('should set breakevenWithFeesThreshold from TRAILING_STOP constant', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.breakevenWithFeesThreshold).toBe(0.015);
    });

    it('should set feePercent from getRoundTripFee for FUTURES', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.feePercent).toBe(0.0008);
    });

    it('should set trailingDistancePercent from PEAK_PROFIT_FLOOR', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBe(0.4);
    });

    it('should default marketType to FUTURES and useBnbDiscount to false', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.marketType).toBe('FUTURES');
      expect(DEFAULT_TRAILING_STOP_CONFIG.useBnbDiscount).toBe(false);
    });

    it('should enable volatility-based thresholds by default', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useVolatilityBasedThresholds).toBe(true);
    });

    it('should enable ATR multiplier with a value of 2.0', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
    });

    it('should set swingLookback to 3 and minTrailingDistancePercent to 0.002', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
    });
  });

  describe('resolveTrailingStopConfig', () => {
    const baseConfig: TrailingStopOptimizationConfig = {
      ...DEFAULT_TRAILING_STOP_CONFIG,
      trailingDistancePercent: 0.5,
      useProfitLockDistance: false,
      useVolatilityBasedThresholds: true,
    };

    it('should return baseConfig values when no override and no wallet config', () => {
      const result = resolveTrailingStopConfig('LONG', null, null, baseConfig);

      expect(result.trailingDistancePercent).toBe(baseConfig.trailingDistancePercent);
      expect(result.useProfitLockDistance).toBe(baseConfig.useProfitLockDistance);
      expect(result.useVolatilityBasedThresholds).toBe(baseConfig.useVolatilityBasedThresholds);
      expect(result.activationPercentLong).toBeUndefined();
      expect(result.activationPercentShort).toBeUndefined();
    });

    it('should use walletConfig trailing distance for LONG when no override', () => {
      const walletConfig = makeWalletConfig({ trailingDistancePercentLong: '0.25' });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

      expect(result.trailingDistancePercent).toBe(0.25);
    });

    it('should use walletConfig trailing distance for SHORT when no override', () => {
      const walletConfig = makeWalletConfig({ trailingDistancePercentShort: '0.35' });
      const result = resolveTrailingStopConfig('SHORT', null, walletConfig, baseConfig);

      expect(result.trailingDistancePercent).toBe(0.35);
    });

    it('should use walletConfig activation percent for LONG when no override', () => {
      const walletConfig = makeWalletConfig({ trailingActivationPercentLong: '0.886' });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

      expect(result.activationPercentLong).toBe(0.886);
    });

    it('should use walletConfig activation percent for SHORT when no override', () => {
      const walletConfig = makeWalletConfig({ trailingActivationPercentShort: '0.786' });
      const result = resolveTrailingStopConfig('SHORT', null, walletConfig, baseConfig);

      expect(result.activationPercentShort).toBe(0.786);
    });

    it('should use walletConfig useProfitLockDistance when no override', () => {
      const walletConfig = makeWalletConfig({ useProfitLockDistance: true });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

      expect(result.useProfitLockDistance).toBe(true);
    });

    it('should use walletConfig useAdaptiveTrailing for useVolatilityBasedThresholds', () => {
      const walletConfig = makeWalletConfig({ useAdaptiveTrailing: false });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

      expect(result.useVolatilityBasedThresholds).toBe(false);
    });

    it('should prefer symbolOverride over walletConfig when useIndividualConfig is true', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistancePercentLong: '0.15',
        trailingDistancePercentShort: '0.20',
        trailingActivationPercentLong: '0.5',
        trailingActivationPercentShort: '0.6',
        useProfitLockDistance: true,
        useAdaptiveTrailing: false,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.4',
        trailingDistancePercentShort: '0.3',
        trailingActivationPercentLong: '0.9',
        trailingActivationPercentShort: '0.8',
        useProfitLockDistance: false,
        useAdaptiveTrailing: true,
      });

      const resultLong = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(resultLong.trailingDistancePercent).toBe(0.15);
      expect(resultLong.activationPercentLong).toBe(0.5);
      expect(resultLong.useProfitLockDistance).toBe(true);
      expect(resultLong.useVolatilityBasedThresholds).toBe(false);

      const resultShort = resolveTrailingStopConfig('SHORT', symbolOverride, walletConfig, baseConfig);
      expect(resultShort.trailingDistancePercent).toBe(0.20);
      expect(resultShort.activationPercentShort).toBe(0.6);
    });

    it('should ignore symbolOverride when useIndividualConfig is false', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: false,
        trailingDistancePercentLong: '0.15',
        trailingActivationPercentLong: '0.5',
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.4',
        trailingActivationPercentLong: '0.9',
      });

      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistancePercent).toBe(0.4);
      expect(result.activationPercentLong).toBe(0.9);
    });

    it('should fall back to walletConfig when override has null values and useIndividualConfig is true', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistancePercentLong: null,
        trailingActivationPercentLong: null,
        useProfitLockDistance: null,
        useAdaptiveTrailing: null,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.4',
        trailingActivationPercentLong: '0.9',
        useProfitLockDistance: true,
        useAdaptiveTrailing: false,
      });

      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistancePercent).toBe(0.4);
      expect(result.activationPercentLong).toBe(0.9);
      expect(result.useProfitLockDistance).toBe(true);
      expect(result.useVolatilityBasedThresholds).toBe(false);
    });

    it('should fall back to baseConfig when both override and walletConfig have null/falsy values', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistancePercentLong: null,
        trailingActivationPercentLong: null,
        useProfitLockDistance: null,
        useAdaptiveTrailing: null,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '',
        trailingActivationPercentLong: '',
        useProfitLockDistance: false,
        useAdaptiveTrailing: true,
      } as unknown as Partial<AutoTradingConfig>);

      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistancePercent).toBe(baseConfig.trailingDistancePercent);
    });

    it('should preserve baseConfig properties that are not overridden', () => {
      const walletConfig = makeWalletConfig({ trailingDistancePercentLong: '0.25' });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

      expect(result.breakevenProfitThreshold).toBe(baseConfig.breakevenProfitThreshold);
      expect(result.minTrailingDistancePercent).toBe(baseConfig.minTrailingDistancePercent);
      expect(result.swingLookback).toBe(baseConfig.swingLookback);
      expect(result.useATRMultiplier).toBe(baseConfig.useATRMultiplier);
      expect(result.atrMultiplier).toBe(baseConfig.atrMultiplier);
    });

    it('should select LONG distance for LONG side and SHORT distance for SHORT side', () => {
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.25',
        trailingDistancePercentShort: '0.35',
      });

      const longResult = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);
      const shortResult = resolveTrailingStopConfig('SHORT', null, walletConfig, baseConfig);

      expect(longResult.trailingDistancePercent).toBe(0.25);
      expect(shortResult.trailingDistancePercent).toBe(0.35);
    });
  });

  describe('calculateBreakevenPrice', () => {
    it('should return entry price when buffer is zero for LONG', () => {
      expect(calculateBreakevenPrice(50000, true, 0)).toBe(50000);
    });

    it('should return entry price when buffer is zero for SHORT', () => {
      expect(calculateBreakevenPrice(50000, false, 0)).toBe(50000);
    });

    it('should add buffer above entry for LONG', () => {
      expect(calculateBreakevenPrice(100, true, 0.01)).toBeCloseTo(101, 6);
    });

    it('should subtract buffer below entry for SHORT', () => {
      expect(calculateBreakevenPrice(100, false, 0.01)).toBeCloseTo(99, 6);
    });

    it('should return entry price when buffer is omitted (default 0)', () => {
      expect(calculateBreakevenPrice(200, true)).toBe(200);
      expect(calculateBreakevenPrice(200, false)).toBe(200);
    });

    it('should handle large entry prices with small buffers', () => {
      expect(calculateBreakevenPrice(65000, true, 0.0001)).toBeCloseTo(65006.5, 2);
    });

    it('should produce symmetric results for LONG and SHORT with same buffer', () => {
      const longBE = calculateBreakevenPrice(100, true, 0.005);
      const shortBE = calculateBreakevenPrice(100, false, 0.005);
      expect(longBE + shortBE).toBeCloseTo(200, 6);
    });
  });

  describe('calculateFeesCoveredPrice', () => {
    it('should use explicit feePercent when provided for LONG', () => {
      expect(calculateFeesCoveredPrice(100, true, 0.003)).toBeCloseTo(100.3, 6);
    });

    it('should use explicit feePercent when provided for SHORT', () => {
      expect(calculateFeesCoveredPrice(100, false, 0.003)).toBeCloseTo(99.7, 6);
    });

    it('should use getRoundTripFee for FUTURES when feePercent not provided', () => {
      const price = calculateFeesCoveredPrice(100, true, undefined, 'FUTURES', false);
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'FUTURES', useBnbDiscount: false });
      expect(price).toBeCloseTo(100.08, 4);
    });

    it('should use getRoundTripFee for SPOT when feePercent not provided', () => {
      const price = calculateFeesCoveredPrice(100, true, undefined, 'SPOT', false);
      expect(getRoundTripFee).toHaveBeenCalledWith({ marketType: 'SPOT', useBnbDiscount: false });
      expect(price).toBeCloseTo(100.2, 4);
    });

    it('should apply BNB discount when useBnbDiscount is true', () => {
      const priceWithDiscount = calculateFeesCoveredPrice(100, true, undefined, 'FUTURES', true);
      const priceWithoutDiscount = calculateFeesCoveredPrice(100, true, undefined, 'FUTURES', false);
      expect(priceWithDiscount).toBeLessThan(priceWithoutDiscount);
    });

    it('should default marketType to FUTURES and useBnbDiscount to false', () => {
      const price = calculateFeesCoveredPrice(100, true);
      expect(price).toBeCloseTo(100.08, 4);
    });

    it('should produce LONG result above entry and SHORT result below entry', () => {
      const longPrice = calculateFeesCoveredPrice(1000, true, 0.001);
      const shortPrice = calculateFeesCoveredPrice(1000, false, 0.001);
      expect(longPrice).toBeGreaterThan(1000);
      expect(shortPrice).toBeLessThan(1000);
    });

    it('should produce symmetric offsets for LONG and SHORT', () => {
      const longPrice = calculateFeesCoveredPrice(100, true, 0.002);
      const shortPrice = calculateFeesCoveredPrice(100, false, 0.002);
      expect(longPrice - 100).toBeCloseTo(100 - shortPrice, 6);
    });
  });

  describe('calculateNewStopLoss', () => {
    it('should return breakeven when swingStop is null for LONG', () => {
      expect(calculateNewStopLoss(100.5, null, true)).toBe(100.5);
    });

    it('should return breakeven when swingStop is null for SHORT', () => {
      expect(calculateNewStopLoss(99.5, null, false)).toBe(99.5);
    });

    it('should return swingStop when it is higher than breakeven for LONG', () => {
      expect(calculateNewStopLoss(100, 102, true)).toBe(102);
    });

    it('should return breakeven when it is higher than swingStop for LONG', () => {
      expect(calculateNewStopLoss(103, 101, true)).toBe(103);
    });

    it('should return swingStop when it is lower than breakeven for SHORT', () => {
      expect(calculateNewStopLoss(100, 98, false)).toBe(98);
    });

    it('should return breakeven when it is lower than swingStop for SHORT', () => {
      expect(calculateNewStopLoss(97, 99, false)).toBe(97);
    });

    it('should return breakeven when both values are equal for LONG', () => {
      expect(calculateNewStopLoss(100, 100, true)).toBe(100);
    });

    it('should return breakeven when both values are equal for SHORT', () => {
      expect(calculateNewStopLoss(100, 100, false)).toBe(100);
    });
  });

  describe('computeTrailingStop', () => {
    const defaultConfig: TrailingStopOptimizationConfig = {
      ...DEFAULT_TRAILING_STOP_CONFIG,
      breakevenProfitThreshold: 0.005,
      breakevenWithFeesThreshold: 0.01,
    };

    it('should delegate to computeTrailingStopCore with correct input mapping for LONG', () => {
      mockComputeTrailingStopCore.mockReturnValue({ newStopLoss: 101, reason: 'fees_covered' });

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 102,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 110,
        swingPoints: [{ price: 101, type: 'low' }],
        atr: 1.5,
        highestPrice: 103,
        lowestPrice: 98,
      };

      computeTrailingStop(input, defaultConfig);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.objectContaining({
          entryPrice: 100,
          currentPrice: 102,
          currentStopLoss: null,
          side: 'LONG',
          takeProfit: 110,
          swingPoints: [{ price: 101, type: 'low' }],
          atr: 1.5,
          highestPrice: 103,
          lowestPrice: undefined,
        }),
        expect.objectContaining({
          feePercent: defaultConfig.feePercent,
          marketType: 'FUTURES',
          useBnbDiscount: false,
          minTrailingDistancePercent: defaultConfig.minTrailingDistancePercent,
          atrMultiplier: defaultConfig.atrMultiplier,
          trailingDistancePercent: defaultConfig.trailingDistancePercent,
        })
      );
    });

    it('should pass lowestPrice for SHORT and omit highestPrice', () => {
      mockComputeTrailingStopCore.mockReturnValue({ newStopLoss: 99, reason: 'fees_covered' });

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 98,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [],
        highestPrice: 103,
        lowestPrice: 97,
      };

      computeTrailingStop(input, defaultConfig);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.objectContaining({
          highestPrice: undefined,
          lowestPrice: 97,
        }),
        expect.anything()
      );
    });

    it('should return the result from computeTrailingStopCore', () => {
      const expectedResult = { newStopLoss: 101.5, reason: 'swing_trail' as const };
      mockComputeTrailingStopCore.mockReturnValue(expectedResult);

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).toEqual(expectedResult);
    });

    it('should return null when computeTrailingStopCore returns null', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.1,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      const result = computeTrailingStop(input, defaultConfig);
      expect(result).toBeNull();
    });

    it('should pass useFibonacciThresholds from config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        useFibonacciThresholds: true,
      };

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
        fibonacciProjection: {
          swingLow: { price: 90, index: 0, timestamp: 1000 },
          swingHigh: { price: 100, index: 10, timestamp: 2000 },
          range: 10,
          primaryLevel: 1.618,
          levels: [],
        },
      };

      computeTrailingStop(input, config);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.objectContaining({
          fibonacciProjection: expect.objectContaining({ range: 10 }),
        }),
        expect.objectContaining({
          useFibonacciThresholds: true,
        })
      );
    });

    it('should default marketType to FUTURES when not set in config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        marketType: undefined,
      };

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      computeTrailingStop(input, config);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ marketType: 'FUTURES' })
      );
    });

    it('should default useBnbDiscount to false when not set in config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        useBnbDiscount: undefined,
      };

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      computeTrailingStop(input, config);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ useBnbDiscount: false })
      );
    });

    it('should pass useProfitLockDistance and activation percents from config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        useProfitLockDistance: true,
        activationPercentLong: 0.886,
        activationPercentShort: 0.786,
      };

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      computeTrailingStop(input, config);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          useProfitLockDistance: true,
          activationPercentLong: 0.886,
          activationPercentShort: 0.786,
        })
      );
    });

    it('should pass SPOT marketType when configured', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        marketType: 'SPOT',
        useBnbDiscount: true,
      };

      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 105,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };

      computeTrailingStop(input, config);

      expect(mockComputeTrailingStopCore).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          marketType: 'SPOT',
          useBnbDiscount: true,
        })
      );
    });
  });
});
