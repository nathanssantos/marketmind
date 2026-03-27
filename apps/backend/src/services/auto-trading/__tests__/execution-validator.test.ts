import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TradingSetup } from '@marketmind/types';
import { WatcherLogBuffer } from '@marketmind/logger';

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: { $inferSelect: {} },
  tradeExecutions: {
    $inferSelect: {},
    walletId: 'walletId',
    status: 'status',
    symbol: 'symbol',
    side: 'side',
  },
  tradingProfiles: { id: 'id' },
}));

vi.mock('../../profile-applicator', () => ({
  applyProfileOverrides: vi.fn((config: unknown) => config),
}));

vi.mock('../../../utils/trading-validation', () => ({
  isDirectionAllowed: vi.fn(() => true),
}));

vi.mock('../../cooldown', () => ({
  cooldownService: {
    checkCooldown: vi.fn().mockResolvedValue({ inCooldown: false }),
  },
}));

vi.mock('../../pyramiding', () => ({
  pyramidingService: {
    evaluatePyramidByMode: vi.fn(),
    calculateDynamicPositionSize: vi.fn(),
  },
}));

vi.mock('../../risk-manager', () => ({
  riskManagerService: {
    validateNewPosition: vi.fn().mockResolvedValue({ isValid: true }),
  },
}));

vi.mock('../../wallet-lock', () => ({
  walletLockService: {
    acquire: vi.fn().mockResolvedValue(vi.fn()),
  },
}));

vi.mock('../../../utils/filters/filter-registry', () => ({
  buildFilterConfigFromDb: vi.fn(() => ({})),
}));

vi.mock('../validation/fibonacci-calculator', () => ({
  calculateFibonacciTakeProfit: vi.fn(),
}));

vi.mock('../../../constants', () => ({
  BACKTEST_DEFAULTS: {
    MIN_RISK_REWARD_RATIO_LONG: 1.0,
    MIN_RISK_REWARD_RATIO_SHORT: 1.0,
  },
}));

import {
  resolveTpConfig,
  buildFilterConfig,
  validateRiskReward,
  resolveConfig,
  type ExecutionValidatorDeps,
} from '../validation/execution-validator';

const createLogBuffer = (): WatcherLogBuffer =>
  new WatcherLogBuffer('watcher-1', 'BTCUSDT', '4h', 'FUTURES');

describe('resolveTpConfig', () => {
  it('should return defaults when config is null', () => {
    const result = resolveTpConfig(null, 'LONG');
    expect(result.tpCalculationMode).toBe('default');
    expect(result.effectiveFibLevel).toBe('2');
    expect(result.fibonacciSwingRange).toBe('nearest');
  });

  it('should return SHORT default fib level for SHORT direction', () => {
    const result = resolveTpConfig(null, 'SHORT');
    expect(result.effectiveFibLevel).toBe('1.272');
  });

  it('should use per-direction fib levels from config', () => {
    const config = {
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevelLong: '1.618',
      fibonacciTargetLevelShort: '1.382',
      fibonacciTargetLevel: '2',
      fibonacciSwingRange: 'extended',
    } as never;
    const resultLong = resolveTpConfig(config, 'LONG');
    expect(resultLong.effectiveFibLevel).toBe('1.618');
    const resultShort = resolveTpConfig(config, 'SHORT');
    expect(resultShort.effectiveFibLevel).toBe('1.382');
  });

  it('should fall back to fibonacciTargetLevel when per-direction is null', () => {
    const config = {
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevelLong: null,
      fibonacciTargetLevelShort: null,
      fibonacciTargetLevel: '1.618',
      fibonacciSwingRange: 'nearest',
    } as never;
    const result = resolveTpConfig(config, 'LONG');
    expect(result.effectiveFibLevel).toBe('1.618');
  });

  it('should use config values for tpCalculationMode and swingRange', () => {
    const config = {
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevel: '2',
      fibonacciSwingRange: 'extended',
    } as never;
    const result = resolveTpConfig(config, 'LONG');
    expect(result.tpCalculationMode).toBe('fibonacci');
    expect(result.fibonacciSwingRange).toBe('extended');
  });
});

