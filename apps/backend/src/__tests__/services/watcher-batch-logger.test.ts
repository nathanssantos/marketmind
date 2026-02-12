import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    appendFileSync: vi.fn(),
  },
}));

vi.mock('../../services/price-cache', () => ({
  priceCache: {
    getStats: vi.fn(() => ({
      size: 0,
      oldestEntry: null,
      metrics: {
        hits: 0,
        misses: 0,
        apiFetches: 0,
        websocketUpdates: 0,
        hitRate: 0,
      },
    })),
  },
}));

import fs from 'fs';
import type {
  BatchResult,
  CorruptionFixEntry,
  FilterCheckEntry,
  GapFillEntry,
  LogEntry,
  MaintenanceResult,
  PendingOrdersCheckResult,
  PositionSyncResult,
  ReconnectionValidationResult,
  RejectionEntry,
  RestoredWatcherInfo,
  RotationResult,
  SetupLogEntry,
  SetupValidationEntry,
  TradeExecutionEntry,
  WatcherResult,
} from '@marketmind/logger';
import { stripAnsi } from '@marketmind/logger';
import type { ConfigCacheStats } from '../../services/watcher-batch-logger';
import {
  createBatchResult,
  formatBatchResults,
  formatDetailedLogs,
  formatMaintenanceResults,
  formatRotationNoChanges,
  formatRotationResults,
  formatStartupResults,
  outputBatchResults,
  outputMaintenanceResults,
  outputPendingOrdersCheckResults,
  outputPositionSyncResults,
  outputReconnectionValidationResults,
  outputRotationResults,
  outputStartupResults,
} from '../../services/watcher-batch-logger';
import { priceCache } from '../../services/price-cache';

const makeLogEntry = (overrides: Partial<LogEntry> = {}): LogEntry => ({
  timestamp: new Date('2025-01-15T10:00:00Z'),
  level: 'info',
  emoji: '📊',
  message: 'test log',
  ...overrides,
});

const makeSetupLogEntry = (overrides: Partial<SetupLogEntry> = {}): SetupLogEntry => ({
  type: 'LW_9.1',
  direction: 'LONG',
  confidence: 85,
  entryPrice: '50000.00',
  stopLoss: '49500.00',
  takeProfit: '51000.00',
  riskReward: '2.00',
  ...overrides,
});

const makeFilterCheckEntry = (overrides: Partial<FilterCheckEntry> = {}): FilterCheckEntry => ({
  filterName: 'ADX',
  passed: true,
  reason: 'ADX above threshold',
  ...overrides,
});

const makeRejectionEntry = (overrides: Partial<RejectionEntry> = {}): RejectionEntry => ({
  setupType: 'LW_9.1',
  direction: 'LONG',
  reason: 'Insufficient volume: below threshold',
  ...overrides,
});

const makeTradeExecutionEntry = (overrides: Partial<TradeExecutionEntry> = {}): TradeExecutionEntry => ({
  setupType: 'LW_9.1',
  direction: 'LONG',
  entryPrice: '50000.00',
  quantity: '0.01',
  stopLoss: '49500.00',
  takeProfit: '51000.00',
  orderType: 'LIMIT',
  status: 'executed',
  ...overrides,
});

const makeSetupValidationEntry = (overrides: Partial<SetupValidationEntry> = {}): SetupValidationEntry => ({
  setupType: 'LW_9.1',
  direction: 'LONG',
  entryPrice: '50000.00',
  stopLoss: '49500.00',
  takeProfit: '51000.00',
  confidence: 85,
  riskReward: '2.00',
  checks: [
    { name: 'ADX', passed: true, value: '25.5', expected: '20' },
    { name: 'Volume', passed: true, reason: 'above average' },
  ],
  outcome: 'executed',
  execution: { quantity: '0.01', orderType: 'LIMIT' },
  ...overrides,
});

const makeWatcherResult = (overrides: Partial<WatcherResult> = {}): WatcherResult => ({
  watcherId: 'w1',
  symbol: 'BTCUSDT',
  interval: '1h',
  marketType: 'futures',
  status: 'success',
  klinesCount: 500,
  setupsDetected: [],
  filterChecks: [],
  rejections: [],
  tradeExecutions: [],
  setupValidations: [],
  tradesExecuted: 0,
  durationMs: 120,
  logs: [],
  ...overrides,
});

const makeBatchResult = (overrides: Partial<BatchResult> = {}): BatchResult => ({
  batchId: 1,
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:02Z'),
  totalWatchers: 5,
  successCount: 4,
  skippedCount: 0,
  pendingCount: 0,
  errorCount: 1,
  totalSetupsDetected: 2,
  totalRejections: 1,
  totalFilterBlocks: 0,
  totalTradesExecuted: 1,
  watcherResults: [],
  ...overrides,
});

const makeMaintenanceResult = (overrides: Partial<MaintenanceResult> = {}): MaintenanceResult => ({
  type: 'periodic',
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:05Z'),
  pairsChecked: 10,
  totalGapsFound: 3,
  totalCandlesFilled: 15,
  totalCorruptedFixed: 2,
  gapFills: [],
  corruptionFixes: [],
  ...overrides,
});

const makeRotationResult = (overrides: Partial<RotationResult> = {}): RotationResult => ({
  walletId: 'wallet-1',
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:03Z'),
  interval: '1h',
  marketType: 'futures',
  targetCount: 20,
  slotsAvailable: 5,
  currentSymbols: ['BTCUSDT', 'ETHUSDT'],
  optimalSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'],
  added: ['SOLUSDT'],
  removed: [],
  kept: 2,
  skippedInsufficientKlines: [],
  skippedInsufficientCapital: [],
  klineValidations: [],
  hasChanges: true,
  logs: [],
  ...overrides,
});

const makeReconnectionValidationResult = (
  overrides: Partial<ReconnectionValidationResult> = {},
): ReconnectionValidationResult => ({
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:01Z'),
  pairsChecked: 10,
  klinesChecked: 500,
  totalMismatches: 0,
  totalFixed: 0,
  mismatches: [],
  ...overrides,
});

