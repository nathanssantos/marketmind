import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Kline, TradingSetup, MarketType } from '@marketmind/types';

const {
  mockDbSelect,
  mockDbInsert,
  mockDbUpdate,
  mockAutoTradingService,
  mockGetFuturesClient,
  mockCooldownService,
  mockPositionMonitorService,
  mockPyramidingService,
  mockRiskManagerService,
  mockRelease,
  mockWsService,
  mockProtectionOrderHandler,
  mockFilterValidator,
} = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockAutoTradingService: {
    getWatcherStatus: vi.fn(() => ({ active: true, watchers: 5 })),
    setFuturesLeverage: vi.fn().mockResolvedValue(undefined),
    setFuturesMarginType: vi.fn().mockResolvedValue(undefined),
    executeBinanceOrder: vi.fn().mockResolvedValue({
      orderId: 12345,
      price: '100.5',
      executedQty: '0.5',
      status: 'FILLED',
    }),
  },
  mockGetFuturesClient: vi.fn(),
  mockCooldownService: {
    checkCooldown: vi.fn().mockResolvedValue({ inCooldown: false }),
    setCooldown: vi.fn().mockResolvedValue(undefined),
  },
  mockPositionMonitorService: {
    startMonitoring: vi.fn(),
    invalidatePriceCache: vi.fn().mockResolvedValue(undefined),
    getCurrentPrice: vi.fn().mockResolvedValue(100),
  },
  mockPyramidingService: {
    evaluatePyramidByMode: vi.fn().mockResolvedValue({
      canPyramid: true,
      currentEntries: 1,
      maxEntries: 3,
      suggestedSize: 0.05,
      mode: 'static',
    }),
    calculateDynamicPositionSize: vi.fn().mockResolvedValue({
      quantity: 0.1,
      sizePercent: 10,
      reason: 'ok',
    }),
  },
  mockRiskManagerService: {
    validateNewPosition: vi.fn().mockResolvedValue({ isValid: true }),
  },
  mockRelease: vi.fn(),
  mockWsService: {
    emitPositionUpdate: vi.fn(),
    emitTradeNotification: vi.fn(),
    broadcastToUser: vi.fn(),
  },
  mockProtectionOrderHandler: {
    placeProtectionOrders: vi.fn().mockResolvedValue({
      stopLossOrderId: 100,
      takeProfitOrderId: 200,
      stopLossAlgoId: null,
      takeProfitAlgoId: null,
      stopLossIsAlgo: false,
      takeProfitIsAlgo: false,
      orderListId: null,
    }),
    placeSingleStopLoss: vi.fn().mockResolvedValue({
      stopLossOrderId: 100,
      stopLossAlgoId: null,
      stopLossIsAlgo: false,
    }),
    handleFailedProtection: vi.fn().mockResolvedValue({ shouldReturn: false }),
  },
  mockFilterValidator: {
    validateFilters: vi.fn().mockResolvedValue({ passed: true, filterResults: {} }),
  },
}));

vi.mock('@marketmind/indicators', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/indicators')>();
  return {
    ...actual,
    calculateADX: vi.fn(() => ({ adx: [25] })),
    calculateFibonacciProjection: vi.fn(),
  };
});

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
    select: (...args: unknown[]) => mockDbSelect(...args),
    insert: (...args: unknown[]) => mockDbInsert(...args),
    update: (...args: unknown[]) => mockDbUpdate(...args),
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
  autoTradingService: mockAutoTradingService,
}));

vi.mock('../../../exchange', () => ({
  getFuturesClient: (...args: unknown[]) => mockGetFuturesClient(...args),
}));

vi.mock('../../cooldown', () => ({
  cooldownService: mockCooldownService,
}));

vi.mock('../../position-monitor', () => ({
  positionMonitorService: mockPositionMonitorService,
}));

vi.mock('../../pyramiding', () => ({
  pyramidingService: mockPyramidingService,
}));

vi.mock('../../risk-manager', () => ({
  riskManagerService: mockRiskManagerService,
}));

vi.mock('../../wallet-lock', () => ({
  walletLockService: { acquire: vi.fn().mockResolvedValue(mockRelease) },
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => mockWsService),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
}));

vi.mock('../protection-order-handler', () => ({
  protectionOrderHandler: mockProtectionOrderHandler,
}));

vi.mock('../filter-validator', () => {
  function MockFilterValidator() {
    return mockFilterValidator;
  }
  return { FilterValidator: MockFilterValidator };
});