describe('buildFilterConfig', () => {
  it('should enable BTC correlation filter only in auto direction mode', () => {
    const config = {
      useBtcCorrelationFilter: true,
      useObvCheckLong: true,
      volumeFilterObvLookbackLong: 10,
      useObvCheckShort: false,
      volumeFilterObvLookbackShort: 7,
    } as never;

    const autoResult = buildFilterConfig(config, 'auto');
    expect(autoResult.useBtcCorrelationFilter).toBe(true);

    const longResult = buildFilterConfig(config, 'long_only');
    expect(longResult.useBtcCorrelationFilter).toBe(false);
  });

  it('should use volume filter config defaults', () => {
    const config = {} as never;
    const result = buildFilterConfig(config, 'auto');
    expect(result.volumeFilterConfig.longConfig.useObvCheck).toBe(false);
    expect(result.volumeFilterConfig.longConfig.obvLookback).toBe(7);
    expect(result.volumeFilterConfig.shortConfig.useObvCheck).toBe(true);
    expect(result.volumeFilterConfig.shortConfig.obvLookback).toBe(5);
  });

  it('should use config values for volume filter when provided', () => {
    const config = {
      useObvCheckLong: true,
      volumeFilterObvLookbackLong: 14,
      useObvCheckShort: false,
      volumeFilterObvLookbackShort: 3,
    } as never;
    const result = buildFilterConfig(config, 'auto');
    expect(result.volumeFilterConfig.longConfig.useObvCheck).toBe(true);
    expect(result.volumeFilterConfig.longConfig.obvLookback).toBe(14);
    expect(result.volumeFilterConfig.shortConfig.useObvCheck).toBe(false);
    expect(result.volumeFilterConfig.shortConfig.obvLookback).toBe(3);
  });
});

describe('validateRiskReward', () => {
  let logBuffer: WatcherLogBuffer;

  beforeEach(() => {
    logBuffer = createLogBuffer();
    logBuffer.startSetupValidation({
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
      confidence: 80,
    });
  });

  it('should pass for valid LONG risk/reward ratio', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 110,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 110, 'default', null, logBuffer);
    expect(result.valid).toBe(true);
  });

  it('should pass for valid SHORT risk/reward ratio', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'SHORT',
      entryPrice: 100,
      stopLoss: 105,
      takeProfit: 90,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 90, 'default', null, logBuffer);
    expect(result.valid).toBe(true);
  });

  it('should reject when LONG R:R ratio is below minimum', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 102,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 102, 'default', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should reject when SHORT R:R ratio is below minimum', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'SHORT',
      entryPrice: 100,
      stopLoss: 110,
      takeProfit: 99,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 99, 'default', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should reject when risk is zero (LONG SL >= entry)', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 100,
      takeProfit: 110,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 110, 'default', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should reject when risk is zero (SHORT SL <= entry)', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'SHORT',
      entryPrice: 100,
      stopLoss: 100,
      takeProfit: 90,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 90, 'default', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should reject when no stop loss', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      takeProfit: 110,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 110, 'default', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should pass when no take profit (skips R:R)', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      confidence: 80,
    };
    const result = validateRiskReward(setup, undefined, 'default', null, logBuffer);
    expect(result.valid).toBe(true);
  });

  it('should use config min R:R when provided', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 108,
      confidence: 80,
    };
    const config = {
      minRiskRewardRatioLong: '2.0',
      minRiskRewardRatioShort: '1.5',
    } as never;
    const result = validateRiskReward(setup, 108, 'default', config, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should use SHORT min R:R for SHORT direction', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'SHORT',
      entryPrice: 100,
      stopLoss: 105,
      takeProfit: 92,
      confidence: 80,
    };
    const config = {
      minRiskRewardRatioLong: '1.0',
      minRiskRewardRatioShort: '2.0',
    } as never;
    const result = validateRiskReward(setup, 92, 'default', config, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should indicate fibonacci TP mode in rejection', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 90,
      takeProfit: 105,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 102, 'fibonacci', null, logBuffer);
    expect(result.valid).toBe(false);
  });

  it('should pass when R:R exactly equals minimum', () => {
    const setup: TradingSetup = {
      type: 'test-setup',
      direction: 'LONG',
      entryPrice: 100,
      stopLoss: 95,
      takeProfit: 105,
      confidence: 80,
    };
    const result = validateRiskReward(setup, 105, 'default', null, logBuffer);
    expect(result.valid).toBe(true);
  });
});

describe('resolveConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return config from getCachedConfig', async () => {
    const mockConfig = { maxPositionSize: '5', directionMode: 'auto' } as never;
    const deps: ExecutionValidatorDeps = {
      getCachedConfig: vi.fn().mockResolvedValue(mockConfig),
      getKlines: vi.fn(),
    } as never;
    const watcher = { walletId: 'w1', userId: 'u1' } as never;

    const result = await resolveConfig(deps, watcher);
    expect(result).toBe(mockConfig);
  });

  it('should return null when getCachedConfig returns null', async () => {
    const deps: ExecutionValidatorDeps = {
      getCachedConfig: vi.fn().mockResolvedValue(null),
      getKlines: vi.fn(),
    } as never;
    const watcher = { walletId: 'w1', userId: 'u1' } as never;

    const result = await resolveConfig(deps, watcher);
    expect(result).toBeNull();
  });
});
