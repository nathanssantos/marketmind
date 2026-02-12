import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kline, TradingSetup, MarketType } from '@marketmind/types';

vi.mock('@marketmind/indicators', () => ({
  calculateADX: vi.fn(() => ({ adx: [25] })),
  calculateFibonacciProjection: vi.fn(),
}));

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    FILTER_THRESHOLDS: { ADX_MIN: 20, ADX_STRONG: 30, ADX_VERY_STRONG: 40 },
    getDefaultFee: vi.fn(() => 0.001),
  };
});

vi.mock('../../../db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 1 }]),
        onConflictDoNothing: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(undefined),
      })),
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: {},
  setupDetections: {},
  tradeExecutions: { walletId: 'walletId', status: 'status' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  inArray: vi.fn(),
}));

vi.mock('../../../env', () => ({
  env: {
    ENABLE_LIVE_TRADING: false,
    ENCRYPTION_KEY: 'a'.repeat(64),
  },
}));

vi.mock('../../../constants', () => ({
  BACKTEST_DEFAULTS: {
    MIN_RISK_REWARD_RATIO_LONG: 1.5,
    MIN_RISK_REWARD_RATIO_SHORT: 1.0,
  },
  TIME_MS: { HOUR: 3_600_000, MINUTE: 60_000, SECOND: 1000 },
  UNIT_MS: { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 },
  AUTO_TRADING_RETRY: {
    MAX_RETRIES: 3,
    INITIAL_DELAY_MS: 1000,
    MAX_DELAY_MS: 10000,
    BACKOFF_MULTIPLIER: 2,
  },
  PROTECTION_ORDER_RETRY: {
    MAX_RETRIES: 5,
    INITIAL_DELAY_MS: 500,
    MAX_DELAY_MS: 5000,
    BACKOFF_MULTIPLIER: 2,
  },
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../../auto-trading', () => ({
  autoTradingService: { getWatcherStatus: vi.fn(() => ({ active: true, watchers: 5 })) },
}));

vi.mock('../../../exchange', () => ({
  getFuturesClient: vi.fn(),
}));

vi.mock('../../cooldown', () => ({
  cooldownService: {
    checkCooldown: vi.fn().mockResolvedValue({ inCooldown: false }),
    registerExecution: vi.fn(),
  },
}));

vi.mock('../../position-monitor', () => ({
  positionMonitorService: { startMonitoring: vi.fn() },
}));

vi.mock('../../pyramiding', () => ({
  pyramidingService: { canAddPosition: vi.fn().mockResolvedValue({ allowed: true }) },
}));

vi.mock('../../risk-manager', () => ({
  riskManagerService: {
    validateNewPosition: vi.fn().mockResolvedValue({ isValid: true }),
    calculateDynamicSize: vi.fn().mockResolvedValue({ quantity: 0.1, positionValue: 1000 }),
  },
}));

vi.mock('../../wallet-lock', () => ({
  walletLockService: { acquire: vi.fn().mockResolvedValue(() => {}) },
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    broadcastToUser: vi.fn(),
  })),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
}));

vi.mock('./protection-order-handler', () => ({
  protectionOrderHandler: { placeProtectionOrders: vi.fn().mockResolvedValue({ success: true }) },
}));

vi.mock('./filter-validator', () => ({
  FilterValidator: vi.fn().mockImplementation(() => ({
    validateFilters: vi.fn().mockResolvedValue({ passed: true, filterResults: {} }),
  })),
}));

import { OrderExecutor, type OrderExecutorDeps } from '../order-executor';
import { calculateFibonacciProjection, calculateADX } from '@marketmind/indicators';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher } from '../types';

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close + 2),
  low: String(close - 2),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlines = (count: number): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(100 + i * 0.5, i));

const createWatcher = (overrides: Partial<ActiveWatcher> = {}): ActiveWatcher => ({
  walletId: 'w1',
  userId: 'u1',
  symbol: 'ETHUSDT',
  interval: '1h',
  marketType: 'FUTURES' as MarketType,
  isActive: true,
  strategies: [],
  klines: [],
  key: 'w1:ETHUSDT:1h:FUTURES',
  isManual: false,
  ...overrides,
});

