import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';

const { mockComputeTrailingStopCore } = vi.hoisted(() => ({
  mockComputeTrailingStopCore: vi.fn(),
}));

vi.mock('../lib/indicators', () => ({
  calculateATR: vi.fn(() => []),
  calculateSwingPoints: vi.fn(() => ({ swingPoints: [] })),
}));

vi.mock('../constants', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    TRAILING_STOP: {
      PEAK_PROFIT_FLOOR: 0.4,
      PEAK_PROFIT_FLOOR_LONG: 0.4,
      PEAK_PROFIT_FLOOR_SHORT: 0.3,
      ATR_MULTIPLIER: 0.002,
      MIN_STOP_CHANGE_ABSOLUTE: 0.005,
    },
  };
});

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
  calculateAutoStopOffset,
  computeTrailingStop,
  DEFAULT_TRAILING_STOP_CONFIG,
  resolveTrailingStopConfig,
  type TrailingStopInput,
} from '../services/trailing-stop';
import type { AutoTradingConfig, SymbolTrailingStopOverride } from '../db/schema';

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
  trailingDistanceMode: null,
  trailingStopOffsetPercent: null,
  trailingActivationModeLong: null,
  trailingActivationModeShort: null,
  manualTrailingActivatedLong: false,
  manualTrailingActivatedShort: false,
  indicatorInterval: null,
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
  trailingDistanceMode: 'fixed',
  trailingStopOffsetPercent: '0',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as AutoTradingConfig);

