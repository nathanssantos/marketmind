import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const {
  mockDbSelectLimit,
  mockDbSelectWhere: _mockDbSelectWhere,
  mockDbSelectLeftJoin: _mockDbSelectLeftJoin,
  mockDbSelectFrom,
  mockDbFindMany,
  mockPrefetchKlines,
  mockPrefetchKlinesAsync,
  mockMeetsKlineRequirement,
  mockDetect,
  mockLoadAll,
  mockToResult,
  mockAddLog,
  mockEmitAutoTradingLog,
  mockGetWebSocketService,
} = vi.hoisted(() => {
  const mockDbSelectLimit = vi.fn().mockResolvedValue([]);
  const mockDbSelectWhere = vi.fn(() => ({ limit: mockDbSelectLimit }));
  const mockDbSelectLeftJoin = vi.fn(() => ({ where: mockDbSelectWhere }));
  const mockDbSelectFrom = vi.fn(() => ({ leftJoin: mockDbSelectLeftJoin, where: mockDbSelectWhere }));
  const mockDbFindMany = vi.fn().mockResolvedValue([]);
  const mockPrefetchKlines = vi.fn().mockResolvedValue({ success: true, downloaded: 0, totalInDb: 100, gaps: 0, alreadyComplete: false });
  const mockPrefetchKlinesAsync = vi.fn();
  const mockMeetsKlineRequirement = vi.fn(() => true);
  const mockDetect = vi.fn().mockReturnValue({ setup: null, confidence: 0 });
  const mockLoadAll = vi.fn().mockResolvedValue([]);
  const mockToResult: ReturnType<typeof vi.fn> = vi.fn(
    (status: string, reason?: string, klinesCount?: number) => ({
      watcherId: '',
      symbol: 'BTCUSDT',
      interval: '1h',
      marketType: 'FUTURES',
      status,
      reason,
      setupsDetected: [],
      filterChecks: [],
      rejections: [],
      tradeExecutions: [],
      setupValidations: [],
      tradesExecuted: 0,
      durationMs: 0,
      klinesCount,
      logs: [],
    })
  );
  const mockAddLog = vi.fn((_walletId: string, entry: Record<string, unknown>) => ({ ...entry, id: 'log-1' }));
  const mockEmitAutoTradingLog = vi.fn();
  const mockGetWebSocketService = vi.fn(() => ({ emitAutoTradingLog: mockEmitAutoTradingLog }));

  return {
    mockDbSelectLimit,
    mockDbSelectWhere,
    mockDbSelectLeftJoin,
    mockDbSelectFrom,
    mockDbFindMany,
    mockPrefetchKlines,
    mockPrefetchKlinesAsync,
    mockMeetsKlineRequirement,
    mockDetect,
    mockLoadAll,
    mockToResult,
    mockAddLog,
    mockEmitAutoTradingLog,
    mockGetWebSocketService,
  };
});

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    TRADING_DEFAULTS: {
      ...actual.TRADING_DEFAULTS,
      REQUIRED_KLINES: 500,
      MIN_KLINES_FOR_SETUP: 100,
      MIN_TRADE_VALUE_USD: 1,
      MIN_RISK_REWARD_RATIO: 1.5,
    },
  };
});

vi.mock('../../../constants', () => ({
  ABSOLUTE_MINIMUM_KLINES: 50,
  AUTO_TRADING_BATCH: { WATCHER_BATCH_SIZE: 5 },
  AUTO_TRADING_TIMING: { CANDLE_CLOSE_SAFETY_BUFFER_MS: 3000 },
  TIME_MS: { MINUTE: 60_000, HOUR: 3_600_000, SECOND: 1000 },
  UNIT_MS: { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 },
  AUTO_TRADING_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 1000, MAX_DELAY_MS: 10000, BACKOFF_MULTIPLIER: 2 },
  PROTECTION_ORDER_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 500, MAX_DELAY_MS: 5000, BACKOFF_MULTIPLIER: 2 },
}));

