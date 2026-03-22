import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../db', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(),
    })),
  },
}));

vi.mock('../../../db/schema', () => ({
  signalSuggestions: {},
}));

vi.mock('../../websocket', () => ({
  getWebSocketService: vi.fn(() => null),
}));

vi.mock('../../auto-trading-log-buffer', () => ({
  autoTradingLogBuffer: {
    addLog: vi.fn(() => ({
      id: 'log-1',
      timestamp: Date.now(),
      level: 'info',
      emoji: '>',
      message: 'test',
    })),
  },
}));

vi.mock('../../../utils/id', () => ({
  generateEntityId: vi.fn(() => 'mock-entity-id'),
}));

vi.mock('../../indicator-engine', () => ({
  detectSetups: vi.fn(() => []),
}));

import { getIntervalMs, emitLogsToWebSocket, runSetupDetection } from '../signal-helpers';
import { getWebSocketService } from '../../websocket';
import { detectSetups } from '../../indicator-engine';
import type { ActiveWatcher } from '../types';
import type { WatcherResult, WatcherLogBuffer } from '../../watcher-batch-logger';

const mockedDetectSetups = vi.mocked(detectSetups);

describe('getIntervalMs', () => {
  it('parses minute intervals', () => {
    expect(getIntervalMs('1m')).toBe(60_000);
    expect(getIntervalMs('5m')).toBe(300_000);
    expect(getIntervalMs('15m')).toBe(900_000);
    expect(getIntervalMs('30m')).toBe(1_800_000);
  });

  it('parses hour intervals', () => {
    expect(getIntervalMs('1h')).toBe(3_600_000);
    expect(getIntervalMs('4h')).toBe(14_400_000);
  });

  it('parses day intervals', () => {
    expect(getIntervalMs('1d')).toBe(86_400_000);
  });

  it('parses week intervals', () => {
    expect(getIntervalMs('1w')).toBe(604_800_000);
  });

  it('returns default 4h for invalid format', () => {
    expect(getIntervalMs('abc')).toBe(4 * 3_600_000);
    expect(getIntervalMs('')).toBe(4 * 3_600_000);
    expect(getIntervalMs('1x')).toBe(4 * 3_600_000);
  });

  it('returns default 4h for missing number', () => {
    expect(getIntervalMs('m')).toBe(4 * 3_600_000);
    expect(getIntervalMs('h')).toBe(4 * 3_600_000);
  });
});

describe('emitLogsToWebSocket', () => {
  it('does nothing when websocket service is null', () => {
    vi.mocked(getWebSocketService).mockReturnValue(null);

    emitLogsToWebSocket([], new Map());
  });

  it('does nothing when watcher not found in map', () => {
    const mockWs = {
      emitAutoTradingLog: vi.fn(),
    };
    vi.mocked(getWebSocketService).mockReturnValue(mockWs as never);

    const results: WatcherResult[] = [{
      watcherId: 'unknown-watcher',
      symbol: 'BTCUSDT',
      interval: '1h',
      logs: [],
      setups: [],
      rejections: [],
      setupValidations: [],
    }];

    emitLogsToWebSocket(results, new Map());
    expect(mockWs.emitAutoTradingLog).not.toHaveBeenCalled();
  });

  it('emits logs for matching watchers', () => {
    const mockWs = {
      emitAutoTradingLog: vi.fn(),
    };
    vi.mocked(getWebSocketService).mockReturnValue(mockWs as never);

    const watcher: ActiveWatcher = {
      walletId: 'wallet-1',
      userId: 'user-1',
      symbol: 'BTCUSDT',
      interval: '1h',
    } as ActiveWatcher;

    const watcherMap = new Map([['w1', watcher]]);

    const results: WatcherResult[] = [{
      watcherId: 'w1',
      symbol: 'BTCUSDT',
      interval: '1h',
      logs: [{
        timestamp: new Date(),
        level: 'info',
        emoji: '>',
        message: 'test log',
      }],
      setups: [],
      rejections: [],
      setupValidations: [],
    }];

    emitLogsToWebSocket(results, watcherMap);
    expect(mockWs.emitAutoTradingLog).toHaveBeenCalledWith('wallet-1', expect.any(Object));
  });
});