const createSetup = (overrides: Partial<TradingSetup> = {}): TradingSetup => ({
  type: 'larry_williams_9_1',
  direction: 'LONG',
  entryPrice: 100,
  stopLoss: 95,
  takeProfit: 110,
  confidence: 80,
  riskRewardRatio: 2,
  ...overrides,
} as TradingSetup);

const createLogBuffer = (): WatcherLogBuffer => ({
  addFilterCheck: vi.fn(),
  addValidationCheck: vi.fn(),
  addRejection: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  startSetupValidation: vi.fn(),
  completeSetupValidation: vi.fn(),
} as unknown as WatcherLogBuffer);

const createDeps = (): OrderExecutorDeps => ({
  getBtcKlines: vi.fn().mockResolvedValue(createKlines(30)),
  getHtfKlines: vi.fn().mockResolvedValue(createKlines(210)),
  getCachedFundingRate: vi.fn().mockResolvedValue(0.01),
  getCachedConfig: vi.fn().mockResolvedValue({
    isEnabled: true,
    maxPositionSize: '1000',
    maxConcurrentPositions: 5,
    tpCalculationMode: 'default',
    fibonacciTargetLevel: '2',
    fibonacciTargetLevelLong: null,
    fibonacciTargetLevelShort: null,
    fibonacciSwingRange: 'nearest',
    minRiskRewardRatioLong: '1.5',
    minRiskRewardRatioShort: '1.0',
    directionMode: 'auto',
    useBtcCorrelationFilter: false,
    useFundingFilter: false,
    useMtfFilter: false,
    useMarketRegimeFilter: false,
    useVolumeFilter: false,
    useConfluenceScoring: false,
    confluenceMinScore: 50,
    useStochasticFilter: false,
    useMomentumTimingFilter: false,
    useAdxFilter: false,
    useTrendFilter: false,
  }),
  getWatcherStatus: vi.fn(() => ({ active: true, watchers: 5 })),
});