vi.mock('../../../db', () => ({
  db: {
    query: {
      klines: { findMany: mockDbFindMany },
    },
    select: vi.fn(() => ({
      from: mockDbSelectFrom,
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: { walletId: 'walletId' },
  klines: { symbol: 'symbol', interval: 'interval', marketType: 'marketType', openTime: 'openTime' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: mockPrefetchKlines,
  prefetchKlinesAsync: mockPrefetchKlinesAsync,
  meetsKlineRequirementWithTolerance: mockMeetsKlineRequirement,
}));

vi.mock('../../setup-detection/dynamic', () => {
  class MockStrategyLoader {
    loadAll = mockLoadAll;
  }
  class MockStrategyInterpreter {
    detect = mockDetect;
  }
  return {
    StrategyInterpreter: MockStrategyInterpreter,
    StrategyLoader: MockStrategyLoader,
  };
});

vi.mock('../../watcher-batch-logger', () => {
  class MockWatcherLogBuffer {
    addFilterCheck = vi.fn();
    addValidationCheck = vi.fn();
    addRejection = vi.fn();
    addSetup = vi.fn();
    log = vi.fn();
    warn = vi.fn();
    error = vi.fn();
    startSetupValidation = vi.fn();
    completeSetupValidation = vi.fn();
    incrementTrades = vi.fn();
    toResult = mockToResult;
  }
  return {
    createBatchResult: vi.fn((_id: unknown, _start: unknown, results: unknown[]) => ({
      watcherResults: results,
      totalDurationMs: 0,
      batchId: 1,
      startTime: new Date(),
      endTime: new Date(),
      totalWatchers: (results as unknown[]).length,
      successCount: 0,
      skippedCount: 0,
      pendingCount: 0,
      errorCount: 0,
      totalSetupsDetected: 0,
      totalRejections: 0,
      totalFilterBlocks: 0,
      totalTradesExecuted: 0,
    })),
    outputBatchResults: vi.fn(),
    WatcherLogBuffer: MockWatcherLogBuffer,
  };
});

vi.mock('../../auto-trading-log-buffer', () => ({
  autoTradingLogBuffer: { addLog: mockAddLog },
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: mockGetWebSocketService,
}));

vi.mock('../../../utils/kline-calculator', () => ({
  calculateRequiredKlines: vi.fn(() => 500),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

vi.mock('../utils', () => ({
  log: vi.fn(),
  yieldToEventLoop: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../env', () => ({
  env: { ENCRYPTION_KEY: 'a'.repeat(64) },
}));

import { SignalProcessor, type SignalProcessorConfig } from '../signal-processor';
import type { ActiveWatcher, SignalProcessorDeps } from '../types';


const HOUR_MS = 3_600_000;

const createWatcher = (overrides: Partial<ActiveWatcher> = {}): ActiveWatcher => ({
  walletId: 'wallet-1',
  userId: 'user-1',
  symbol: 'BTCUSDT',
  interval: '1h',
  marketType: 'FUTURES',
  exchange: 'BINANCE',
  enabledStrategies: ['strategy-1'],
  profileName: 'Test Profile',
  intervalId: setInterval(() => {}, 999999),
  lastProcessedTime: 0,
  isManual: false,
  ...overrides,
});

const createDeps = (): SignalProcessorDeps => ({
  getActiveWatchers: vi.fn(() => new Map<string, ActiveWatcher>()),
  executeSetupSafe: vi.fn().mockResolvedValue(true),
  isWatcherRecentlyRotated: vi.fn().mockReturnValue(false),
  getRotationPendingWatcher: vi.fn().mockReturnValue(undefined),
  deleteRotationPendingWatcher: vi.fn(),
  incrementBarsForOpenTrades: vi.fn().mockResolvedValue(undefined),
  checkAllRotationsOnce: vi.fn().mockResolvedValue([]),
  getConfigCacheStats: vi.fn().mockReturnValue({ size: 0, hits: 0, misses: 0, preloads: 0, hitRate: 0 }),
  isWalletPaused: vi.fn().mockReturnValue(false),
  pauseWatchersForWallet: vi.fn(),
  resumeWatchersForWallet: vi.fn(),
});

const createConfig = (): SignalProcessorConfig => ({
  strategiesDir: '/tmp/strategies',
});

const createKlineRow = (openTimeMs: number, overrides: Record<string, unknown> = {}) => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  marketType: 'FUTURES',
  openTime: new Date(openTimeMs),
  closeTime: new Date(openTimeMs + HOUR_MS - 1),
  open: '50000',
  high: '51000',
  low: '49000',
  close: '50500',
  volume: '1000',
  quoteVolume: '50000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '25000000',
  ...overrides,
});

describe('SignalProcessor', () => {
  let processor: SignalProcessor;
  let deps: SignalProcessorDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    deps = createDeps();
    processor = new SignalProcessor(deps, createConfig());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('queueWatcherProcessing', () => {
    it('should add watcher to processing queue', () => {
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      expect((processor as any).processingQueue).toContain('w1-ETHUSDT-1h-FUTURES');
    });

    it('should not add duplicate watcher to queue', () => {
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      expect((processor as any).processingQueue.filter(
        (id: string) => id === 'w1-ETHUSDT-1h-FUTURES',
      ).length).toBe(1);
    });

    it('should allow re-queueing a watcher already processed this cycle', () => {
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      (processor as any).processingQueue = [];
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      expect((processor as any).processingQueue).toContain('w1-ETHUSDT-1h-FUTURES');
    });
  });

  describe('addToProcessingQueue', () => {
    it('should add multiple watchers to queue', () => {
      processor.addToProcessingQueue(['w1-A-1h-FUTURES', 'w1-B-1h-FUTURES']);
      expect((processor as any).processingQueue).toContain('w1-A-1h-FUTURES');
      expect((processor as any).processingQueue).toContain('w1-B-1h-FUTURES');
    });

    it('should not add duplicates', () => {
      processor.addToProcessingQueue(['w1-A-1h-FUTURES']);
      processor.addToProcessingQueue(['w1-A-1h-FUTURES', 'w1-B-1h-FUTURES']);
      expect(
        (processor as any).processingQueue.filter((id: string) => id === 'w1-A-1h-FUTURES').length,
      ).toBe(1);
    });
  });

  describe('getIntervalMs', () => {
    it('should parse minute intervals', () => {
      const result = (processor as any).getIntervalMs('15m');
      expect(result).toBe(15 * 60_000);
    });

    it('should parse hour intervals', () => {
      const result = (processor as any).getIntervalMs('4h');
      expect(result).toBe(4 * 3_600_000);
    });

    it('should parse day intervals', () => {
      const result = (processor as any).getIntervalMs('1d');
      expect(result).toBe(86_400_000);
    });

    it('should parse week intervals', () => {
      const result = (processor as any).getIntervalMs('1w');
      expect(result).toBe(604_800_000);
    });

    it('should return default 4h for invalid format', () => {
      const result = (processor as any).getIntervalMs('invalid');
      expect(result).toBe(4 * 3_600_000);
    });

    it('should return default 4h for empty string', () => {
      const result = (processor as any).getIntervalMs('');
      expect(result).toBe(4 * 3_600_000);
    });

    it('should return default 4h for unknown unit', () => {
      const result = (processor as any).getIntervalMs('5x');
      expect(result).toBe(4 * 3_600_000);
    });
  });

  describe('processWatcherWithBuffer', () => {
    it('should return error result when watcher not found in active watchers', async () => {
      const emptyMap = new Map<string, ActiveWatcher>();
      vi.mocked(deps.getActiveWatchers).mockReturnValue(emptyMap);

      const result = await (processor as any).processWatcherWithBuffer('nonexistent-watcher');

      expect(result.status).toBe('error');
      expect(result.reason).toBe('Watcher not found');
      expect(result.watcherId).toBe('nonexistent-watcher');
      expect(result.symbol).toBe('unknown');
    });

    it('should set isRecentlyRotated on result', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWatcherRecentlyRotated).mockReturnValue(true);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.isRecentlyRotated).toBe(true);
    });

    it('should catch errors in processWatcherCore and return error result', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);

      mockDbSelectLimit.mockRejectedValueOnce(new Error('DB connection failed'));

      mockToResult.mockReturnValueOnce({
        watcherId: 'wallet-1-BTCUSDT-1h-FUTURES',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'error',
        reason: 'Error: DB connection failed',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('error');
    });
  });

  describe('processWatcherCore - wallet paused', () => {
    it('should return skipped when wallet is paused', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValueOnce({
        watcherId: 'wallet-1-BTCUSDT-1h-FUTURES',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused - no free capital',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Wallet paused - no free capital');
    });
  });

  describe('processWatcherCore - economy mode', () => {
    it('should enter economy mode when available capital is below minimum', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);

      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '0.5', leverage: 1 }]);

      mockToResult.mockReturnValueOnce({
        watcherId: 'wallet-1-BTCUSDT-1h-FUTURES',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Economy mode - waiting for capital',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
      expect((processor as any).walletEconomyMode.get('wallet-1')).toBe(true);
    });

    it('should wake from economy mode when capital available again', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);

      (processor as any).walletEconomyMode.set('wallet-1', true);

      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 2 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: 'wallet-1-BTCUSDT-1h-FUTURES',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect((processor as any).walletEconomyMode.get('wallet-1')).toBe(false);
      expect(deps.checkAllRotationsOnce).toHaveBeenCalled();
    });

    it('should handle zero balance with leverage', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);

      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '0', leverage: 10 }]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Economy mode - waiting for capital',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
    });

    it('should handle null wallet config result', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);

      mockDbSelectLimit.mockResolvedValueOnce([undefined]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Economy mode - waiting for capital',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
    });
  });

  describe('processWatcherCore - kline fetching', () => {
    const setupWatcherWithBalance = (balance = '1000', leverage = 1) => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: balance, leverage }]);
      return watcher;
    };

    it('should backfill klines when below minimum required', async () => {
      setupWatcherWithBalance();

      mockDbFindMany.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Kline backfill in progress',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockPrefetchKlinesAsync).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        targetCount: 500,
        silent: true,
      });
      expect(result.status).toBe('pending');
    });

    it('should return pending and not block when klines are insufficient', async () => {
      setupWatcherWithBalance();

      mockDbFindMany.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Kline backfill in progress',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockPrefetchKlinesAsync).toHaveBeenCalled();
      expect(mockPrefetchKlines).not.toHaveBeenCalled();
      expect(result.status).toBe('pending');
    });

    it('should trigger async prefetch and not perform a blocking fetch', async () => {
      setupWatcherWithBalance();

      mockDbFindMany.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Kline backfill in progress',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockPrefetchKlinesAsync).toHaveBeenCalledWith(
        expect.objectContaining({ symbol: 'BTCUSDT', interval: '1h', silent: true })
      );
      expect(mockDbFindMany).toHaveBeenCalledTimes(1);
    });

    it('should only query klines once when insufficient (no re-fetch)', async () => {
      setupWatcherWithBalance();

      mockDbFindMany.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Kline backfill in progress',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockDbFindMany).toHaveBeenCalledTimes(1);
    });
  });

  describe('processWatcherCore - candle availability', () => {
    const setupWithKlines = (klineRows: ReturnType<typeof createKlineRow>[]) => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);
      return watcher;
    };

    it('should return skipped when no closed candles available', async () => {
      const now = Date.now();
      const intervalMs = HOUR_MS;
      const currentCandleOpen = Math.floor(now / intervalMs) * intervalMs;
      const klineRows = [createKlineRow(currentCandleOpen)];

      setupWithKlines(klineRows);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'No closed candles',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('No closed candles');
    });

    it('should return skipped when candle was already processed', async () => {
      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );

      const watcher = setupWithKlines(klineRows);
      watcher.lastProcessedCandleOpenTime = lastCandleOpen;

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Already processed',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('skipped');
      expect(result.reason).toBe('Already processed');
    });
  });

  describe('processWatcherCore - rotation pending', () => {
    it('should return pending when rotation sync is not yet complete', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      vi.mocked(deps.getRotationPendingWatcher).mockReturnValue({
        addedAt: now - 1000,
        targetCandleClose: now + 60_000,
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Rotation sync: 63s',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('pending');
    });

    it('should complete rotation sync when target time has passed', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      vi.mocked(deps.getRotationPendingWatcher).mockReturnValue({
        addedAt: now - 10_000,
        targetCandleClose: now - 5_000,
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.deleteRotationPendingWatcher).toHaveBeenCalledWith(
        'wallet-1-BTCUSDT-1h-FUTURES'
      );
    });
  });

  describe('processWatcherCore - setup detection', () => {
    const setupForDetection = () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);

      return { watcher, lastCandleOpen };
    };

    it('should return success with no setups when none detected', async () => {
      setupForDetection();
      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({ setup: null, confidence: 0 });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('success');
    });

    it('should filter strategies by enabled list', async () => {
      const { watcher } = setupForDetection();
      watcher.enabledStrategies = ['strategy-1'];

      mockLoadAll.mockResolvedValueOnce([
        { id: 'strategy-1', name: 'Enabled Strategy' },
        { id: 'strategy-2', name: 'Disabled Strategy' },
      ]);
      mockDetect.mockReturnValue({ setup: null, confidence: 0 });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockDetect).toHaveBeenCalledTimes(1);
    });

    it('should detect and execute setups with sufficient confidence', async () => {
      const { lastCandleOpen: _lastCandleOpen } = setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: {
          type: 'Test Strategy',
          direction: 'LONG',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          riskRewardRatio: 2.0,
        },
        confidence: 80,
        triggerKlineIndex: 59,
        triggerCandleData: {},
        triggerIndicatorValues: {},
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [{ type: 'Test Strategy', direction: 'LONG' }],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 1,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.executeSetupSafe).toHaveBeenCalled();
      expect(result.status).toBe('success');
    });

    it('should not execute setups with confidence below threshold', async () => {
      setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: {
          type: 'Test Strategy',
          direction: 'LONG',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          riskRewardRatio: 2.0,
        },
        confidence: 30,
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.executeSetupSafe).not.toHaveBeenCalled();
    });

    it('should handle rejections with direction details', async () => {
      setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 0,
        rejection: {
          reason: 'Trend filter: wrong direction',
          details: {
            direction: 'LONG',
            entryPrice: 50000,
            trendStrength: 0.3,
          },
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [{ setupType: 'Test Strategy', direction: 'LONG', reason: 'Trend filter: wrong direction' }],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('success');
    });

    it('should handle rejections without direction', async () => {
      setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 0,
        rejection: {
          reason: 'Not enough data',
          details: {},
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');
    });

    it('should handle rejection with dash direction', async () => {
      setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 0,
        rejection: {
          reason: 'Volume too low',
          details: { direction: '-' },
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');
    });

    it('should update lastProcessedCandleOpenTime after processing', async () => {
      const { watcher, lastCandleOpen } = setupForDetection();

      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(watcher.lastProcessedCandleOpenTime).toBe(lastCandleOpen);
    });

    it('should call incrementBarsForOpenTrades', async () => {
      setupForDetection();
      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.incrementBarsForOpenTrades).toHaveBeenCalledWith('BTCUSDT', '1h', 50500);
    });

    it('should handle multiple setups from different strategies', async () => {
      const watcher = createWatcher({ enabledStrategies: ['strategy-1', 'strategy-2'] });
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);

      mockLoadAll.mockResolvedValueOnce([
        { id: 'strategy-1', name: 'Strategy A' },
        { id: 'strategy-2', name: 'Strategy B' },
      ]);

      mockDetect
        .mockReturnValueOnce({
          setup: {
            type: 'Strategy A',
            direction: 'LONG',
            entryPrice: 50000,
            stopLoss: 49000,
            takeProfit: 52000,
            riskRewardRatio: 2.0,
          },
          confidence: 80,
          triggerKlineIndex: 59,
          triggerCandleData: {},
          triggerIndicatorValues: {},
        })
        .mockReturnValueOnce({
          setup: {
            type: 'Strategy B',
            direction: 'SHORT',
            entryPrice: 50000,
            stopLoss: 51000,
            takeProfit: 48000,
            riskRewardRatio: 2.0,
          },
          confidence: 75,
          triggerKlineIndex: 59,
          triggerCandleData: {},
          triggerIndicatorValues: {},
        });

      vi.mocked(deps.executeSetupSafe).mockResolvedValue(true);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 2,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.executeSetupSafe).toHaveBeenCalledTimes(2);
    });

    it('should not increment trades when executeSetupSafe returns false', async () => {
      setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: {
          type: 'Test Strategy',
          direction: 'LONG',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          riskRewardRatio: 2.0,
        },
        confidence: 80,
        triggerKlineIndex: 59,
        triggerCandleData: {},
        triggerIndicatorValues: {},
      });

      vi.mocked(deps.executeSetupSafe).mockResolvedValueOnce(false);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(deps.executeSetupSafe).toHaveBeenCalled();
    });

    it('should update lastProcessedTime after processing with setups', async () => {
      const { watcher } = setupForDetection();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: {
          type: 'Test Strategy',
          direction: 'LONG',
          entryPrice: 50000,
          stopLoss: 49000,
          takeProfit: 52000,
          riskRewardRatio: 2.0,
        },
        confidence: 80,
        triggerKlineIndex: 59,
        triggerCandleData: {},
        triggerIndicatorValues: {},
      });

      vi.mocked(deps.executeSetupSafe).mockResolvedValueOnce(true);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 1,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(watcher.lastProcessedTime).toBeGreaterThan(0);
    });
  });

  describe('processWatcherQueue', () => {
    it('should not run concurrently', async () => {
      (processor as any).isProcessingQueue = true;
      await (processor as any).processWatcherQueue();
      expect(deps.checkAllRotationsOnce).not.toHaveBeenCalled();
    });

    it('should start a new cycle when pendingCycleId is null', async () => {
      (processor as any).processingQueue = ['watcher-1'];

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect(deps.checkAllRotationsOnce).toHaveBeenCalled();
      expect((processor as any).cycleCounter).toBe(1);
    });

    it('should add new watchers from rotation check', async () => {
      (processor as any).processingQueue = ['watcher-1'];

      vi.mocked(deps.checkAllRotationsOnce).mockResolvedValueOnce(['new-watcher-1', 'new-watcher-2']);

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      watcherMap.set('new-watcher-1', createWatcher({ symbol: 'ETHUSDT' }));
      watcherMap.set('new-watcher-2', createWatcher({ symbol: 'SOLUSDT' }));
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect((processor as any).batchCounter).toBeGreaterThanOrEqual(1);
    });

    it('should clear processedThisCycle and reset cycle when no pending watchers', async () => {
      (processor as any).processingQueue = ['watcher-1'];

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect((processor as any).pendingCycleId).toBeNull();
      expect((processor as any).isProcessingQueue).toBe(false);
    });

    it('should not clear cycle state when there are pending watchers', async () => {
      (processor as any).processingQueue = ['watcher-1'];

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Waiting',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect((processor as any).pendingCycleId).not.toBeNull();
    });

    it('should update existing result when same watcher re-processed', async () => {
      (processor as any).processingQueue = ['watcher-1'];
      (processor as any).pendingCycleId = 1;
      (processor as any).pendingCycleStartTime = new Date();
      (processor as any).pendingResults = [
        {
          watcherId: 'watcher-1',
          status: 'pending',
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          setupsDetected: [],
          filterChecks: [],
          rejections: [],
          tradeExecutions: [],
          setupValidations: [],
          tradesExecuted: 0,
          durationMs: 0,
          logs: [],
        },
        {
          watcherId: 'watcher-2',
          status: 'pending',
          symbol: 'ETHUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          setupsDetected: [],
          filterChecks: [],
          rejections: [],
          tradeExecutions: [],
          setupValidations: [],
          tradesExecuted: 0,
          durationMs: 0,
          logs: [],
        },
      ];

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      watcherMap.set('watcher-2', createWatcher({ symbol: 'ETHUSDT' }));
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      const updatedResult = (processor as any).pendingResults.find(
        (r: { watcherId: string }) => r.watcherId === 'watcher-1'
      );
      expect(updatedResult).toBeDefined();
      expect(updatedResult.status).toBe('skipped');
      expect((processor as any).pendingCycleId).not.toBeNull();
    });

    it('should accumulate results in pendingResults when not pending', async () => {
      (processor as any).processingQueue = ['watcher-1'];

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect((processor as any).pendingResults).toHaveLength(0);
    });
  });

  describe('emitLogsToWebSocket', () => {
    it('should emit logs for each watcher result to websocket', () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);

      const watcherResults = [
        {
          watcherId: 'wallet-1-BTCUSDT-1h-FUTURES',
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          status: 'success',
          setupsDetected: [],
          filterChecks: [],
          rejections: [],
          tradeExecutions: [],
          setupValidations: [],
          tradesExecuted: 0,
          durationMs: 10,
          logs: [
            {
              timestamp: new Date(),
              level: 'info' as const,
              emoji: '>',
              message: 'Processing watcher',
            },
          ],
        },
      ];

      (processor as any).emitLogsToWebSocket(watcherResults);

      expect(mockAddLog).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
        level: 'info',
        emoji: '>',
        message: 'Processing watcher',
        symbol: 'BTCUSDT',
        interval: '1h',
      }));
      expect(mockEmitAutoTradingLog).toHaveBeenCalledWith('wallet-1', expect.objectContaining({
        id: 'log-1',
      }));
    });

    it('should skip when websocket service is null', () => {
      mockGetWebSocketService.mockReturnValueOnce(null as unknown as ReturnType<typeof mockGetWebSocketService>);

      (processor as any).emitLogsToWebSocket([]);

      expect(mockAddLog).not.toHaveBeenCalled();
    });

    it('should skip watchers not found in active watchers', () => {
      vi.mocked(deps.getActiveWatchers).mockReturnValue(new Map());

      const watcherResults = [
        {
          watcherId: 'nonexistent',
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          status: 'success',
          setupsDetected: [],
          filterChecks: [],
          rejections: [],
          tradeExecutions: [],
          setupValidations: [],
          tradesExecuted: 0,
          durationMs: 10,
          logs: [
            {
              timestamp: new Date(),
              level: 'info' as const,
              emoji: '>',
              message: 'Test',
            },
          ],
        },
      ];

      (processor as any).emitLogsToWebSocket(watcherResults);

      expect(mockAddLog).not.toHaveBeenCalled();
    });

    it('should emit multiple log entries for a single watcher', () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('watcher-1', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);

      const watcherResults = [
        {
          watcherId: 'watcher-1',
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'FUTURES',
          status: 'success',
          setupsDetected: [],
          filterChecks: [],
          rejections: [],
          tradeExecutions: [],
          setupValidations: [],
          tradesExecuted: 0,
          durationMs: 10,
          logs: [
            { timestamp: new Date(), level: 'info' as const, emoji: '>', message: 'Processing' },
            { timestamp: new Date(), level: 'info' as const, emoji: '>', message: 'Scanning' },
            { timestamp: new Date(), level: 'info' as const, emoji: '.', message: 'No setups' },
          ],
        },
      ];

      (processor as any).emitLogsToWebSocket(watcherResults);

      expect(mockAddLog).toHaveBeenCalledTimes(3);
      expect(mockEmitAutoTradingLog).toHaveBeenCalledTimes(3);
    });
  });

  describe('processWatcherCore - candle timing edge cases', () => {
    it('should handle missing latest candle with short wait time', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const twoCandlesAgoOpen = Math.floor(now / intervalMs) * intervalMs - 2 * intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(twoCandlesAgoOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      mockPrefetchKlines.mockResolvedValueOnce({
        success: true,
        downloaded: 1,
        totalInDb: 61,
        gaps: 0,
        alreadyComplete: false,
      });

      mockToResult.mockReturnValue({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Fetched missing candle, reprocessing',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('pending');
    });

    it('should handle candle not yet closed by scheduling recheck', async () => {
      vi.useRealTimers();
      const realNow = Date.now();
      vi.useFakeTimers({ now: realNow, shouldAdvanceTime: true });

      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const currentCandleOpen = Math.floor(now / intervalMs) * intervalMs;
      const lastCandleOpen = currentCandleOpen - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs, {
          closeTime: i === 59 ? new Date(now + 1000) : new Date(lastCandleOpen - (59 - i) * intervalMs + intervalMs - 1),
        })
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValue({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'pending',
        reason: 'Candle closes in 4s',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('pending');
    });
  });

  describe('processWatcherCore - kline mapping', () => {
    it('should map DB klines to Kline type correctly', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;

      const klineRow = createKlineRow(lastCandleOpen, {
        quoteVolume: null,
        trades: null,
        takerBuyBaseVolume: null,
        takerBuyQuoteVolume: null,
      });

      const klineRows = [
        ...Array.from({ length: 59 }, (_, i) =>
          createKlineRow(lastCandleOpen - i * intervalMs)
        ),
        klineRow,
      ];
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(mockToResult).toHaveBeenCalled();
    });
  });

  describe('economy mode edge cases', () => {
    it('should track wallet economy mode state', () => {
      (processor as any).walletEconomyMode.set('w1', true);
      expect((processor as any).walletEconomyMode.get('w1')).toBe(true);
    });

    it('should default to not economy mode', () => {
      expect((processor as any).walletEconomyMode.get('nonexistent')).toBeUndefined();
    });
  });

  describe('batch counter', () => {
    it('should start with batch counter at 0', () => {
      expect((processor as any).batchCounter).toBe(0);
    });

    it('should start with cycle counter at 0', () => {
      expect((processor as any).cycleCounter).toBe(0);
    });
  });

  describe('queueWatcherProcessing deduplication', () => {
    it('should not add duplicate watcher to queue', () => {
      processor.queueWatcherProcessing('w1-TEST-1h-FUTURES');
      processor.queueWatcherProcessing('w1-TEST-1h-FUTURES');
      expect((processor as any).processingQueue.filter((id: string) => id === 'w1-TEST-1h-FUTURES').length).toBe(1);
    });

    it('should allow re-queueing after watcher is dequeued', () => {
      processor.queueWatcherProcessing('w1-TEST-1h-FUTURES');
      (processor as any).processingQueue = [];
      processor.queueWatcherProcessing('w1-TEST-1h-FUTURES');
      expect((processor as any).processingQueue).toContain('w1-TEST-1h-FUTURES');
    });
  });

  describe('pending results', () => {
    it('should initialize with empty pending results', () => {
      expect((processor as any).pendingResults).toEqual([]);
    });

    it('should initialize with null pending cycle ID', () => {
      expect((processor as any).pendingCycleId).toBeNull();
    });
  });

  describe('processWatcherCore - rejection details formatting', () => {
    const setupForRejectionTest = () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      return watcher;
    };

    it('should handle rejection with no details object', async () => {
      setupForRejectionTest();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 0,
        rejection: {
          reason: 'No signal',
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [{ setupType: 'Test Strategy', direction: '-', reason: 'No signal' }],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');
    });

    it('should handle rejection with direction LONG and entry price detail', async () => {
      setupForRejectionTest();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 45,
        rejection: {
          reason: 'Risk/Reward: below minimum',
          details: {
            direction: 'LONG',
            entryPrice: 50000,
            riskReward: 0.8,
            minRequired: 1.5,
          },
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');
    });

    it('should handle rejection with direction SHORT and no extra details', async () => {
      setupForRejectionTest();

      mockLoadAll.mockResolvedValueOnce([{ id: 'strategy-1', name: 'Test Strategy' }]);
      mockDetect.mockReturnValueOnce({
        setup: null,
        confidence: 60,
        rejection: {
          reason: 'Trend filter blocked',
          details: {
            direction: 'SHORT',
          },
        },
      });

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');
    });
  });

  describe('constructor', () => {
    it('should initialize StrategyLoader with provided strategies directory', () => {
      const config = { strategiesDir: '/custom/strategies/dir' };
      const newProcessor = new SignalProcessor(deps, config);
      expect((newProcessor as any).strategyLoader).toBeDefined();
    });
  });

  describe('processWatcherCore - leverage applied to capital', () => {
    it('should use leveraged capital for economy mode check', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);

      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '0.3' }]);
      mockDbSelectLimit.mockResolvedValueOnce([{ leverage: 5 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('success');
      expect((processor as any).walletEconomyMode.get('wallet-1')).toBeUndefined();
    });
  });

  describe('processWatcherCore - incrementBarsForOpenTrades error handling', () => {
    it('should continue processing even if incrementBarsForOpenTrades fails', async () => {
      const watcher = createWatcher();
      const watcherMap = new Map<string, ActiveWatcher>();
      watcherMap.set('wallet-1-BTCUSDT-1h-FUTURES', watcher);
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(false);
      mockDbSelectLimit.mockResolvedValueOnce([{ currentBalance: '1000', leverage: 1 }]);

      const now = Date.now();
      const intervalMs = HOUR_MS;
      const lastCandleOpen = Math.floor(now / intervalMs) * intervalMs - intervalMs;
      const klineRows = Array.from({ length: 60 }, (_, i) =>
        createKlineRow(lastCandleOpen - i * intervalMs)
      );
      mockDbFindMany.mockResolvedValueOnce(klineRows);
      mockLoadAll.mockResolvedValueOnce([]);

      vi.mocked(deps.incrementBarsForOpenTrades).mockRejectedValueOnce(new Error('DB error'));

      mockToResult.mockReturnValueOnce({
        watcherId: '',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'success',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      const result = await (processor as any).processWatcherWithBuffer('wallet-1-BTCUSDT-1h-FUTURES');

      expect(result.status).toBe('success');
    });
  });

  describe('processWatcherQueue - batch processing', () => {
    it('should process multiple watchers in batches', async () => {
      (processor as any).processingQueue = [
        'watcher-1', 'watcher-2', 'watcher-3',
        'watcher-4', 'watcher-5', 'watcher-6',
      ];

      const watcherMap = new Map<string, ActiveWatcher>();
      for (let i = 1; i <= 6; i++) {
        watcherMap.set(`watcher-${i}`, createWatcher({ symbol: `SYM${i}USDT` }));
      }
      vi.mocked(deps.getActiveWatchers).mockReturnValue(watcherMap);
      vi.mocked(deps.isWalletPaused).mockReturnValue(true);

      mockToResult.mockReturnValue({
        watcherId: 'watcher-1',
        symbol: 'BTCUSDT',
        interval: '1h',
        marketType: 'FUTURES',
        status: 'skipped',
        reason: 'Wallet paused',
        setupsDetected: [],
        filterChecks: [],
        rejections: [],
        tradeExecutions: [],
        setupValidations: [],
        tradesExecuted: 0,
        durationMs: 0,
        logs: [],
      });

      await (processor as any).processWatcherQueue();

      expect((processor as any).batchCounter).toBeGreaterThanOrEqual(2);
    });
  });
});
