import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@marketmind/types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@marketmind/types')>();
  return {
    ...actual,
    TRADING_DEFAULTS: { REQUIRED_KLINES: 500, MIN_KLINES_FOR_SETUP: 100 },
  };
});

vi.mock('../../../constants', () => ({
  ABSOLUTE_MINIMUM_KLINES: 50,
  AUTO_TRADING_BATCH: { WATCHER_BATCH_SIZE: 5 },
  AUTO_TRADING_TIMING: { CANDLE_CLOSE_SAFETY_BUFFER_MS: 3000 },
  TIME_MS: { MINUTE: 60_000, HOUR: 3_600_000, SECOND: 1000 },
  UNIT_MS: { m: 60_000, h: 3_600_000 },
  AUTO_TRADING_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 1000, MAX_DELAY_MS: 10000, BACKOFF_MULTIPLIER: 2 },
  PROTECTION_ORDER_RETRY: { MAX_RETRIES: 3, INITIAL_DELAY_MS: 500, MAX_DELAY_MS: 5000, BACKOFF_MULTIPLIER: 2 },
}));

vi.mock('../../../db', () => ({
  db: {
    query: { klines: { findMany: vi.fn().mockResolvedValue([]) } },
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue([]),
        })),
      })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(() => ({ onConflictDoNothing: vi.fn() })) })),
  },
}));

vi.mock('../../../db/schema', () => ({
  autoTradingConfig: {},
  klines: { symbol: 'symbol', interval: 'interval', marketType: 'marketType', openTime: 'openTime' },
  wallets: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
}));

vi.mock('../../kline-prefetch', () => ({
  prefetchKlines: vi.fn().mockResolvedValue({ success: true }),
  meetsKlineRequirementWithTolerance: vi.fn(() => true),
}));

vi.mock('../../setup-detection/dynamic', () => {
  class MockStrategyLoader {
    loadStrategies = vi.fn().mockResolvedValue([]);
    getLoadedStrategies = vi.fn().mockReturnValue([]);
  }
  class MockStrategyInterpreter {
    detectSetups = vi.fn().mockReturnValue([]);
  }
  return {
    StrategyInterpreter: MockStrategyInterpreter,
    StrategyLoader: MockStrategyLoader,
  };
});

vi.mock('../../watcher-batch-logger', () => ({
  createBatchResult: vi.fn(() => ({ watcherResults: [], totalDurationMs: 0 })),
  outputBatchResults: vi.fn(),
  WatcherLogBuffer: vi.fn().mockImplementation(() => ({
    addFilterCheck: vi.fn(),
    addValidationCheck: vi.fn(),
    addRejection: vi.fn(),
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    startSetupValidation: vi.fn(),
    completeSetupValidation: vi.fn(),
    getResult: vi.fn(() => ({ symbol: 'TEST', status: 'ok' })),
  })),
}));

vi.mock('../../auto-trading-log-buffer', () => ({
  autoTradingLogBuffer: { add: vi.fn() },
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => ({
    broadcastToUser: vi.fn(),
  })),
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

describe('SignalProcessor', () => {
  let processor: SignalProcessor;
  let deps: SignalProcessorDeps;

  beforeEach(() => {
    vi.clearAllMocks();
    deps = createDeps();
    processor = new SignalProcessor(deps, createConfig());
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

    it('should skip watcher already processed this cycle', () => {
      (processor as any).processedThisCycle.add('w1-ETHUSDT-1h-FUTURES');
      processor.queueWatcherProcessing('w1-ETHUSDT-1h-FUTURES');
      expect((processor as any).processingQueue).not.toContain('w1-ETHUSDT-1h-FUTURES');
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

  describe('economy mode', () => {
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

  describe('processedThisCycle tracking', () => {
    it('should prevent re-processing in same cycle', () => {
      (processor as any).processedThisCycle.add('w1-TEST-1h-FUTURES');
      processor.queueWatcherProcessing('w1-TEST-1h-FUTURES');
      expect((processor as any).processingQueue.length).toBe(0);
    });

    it('should clear on new cycle', () => {
      (processor as any).processedThisCycle.add('w1-TEST-1h-FUTURES');
      (processor as any).processedThisCycle.clear();
      expect((processor as any).processedThisCycle.size).toBe(0);
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
});