const makePositionSyncResult = (overrides: Partial<PositionSyncResult> = {}): PositionSyncResult => ({
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:01Z'),
  walletsChecked: 3,
  totalOrphaned: 0,
  totalUnknown: 0,
  totalUpdated: 0,
  walletSummaries: [],
  orphanedPositions: [],
  unknownPositions: [],
  updatedPositions: [],
  ...overrides,
});

const makePendingOrdersCheckResult = (
  overrides: Partial<PendingOrdersCheckResult> = {},
): PendingOrdersCheckResult => ({
  startTime: new Date('2025-01-15T10:00:00Z'),
  endTime: new Date('2025-01-15T10:00:01Z'),
  totalChecked: 5,
  expiredCount: 0,
  invalidCount: 0,
  filledCount: 0,
  pendingCount: 5,
  errorCount: 0,
  actions: [],
  ...overrides,
});

describe('watcher-batch-logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  describe('createBatchResult', () => {
    it('should create batch result with correct counts for empty results', () => {
      const result = createBatchResult(1, new Date('2025-01-15T10:00:00Z'), []);

      expect(result.batchId).toBe(1);
      expect(result.totalWatchers).toBe(0);
      expect(result.successCount).toBe(0);
      expect(result.skippedCount).toBe(0);
      expect(result.pendingCount).toBe(0);
      expect(result.errorCount).toBe(0);
      expect(result.totalSetupsDetected).toBe(0);
      expect(result.totalRejections).toBe(0);
      expect(result.totalFilterBlocks).toBe(0);
      expect(result.totalTradesExecuted).toBe(0);
      expect(result.watcherResults).toEqual([]);
    });

    it('should count success watchers correctly', () => {
      const watchers = [
        makeWatcherResult({ status: 'success' }),
        makeWatcherResult({ status: 'success' }),
        makeWatcherResult({ status: 'error' }),
      ];
      const result = createBatchResult(2, new Date(), watchers);

      expect(result.totalWatchers).toBe(3);
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(1);
    });

    it('should count skipped and pending watchers', () => {
      const watchers = [
        makeWatcherResult({ status: 'skipped' }),
        makeWatcherResult({ status: 'pending' }),
        makeWatcherResult({ status: 'skipped' }),
      ];
      const result = createBatchResult(3, new Date(), watchers);

      expect(result.skippedCount).toBe(2);
      expect(result.pendingCount).toBe(1);
    });

    it('should sum setups detected across watchers', () => {
      const watchers = [
        makeWatcherResult({ setupsDetected: [makeSetupLogEntry(), makeSetupLogEntry()] }),
        makeWatcherResult({ setupsDetected: [makeSetupLogEntry()] }),
      ];
      const result = createBatchResult(4, new Date(), watchers);

      expect(result.totalSetupsDetected).toBe(3);
    });

    it('should sum rejections across watchers', () => {
      const watchers = [
        makeWatcherResult({ rejections: [makeRejectionEntry(), makeRejectionEntry()] }),
        makeWatcherResult({ rejections: [makeRejectionEntry()] }),
      ];
      const result = createBatchResult(5, new Date(), watchers);

      expect(result.totalRejections).toBe(3);
    });

    it('should sum filter blocks (failed filter checks)', () => {
      const watchers = [
        makeWatcherResult({
          filterChecks: [
            makeFilterCheckEntry({ passed: false }),
            makeFilterCheckEntry({ passed: true }),
          ],
        }),
        makeWatcherResult({
          filterChecks: [makeFilterCheckEntry({ passed: false })],
        }),
      ];
      const result = createBatchResult(6, new Date(), watchers);

      expect(result.totalFilterBlocks).toBe(2);
    });

    it('should sum trades executed across watchers', () => {
      const watchers = [
        makeWatcherResult({ tradesExecuted: 2 }),
        makeWatcherResult({ tradesExecuted: 1 }),
      ];
      const result = createBatchResult(7, new Date(), watchers);

      expect(result.totalTradesExecuted).toBe(3);
    });

    it('should set endTime to current time', () => {
      const before = Date.now();
      const result = createBatchResult(8, new Date(), []);
      const after = Date.now();

      expect(result.endTime.getTime()).toBeGreaterThanOrEqual(before);
      expect(result.endTime.getTime()).toBeLessThanOrEqual(after);
    });
  });

  describe('formatBatchResults', () => {
    it('should include batch id in the header', () => {
      const batch = makeBatchResult({ batchId: 42 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('cycle #42');
    });

    it('should include watcher counts in summary', () => {
      const batch = makeBatchResult({ totalWatchers: 10, successCount: 8, errorCount: 2 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('10 watchers');
      expect(output).toContain('8');
      expect(output).toContain('2');
    });

    it('should include skipped count when present', () => {
      const batch = makeBatchResult({ skippedCount: 3 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('3 skipped');
    });

    it('should not include skipped count when zero', () => {
      const batch = makeBatchResult({ skippedCount: 0 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).not.toContain('skipped');
    });

    it('should include setups detected when present', () => {
      const batch = makeBatchResult({ totalSetupsDetected: 5 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('5 setups');
    });

    it('should include trades executed when present', () => {
      const batch = makeBatchResult({ totalTradesExecuted: 3 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('3 trades');
    });

    it('should include singular trade text for single trade', () => {
      const batch = makeBatchResult({ totalTradesExecuted: 1 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('1 trade');
      expect(output).not.toContain('1 trades');
    });

    it('should show rejection summary with reason counts', () => {
      const watchers = [
        makeWatcherResult({
          rejections: [
            makeRejectionEntry({ reason: 'Volume: too low' }),
            makeRejectionEntry({ reason: 'Volume: very low' }),
            makeRejectionEntry({ reason: 'ADX: weak trend' }),
          ],
        }),
      ];
      const batch = makeBatchResult({
        totalRejections: 3,
        totalFilterBlocks: 0,
        watcherResults: watchers,
      });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('3 rejected');
      expect(output).toContain('2x Volume');
      expect(output).toContain('1x ADX');
    });

    it('should show filter block reasons in rejection summary', () => {
      const watchers = [
        makeWatcherResult({
          filterChecks: [
            makeFilterCheckEntry({ filterName: 'TrendFilter', passed: false }),
            makeFilterCheckEntry({ filterName: 'TrendFilter', passed: false }),
          ],
        }),
      ];
      const batch = makeBatchResult({
        totalRejections: 0,
        totalFilterBlocks: 2,
        watcherResults: watchers,
      });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('2 rejected');
      expect(output).toContain('2x TrendFilter');
    });

    it('should show watcher lines for success status', () => {
      const watcher = makeWatcherResult({
        symbol: 'ETHUSDT',
        interval: '4h',
        klinesCount: 200,
        durationMs: 85,
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('ETHUSDT/4h');
      expect(output).toContain('200 klines');
      expect(output).toContain('85ms');
    });

    it('should show error watchers with error messages', () => {
      const watcher = makeWatcherResult({
        status: 'error',
        reason: 'Connection timeout',
      });
      const batch = makeBatchResult({ watcherResults: [watcher], errorCount: 1 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('error: Connection timeout');
      expect(output).toContain('errors');
    });

    it('should show skipped watchers', () => {
      const watcher = makeWatcherResult({
        status: 'skipped',
        reason: 'cooldown active',
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('skipped (cooldown active)');
    });

    it('should show pending watchers', () => {
      const watcher = makeWatcherResult({ status: 'pending' });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('pending');
    });

    it('should show recently rotated tag', () => {
      const watcher = makeWatcherResult({ isRecentlyRotated: true });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain(' R');
    });

    it('should show setups detected section', () => {
      const watcher = makeWatcherResult({
        setupsDetected: [makeSetupLogEntry({ type: 'LW_9.2', direction: 'SHORT' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('setups detected');
      expect(output).toContain('LW_9.2');
      expect(output).toContain('SHORT');
    });

    it('should show setup validations section', () => {
      const watcher = makeWatcherResult({
        setupValidations: [makeSetupValidationEntry()],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('setup analysis');
      expect(output).toContain('LW_9.1');
      expect(output).toContain('EXECUTED');
    });

    it('should show trade executions section', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry()],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('trade executions');
      expect(output).toContain('BTCUSDT');
      expect(output).toContain('entry=50000.00');
    });

    it('should show setup validation with blocked outcome', () => {
      const watcher = makeWatcherResult({
        setupValidations: [
          makeSetupValidationEntry({
            outcome: 'blocked',
            outcomeReason: 'Max positions reached',
            execution: undefined,
          }),
        ],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('BLOCKED: Max positions reached');
    });

    it('should show setup validation with failed outcome', () => {
      const watcher = makeWatcherResult({
        setupValidations: [
          makeSetupValidationEntry({
            outcome: 'failed',
            outcomeReason: 'Order rejected',
            execution: undefined,
          }),
        ],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('FAILED: Order rejected');
    });

    it('should show setup validation with pending outcome', () => {
      const watcher = makeWatcherResult({
        setupValidations: [
          makeSetupValidationEntry({
            outcome: 'pending',
            execution: undefined,
          }),
        ],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('PENDING');
    });

    it('should show validation checks with value and expected', () => {
      const watcher = makeWatcherResult({
        setupValidations: [
          makeSetupValidationEntry({
            checks: [{ name: 'ADX', passed: false, value: '15.2', expected: '20' }],
          }),
        ],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('15.2');
      expect(output).toContain('need 20');
    });

    it('should show validation checks with reason', () => {
      const watcher = makeWatcherResult({
        setupValidations: [
          makeSetupValidationEntry({
            checks: [{ name: 'Trend', passed: true, reason: 'bullish confirmed' }],
          }),
        ],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('bullish confirmed');
    });

    it('should show no setups text when none detected', () => {
      const watcher = makeWatcherResult({ setupsDetected: [] });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('no setups');
    });

    it('should show trade count on watcher line', () => {
      const watcher = makeWatcherResult({ tradesExecuted: 2 });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('2 trades');
    });

    it('should show error watcher with log-based error messages', () => {
      const watcher = makeWatcherResult({
        status: 'error',
        reason: undefined,
        logs: [makeLogEntry({ level: 'error', message: 'API rate limit exceeded' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher], errorCount: 1 });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('API rate limit exceeded');
    });

    it('should limit rejection summary to 4 reasons', () => {
      const watchers = [
        makeWatcherResult({
          rejections: [
            makeRejectionEntry({ reason: 'A' }),
            makeRejectionEntry({ reason: 'B' }),
            makeRejectionEntry({ reason: 'C' }),
            makeRejectionEntry({ reason: 'D' }),
            makeRejectionEntry({ reason: 'E' }),
          ],
        }),
      ];
      const batch = makeBatchResult({
        totalRejections: 5,
        watcherResults: watchers,
      });
      const output = stripAnsi(formatBatchResults(batch));
      const reasons = output.match(/1x [A-E]/g);

      expect(reasons).not.toBeNull();
      expect(reasons!.length).toBeLessThanOrEqual(4);
    });
  });

  describe('formatDetailedLogs', () => {
    it('should return empty string for results with no logs', () => {
      const result = formatDetailedLogs([makeWatcherResult({ logs: [] })]);

      expect(result).toBe('');
    });

    it('should format logs with timestamp, emoji, and message', () => {
      const results = [
        makeWatcherResult({
          logs: [makeLogEntry({ emoji: '🔍', message: 'Scanning klines' })],
        }),
      ];
      const output = stripAnsi(formatDetailedLogs(results));

      expect(output).toContain('BTCUSDT/1h/futures');
      expect(output).toContain('Scanning klines');
    });

    it('should format error level logs', () => {
      const results = [
        makeWatcherResult({
          logs: [makeLogEntry({ level: 'error', message: 'Connection failed' })],
        }),
      ];
      const output = formatDetailedLogs(results);

      expect(stripAnsi(output)).toContain('Connection failed');
    });

    it('should format warn level logs', () => {
      const results = [
        makeWatcherResult({
          logs: [makeLogEntry({ level: 'warn', message: 'Rate limit approaching' })],
        }),
      ];
      const output = formatDetailedLogs(results);

      expect(stripAnsi(output)).toContain('Rate limit approaching');
    });

    it('should include log data when present', () => {
      const results = [
        makeWatcherResult({
          logs: [makeLogEntry({ data: { count: 5 } })],
        }),
      ];
      const output = stripAnsi(formatDetailedLogs(results));

      expect(output).toContain('{"count":5}');
    });

    it('should skip results with empty logs array', () => {
      const results = [
        makeWatcherResult({ symbol: 'BTCUSDT', logs: [] }),
        makeWatcherResult({
          symbol: 'ETHUSDT',
          logs: [makeLogEntry({ message: 'active watcher' })],
        }),
      ];
      const output = stripAnsi(formatDetailedLogs(results));

      expect(output).not.toContain('BTCUSDT');
      expect(output).toContain('ETHUSDT');
    });
  });

  describe('formatStartupResults', () => {
    it('should include auto-trading startup header', () => {
      const output = stripAnsi(formatStartupResults([], 0, 1500));

      expect(output).toContain('auto-trading startup');
    });

    it('should show persisted and restored counts', () => {
      const watchers: RestoredWatcherInfo[] = [
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'futures',
          isManual: true,
          status: 'success',
          totalKlinesInDb: 5000,
        },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 3, 2000));

      expect(output).toContain('3 persisted');
      expect(output).toContain('1 restored');
    });

    it('should show manual and dynamic counts', () => {
      const watchers: RestoredWatcherInfo[] = [
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'futures', isManual: true, status: 'success' },
        { symbol: 'ETHUSDT', interval: '1h', marketType: 'futures', isManual: false, status: 'success' },
        { symbol: 'SOLUSDT', interval: '1h', marketType: 'futures', isManual: false, status: 'success' },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 3, 500));

      expect(output).toContain('1 manual');
      expect(output).toContain('2 dynamic');
    });

    it('should show preloaded configs when present', () => {
      const output = stripAnsi(formatStartupResults([], 0, 100, 5));

      expect(output).toContain('5 configs');
    });

    it('should show wallet count when present', () => {
      const output = stripAnsi(formatStartupResults([], 0, 100, 0, 3));

      expect(output).toContain('3 wallets');
    });

    it('should show watcher details with klines and next candle', () => {
      const nextClose = new Date('2025-01-15T11:00:00Z');
      const watchers: RestoredWatcherInfo[] = [
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'futures',
          isManual: true,
          status: 'success',
          totalKlinesInDb: 5000,
          nextCandleClose: nextClose,
        },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 1, 100));

      expect(output).toContain('BTCUSDT/1h');
      expect(output).toContain('5.0k klines');
      expect(output).toContain('next');
    });

    it('should show failed watcher restorations', () => {
      const watchers: RestoredWatcherInfo[] = [
        {
          symbol: 'XRPUSDT',
          interval: '4h',
          marketType: 'futures',
          isManual: false,
          status: 'failed',
          error: 'Symbol delisted',
        },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 1, 100));

      expect(output).toContain('failed restorations');
      expect(output).toContain('XRPUSDT/4h');
      expect(output).toContain('Symbol delisted');
    });

    it('should show failed count when there are failures', () => {
      const watchers: RestoredWatcherInfo[] = [
        { symbol: 'A', interval: '1h', marketType: 'futures', isManual: false, status: 'failed', error: 'err' },
        { symbol: 'B', interval: '1h', marketType: 'futures', isManual: false, status: 'failed', error: 'err' },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 2, 100));

      expect(output).toContain('2 failed');
    });

    it('should show 0 failed as dim when no failures', () => {
      const watchers: RestoredWatcherInfo[] = [
        { symbol: 'BTCUSDT', interval: '1h', marketType: 'futures', isManual: true, status: 'success' },
      ];
      const output = stripAnsi(formatStartupResults(watchers, 1, 100));

      expect(output).toContain('0 failed');
    });
  });

  describe('formatMaintenanceResults', () => {
    it('should use startup maintenance title for startup type', () => {
      const result = makeMaintenanceResult({ type: 'startup' });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('startup maintenance');
    });

    it('should use periodic maintenance title for periodic type', () => {
      const result = makeMaintenanceResult({ type: 'periodic' });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('periodic maintenance');
    });

    it('should show pairs checked and gap/fix counts', () => {
      const result = makeMaintenanceResult({
        pairsChecked: 15,
        totalGapsFound: 4,
        totalCandlesFilled: 20,
        totalCorruptedFixed: 1,
      });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('15 pairs');
      expect(output).toContain('4 gaps');
      expect(output).toContain('20 filled');
      expect(output).toContain('1 fixed');
    });

    it('should show dim text for zero counts', () => {
      const result = makeMaintenanceResult({
        totalGapsFound: 0,
        totalCandlesFilled: 0,
        totalCorruptedFixed: 0,
      });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('0 gaps');
      expect(output).toContain('0 filled');
      expect(output).toContain('0 fixed');
    });

    it('should show gap fill details when gaps have activity', () => {
      const gapFills: GapFillEntry[] = [
        {
          symbol: 'BTCUSDT',
          interval: '1h',
          marketType: 'futures',
          gapsFound: 3,
          candlesFilled: 10,
          status: 'success',
        },
      ];
      const result = makeMaintenanceResult({ gapFills });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('gap fills');
      expect(output).toContain('BTCUSDT/1h');
      expect(output).toContain('3 gaps');
      expect(output).toContain('10 candles filled');
    });

    it('should show corruption fix details', () => {
      const corruptionFixes: CorruptionFixEntry[] = [
        {
          symbol: 'ETHUSDT',
          interval: '4h',
          marketType: 'futures',
          corruptedFound: 5,
          fixed: 5,
          status: 'success',
        },
      ];
      const result = makeMaintenanceResult({ corruptionFixes });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('corruption fixes');
      expect(output).toContain('ETHUSDT/4h');
      expect(output).toContain('5 found');
      expect(output).toContain('5 fixed');
    });

    it('should show error gap fills', () => {
      const gapFills: GapFillEntry[] = [
        {
          symbol: 'DOTUSDT',
          interval: '1h',
          marketType: 'futures',
          gapsFound: 0,
          candlesFilled: 0,
          status: 'error',
          reason: 'API timeout',
        },
      ];
      const result = makeMaintenanceResult({ gapFills });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('errors');
      expect(output).toContain('DOTUSDT/1h');
      expect(output).toContain('API timeout');
    });

    it('should show partial status gap fills', () => {
      const gapFills: GapFillEntry[] = [
        {
          symbol: 'SOLUSDT',
          interval: '1h',
          marketType: 'futures',
          gapsFound: 5,
          candlesFilled: 3,
          status: 'partial',
        },
      ];
      const result = makeMaintenanceResult({ gapFills });
      const output = stripAnsi(formatMaintenanceResults(result));

      expect(output).toContain('SOLUSDT/1h');
      expect(output).toContain('5 gaps');
    });
  });

  describe('formatRotationResults', () => {
    it('should include symbol rotation header', () => {
      const result = makeRotationResult();
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('symbol rotation');
    });

    it('should show market type, interval, target count, and slots', () => {
      const result = makeRotationResult({
        marketType: 'futures',
        interval: '1h',
        targetCount: 20,
        slotsAvailable: 5,
      });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('futures');
      expect(output).toContain('1h');
      expect(output).toContain('target 20');
      expect(output).toContain('5 slots');
    });

    it('should show added symbols', () => {
      const result = makeRotationResult({ added: ['SOLUSDT', 'AVAXUSDT'] });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('+ SOLUSDT');
      expect(output).toContain('+ AVAXUSDT');
    });

    it('should show removed symbols', () => {
      const result = makeRotationResult({ removed: ['DOTUSDT'] });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('- DOTUSDT');
    });

    it('should show kept, added, removed counts', () => {
      const result = makeRotationResult({
        kept: 15,
        added: ['SOLUSDT'],
        removed: ['DOTUSDT', 'LINKUSDT'],
      });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('15 kept');
      expect(output).toContain('1 added');
      expect(output).toContain('2 removed');
    });

    it('should show skipped insufficient klines', () => {
      const result = makeRotationResult({ skippedInsufficientKlines: ['NEWUSDT', 'FRESHUSDT'] });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('2 insufficient data');
      expect(output).toContain('NEWUSDT, FRESHUSDT');
    });

    it('should show skipped insufficient capital', () => {
      const result = makeRotationResult({ skippedInsufficientCapital: ['LOWUSDT'] });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('1 low capital');
      expect(output).toContain('LOWUSDT');
    });

    it('should show kline validation info for added symbols', () => {
      const result = makeRotationResult({
        added: ['SOLUSDT'],
        klineValidations: [{ symbol: 'SOLUSDT', gapsFilled: 3, corruptedFixed: 1 }],
      });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('validated');
      expect(output).toContain('gaps: 3');
      expect(output).toContain('fixed: 1');
    });

    it('should show ready status for added symbols without validation issues', () => {
      const result = makeRotationResult({ added: ['SOLUSDT'], klineValidations: [] });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('ready');
    });

    it('should show 0 slots as dim when none available', () => {
      const result = makeRotationResult({ slotsAvailable: 0 });
      const output = stripAnsi(formatRotationResults(result));

      expect(output).toContain('0 slots');
    });
  });

  describe('formatRotationNoChanges', () => {
    it('should include symbol rotation header', () => {
      const result = makeRotationResult({ hasChanges: false });
      const output = stripAnsi(formatRotationNoChanges(result));

      expect(output).toContain('symbol rotation');
    });

    it('should show no changes message', () => {
      const result = makeRotationResult({ hasChanges: false, kept: 18 });
      const output = stripAnsi(formatRotationNoChanges(result));

      expect(output).toContain('no changes');
      expect(output).toContain('18 symbols');
    });

    it('should show market type and interval', () => {
      const result = makeRotationResult({ marketType: 'futures', interval: '4h' });
      const output = stripAnsi(formatRotationNoChanges(result));

      expect(output).toContain('futures');
      expect(output).toContain('4h');
    });

    it('should show target count', () => {
      const result = makeRotationResult({ targetCount: 25 });
      const output = stripAnsi(formatRotationNoChanges(result));

      expect(output).toContain('target 25');
    });

    it('should show skipped counts in no-change mode', () => {
      const result = makeRotationResult({
        hasChanges: false,
        skippedInsufficientKlines: ['A'],
        skippedInsufficientCapital: ['B', 'C'],
      });
      const output = stripAnsi(formatRotationNoChanges(result));

      expect(output).toContain('1 no data');
      expect(output).toContain('2 low capital');
    });
  });

  describe('outputBatchResults', () => {
    it('should log summary to console and write to file', () => {
      const batch = makeBatchResult();
      outputBatchResults(batch);

      expect(console.log).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should include detailed logs when verbose is true', () => {
      const watcher = makeWatcherResult({
        logs: [makeLogEntry({ message: 'detailed info' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      outputBatchResults(batch, true);

      const allLogs = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(stripAnsi(allLogs)).toContain('detailed info');
    });

    it('should not include detailed logs when verbose is false', () => {
      const watcher = makeWatcherResult({
        logs: [makeLogEntry({ message: 'secret detail' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      outputBatchResults(batch, false);

      const callCount = vi.mocked(console.log).mock.calls.length;
      expect(callCount).toBe(1);
    });

    it('should show price cache stats when there is activity', () => {
      vi.mocked(priceCache.getStats).mockReturnValue({
        size: 50,
        oldestEntry: Date.now() - 5000,
        metrics: { hits: 100, misses: 10, apiFetches: 5, websocketUpdates: 200, hitRate: 0.909 },
      });
      const batch = makeBatchResult();
      outputBatchResults(batch);

      const allLogs = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(stripAnsi(allLogs)).toContain('price-cache');
      expect(stripAnsi(allLogs)).toContain('50 entries');
    });

    it('should show config cache stats when provided', () => {
      vi.mocked(priceCache.getStats).mockReturnValue({
        size: 0,
        oldestEntry: null,
        metrics: { hits: 0, misses: 0, apiFetches: 0, websocketUpdates: 0, hitRate: 0 },
      });
      const configCacheStats: ConfigCacheStats = {
        size: 10,
        hits: 50,
        misses: 5,
        preloads: 8,
        hitRate: 0.909,
      };
      const batch = makeBatchResult();
      outputBatchResults(batch, false, configCacheStats);

      const allLogs = vi.mocked(console.log).mock.calls.flat().join('\n');
      expect(stripAnsi(allLogs)).toContain('config-cache');
      expect(stripAnsi(allLogs)).toContain('10 entries');
      expect(stripAnsi(allLogs)).toContain('8 preloaded');
    });

    it('should not show cache stats when no activity', () => {
      vi.mocked(priceCache.getStats).mockReturnValue({
        size: 0,
        oldestEntry: null,
        metrics: { hits: 0, misses: 0, apiFetches: 0, websocketUpdates: 0, hitRate: 0 },
      });
      const batch = makeBatchResult();
      outputBatchResults(batch);

      expect(vi.mocked(console.log).mock.calls.length).toBe(1);
    });

    it('should create log directory if it does not exist', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const batch = makeBatchResult();
      outputBatchResults(batch);

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });
  });

  describe('outputStartupResults', () => {
    it('should log to console and write to file', () => {
      outputStartupResults([], 0, 100);

      expect(console.log).toHaveBeenCalled();
      expect(fs.appendFileSync).toHaveBeenCalled();
    });

    it('should pass all parameters to formatStartupResults', () => {
      const watchers: RestoredWatcherInfo[] = [
        { symbol: 'BTC', interval: '1h', marketType: 'futures', isManual: true, status: 'success' },
      ];
      outputStartupResults(watchers, 5, 200, 3, 2);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('5 persisted');
      expect(logOutput).toContain('3 configs');
      expect(logOutput).toContain('2 wallets');
    });
  });

  describe('outputMaintenanceResults', () => {
    it('should skip output for periodic maintenance with no activity', () => {
      const result = makeMaintenanceResult({
        type: 'periodic',
        totalGapsFound: 0,
        totalCorruptedFixed: 0,
      });
      outputMaintenanceResults(result);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should output for startup maintenance even with no activity', () => {
      const result = makeMaintenanceResult({
        type: 'startup',
        totalGapsFound: 0,
        totalCorruptedFixed: 0,
      });
      outputMaintenanceResults(result);

      expect(console.log).toHaveBeenCalled();
    });

    it('should output when there are gaps found', () => {
      const result = makeMaintenanceResult({ type: 'periodic', totalGapsFound: 3 });
      outputMaintenanceResults(result);

      expect(console.log).toHaveBeenCalled();
    });

    it('should output when there are corruptions fixed', () => {
      const result = makeMaintenanceResult({
        type: 'periodic',
        totalGapsFound: 0,
        totalCorruptedFixed: 2,
      });
      outputMaintenanceResults(result);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe('outputRotationResults', () => {
    it('should use formatRotationNoChanges when hasChanges is false', () => {
      const result = makeRotationResult({ hasChanges: false, kept: 20 });
      outputRotationResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('no changes');
    });

    it('should use formatRotationResults when hasChanges is true', () => {
      const result = makeRotationResult({ hasChanges: true, added: ['SOLUSDT'] });
      outputRotationResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('+ SOLUSDT');
    });

    it('should write to file', () => {
      const result = makeRotationResult();
      outputRotationResults(result);

      expect(fs.appendFileSync).toHaveBeenCalled();
    });
  });

  describe('outputReconnectionValidationResults', () => {
    it('should skip output when no mismatches', () => {
      const result = makeReconnectionValidationResult({ totalMismatches: 0 });
      outputReconnectionValidationResults(result);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should output when there are mismatches', () => {
      const result = makeReconnectionValidationResult({
        totalMismatches: 2,
        totalFixed: 2,
        mismatches: [
          {
            symbol: 'BTCUSDT',
            interval: '1h',
            marketType: 'futures',
            openTime: new Date('2025-01-15T09:00:00Z'),
            field: 'close',
            dbValue: 50000.123456,
            apiValue: 50001.654321,
            diffPercent: 0.003,
            fixed: true,
          },
          {
            symbol: 'ETHUSDT',
            interval: '1h',
            marketType: 'futures',
            openTime: new Date('2025-01-15T09:00:00Z'),
            field: 'high',
            dbValue: 3000.5,
            apiValue: 3001.2,
            diffPercent: 0.023,
            fixed: false,
          },
        ],
      });
      outputReconnectionValidationResults(result);

      expect(console.log).toHaveBeenCalled();
      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('reconnection validation');
      expect(logOutput).toContain('OHLC corrections');
      expect(logOutput).toContain('BTCUSDT/1h');
      expect(logOutput).toContain('CLOSE');
      expect(logOutput).toContain('ETHUSDT/1h');
      expect(logOutput).toContain('HIGH');
    });

    it('should show summary stats in reconnection output', () => {
      const result = makeReconnectionValidationResult({
        pairsChecked: 10,
        klinesChecked: 500,
        totalMismatches: 1,
        totalFixed: 1,
        mismatches: [
          {
            symbol: 'BTCUSDT',
            interval: '1h',
            marketType: 'futures',
            openTime: new Date(),
            field: 'open',
            dbValue: 100,
            apiValue: 101,
            diffPercent: 1.0,
            fixed: true,
          },
        ],
      });
      outputReconnectionValidationResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('10 pairs');
      expect(logOutput).toContain('500 klines');
      expect(logOutput).toContain('1 mismatches');
      expect(logOutput).toContain('1 fixed');
    });
  });

  describe('outputPositionSyncResults', () => {
    it('should skip output when no issues', () => {
      const result = makePositionSyncResult();
      outputPositionSyncResults(result);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should output when there are orphaned positions', () => {
      const result = makePositionSyncResult({
        totalOrphaned: 1,
        orphanedPositions: [
          {
            walletId: 'w1',
            executionId: 'e1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: 50000,
            exitPrice: 51000,
            quantity: 0.01,
            pnl: 10,
            pnlPercent: 2.0,
          },
        ],
      });
      outputPositionSyncResults(result);

      expect(console.log).toHaveBeenCalled();
      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('position sync');
      expect(logOutput).toContain('orphaned positions');
      expect(logOutput).toContain('BTCUSDT');
      expect(logOutput).toContain('+10.00');
      expect(logOutput).toContain('+2.00%');
    });

    it('should output when there are unknown positions', () => {
      const result = makePositionSyncResult({
        totalUnknown: 1,
        unknownPositions: [
          {
            walletId: 'w1',
            symbol: 'ETHUSDT',
            positionAmt: 0.5,
            entryPrice: 3000,
            unrealizedPnl: -50,
            leverage: 10,
            marginType: 'cross',
          },
        ],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('unknown positions');
      expect(logOutput).toContain('ETHUSDT');
      expect(logOutput).toContain('-50.00');
      expect(logOutput).toContain('10x');
      expect(logOutput).toContain('cross');
    });

    it('should output when there are updated positions', () => {
      const result = makePositionSyncResult({
        totalUpdated: 1,
        updatedPositions: [
          {
            walletId: 'w1',
            executionId: 'e1',
            symbol: 'BTCUSDT',
            field: 'entryPrice',
            oldValue: 50000,
            newValue: 50100,
          },
        ],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('position updates');
      expect(logOutput).toContain('BTCUSDT');
      expect(logOutput).toContain('entryPrice');
    });

    it('should show wallets checked count', () => {
      const result = makePositionSyncResult({ walletsChecked: 5, totalOrphaned: 1, orphanedPositions: [
        { walletId: 'w1', executionId: 'e1', symbol: 'X', side: 'LONG', entryPrice: 1, exitPrice: 2, quantity: 1, pnl: 1, pnlPercent: 1 },
      ] });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('5 wallets');
    });

    it('should show negative PnL in position display', () => {
      const result = makePositionSyncResult({
        totalOrphaned: 1,
        orphanedPositions: [
          {
            walletId: 'w1',
            executionId: 'e1',
            symbol: 'BTCUSDT',
            side: 'SHORT',
            entryPrice: 50000,
            exitPrice: 51000,
            quantity: 0.01,
            pnl: -10,
            pnlPercent: -2.0,
          },
        ],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('-10.00');
      expect(logOutput).toContain('-2.00%');
    });

    it('should show zero PnL without sign', () => {
      const result = makePositionSyncResult({
        totalOrphaned: 1,
        orphanedPositions: [
          {
            walletId: 'w1',
            executionId: 'e1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            entryPrice: 50000,
            exitPrice: 50000,
            quantity: 0.01,
            pnl: 0,
            pnlPercent: 0,
          },
        ],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('0.00');
      expect(logOutput).not.toContain('+0.00');
      expect(logOutput).not.toContain('-0.00');
    });
  });

  describe('outputPendingOrdersCheckResults', () => {
    it('should skip output when no activity', () => {
      const result = makePendingOrdersCheckResult();
      outputPendingOrdersCheckResults(result);

      expect(console.log).not.toHaveBeenCalled();
    });

    it('should output when there are expired orders', () => {
      const result = makePendingOrdersCheckResult({
        expiredCount: 1,
        actions: [
          {
            executionId: 'e1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            action: 'EXPIRED',
            limitPrice: 49000,
            expiresAt: new Date('2025-01-15T09:30:00Z'),
          },
        ],
      });
      outputPendingOrdersCheckResults(result);

      expect(console.log).toHaveBeenCalled();
      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('pending orders');
      expect(logOutput).toContain('1 expired');
      expect(logOutput).toContain('BTCUSDT');
      expect(logOutput).toContain('EXPIRED');
    });

    it('should output when there are filled orders', () => {
      const result = makePendingOrdersCheckResult({
        filledCount: 1,
        actions: [
          {
            executionId: 'e1',
            symbol: 'ETHUSDT',
            side: 'SHORT',
            action: 'FILLED',
            limitPrice: 3100,
            currentPrice: 3095.123456,
          },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('1 filled');
      expect(logOutput).toContain('ETHUSDT');
      expect(logOutput).toContain('FILLED');
      expect(logOutput).toContain('filled at');
    });

    it('should output when there are invalid orders', () => {
      const result = makePendingOrdersCheckResult({
        invalidCount: 1,
        actions: [
          {
            executionId: 'e1',
            symbol: 'SOLUSDT',
            side: 'LONG',
            action: 'INVALID',
            limitPrice: null,
          },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('1 invalid');
      expect(logOutput).toContain('INVALID');
    });

    it('should output when there are errors', () => {
      const result = makePendingOrdersCheckResult({
        errorCount: 1,
        actions: [
          {
            executionId: 'e1',
            symbol: 'BTCUSDT',
            side: 'LONG',
            action: 'ERROR',
            limitPrice: 50000,
            error: 'API connection lost',
          },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('1 errors');
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('API connection lost');
    });

    it('should show pending count in summary', () => {
      const result = makePendingOrdersCheckResult({
        filledCount: 1,
        pendingCount: 3,
        actions: [
          { executionId: 'e1', symbol: 'BTCUSDT', side: 'LONG', action: 'FILLED', limitPrice: 50000, currentPrice: 50100 },
          { executionId: 'e2', symbol: 'ETHUSDT', side: 'SHORT', action: 'PENDING', limitPrice: 3000 },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('3 pending');
    });

    it('should not show PENDING actions in detail list', () => {
      const result = makePendingOrdersCheckResult({
        filledCount: 1,
        actions: [
          { executionId: 'e1', symbol: 'BTCUSDT', side: 'LONG', action: 'FILLED', limitPrice: 50000, currentPrice: 50100 },
          { executionId: 'e2', symbol: 'ETHUSDT', side: 'SHORT', action: 'PENDING', limitPrice: 3000 },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      const pendingDetailMatches = logOutput.match(/ETHUSDT.*SHORT.*PENDING/);
      expect(pendingDetailMatches).toBeNull();
    });

    it('should show limit price for actions that have it', () => {
      const result = makePendingOrdersCheckResult({
        expiredCount: 1,
        actions: [
          { executionId: 'e1', symbol: 'BTCUSDT', side: 'LONG', action: 'EXPIRED', limitPrice: 48500.123456, expiresAt: new Date() },
        ],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('limit=');
    });

    it('should show total checked in summary', () => {
      const result = makePendingOrdersCheckResult({ totalChecked: 12, filledCount: 1, actions: [
        { executionId: 'e1', symbol: 'X', side: 'LONG', action: 'FILLED', limitPrice: null, currentPrice: 100 },
      ] });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('12 orders');
    });
  });

  describe('file logging', () => {
    it('should strip ANSI codes when writing to file', () => {
      const batch = makeBatchResult();
      outputBatchResults(batch);

      const writtenContent = vi.mocked(fs.appendFileSync).mock.calls[0]?.[1] as string;
      expect(writtenContent).not.toContain('\x1b[');
    });

    it('should silently fail when file write throws', () => {
      vi.mocked(fs.appendFileSync).mockImplementation(() => {
        throw new Error('Disk full');
      });

      expect(() => {
        outputBatchResults(makeBatchResult());
      }).not.toThrow();
    });
  });

  describe('dirDisplay helper via formatBatchResults', () => {
    it('should show upward arrow for LONG direction', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({ direction: 'LONG' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('LONG');
    });

    it('should show downward arrow for SHORT direction', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({ direction: 'SHORT' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('SHORT');
    });
  });

  describe('pnlDisplay helper via outputPositionSyncResults', () => {
    it('should display positive PnL with plus sign', () => {
      const result = makePositionSyncResult({
        totalOrphaned: 1,
        orphanedPositions: [{
          walletId: 'w1', executionId: 'e1', symbol: 'X', side: 'LONG',
          entryPrice: 100, exitPrice: 110, quantity: 1, pnl: 15.5, pnlPercent: 3.25,
        }],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('+15.50');
      expect(logOutput).toContain('+3.25%');
    });

    it('should display negative PnL without explicit minus prefix', () => {
      const result = makePositionSyncResult({
        totalOrphaned: 1,
        orphanedPositions: [{
          walletId: 'w1', executionId: 'e1', symbol: 'X', side: 'SHORT',
          entryPrice: 100, exitPrice: 110, quantity: 1, pnl: -8.75, pnlPercent: -1.23,
        }],
      });
      outputPositionSyncResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('-8.75');
      expect(logOutput).toContain('-1.23%');
    });
  });

  describe('header and dimHeader via format functions', () => {
    it('should format header with duration in ms', () => {
      const batch = makeBatchResult({
        startTime: new Date('2025-01-15T10:00:00Z'),
        endTime: new Date('2025-01-15T10:00:03Z'),
      });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('3000ms');
    });

    it('should use dimHeader for position sync without issues', () => {
      const result = makePositionSyncResult({ totalOrphaned: 1, orphanedPositions: [
        { walletId: 'w1', executionId: 'e1', symbol: 'X', side: 'LONG', entryPrice: 1, exitPrice: 2, quantity: 1, pnl: 1, pnlPercent: 1 },
      ] });
      outputPositionSyncResults(result);

      expect(console.log).toHaveBeenCalled();
    });

    it('should use header for pending orders with activity', () => {
      const result = makePendingOrdersCheckResult({
        expiredCount: 1,
        actions: [{ executionId: 'e1', symbol: 'X', side: 'LONG', action: 'EXPIRED', limitPrice: null, expiresAt: new Date() }],
      });
      outputPendingOrdersCheckResults(result);

      const logOutput = stripAnsi(vi.mocked(console.log).mock.calls[0]?.[0] as string);
      expect(logOutput).toContain('pending orders');
    });
  });

  describe('setup direction display in batch results', () => {
    it('should show direction initial in setup compact display', () => {
      const watcher = makeWatcherResult({
        setupsDetected: [makeSetupLogEntry({ type: 'LW_9.1', direction: 'LONG' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('LW_9.1(L)');
    });

    it('should show SHORT direction initial', () => {
      const watcher = makeWatcherResult({
        setupsDetected: [makeSetupLogEntry({ type: 'LW_9.2', direction: 'SHORT' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('LW_9.2(S)');
    });
  });

  describe('trade execution details in batch results', () => {
    it('should show stop loss and take profit in trade line', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({
          stopLoss: '49000.00',
          takeProfit: '52000.00',
        })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('sl=49000.00');
      expect(output).toContain('tp=52000.00');
    });

    it('should omit stop loss and take profit when not present', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({
          stopLoss: undefined,
          takeProfit: undefined,
        })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).not.toContain('sl=');
      expect(output).not.toContain('tp=');
    });

    it('should show order type and status', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({ orderType: 'MARKET', status: 'pending' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('MARKET');
      expect(output).toContain('pending');
    });

    it('should show failed trade status', () => {
      const watcher = makeWatcherResult({
        tradeExecutions: [makeTradeExecutionEntry({ status: 'failed' })],
      });
      const batch = makeBatchResult({ watcherResults: [watcher] });
      const output = stripAnsi(formatBatchResults(batch));

      expect(output).toContain('failed');
    });
  });
});
