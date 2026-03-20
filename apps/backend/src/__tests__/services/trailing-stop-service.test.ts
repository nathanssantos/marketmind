import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TrailingStopOptimizationConfig } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn(() => []),
  calculateSwingPoints: vi.fn(() => ({ swingPoints: [] })),
}));

vi.mock('../../constants', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    TRAILING_STOP: {
      PEAK_PROFIT_FLOOR: 0.3,
      PEAK_PROFIT_FLOOR_LONG: 0.25,
      PEAK_PROFIT_FLOOR_SHORT: 0.35,
      TP_PROGRESS_THRESHOLD_LONG: 0.886,
      TP_PROGRESS_THRESHOLD_SHORT: 0.786,
    },
  };
});

vi.mock('../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve([])),
      })),
    })),
    query: {
      priceCache: { findFirst: vi.fn().mockResolvedValue(null) },
      klines: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) },
      setupDetections: { findFirst: vi.fn().mockResolvedValue(null) },
      autoTradingConfig: { findFirst: vi.fn().mockResolvedValue(null) },
      symbolTrailingStopOverrides: { findFirst: vi.fn().mockResolvedValue(null) },
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

vi.mock('../../services/protection-orders', () => ({
  updateStopLossOrder: vi.fn().mockResolvedValue({ algoId: null }),
}));

vi.mock('../../services/volatility-profile', () => ({
  calculateATRPercent: vi.fn(() => 0.02),
  getVolatilityProfile: vi.fn(() => ({
    atrMultiplier: 2.0,
    minTrailingDistance: 0.002,
  })),
}));

vi.mock('../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => e),
}));

vi.mock('../../utils/formatters', () => ({
  formatPrice: vi.fn((p: number) => p.toString()),
}));

import {
  computeTrailingStop,
  DEFAULT_TRAILING_STOP_CONFIG,
  resolveTrailingStopConfig,
  TrailingStopService,
  type TrailingStopInput,
} from '../../services/trailing-stop';
import type { AutoTradingConfig, SymbolTrailingStopOverride } from '../../db/schema';