describe('trailing-stop exports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('DEFAULT_TRAILING_STOP_CONFIG', () => {
    it('should set trailingDistancePercent from PEAK_PROFIT_FLOOR', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBe(0.4);
    });

    it('should set marketType to FUTURES and useBnbDiscount to false', () => {
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
      useVolatilityBasedThresholds: true,
    };

    it('should return baseConfig values when no override and no wallet config', () => {
      const result = resolveTrailingStopConfig('LONG', null, null, baseConfig);

      expect(result.trailingDistancePercent).toBe(baseConfig.trailingDistancePercent);
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
        useAdaptiveTrailing: false,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.4',
        trailingDistancePercentShort: '0.3',
        trailingActivationPercentLong: '0.9',
        trailingActivationPercentShort: '0.8',
        useAdaptiveTrailing: true,
      });

      const resultLong = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(resultLong.trailingDistancePercent).toBe(0.15);
      expect(resultLong.activationPercentLong).toBe(0.5);
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
        useAdaptiveTrailing: null,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '0.4',
        trailingActivationPercentLong: '0.9',
        useAdaptiveTrailing: false,
      });

      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistancePercent).toBe(0.4);
      expect(result.activationPercentLong).toBe(0.9);
      expect(result.useVolatilityBasedThresholds).toBe(false);
    });

    it('should fall back to baseConfig when both override and walletConfig have null/falsy values', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistancePercentLong: null,
        trailingActivationPercentLong: null,
        useAdaptiveTrailing: null,
      });
      const walletConfig = makeWalletConfig({
        trailingDistancePercentLong: '',
        trailingActivationPercentLong: '',
        useAdaptiveTrailing: true,
      } as unknown as Partial<AutoTradingConfig>);

      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistancePercent).toBe(baseConfig.trailingDistancePercent);
    });

    it('should preserve baseConfig properties that are not overridden', () => {
      const walletConfig = makeWalletConfig({ trailingDistancePercentLong: '0.25' });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);

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

  describe('computeTrailingStop', () => {
    const defaultConfig: TrailingStopOptimizationConfig = {
      ...DEFAULT_TRAILING_STOP_CONFIG,
    };

    it('should delegate to computeTrailingStopCore with correct input mapping for LONG', () => {
      mockComputeTrailingStopCore.mockReturnValue({ newStopLoss: 101, reason: 'progressive_trail' });

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
          minTrailingDistancePercent: defaultConfig.minTrailingDistancePercent,
          atrMultiplier: defaultConfig.atrMultiplier,
          trailingDistancePercent: defaultConfig.trailingDistancePercent,
        })
      );
    });

    it('should pass lowestPrice for SHORT and omit highestPrice', () => {
      mockComputeTrailingStopCore.mockReturnValue({ newStopLoss: 99, reason: 'progressive_trail' });

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

    it('should pass activation percents from config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
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
          activationPercentLong: 0.886,
          activationPercentShort: 0.786,
        })
      );
    });

    it('should pass forceActivated from config', () => {
      mockComputeTrailingStopCore.mockReturnValue(null);

      const config: TrailingStopOptimizationConfig = {
        ...defaultConfig,
        forceActivated: true,
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
          forceActivated: true,
        })
      );
    });
  });

  describe('calculateAutoStopOffset', () => {
    it('should return 0 for very low volatility (ATR < 0.5%)', () => {
      expect(calculateAutoStopOffset(0.001)).toBe(0);
      expect(calculateAutoStopOffset(0.004)).toBe(0);
    });

    it('should return 0.0025 for low volatility (0.5% <= ATR < 1%)', () => {
      expect(calculateAutoStopOffset(0.005)).toBe(0.0025);
      expect(calculateAutoStopOffset(0.009)).toBe(0.0025);
    });

    it('should return 0.005 for medium-low volatility (1% <= ATR < 2%)', () => {
      expect(calculateAutoStopOffset(0.01)).toBe(0.005);
      expect(calculateAutoStopOffset(0.015)).toBe(0.005);
      expect(calculateAutoStopOffset(0.019)).toBe(0.005);
    });

    it('should return 0.0075 for medium volatility (2% <= ATR < 3%)', () => {
      expect(calculateAutoStopOffset(0.02)).toBe(0.0075);
      expect(calculateAutoStopOffset(0.025)).toBe(0.0075);
      expect(calculateAutoStopOffset(0.029)).toBe(0.0075);
    });

    it('should return 0.01 for high volatility (3% <= ATR < 4%)', () => {
      expect(calculateAutoStopOffset(0.03)).toBe(0.01);
      expect(calculateAutoStopOffset(0.035)).toBe(0.01);
      expect(calculateAutoStopOffset(0.039)).toBe(0.01);
    });

    it('should return 0.015 for extreme volatility (ATR >= 4%)', () => {
      expect(calculateAutoStopOffset(0.04)).toBe(0.015);
      expect(calculateAutoStopOffset(0.05)).toBe(0.015);
      expect(calculateAutoStopOffset(0.10)).toBe(0.015);
    });

    it('should handle boundary values correctly', () => {
      expect(calculateAutoStopOffset(0)).toBe(0);
      expect(calculateAutoStopOffset(0.005)).toBe(0.0025);
      expect(calculateAutoStopOffset(0.01)).toBe(0.005);
      expect(calculateAutoStopOffset(0.02)).toBe(0.0075);
      expect(calculateAutoStopOffset(0.03)).toBe(0.01);
      expect(calculateAutoStopOffset(0.04)).toBe(0.015);
    });
  });

  describe('resolveTrailingStopConfig - trailingDistanceMode', () => {
    const baseConfig: TrailingStopOptimizationConfig = {
      ...DEFAULT_TRAILING_STOP_CONFIG,
      trailingDistanceMode: 'fixed',
    };

    it('should default to fixed when no override or wallet config', () => {
      const result = resolveTrailingStopConfig('LONG', null, null, baseConfig);
      expect(result.trailingDistanceMode).toBe('fixed');
    });

    it('should use wallet config trailingDistanceMode', () => {
      const walletConfig = makeWalletConfig({ trailingDistanceMode: 'auto' });
      const result = resolveTrailingStopConfig('LONG', null, walletConfig, baseConfig);
      expect(result.trailingDistanceMode).toBe('auto');
    });

    it('should use symbol override trailingDistanceMode when individual config is enabled', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistanceMode: 'auto',
      });
      const walletConfig = makeWalletConfig({ trailingDistanceMode: 'fixed' });
      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistanceMode).toBe('auto');
    });

    it('should fall back to wallet config when symbol override has null trailingDistanceMode', () => {
      const symbolOverride = makeSymbolOverride({
        useIndividualConfig: true,
        trailingDistanceMode: null,
      });
      const walletConfig = makeWalletConfig({ trailingDistanceMode: 'auto' });
      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseConfig);
      expect(result.trailingDistanceMode).toBe('auto');
    });

    it('should fall back to base config when both override and wallet are null', () => {
      const symbolOverride = makeSymbolOverride({ useIndividualConfig: false });
      const walletConfig = makeWalletConfig();
      const baseWithAuto: TrailingStopOptimizationConfig = {
        ...baseConfig,
        trailingDistanceMode: 'auto',
      };
      const result = resolveTrailingStopConfig('LONG', symbolOverride, walletConfig, baseWithAuto);
      expect(result.trailingDistanceMode).toBe('fixed');
    });

    it('should default to fixed when trailingDistanceMode is undefined in base config', () => {
      const baseWithoutMode: TrailingStopOptimizationConfig = {
        ...DEFAULT_TRAILING_STOP_CONFIG,
      };
      const result = resolveTrailingStopConfig('LONG', null, null, baseWithoutMode);
      expect(result.trailingDistanceMode).toBe('fixed');
    });
  });
});