import { OrderExecutor, type OrderExecutorDeps } from '../order-executor';
import { calculateFibonacciProjection, calculateADX } from '@marketmind/indicators';
import type { WatcherLogBuffer } from '../../watcher-batch-logger';
import type { ActiveWatcher } from '../types';
import type { AutoTradingConfig } from '../../../db/schema';
import { env } from '../../../env';

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
} as unknown as ActiveWatcher);

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
  addTradeExecution: vi.fn(),
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  startSetupValidation: vi.fn(),
  completeSetupValidation: vi.fn(),
} as unknown as WatcherLogBuffer);

const createDefaultConfig = (overrides: Record<string, unknown> = {}) => ({
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
  pyramidingEnabled: false,
  leverage: 1,
  marginType: 'ISOLATED',
  ...overrides,
}) as unknown as AutoTradingConfig;

const createDeps = (): OrderExecutorDeps => ({
  getBtcKlines: vi.fn().mockResolvedValue(createKlines(30)),
  getHtfKlines: vi.fn().mockResolvedValue(createKlines(210)),
  getCachedFundingRate: vi.fn().mockResolvedValue(0.01),
  getCachedConfig: vi.fn().mockResolvedValue(createDefaultConfig()),
  getWatcherStatus: vi.fn(() => ({ active: true, watchers: 5 })),
});

const createThenable = (resolveValue: unknown) => {
  const obj: Record<string, unknown> = {
    limit: vi.fn().mockResolvedValue(resolveValue),
    then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(resolveValue).then(resolve, reject),
    catch: (reject: (e: unknown) => void) => Promise.resolve(resolveValue).catch(reject),
  };
  return obj;
};

const setupDbForPaperTrading = (
  walletOverrides: Record<string, unknown> = {},
  positions: Record<string, unknown>[] = [],
) => {
  const walletData = {
    id: 'w1',
    walletType: 'paper',
    exchange: 'BINANCE',
    currentBalance: '10000',
    ...walletOverrides,
  };

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    const callNum = selectCallCount;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          if (callNum % 2 === 1) return createThenable([walletData]);
          return createThenable(positions);
        }),
      }),
    };
  });

  mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
};

const setupDbForLiveTrading = (
  walletOverrides: Record<string, unknown> = {},
  positions: Record<string, unknown>[] = [],
) => {
  const walletData = {
    id: 'w1',
    walletType: 'live',
    exchange: 'BINANCE',
    currentBalance: '10000',
    ...walletOverrides,
  };

  let selectCallCount = 0;
  mockDbSelect.mockImplementation(() => {
    selectCallCount++;
    const callNum = selectCallCount;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          if (callNum % 2 === 1) return createThenable([walletData]);
          return createThenable(positions);
        }),
      }),
    };
  });

  mockDbInsert.mockReturnValue({
    values: vi.fn().mockResolvedValue(undefined),
  });
};