const makeSymbolOverride = (overrides: Partial<SymbolTrailingStopOverride> = {}): SymbolTrailingStopOverride => ({
  id: 1,
  walletId: 'wallet-1',
  symbol: 'BTCUSDT',
  useIndividualConfig: true,
  trailingStopEnabled: true,
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
  isEnabled: true,
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
  trailingDistanceMode: 'fixed',
  trailingStopOffsetPercent: '0',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as AutoTradingConfig);

const makeBaseConfig = (overrides: Partial<TrailingStopOptimizationConfig> = {}): TrailingStopOptimizationConfig => ({
  ...DEFAULT_TRAILING_STOP_CONFIG,
  ...overrides,
});

describe('trailing-stop-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('resolveTrailingStopConfig', () => {
    describe('activationPercentLong', () => {
      it('should use symbol override when useIndividualConfig is true and value is set', () => {
        const override = makeSymbolOverride({ trailingActivationPercentLong: '0.75' });
        const walletCfg = makeWalletConfig({ trailingActivationPercentLong: '0.9' });
        const base = makeBaseConfig({ activationPercentLong: 0.95 });
        const result = resolveTrailingStopConfig('LONG', override, walletCfg, base);
        expect(result.activationPercentLong).toBe(0.75);
      });

      it('should fall back to wallet config when symbol override has null value', () => {
        const override = makeSymbolOverride({ trailingActivationPercentLong: null });
        const walletCfg = makeWalletConfig({ trailingActivationPercentLong: '0.85' });
        const base = makeBaseConfig({ activationPercentLong: 0.95 });
        const result = resolveTrailingStopConfig('LONG', override, walletCfg, base);
        expect(result.activationPercentLong).toBe(0.85);
      });

      it('should fall back to wallet config when useIndividualConfig is false', () => {
        const override = makeSymbolOverride({ useIndividualConfig: false, trailingActivationPercentLong: '0.75' });
        const walletCfg = makeWalletConfig({ trailingActivationPercentLong: '0.85' });
        const result = resolveTrailingStopConfig('LONG', override, walletCfg, makeBaseConfig());
        expect(result.activationPercentLong).toBe(0.85);
      });

      it('should return undefined when neither override nor wallet config have a value', () => {
        const result = resolveTrailingStopConfig('LONG', null, null, makeBaseConfig());
        expect(result.activationPercentLong).toBeUndefined();
      });
    });

    describe('activationPercentShort', () => {
      it('should use symbol override when useIndividualConfig is true and value is set', () => {
        const override = makeSymbolOverride({ trailingActivationPercentShort: '0.65' });
        const walletCfg = makeWalletConfig({ trailingActivationPercentShort: '0.8' });
        const result = resolveTrailingStopConfig('SHORT', override, walletCfg, makeBaseConfig());
        expect(result.activationPercentShort).toBe(0.65);
      });

      it('should fall back to wallet config when override is null', () => {
        const walletCfg = makeWalletConfig({ trailingActivationPercentShort: '0.7' });
        const result = resolveTrailingStopConfig('SHORT', null, walletCfg, makeBaseConfig());
        expect(result.activationPercentShort).toBe(0.7);
      });

      it('should return 0 when wallet config has string zero', () => {
        const walletCfg = makeWalletConfig({ trailingActivationPercentShort: '0' });
        const result = resolveTrailingStopConfig('SHORT', null, walletCfg, makeBaseConfig());
        expect(result.activationPercentShort).toBe(0);
      });

      it('should return undefined when no source provides a value', () => {
        const result = resolveTrailingStopConfig('SHORT', null, null, makeBaseConfig());
        expect(result.activationPercentShort).toBeUndefined();
      });
    });

    describe('trailingDistancePercent', () => {
      it('should use symbol override distanceLong for LONG side', () => {
        const override = makeSymbolOverride({ trailingDistancePercentLong: '0.15' });
        const result = resolveTrailingStopConfig('LONG', override, null, makeBaseConfig());
        expect(result.trailingDistancePercent).toBe(0.15);
      });

      it('should use symbol override distanceShort for SHORT side', () => {
        const override = makeSymbolOverride({ trailingDistancePercentShort: '0.2' });
        const result = resolveTrailingStopConfig('SHORT', override, null, makeBaseConfig());
        expect(result.trailingDistancePercent).toBe(0.2);
      });

      it('should fall back to wallet config distanceLong for LONG when override is null', () => {
        const walletCfg = makeWalletConfig({ trailingDistancePercentLong: '0.35' });
        const result = resolveTrailingStopConfig('LONG', null, walletCfg, makeBaseConfig());
        expect(result.trailingDistancePercent).toBe(0.35);
      });

      it('should fall back to wallet config distanceShort for SHORT when override is null', () => {
        const walletCfg = makeWalletConfig({ trailingDistancePercentShort: '0.25' });
        const result = resolveTrailingStopConfig('SHORT', null, walletCfg, makeBaseConfig());
        expect(result.trailingDistancePercent).toBe(0.25);
      });

      it('should fall back to baseConfig trailingDistancePercent when no override and no wallet config', () => {
        const base = makeBaseConfig({ trailingDistancePercent: 0.5 });
        const result = resolveTrailingStopConfig('LONG', null, null, base);
        expect(result.trailingDistancePercent).toBe(0.5);
      });

      it('should use SHORT distance from override even when LONG distance is also set', () => {
        const override = makeSymbolOverride({
          trailingDistancePercentLong: '0.1',
          trailingDistancePercentShort: '0.2',
        });
        const result = resolveTrailingStopConfig('SHORT', override, null, makeBaseConfig());
        expect(result.trailingDistancePercent).toBe(0.2);
      });
    });

    describe('useVolatilityBasedThresholds', () => {
      it('should use symbol override useAdaptiveTrailing when useIndividualConfig is true', () => {
        const override = makeSymbolOverride({ useAdaptiveTrailing: false });
        const walletCfg = makeWalletConfig({ useAdaptiveTrailing: true });
        const base = makeBaseConfig({ useVolatilityBasedThresholds: true });
        const result = resolveTrailingStopConfig('LONG', override, walletCfg, base);
        expect(result.useVolatilityBasedThresholds).toBe(false);
      });

      it('should fall back to wallet config useAdaptiveTrailing when override is null', () => {
        const walletCfg = makeWalletConfig({ useAdaptiveTrailing: false });
        const base = makeBaseConfig({ useVolatilityBasedThresholds: true });
        const result = resolveTrailingStopConfig('LONG', null, walletCfg, base);
        expect(result.useVolatilityBasedThresholds).toBe(false);
      });

      it('should fall back to base config when no wallet config', () => {
        const base = makeBaseConfig({ useVolatilityBasedThresholds: true });
        const result = resolveTrailingStopConfig('LONG', null, null, base);
        expect(result.useVolatilityBasedThresholds).toBe(true);
      });

      it('should use override null and fall through to wallet config', () => {
        const override = makeSymbolOverride({ useAdaptiveTrailing: null });
        const walletCfg = makeWalletConfig({ useAdaptiveTrailing: true });
        const result = resolveTrailingStopConfig('LONG', override, walletCfg, makeBaseConfig({ useVolatilityBasedThresholds: false }));
        expect(result.useVolatilityBasedThresholds).toBe(true);
      });
    });

    describe('priority chain', () => {
      it('should spread baseConfig first then override specific fields', () => {
        const base = makeBaseConfig({
          swingLookback: 5,
          useATRMultiplier: false,
        });
        const result = resolveTrailingStopConfig('LONG', null, null, base);
        expect(result.swingLookback).toBe(5);
        expect(result.useATRMultiplier).toBe(false);
      });

      it('should produce consistent results for LONG and SHORT when configs differ by side', () => {
        const override = makeSymbolOverride({
          trailingDistancePercentLong: '0.1',
          trailingDistancePercentShort: '0.2',
        });
        const longResult = resolveTrailingStopConfig('LONG', override, null, makeBaseConfig());
        const shortResult = resolveTrailingStopConfig('SHORT', override, null, makeBaseConfig());
        expect(longResult.trailingDistancePercent).toBe(0.1);
        expect(shortResult.trailingDistancePercent).toBe(0.2);
      });
    });
  });

  describe('computeTrailingStop', () => {
    const baseConfig = makeBaseConfig({ forceActivated: true });

    it('should return null when profit is below threshold for LONG', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 100.1,
        currentStopLoss: null,
        side: 'LONG',
        swingPoints: [],
      };
      expect(computeTrailingStop(input, baseConfig)).toBeNull();
    });

    it('should return null when profit is below threshold for SHORT', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 99.9,
        currentStopLoss: null,
        side: 'SHORT',
        swingPoints: [],
      };
      expect(computeTrailingStop(input, baseConfig)).toBeNull();
    });

    it('should pass highestPrice only for LONG positions', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 115,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 120,
        swingPoints: [],
        highestPrice: 116,
        lowestPrice: 80,
      };
      const result = computeTrailingStop(input, baseConfig);
      expect(result).not.toBeNull();
    });

    it('should pass lowestPrice only for SHORT positions', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 85,
        currentStopLoss: null,
        side: 'SHORT',
        takeProfit: 80,
        swingPoints: [],
        highestPrice: 120,
        lowestPrice: 84,
      };
      const result = computeTrailingStop(input, baseConfig);
      expect(result).not.toBeNull();
    });

    it('should use marketType from config defaulting to FUTURES', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 115,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 120,
        swingPoints: [],
        highestPrice: 116,
      };
      const configWithoutMarket = { ...baseConfig, marketType: undefined } as TrailingStopOptimizationConfig;
      const result = computeTrailingStop(input, configWithoutMarket);
      expect(result).not.toBeNull();
    });

    it('should use useBnbDiscount from config defaulting to false', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 115,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 120,
        swingPoints: [],
        highestPrice: 116,
      };
      const configWithoutBnb = { ...baseConfig, useBnbDiscount: undefined } as TrailingStopOptimizationConfig;
      const result = computeTrailingStop(input, configWithoutBnb);
      expect(result).not.toBeNull();
    });

    it('should pass useFibonacciThresholds from config', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 115,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 120,
        swingPoints: [],
        highestPrice: 116,
      };
      const fibConfig = { ...baseConfig, useFibonacciThresholds: false };
      const result = computeTrailingStop(input, fibConfig);
      expect(result).not.toBeNull();
    });

    it('should pass activationPercentLong and activationPercentShort from config', () => {
      const input: TrailingStopInput = {
        entryPrice: 100,
        currentPrice: 115,
        currentStopLoss: null,
        side: 'LONG',
        takeProfit: 120,
        swingPoints: [],
        highestPrice: 116,
      };
      const configWithActivation = {
        ...baseConfig,
        activationPercentLong: 0.5,
        activationPercentShort: 0.6,
      };
      const result = computeTrailingStop(input, configWithActivation);
      expect(result).not.toBeNull();
    });
  });

  describe('TrailingStopService', () => {
    describe('constructor', () => {
      it('should use DEFAULT_TRAILING_STOP_CONFIG when no config provided', () => {
        const service = new TrailingStopService();
        const config = service.getConfig();
        expect(config.minTrailingDistancePercent).toBe(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent);
        expect(config.swingLookback).toBe(DEFAULT_TRAILING_STOP_CONFIG.swingLookback);
        expect(config.useATRMultiplier).toBe(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier);
        expect(config.atrMultiplier).toBe(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier);
        expect(config.marketType).toBe('FUTURES');
        expect(config.useBnbDiscount).toBe(false);
      });

      it('should merge partial config with defaults', () => {
        const service = new TrailingStopService({ atrMultiplier: 3, marketType: 'SPOT' });
        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(3);
        expect(config.marketType).toBe('SPOT');
        expect(config.minTrailingDistancePercent).toBe(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent);
      });

      it('should allow overriding all default config fields', () => {
        const customConfig: Partial<TrailingStopOptimizationConfig> = {
          minTrailingDistancePercent: 0.01,
          swingLookback: 10,
          useATRMultiplier: false,
          atrMultiplier: 5,
          trailingDistancePercent: 0.5,
          useVolatilityBasedThresholds: false,
          marketType: 'SPOT',
          useBnbDiscount: true,
        };
        const service = new TrailingStopService(customConfig);
        const config = service.getConfig();
        expect(config.minTrailingDistancePercent).toBe(0.01);
        expect(config.swingLookback).toBe(10);
        expect(config.useATRMultiplier).toBe(false);
        expect(config.atrMultiplier).toBe(5);
        expect(config.trailingDistancePercent).toBe(0.5);
        expect(config.useVolatilityBasedThresholds).toBe(false);
        expect(config.marketType).toBe('SPOT');
        expect(config.useBnbDiscount).toBe(true);
      });
    });

    describe('updateConfig', () => {
      it('should update a single field while preserving others', () => {
        const service = new TrailingStopService({ marketType: 'SPOT', atrMultiplier: 2 });
        service.updateConfig({ atrMultiplier: 4 });
        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(4);
        expect(config.marketType).toBe('SPOT');
      });

      it('should allow multiple sequential updates', () => {
        const service = new TrailingStopService();
        service.updateConfig({ atrMultiplier: 3 });
        service.updateConfig({ marketType: 'SPOT' });
        service.updateConfig({ useBnbDiscount: true });
        const config = service.getConfig();
        expect(config.atrMultiplier).toBe(3);
        expect(config.marketType).toBe('SPOT');
        expect(config.useBnbDiscount).toBe(true);
      });

      it('should overwrite previously updated values', () => {
        const service = new TrailingStopService();
        service.updateConfig({ atrMultiplier: 3 });
        service.updateConfig({ atrMultiplier: 5 });
        expect(service.getConfig().atrMultiplier).toBe(5);
      });
    });

    describe('getConfig', () => {
      it('should return a defensive copy (not the internal reference)', () => {
        const service = new TrailingStopService();
        const config1 = service.getConfig();
        const config2 = service.getConfig();
        expect(config1).toEqual(config2);
        expect(config1).not.toBe(config2);
      });

      it('should not be affected by external mutations of returned config', () => {
        const service = new TrailingStopService({ atrMultiplier: 2 });
        const config = service.getConfig();
        config.atrMultiplier = 999;
        expect(service.getConfig().atrMultiplier).toBe(2);
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
    it('should use TRAILING_STOP PEAK_PROFIT_FLOOR for trailingDistancePercent', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.trailingDistancePercent).toBe(0.3);
    });

    it('should have minTrailingDistancePercent of 0.002', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.minTrailingDistancePercent).toBe(0.002);
    });

    it('should have swingLookback of 3', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.swingLookback).toBe(3);
    });

    it('should enable ATR multiplier by default', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useATRMultiplier).toBe(true);
    });

    it('should have atrMultiplier of 2.0', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.atrMultiplier).toBe(2.0);
    });

    it('should enable volatility based thresholds by default', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useVolatilityBasedThresholds).toBe(true);
    });

    it('should default to FUTURES market type', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.marketType).toBe('FUTURES');
    });

    it('should default to no BNB discount', () => {
      expect(DEFAULT_TRAILING_STOP_CONFIG.useBnbDiscount).toBe(false);
    });
  });
});