describe('OrderExecutor', () => {
  let executor: OrderExecutor;
  let deps: OrderExecutorDeps;
  let logBuffer: WatcherLogBuffer;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
    executor = new OrderExecutor(deps);
    logBuffer = createLogBuffer();
  });

  describe('getIntervalMs (private, tested via public interface)', () => {
    it('should parse interval strings correctly', () => {
      const getIntervalMs = (executor as any).getIntervalMs.bind(executor);

      expect(getIntervalMs('1m')).toBe(60_000);
      expect(getIntervalMs('5m')).toBe(300_000);
      expect(getIntervalMs('1h')).toBe(3_600_000);
      expect(getIntervalMs('4h')).toBe(14_400_000);
      expect(getIntervalMs('1d')).toBe(86_400_000);
      expect(getIntervalMs('1w')).toBe(604_800_000);
    });

    it('should return default for invalid intervals', () => {
      const getIntervalMs = (executor as any).getIntervalMs.bind(executor);

      expect(getIntervalMs('invalid')).toBe(4 * 3_600_000);
      expect(getIntervalMs('')).toBe(4 * 3_600_000);
      expect(getIntervalMs('1x')).toBe(4 * 3_600_000);
    });
  });

  describe('calculateFibonacciTakeProfit', () => {
    it('should return null when projection fails', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue(null);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2', '1h',
      );

      expect(result).toBeNull();
    });

    it('should return null when projection has no levels', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue({ levels: [] } as never);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2', '1h',
      );

      expect(result).toBeNull();
    });

    it('should return target level price when found', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.618, price: 115 },
          { level: 2.0, price: 120 },
          { level: 2.618, price: 130 },
        ],
      } as never);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2', '1h',
      );

      expect(result).toBe(120);
    });

    it('should fall back to 161.8% level when target not found', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.0, price: 105 },
          { level: 1.618, price: 115 },
        ],
      } as never);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2.618', '1h',
      );

      expect(result).toBe(115);
    });

    it('should return null when neither target nor 161.8% found', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [{ level: 1.0, price: 105 }],
      } as never);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2.618', '1h',
      );

      expect(result).toBeNull();
    });

    it('should use ADX-based level when auto mode', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [35] } as never);
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.382, price: 112 },
          { level: 1.618, price: 115 },
        ],
      } as never);

      const result = executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', 'auto', '1h',
      );

      expect(result).toBe(115);
    });

    it('should pass swingRange parameter', () => {
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [{ level: 2.0, price: 120 }],
      } as never);

      executor.calculateFibonacciTakeProfit(
        createKlines(50), 100, 'LONG', '2', '1h', 'extended',
      );

      expect(calculateFibonacciProjection).toHaveBeenCalledWith(
        expect.any(Array), 49, 100, 'LONG', 'extended',
      );
    });
  });

  describe('getAdxBasedFibonacciLevel (private)', () => {
    const getLevel = (klines: Kline[], dir: 'LONG' | 'SHORT'): number =>
      (executor as any).getAdxBasedFibonacciLevel(klines, dir);

    it('should return default 1.272 when insufficient klines', () => {
      expect(getLevel(createKlines(20), 'LONG')).toBe(1.272);
    });

    it('should return default 1.272 when ADX is null', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [null] } as never);
      expect(getLevel(createKlines(50), 'LONG')).toBe(1.272);
    });

    it('should return 2.0 for very strong ADX (>= 40)', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [45] } as never);
      expect(getLevel(createKlines(50), 'LONG')).toBe(2.0);
    });

    it('should return 1.618 for strong ADX (>= 30)', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [35] } as never);
      expect(getLevel(createKlines(50), 'LONG')).toBe(1.618);
    });

    it('should return 1.382 for moderate ADX (>= 20)', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [25] } as never);
      expect(getLevel(createKlines(50), 'LONG')).toBe(1.382);
    });

    it('should return 1.272 for weak ADX (< 20)', () => {
      vi.mocked(calculateADX).mockReturnValue({ adx: [15] } as never);
      expect(getLevel(createKlines(50), 'LONG')).toBe(1.272);
    });
  });

  describe('validateRiskReward (private)', () => {
    const validate = (
      setup: TradingSetup,
      tp: number | undefined,
      mode = 'default',
      config: Record<string, unknown> | null = null,
    ) => (executor as any).validateRiskReward(setup, tp, mode, config, logBuffer);

    it('should fail when stopLoss is missing', () => {
      const setup = createSetup({ stopLoss: undefined });
      expect(validate(setup, undefined).valid).toBe(false);
    });

    it('should pass when stopLoss present but no take profit (skip R:R validation)', () => {
      const setup = createSetup({ stopLoss: 95, takeProfit: undefined });
      expect(validate(setup, undefined).valid).toBe(true);
    });

    it('should fail when risk is zero or negative (LONG)', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 105 });
      expect(validate(setup, 110).valid).toBe(false);
    });

    it('should fail when risk is zero or negative (SHORT)', () => {
      const setup = createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 95 });
      expect(validate(setup, 90).valid).toBe(false);
    });

    it('should fail when R:R ratio is below minimum (LONG)', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 });
      expect(validate(setup, 105).valid).toBe(false);
    });

    it('should pass when R:R ratio meets minimum (LONG)', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 });
      expect(validate(setup, 110).valid).toBe(true);
    });

    it('should use direction-specific R:R config', () => {
      const setup = createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 105 });
      expect(validate(setup, 94).valid).toBe(true);
    });

    it('should use config R:R when provided', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 });
      const config = { minRiskRewardRatioLong: '3.0', minRiskRewardRatioShort: '2.0' };
      expect(validate(setup, 110, 'default', config).valid).toBe(false);
    });
  });

  describe('executeSetupSafe', () => {
    it('should return true on successful execution', async () => {
      const config = await deps.getCachedConfig('w1');
      (config as any).isEnabled = true;

      const { db } = await import('../../../db');
      vi.mocked(db.select).mockReturnValue({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([{
              id: 'w1',
              walletType: 'paper',
              exchange: 'BINANCE',
            }]),
          })),
        })),
      } as never);

      const result = await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(typeof result).toBe('boolean');
    });

    it('should return false when execution throws', async () => {
      vi.mocked(deps.getCachedConfig).mockRejectedValue(new Error('config fail'));

      const result = await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(result).toBe(false);
      expect(logBuffer.error).toHaveBeenCalled();
    });

    it('should prevent duplicate execution of same setup', async () => {
      vi.mocked(deps.getCachedConfig).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(null), 100)),
      );

      const p1 = executor.executeSetupSafe(createWatcher(), createSetup(), [], createKlines(50), logBuffer);
      const p2 = executor.executeSetupSafe(createWatcher(), createSetup(), [], createKlines(50), createLogBuffer());

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });
  });
});
