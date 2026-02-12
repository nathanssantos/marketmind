import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    appendFileSync: vi.fn(),
  },
}));

vi.mock('../../../constants', () => ({
  INTERVAL_MS: {
    '1m': 60_000,
    '5m': 300_000,
    '15m': 900_000,
    '1h': 3_600_000,
    '4h': 14_400_000,
    '1d': 86_400_000,
  },
  TIME_MS: {
    SECOND: 1000,
    MINUTE: 60_000,
    HOUR: 3_600_000,
    DAY: 86_400_000,
  },
  AUTO_TRADING_ROTATION: {
    MIN_ANTICIPATION_MS: 5_000,
    MAX_ANTICIPATION_MS: 60_000,
  },
}));

vi.mock('../../dynamic-symbol-rotation', () => ({
  getIntervalMs: vi.fn((interval: string): number => {
    const map: Record<string, number> = {
      '1m': 60_000,
      '5m': 300_000,
      '15m': 900_000,
      '1h': 3_600_000,
      '4h': 14_400_000,
    };
    return map[interval] ?? 3_600_000;
  }),
}));

vi.mock('../../../utils/errors', () => ({
  serializeError: vi.fn((e: unknown) => String(e)),
}));

import {
  log,
  yieldToEventLoop,
  getPollingIntervalForTimeframe,
  getRotationAnticipationMs,
  getCandleCloseTime,
  getNextCandleCloseTime,
} from '../utils';
import fs from 'fs';

describe('log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should log message without data', () => {
    log('test message');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('test message'));
    expect(fs.appendFileSync).toHaveBeenCalled();
  });

  it('should log message with data', () => {
    log('test message', { key: 'value' });
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('"key":"value"'));
  });

  it('should handle file write failure gracefully', () => {
    vi.mocked(fs.appendFileSync).mockImplementation(() => { throw new Error('write failed'); });
    log('test message');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to write'),
      expect.any(String),
    );
  });

  it('should create log directory if it does not exist', () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    log('test');
    expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });
});

describe('yieldToEventLoop', () => {
  it('should resolve', async () => {
    await expect(yieldToEventLoop()).resolves.toBeUndefined();
  });
});

describe('getPollingIntervalForTimeframe', () => {
  it('should return interval ms for known intervals', () => {
    expect(getPollingIntervalForTimeframe('1h')).toBe(3_600_000);
    expect(getPollingIntervalForTimeframe('4h')).toBe(14_400_000);
  });

  it('should clamp minimum to 1 minute', () => {
    expect(getPollingIntervalForTimeframe('1m')).toBe(60_000);
  });

  it('should return 1 minute for unknown intervals', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(getPollingIntervalForTimeframe('unknown')).toBe(60_000);
  });
});

describe('getRotationAnticipationMs', () => {
  it('should return 5% of interval ms clamped between min and max', () => {
    const result = getRotationAnticipationMs('1h');
    const expected = Math.floor(3_600_000 * 0.05);
    expect(result).toBe(Math.max(5000, Math.min(expected, 60_000)));
  });

  it('should not go below minimum anticipation', () => {
    const result = getRotationAnticipationMs('1m');
    expect(result).toBeGreaterThanOrEqual(5000);
  });

  it('should not exceed maximum anticipation', () => {
    const result = getRotationAnticipationMs('1d');
    expect(result).toBeLessThanOrEqual(60_000);
  });

  it('should default to 1h for unknown intervals', () => {
    const result = getRotationAnticipationMs('unknown');
    expect(result).toBe(Math.max(5000, Math.min(Math.floor(3_600_000 * 0.05), 60_000)));
  });
});

describe('getCandleCloseTime', () => {
  it('should calculate close time for current candle', () => {
    const timestamp = 3_600_000 * 5 + 1000;
    const result = getCandleCloseTime('1h', timestamp);
    expect(result).toBe(3_600_000 * 6);
  });

  it('should handle exact candle boundary', () => {
    const timestamp = 3_600_000 * 5;
    const result = getCandleCloseTime('1h', timestamp);
    expect(result).toBe(3_600_000 * 6);
  });
});

describe('getNextCandleCloseTime', () => {
  it('should return close time one interval after current candle close', () => {
    const timestamp = 3_600_000 * 5 + 1000;
    const result = getNextCandleCloseTime('1h', timestamp);
    expect(result).toBe(3_600_000 * 7);
  });
});