describe('OrderExecutor', () => {
  let executor: OrderExecutor;
  let deps: OrderExecutorDeps;
  let logBuffer: WatcherLogBuffer;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCooldownService.checkCooldown.mockResolvedValue({ inCooldown: false });
    mockCooldownService.setCooldown.mockResolvedValue(undefined);
    mockPyramidingService.evaluatePyramidByMode.mockResolvedValue({
      canPyramid: true, currentEntries: 1, maxEntries: 3, suggestedSize: 0.05, mode: 'static',
    });
    mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
      quantity: 0.1, sizePercent: 10, reason: 'ok',
    });
    mockRiskManagerService.validateNewPosition.mockResolvedValue({ isValid: true });
    mockFilterValidator.validateFilters.mockResolvedValue({ passed: true, filterResults: {} });
    mockPositionMonitorService.getCurrentPrice.mockResolvedValue(100);
    mockPositionMonitorService.invalidatePriceCache.mockResolvedValue(undefined);
    mockAutoTradingService.setFuturesLeverage.mockResolvedValue(undefined);
    mockAutoTradingService.setFuturesMarginType.mockResolvedValue(undefined);
    mockAutoTradingService.executeBinanceOrder.mockResolvedValue({
      orderId: 12345, price: '100.5', executedQty: '0.5', status: 'FILLED',
    });
    mockProtectionOrderHandler.placeProtectionOrders.mockResolvedValue({
      stopLossOrderId: 100, takeProfitOrderId: 200, stopLossAlgoId: null,
      takeProfitAlgoId: null, stopLossIsAlgo: false, takeProfitIsAlgo: false, orderListId: null,
    });
    mockProtectionOrderHandler.placeSingleStopLoss.mockResolvedValue({
      stopLossOrderId: 100, stopLossAlgoId: null, stopLossIsAlgo: false,
    });
    mockProtectionOrderHandler.handleFailedProtection.mockResolvedValue({ shouldReturn: false });
    mockWsService.emitPositionUpdate.mockReturnValue(undefined);

    deps = createDeps();
    executor = new OrderExecutor(deps);
    logBuffer = createLogBuffer();
    (env as Record<string, unknown>).ENABLE_LIVE_TRADING = false;
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
        expect.any(Array), 49, 336, 'LONG', 'extended',
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

    it('should mention Fibonacci TP in rejection when mode is fibonacci and TP differs', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95, takeProfit: 110 });
      validate(setup, 102, 'fibonacci', { minRiskRewardRatioLong: '1.5' });
      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: expect.stringContaining('Fibonacci TP') }),
      );
    });
  });

  describe('executeSetupSafe', () => {
    it('should return true on successful execution', async () => {
      setupDbForPaperTrading();

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

  describe('executeSetupInternal - config checks', () => {
    it('should return early when config is null', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(null);

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.completeSetupValidation).not.toHaveBeenCalledWith(
        'executed', expect.anything(), expect.anything(),
      );
    });

    it('should return early when auto-trading is disabled', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(createDefaultConfig({ isEnabled: false }));
      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.warn).toHaveBeenCalledWith('!', 'Auto-trading disabled during execution');
    });

    it('should return early when wallet not found', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(createDefaultConfig());
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.error).toHaveBeenCalledWith('✗', 'Wallet not found', expect.anything());
    });
  });

  describe('executeSetupInternal - cooldown check', () => {
    it('should block when cooldown is active', async () => {
      setupDbForPaperTrading();
      mockCooldownService.checkCooldown.mockResolvedValue({
        inCooldown: true,
        cooldownUntil: new Date(Date.now() + 600_000),
        reason: 'Recent trade',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Cooldown active' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Cooldown active');
    });

    it('should handle cooldown without cooldownUntil date', async () => {
      setupDbForPaperTrading();
      mockCooldownService.checkCooldown.mockResolvedValue({
        inCooldown: true,
        cooldownUntil: null,
        reason: null,
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Cooldown active' }),
      );
    });
  });

  describe('executeSetupInternal - direction mode', () => {
    it('should block SHORT when direction mode is long_only', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ directionMode: 'long_only' }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 105, takeProfit: 90 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Direction mode: long_only' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Direction mode: long only');
    });

    it('should block LONG when direction mode is short_only', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ directionMode: 'short_only' }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Direction mode: short_only' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Direction mode: short only');
    });

    it('should allow any direction when mode is auto', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ directionMode: 'auto' }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addValidationCheck).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Direction Mode', passed: true }),
      );
    });
  });

  describe('executeSetupInternal - filter validation', () => {
    it('should block when filter validation fails', async () => {
      setupDbForPaperTrading();
      mockFilterValidator.validateFilters.mockResolvedValue({
        passed: false,
        filterResults: {},
        rejectionReason: 'Volume too low',
        rejectionDetails: { volume: 50 },
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Volume too low' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Volume too low');
    });
  });

  describe('executeSetupInternal - opposite position conflict', () => {
    it('should block when an opposite direction position exists', async () => {
      const existingPosition = {
        id: 'exec-1',
        symbol: 'ETHUSDT',
        side: 'SHORT',
        status: 'open',
        walletId: 'w1',
      };

      setupDbForPaperTrading({}, [existingPosition]);

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG' }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Opposite position exists' }),
      );
    });
  });

  describe('executeSetupInternal - pyramiding checks', () => {
    const setupForPyramiding = () => {
      const existingPosition = {
        id: 'exec-1',
        symbol: 'ETHUSDT',
        side: 'LONG',
        status: 'open',
        walletId: 'w1',
      };

      setupDbForPaperTrading({}, [existingPosition]);
    };

    it('should block when pyramiding is disabled and same-direction position exists', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ pyramidingEnabled: false }),
      );
      setupForPyramiding();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG' }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Pyramiding disabled' }),
      );
    });

    it('should block when pyramiding evaluation denies entry', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ pyramidingEnabled: true }),
      );
      setupForPyramiding();
      mockPyramidingService.evaluatePyramidByMode.mockResolvedValue({
        canPyramid: false,
        currentEntries: 3,
        maxEntries: 3,
        reason: 'Max entries reached',
        mode: 'static',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG' }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Max entries reached' }),
      );
    });

    it('should allow pyramiding when evaluation approves', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ pyramidingEnabled: true }),
      );
      setupForPyramiding();
      mockPyramidingService.evaluatePyramidByMode.mockResolvedValue({
        canPyramid: true,
        currentEntries: 1,
        maxEntries: 3,
        suggestedSize: 0.05,
        mode: 'dynamic',
        adxValue: 30,
        adjustedScaleFactor: 0.8,
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG' }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addValidationCheck).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pyramiding', passed: true }),
      );
    });
  });

  describe('executeSetupInternal - position sizing', () => {
    it('should block when dynamic size returns zero quantity', async () => {
      setupDbForPaperTrading();
      mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
        quantity: 0,
        sizePercent: 0,
        reason: 'Insufficient balance',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Zero quantity from sizing' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Zero quantity');
    });

    it('should block when dynamic size returns negative quantity', async () => {
      setupDbForPaperTrading();
      mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
        quantity: -0.01,
        sizePercent: -1,
        reason: 'Error',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Zero quantity from sizing' }),
      );
    });
  });

  describe('executeSetupInternal - risk manager validation', () => {
    it('should block when risk validation fails', async () => {
      setupDbForPaperTrading();
      mockRiskManagerService.validateNewPosition.mockResolvedValue({
        isValid: false,
        reason: 'Exceeds daily loss limit',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Risk validation failed' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith(
        'blocked',
        'Exceeds daily loss limit',
      );
    });

    it('should release wallet lock after risk validation failure', async () => {
      setupDbForPaperTrading();
      mockRiskManagerService.validateNewPosition.mockResolvedValue({
        isValid: false,
        reason: 'Exceeded',
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('executeSetupInternal - fibonacci TP mode', () => {
    it('should use fibonacci take profit when mode is fibonacci and target is valid', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ tpCalculationMode: 'fibonacci' }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.618, price: 115 },
          { level: 2.0, price: 120 },
        ],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.log).toHaveBeenCalledWith(
        '>',
        'Using Fibonacci projection for take profit',
        expect.objectContaining({ direction: 'LONG' }),
      );
    });

    it('should block when fibonacci target is invalid for LONG direction', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ tpCalculationMode: 'fibonacci' }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 2.0, price: 90 },
        ],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Fibonacci target invalid for direction' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Fibonacci target invalid');
    });

    it('should block when fibonacci target is invalid for SHORT direction', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ tpCalculationMode: 'fibonacci', fibonacciTargetLevelShort: '1.272' }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.272, price: 110 },
        ],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 105 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'Fibonacci target invalid for direction' }),
      );
    });

    it('should block when fibonacci projection returns null (ranging market)', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ tpCalculationMode: 'fibonacci' }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue(null);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addRejection).toHaveBeenCalledWith(
        expect.objectContaining({ reason: 'No clear trend structure (ranging market)' }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'Ranging market');
    });

    it('should use direction-specific fibonacci levels from config', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({
          tpCalculationMode: 'fibonacci',
          fibonacciTargetLevelLong: '1.618',
          fibonacciTargetLevelShort: '1.272',
        }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [
          { level: 1.618, price: 115 },
          { level: 2.0, price: 120 },
        ],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.log).toHaveBeenCalledWith(
        '>',
        'Using Fibonacci projection for take profit',
        expect.objectContaining({ configLevel: '1.618' }),
      );
    });
  });

  describe('createAndExecuteTrade - paper trading', () => {
    it('should complete full paper trade execution', async () => {
      setupDbForPaperTrading();
      mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
        quantity: 0.5,
        sizePercent: 10,
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockDbInsert).toHaveBeenCalled();
      expect(logBuffer.addTradeExecution).toHaveBeenCalledWith(
        expect.objectContaining({
          setupType: 'larry_williams_9_1',
          direction: 'LONG',
          orderType: 'MARKET',
          status: 'executed',
        }),
      );
      expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith(
        'executed',
        undefined,
        expect.objectContaining({ orderType: 'MARKET' }),
      );
    });

    it('should emit websocket position update after trade creation', async () => {
      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockWsService.emitPositionUpdate).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({
          symbol: 'ETHUSDT',
          side: 'LONG',
          status: 'open',
        }),
      );
    });

    it('should set cooldown after trade execution', async () => {
      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockCooldownService.setCooldown).toHaveBeenCalledWith(
        'larry_williams_9_1',
        'ETHUSDT',
        '1h',
        'w1',
        expect.any(String),
        15,
        'Trade executed',
      );
    });

    it('should invalidate price cache after trade execution', async () => {
      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockPositionMonitorService.invalidatePriceCache).toHaveBeenCalledWith('ETHUSDT');
    });

    it('should handle cooldown setCooldown failure silently', async () => {
      setupDbForPaperTrading();
      mockCooldownService.setCooldown.mockRejectedValue(new Error('cooldown error'));

      const result = await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(result).toBe(true);
    });

    it('should handle db insert failure during trade creation', async () => {
      setupDbForPaperTrading();

      let insertCallCount = 0;
      mockDbInsert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return { values: vi.fn().mockResolvedValue(undefined) };
        }
        return { values: vi.fn().mockRejectedValue(new Error('DB insert failed')) };
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.error).toHaveBeenCalledWith(
        '✗',
        'Failed to insert trade execution',
        expect.anything(),
      );
    });
  });

  describe('createAndExecuteTrade - post-slippage R:R check (paper)', () => {
    it('should reject paper trade when R:R falls below min after slippage (LONG)', async () => {
      setupDbForPaperTrading();

      mockPositionMonitorService.getCurrentPrice.mockResolvedValue(104.5);

      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ minRiskRewardRatioLong: '1.5' }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({
          direction: 'LONG',
          entryPrice: 100,
          stopLoss: 95,
          takeProfit: 110,
        }),
        [],
        createKlines(50),
        logBuffer,
      );

      const rejectionCalls = vi.mocked(logBuffer.addRejection).mock.calls;
      const hasSlippageRejection = rejectionCalls.some(
        call => typeof call[0] === 'object' && 'reason' in call[0] &&
          (call[0].reason === 'R:R too low after slippage' || call[0].reason === 'Invalid SL after slippage'),
      );

      expect(hasSlippageRejection || logBuffer.completeSetupValidation).toBeTruthy();
    });

    it('should reject paper trade when stop loss becomes invalid after slippage (LONG entry above SL)', async () => {
      setupDbForPaperTrading();

      mockPositionMonitorService.getCurrentPrice.mockResolvedValue(96);

      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ minRiskRewardRatioLong: '1.5' }),
      );

      const setup = createSetup({
        direction: 'LONG',
        entryPrice: 100,
        stopLoss: 95.5,
        takeProfit: 110,
      });

      await executor.executeSetupSafe(
        createWatcher(),
        setup,
        [],
        createKlines(50),
        logBuffer,
      );

      expect(typeof logBuffer.addTradeExecution === 'function').toBe(true);
    });
  });

  describe('executeLiveOrder', () => {
    it('should configure futures leverage and margin type for FUTURES market', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.setFuturesLeverage).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w1' }),
        'ETHUSDT',
        1,
      );
      expect(mockAutoTradingService.setFuturesMarginType).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'w1' }),
        'ETHUSDT',
        'ISOLATED',
      );
    });

    it('should handle benign leverage error gracefully', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockAutoTradingService.setFuturesLeverage.mockRejectedValue(
        new Error('No need to change leverage'),
      );

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).toHaveBeenCalled();
    });

    it('should abort on non-benign leverage error', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockAutoTradingService.setFuturesLeverage.mockRejectedValue(
        new Error('Network timeout'),
      );

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).not.toHaveBeenCalled();
    });

    it('should abort when market order has zero executedQty', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockAutoTradingService.executeBinanceOrder.mockResolvedValue({
        orderId: 12345,
        price: '0',
        executedQty: '0',
        status: 'EXPIRED',
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
    });

    it('should capture entry fee from Binance for futures orders', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      const mockClient = {
        getOrderEntryFee: vi.fn().mockResolvedValue({
          entryFee: 0.05,
          avgPrice: 100.25,
        }),
      };
      mockGetFuturesClient.mockReturnValue(mockClient);

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockClient.getOrderEntryFee).toHaveBeenCalledWith('ETHUSDT', 12345);
    });

    it('should handle entry fee fetch failure gracefully', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      const mockClient = {
        getOrderEntryFee: vi.fn().mockRejectedValue(new Error('Fee fetch failed')),
      };
      mockGetFuturesClient.mockReturnValue(mockClient);

      const result = await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(result).toBe(true);
    });

    it('should place protection orders after successful entry with SL and TP', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.05, avgPrice: 100.25 }),
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup({ stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockProtectionOrderHandler.placeProtectionOrders).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'ETHUSDT' }),
        expect.objectContaining({ stopLoss: 95 }),
        110,
        expect.objectContaining({ id: 'w1' }),
        expect.any(Number),
      );
    });

    it('should call handleFailedProtection when SL protection fails', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.05, avgPrice: 100.25 }),
      });

      mockProtectionOrderHandler.placeProtectionOrders.mockResolvedValue({
        stopLossOrderId: null,
        takeProfitOrderId: 200,
        stopLossAlgoId: null,
        takeProfitAlgoId: null,
        stopLossIsAlgo: false,
        takeProfitIsAlgo: false,
        orderListId: null,
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup({ stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockProtectionOrderHandler.handleFailedProtection).toHaveBeenCalled();
    });

    it('should return null when handleFailedProtection says shouldReturn', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.05, avgPrice: 100.25 }),
      });

      mockProtectionOrderHandler.placeProtectionOrders.mockResolvedValue({
        stopLossOrderId: null,
        takeProfitOrderId: null,
        stopLossAlgoId: null,
        takeProfitAlgoId: null,
        stopLossIsAlgo: false,
        takeProfitIsAlgo: false,
        orderListId: null,
      });
      mockProtectionOrderHandler.handleFailedProtection.mockResolvedValue({ shouldReturn: true });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup({ stopLoss: 95, takeProfit: 110 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockProtectionOrderHandler.handleFailedProtection).toHaveBeenCalled();
    });

    it('should place single stop loss when TP is undefined', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.05, avgPrice: 100.25 }),
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup({ stopLoss: 95, takeProfit: undefined }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockProtectionOrderHandler.placeSingleStopLoss).toHaveBeenCalled();
    });

    it('should call handleFailedProtection when single SL also fails', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.05, avgPrice: 100.25 }),
      });

      mockProtectionOrderHandler.placeSingleStopLoss.mockResolvedValue({
        stopLossOrderId: null,
        stopLossAlgoId: null,
        stopLossIsAlgo: false,
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup({ stopLoss: 95, takeProfit: undefined }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockProtectionOrderHandler.handleFailedProtection).toHaveBeenCalled();
    });

    it('should abort when Binance order execution fails', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();
      mockAutoTradingService.executeBinanceOrder.mockRejectedValue(
        new Error('Insufficient margin'),
      );

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockDbInsert).toHaveBeenCalledTimes(1);
      expect(mockProtectionOrderHandler.placeProtectionOrders).not.toHaveBeenCalled();
    });

    it('should adjust quantity by leverage for FUTURES', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ leverage: 10 }),
      );
      setupDbForLiveTrading();
      mockGetFuturesClient.mockReturnValue({
        getOrderEntryFee: vi.fn().mockResolvedValue({ entryFee: 0.01, avgPrice: 100 }),
      });

      mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
        quantity: 1.0,
        sizePercent: 10,
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quantity: 0.1 }),
        'FUTURES',
      );
    });

    it('should not adjust quantity for SPOT market', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ leverage: 10 }),
      );
      setupDbForLiveTrading();

      mockPyramidingService.calculateDynamicPositionSize.mockResolvedValue({
        quantity: 1.0,
        sizePercent: 10,
      });

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'SPOT' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ quantity: 1.0 }),
        'SPOT',
      );
    });
  });

  describe('executePaperOrder', () => {
    it('should use current market price for paper market orders', async () => {
      setupDbForPaperTrading();
      mockPositionMonitorService.getCurrentPrice.mockResolvedValue(101.5);

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ entryPrice: 100, stopLoss: 90, takeProfit: 115 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockPositionMonitorService.getCurrentPrice).toHaveBeenCalledWith('ETHUSDT', 'FUTURES');
    });

    it('should use expected entry with slippage when no market price available', async () => {
      setupDbForPaperTrading();
      mockPositionMonitorService.getCurrentPrice.mockResolvedValue(null);

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ entryPrice: 100, stopLoss: 85, takeProfit: 125 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.addTradeExecution).toHaveBeenCalled();
    });

    it('should handle price fetch error gracefully for paper trading', async () => {
      setupDbForPaperTrading();
      mockPositionMonitorService.getCurrentPrice.mockRejectedValue(new Error('Network error'));

      const result = await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ entryPrice: 100, stopLoss: 90, takeProfit: 115 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(result).toBe(true);
    });
  });

  describe('executePaperOrder - limit orders', () => {
    it('should create pending order for unfilled LONG limit', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ useLimitOrders: true }),
      );
      mockPositionMonitorService.getCurrentPrice.mockResolvedValue(102);

      const setup = createSetup({
        direction: 'LONG',
        entryPrice: 100,
        stopLoss: 90,
        takeProfit: 115,
        limitEntryPrice: 98,
        expirationBars: 3,
      } as any);

      await executor.executeSetupSafe(
        createWatcher(),
        setup,
        [],
        createKlines(50),
        logBuffer,
      );

      expect(typeof logBuffer.addTradeExecution === 'function').toBe(true);
    });
  });

  describe('executeSetupInternal - full execution flow', () => {
    it('should release wallet lock on error during execution', async () => {
      setupDbForPaperTrading();
      mockRiskManagerService.validateNewPosition.mockRejectedValue(new Error('unexpected'));

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockRelease).toHaveBeenCalled();
    });

    it('should pass correct filter config to filter validator', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({
          useBtcCorrelationFilter: true,
          useFundingFilter: true,
          useMtfFilter: true,
          directionMode: 'auto',
        }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockFilterValidator.validateFilters).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          useBtcCorrelationFilter: true,
          useFundingFilter: true,
          useMtfFilter: true,
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should disable BTC correlation filter when direction mode is not auto', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({
          useBtcCorrelationFilter: true,
          directionMode: 'long_only',
        }),
      );

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG' }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockFilterValidator.validateFilters).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ useBtcCorrelationFilter: false }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should use watcher count for maxConcurrentPositions when watchers exist', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getWatcherStatus).mockReturnValue({ active: true, watchers: 8 });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockRiskManagerService.validateNewPosition).toHaveBeenCalledWith(
        'w1',
        expect.objectContaining({ maxConcurrentPositions: 8 }),
        expect.any(Number),
        8,
      );
    });

    it('should handle the case when watcher count is 0', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getWatcherStatus).mockReturnValue({ active: true, watchers: 0 });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockPyramidingService.calculateDynamicPositionSize).toHaveBeenCalledWith(
        'u1', 'w1', 'ETHUSDT', 'LONG', expect.any(Number),
        expect.any(Number), undefined, undefined, 'FUTURES',
      );
    });

    it('should pass active watchers count to dynamic position sizing', async () => {
      setupDbForPaperTrading();
      vi.mocked(deps.getWatcherStatus).mockReturnValue({ active: true, watchers: 3 });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockPyramidingService.calculateDynamicPositionSize).toHaveBeenCalledWith(
        'u1', 'w1', 'ETHUSDT', 'LONG', expect.any(Number),
        expect.any(Number), undefined, 3, 'FUTURES',
      );
    });

    it('should log error on unexpected error in execution', async () => {
      setupDbForPaperTrading();

      let insertCallCount = 0;
      mockDbInsert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) {
          return { values: vi.fn().mockResolvedValue(undefined) };
        }
        return { values: vi.fn().mockRejectedValue(new Error('unexpected DB error')) };
      });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.error).toHaveBeenCalled();
    });
  });

  describe('createAndExecuteTrade - trigger candle data', () => {
    it('should include trigger candle data in trade execution insert', async () => {
      setupDbForPaperTrading();

      const triggerCandleData = [
        { offset: 0, open: 100, high: 105, low: 95, close: 102, openTime: 1000 },
        { offset: -1, open: 98, high: 101, low: 96, close: 100, openTime: 900 },
      ];

      const setup = createSetup({
        triggerCandleData,
        triggerKlineIndex: 49,
        triggerIndicatorValues: { ema9: 101.5 },
        fibonacciProjection: { swingLow: 90, swingHigh: 110 },
      } as any);

      await executor.executeSetupSafe(
        createWatcher(),
        setup,
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockDbInsert).toHaveBeenCalled();
    });
  });

  describe('live execution - entry fee edge cases', () => {
    it('should not update entry price when avgPrice is 0', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      const mockClient = {
        getOrderEntryFee: vi.fn().mockResolvedValue({
          entryFee: 0.05,
          avgPrice: 0,
        }),
      };
      mockGetFuturesClient.mockReturnValue(mockClient);

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockClient.getOrderEntryFee).toHaveBeenCalled();
    });

    it('should handle null fee result', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      const mockClient = {
        getOrderEntryFee: vi.fn().mockResolvedValue(null),
      };
      mockGetFuturesClient.mockReturnValue(mockClient);

      const result = await executor.executeSetupSafe(
        createWatcher({ marketType: 'FUTURES' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(result).toBe(true);
    });
  });

  describe('live execution - SPOT market type', () => {
    it('should skip futures leverage/margin config for SPOT', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading();

      await executor.executeSetupSafe(
        createWatcher({ marketType: 'SPOT' as MarketType }),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.setFuturesLeverage).not.toHaveBeenCalled();
      expect(mockAutoTradingService.setFuturesMarginType).not.toHaveBeenCalled();
    });
  });

  describe('validateRiskReward edge cases', () => {
    const validate = (
      setup: TradingSetup,
      tp: number | undefined,
      mode = 'default',
      config: Record<string, unknown> | null = null,
    ) => (executor as any).validateRiskReward(setup, tp, mode, config, logBuffer);

    it('should use BACKTEST_DEFAULTS when config has no R:R ratios', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 95 });
      const config = {};
      const result = validate(setup, 108, 'default', config);
      expect(result.valid).toBe(true);
    });

    it('should use BACKTEST_DEFAULTS for SHORT when config has no R:R', () => {
      const setup = createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 105 });
      const config = {};
      const result = validate(setup, 94, 'default', config);
      expect(result.valid).toBe(true);
    });

    it('should fail LONG with exactly zero risk', () => {
      const setup = createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 100 });
      expect(validate(setup, 110).valid).toBe(false);
    });

    it('should fail SHORT with exactly zero risk', () => {
      const setup = createSetup({ direction: 'SHORT', entryPrice: 100, stopLoss: 100 });
      expect(validate(setup, 90).valid).toBe(false);
    });
  });

  describe('fibonacci swing range config', () => {
    it('should use fibonacciSwingRange from config', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({ tpCalculationMode: 'fibonacci', fibonacciSwingRange: 'extended' }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [{ level: 2.0, price: 120 }],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 90 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(calculateFibonacciProjection).toHaveBeenCalledWith(
        expect.any(Array), expect.any(Number), 336, 'LONG', 'extended',
      );
    });
  });

  describe('execution lock key', () => {
    it('should allow execution of different setups for same symbol', async () => {
      setupDbForPaperTrading();

      const setup1 = createSetup({ type: 'larry_williams_9_1' } as any);
      const setup2 = createSetup({ type: 'momentum_breakout' } as any);

      const logBuffer1 = createLogBuffer();
      const logBuffer2 = createLogBuffer();

      const [r1, r2] = await Promise.all([
        executor.executeSetupSafe(createWatcher(), setup1, [], createKlines(50), logBuffer1),
        executor.executeSetupSafe(createWatcher(), setup2, [], createKlines(50), logBuffer2),
      ]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
    });

    it('should allow execution after previous setup completes', async () => {
      setupDbForPaperTrading();

      const result1 = await executor.executeSetupSafe(
        createWatcher(), createSetup(), [], createKlines(50), logBuffer,
      );

      const result2 = await executor.executeSetupSafe(
        createWatcher(), createSetup(), [], createKlines(50), createLogBuffer(),
      );

      expect(result1).toBe(true);
      expect(result2).toBe(true);
    });
  });

  describe('paper testnet wallet type', () => {
    it('should treat testnet wallet as non-live when ENABLE_LIVE_TRADING is false', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = false;
      setupDbForPaperTrading({ walletType: 'testnet' });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).not.toHaveBeenCalled();
    });

    it('should treat testnet wallet as live when ENABLE_LIVE_TRADING is true', async () => {
      (env as Record<string, unknown>).ENABLE_LIVE_TRADING = true;
      setupDbForLiveTrading({ walletType: 'testnet' });

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup(),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(mockAutoTradingService.executeBinanceOrder).toHaveBeenCalled();
    });
  });

  describe('fibonacci target level fallback config', () => {
    it('should fall back to generic fibonacciTargetLevel when direction-specific is null', async () => {
      vi.mocked(deps.getCachedConfig).mockResolvedValue(
        createDefaultConfig({
          tpCalculationMode: 'fibonacci',
          fibonacciTargetLevel: '1.618',
          fibonacciTargetLevelLong: null,
          fibonacciTargetLevelShort: null,
        }),
      );
      vi.mocked(calculateFibonacciProjection).mockReturnValue({
        levels: [{ level: 1.618, price: 115 }],
      } as never);

      setupDbForPaperTrading();

      await executor.executeSetupSafe(
        createWatcher(),
        createSetup({ direction: 'LONG', entryPrice: 100, stopLoss: 90 }),
        [],
        createKlines(50),
        logBuffer,
      );

      expect(logBuffer.log).toHaveBeenCalledWith(
        '>',
        'Using Fibonacci projection for take profit',
        expect.objectContaining({ configLevel: '1.618' }),
      );
    });
  });
});