describe('runSetupDetection', () => {

  const makeLogBuffer = (): WatcherLogBuffer => ({
    log: vi.fn(),
    addSetup: vi.fn(),
    addRejection: vi.fn(),
    startSetupValidation: vi.fn(),
    addValidationCheck: vi.fn(),
    completeSetupValidation: vi.fn(),
    getResult: vi.fn(),
  } as unknown as WatcherLogBuffer);

  const makeKline = (close: string) => ({
    symbol: 'BTCUSDT',
    interval: '1h',
    openTime: Date.now(),
    closeTime: Date.now() + 3600000,
    open: '100',
    high: '110',
    low: '90',
    close,
    volume: '1000',
    quoteVolume: '100000',
    trades: 100,
    takerBuyBaseVolume: '500',
    takerBuyQuoteVolume: '50000',
  });

  it('returns empty array when detectSetups returns no results', () => {
    mockedDetectSetups.mockReturnValue([]);

    const result = runSetupDetection(
      [makeKline('100')] as never[],
      [],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      makeLogBuffer(),
    );

    expect(result).toEqual([]);
  });

  it('returns setups with confidence >= 50', () => {
    mockedDetectSetups.mockReturnValue([
      {
        strategyId: 'test-strat',
        confidence: 75,
        setup: {
          type: 'test-strat',
          direction: 'LONG',
          entryPrice: 100,
          stopLoss: 95,
          takeProfit: 110,
          riskRewardRatio: 2.0,
          confidence: 75,
        },
        triggerKlineIndex: 0,
        triggerCandleData: {},
        triggerIndicatorValues: {},
      } as never,
    ]);

    const logBuffer = makeLogBuffer();

    const result = runSetupDetection(
      [makeKline('100')] as never[],
      [{ id: 'test-strat', name: 'Test Strategy' }] as never[],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      logBuffer,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('test-strat');
    expect(logBuffer.addSetup).toHaveBeenCalled();
  });

  it('filters out setups with confidence < 50', () => {
    mockedDetectSetups.mockReturnValue([
      {
        strategyId: 'low-conf',
        confidence: 30,
        setup: {
          type: 'low-conf',
          direction: 'LONG',
          entryPrice: 100,
          confidence: 30,
        },
      } as never,
    ]);

    const result = runSetupDetection(
      [makeKline('100')] as never[],
      [],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      makeLogBuffer(),
    );

    expect(result).toEqual([]);
  });

  it('logs rejections with direction', () => {
    mockedDetectSetups.mockReturnValue([
      {
        strategyId: 'rejected-strat',
        confidence: 60,
        rejection: {
          reason: 'minRR: too low',
          details: { direction: 'LONG', entryPrice: 100, rr: 0.5 },
        },
      } as never,
    ]);

    const logBuffer = makeLogBuffer();

    runSetupDetection(
      [makeKline('100')] as never[],
      [{ id: 'rejected-strat', name: 'Rejected Strategy' }] as never[],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      logBuffer,
    );

    expect(logBuffer.addRejection).toHaveBeenCalledWith(expect.objectContaining({
      setupType: 'Rejected Strategy',
      direction: 'LONG',
    }));
    expect(logBuffer.startSetupValidation).toHaveBeenCalled();
    expect(logBuffer.completeSetupValidation).toHaveBeenCalledWith('blocked', 'minRR: too low');
  });

  it('uses TRADING_DEFAULTS for minRR when effectiveConfig is null', () => {
    mockedDetectSetups.mockReturnValue([]);

    runSetupDetection(
      [makeKline('100')] as never[],
      [],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      makeLogBuffer(),
    );

    expect(mockedDetectSetups).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        minConfidence: 50,
      }),
    }));
  });

  it('passes directionMode when not auto', () => {
    mockedDetectSetups.mockReturnValue([]);

    runSetupDetection(
      [makeKline('100')] as never[],
      [],
      null,
      'long_only',
      { interval: '4h' } as ActiveWatcher,
      makeLogBuffer(),
    );

    expect(mockedDetectSetups).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        directionMode: 'long_only',
      }),
    }));
  });

  it('passes undefined directionMode when auto', () => {
    mockedDetectSetups.mockReturnValue([]);

    runSetupDetection(
      [makeKline('100')] as never[],
      [],
      null,
      'auto',
      { interval: '1h' } as ActiveWatcher,
      makeLogBuffer(),
    );

    expect(mockedDetectSetups).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({
        directionMode: undefined,
      }),
    }));
  });
});
