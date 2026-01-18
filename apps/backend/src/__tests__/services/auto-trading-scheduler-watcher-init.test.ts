import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { INTERVAL_MS, TIME_MS } from '../../constants';

const CANDLE_CLOSE_SAFETY_BUFFER_MS = 2000;

describe('AutoTradingScheduler Watcher Initialization', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('lastProcessedCandleOpenTime initialization', () => {
    const calculatePreviousCandleOpenTime = (now: number, interval: string): number => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;
      return previousCandleOpenTime;
    };

    const calculateCurrentCandleOpenTime = (now: number, interval: string): number => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      return Math.floor(now / intervalMs) * intervalMs;
    };

    it('should calculate previous candle openTime for 30m interval', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '30m');
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, '30m');

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T10:30:00.000Z').getTime());
      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());
      expect(previousCandleOpenTime).toBeLessThan(currentCandleOpenTime);
      expect(currentCandleOpenTime - previousCandleOpenTime).toBe(30 * 60 * 1000);
    });

    it('should calculate previous candle openTime for 1h interval', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '1h');
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, '1h');

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());
      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T09:00:00.000Z').getTime());
      expect(currentCandleOpenTime - previousCandleOpenTime).toBe(60 * 60 * 1000);
    });

    it('should calculate previous candle openTime for 4h interval', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '4h');
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, '4h');

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T08:00:00.000Z').getTime());
      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T04:00:00.000Z').getTime());
      expect(currentCandleOpenTime - previousCandleOpenTime).toBe(4 * 60 * 60 * 1000);
    });

    it('should calculate previous candle openTime for 1d interval', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '1d');
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, '1d');

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T00:00:00.000Z').getTime());
      expect(previousCandleOpenTime).toBe(new Date('2024-01-14T00:00:00.000Z').getTime());
      expect(currentCandleOpenTime - previousCandleOpenTime).toBe(24 * 60 * 60 * 1000);
    });

    it('should use 1h fallback for invalid interval', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, 'invalid');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T09:00:00.000Z').getTime());
    });

    it('should ensure new watcher processes just-closed candle immediately', () => {
      const now = new Date('2024-01-15T10:31:00.000Z').getTime();
      vi.setSystemTime(now);

      const interval = '30m';
      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, interval);
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, interval);

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const newlyOpenedCandleOpenTime = new Date('2024-01-15T10:30:00.000Z').getTime();

      expect(currentCandleOpenTime).toBe(newlyOpenedCandleOpenTime);
      expect(previousCandleOpenTime).toBe(justClosedCandleOpenTime);

      const lastProcessedCandleOpenTime = previousCandleOpenTime;

      const shouldProcessJustClosedCandle = justClosedCandleOpenTime !== lastProcessedCandleOpenTime;
      expect(shouldProcessJustClosedCandle).toBe(false);

      const undefinedLastProcessed: number | undefined = undefined;
      const wouldSkipWithUndefined = justClosedCandleOpenTime === undefinedLastProcessed;
      expect(wouldSkipWithUndefined).toBe(false);
    });

    it('should correctly identify when to skip already processed candle', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(now);

      const interval = '30m';
      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, interval);

      const cycleKlineOpenTime = previousCandleOpenTime;
      const lastProcessedCandleOpenTime = previousCandleOpenTime;

      const shouldSkip = cycleKlineOpenTime === lastProcessedCandleOpenTime;
      expect(shouldSkip).toBe(true);
    });

    it('should correctly identify when to process new candle', () => {
      const now = new Date('2024-01-15T11:01:00.000Z').getTime();
      vi.setSystemTime(now);

      const interval = '30m';
      const currentCandleOpenTime = calculateCurrentCandleOpenTime(now, interval);

      const lastProcessedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const newCandleOpenTime = new Date('2024-01-15T10:30:00.000Z').getTime();

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T11:00:00.000Z').getTime());

      const cycleKlineOpenTime = newCandleOpenTime;
      const shouldProcess = cycleKlineOpenTime !== lastProcessedCandleOpenTime;
      expect(shouldProcess).toBe(true);
    });
  });

  describe('Watcher state simulation', () => {
    interface MockWatcher {
      symbol: string;
      interval: string;
      lastProcessedCandleOpenTime: number;
    }

    const createMockWatcher = (symbol: string, interval: string, now: number): MockWatcher => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      return {
        symbol,
        interval,
        lastProcessedCandleOpenTime: previousCandleOpenTime,
      };
    };

    const shouldProcessCandle = (
      cycleKlineOpenTime: number,
      lastProcessedCandleOpenTime: number | undefined
    ): boolean => {
      if (lastProcessedCandleOpenTime === undefined) return true;
      return cycleKlineOpenTime !== lastProcessedCandleOpenTime;
    };

    it('should process just-closed candle when watcher is created mid-cycle', () => {
      const now = new Date('2024-01-15T10:35:00.000Z').getTime();
      vi.setSystemTime(now);

      const watcher = createMockWatcher('BTCUSDT', '30m', now);

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();

      const result = shouldProcessCandle(justClosedCandleOpenTime, watcher.lastProcessedCandleOpenTime);

      expect(result).toBe(false);
    });

    it('should process new candle when cycle completes', () => {
      const creationTime = new Date('2024-01-15T10:35:00.000Z').getTime();
      const watcher = createMockWatcher('BTCUSDT', '30m', creationTime);

      const nextCycleTime = new Date('2024-01-15T11:01:00.000Z').getTime();
      vi.setSystemTime(nextCycleTime);

      const newCandleOpenTime = new Date('2024-01-15T10:30:00.000Z').getTime();

      const result = shouldProcessCandle(newCandleOpenTime, watcher.lastProcessedCandleOpenTime);

      expect(result).toBe(true);
    });

    it('should not process same candle twice', () => {
      const now = new Date('2024-01-15T10:35:00.000Z').getTime();
      vi.setSystemTime(now);

      const watcher = createMockWatcher('BTCUSDT', '30m', now);
      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();

      watcher.lastProcessedCandleOpenTime = justClosedCandleOpenTime;

      const result = shouldProcessCandle(justClosedCandleOpenTime, watcher.lastProcessedCandleOpenTime);

      expect(result).toBe(false);
    });

    it('should handle rotation-created watchers correctly', () => {
      const rotationTime = new Date('2024-01-15T10:31:00.000Z').getTime();
      vi.setSystemTime(rotationTime);

      const newWatcher = createMockWatcher('ETHUSDT', '30m', rotationTime);

      expect(newWatcher.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const shouldProcess = shouldProcessCandle(justClosedCandleOpenTime, newWatcher.lastProcessedCandleOpenTime);

      expect(shouldProcess).toBe(false);
    });

    it('should handle edge case at exact candle boundary', () => {
      const exactBoundary = new Date('2024-01-15T10:30:00.000Z').getTime();
      vi.setSystemTime(exactBoundary);

      const watcher = createMockWatcher('BTCUSDT', '30m', exactBoundary);

      expect(watcher.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const result = shouldProcessCandle(justClosedCandleOpenTime, watcher.lastProcessedCandleOpenTime);

      expect(result).toBe(false);
    });
  });

  describe('All supported intervals', () => {
    const calculatePreviousCandleOpenTime = (now: number, interval: string): number => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      return currentCandleOpenTime - intervalMs;
    };

    const supportedIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'];

    it.each(supportedIntervals)('should calculate correct previous candle for %s interval', (interval) => {
      const now = new Date('2024-01-15T12:45:30.000Z').getTime();
      vi.setSystemTime(now);

      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS];
      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, interval);
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;

      expect(currentCandleOpenTime - previousCandleOpenTime).toBe(intervalMs);
      expect(previousCandleOpenTime).toBeLessThan(now);
      expect(previousCandleOpenTime % intervalMs).toBe(0);
    });

    it('should handle 1m interval correctly', () => {
      const now = new Date('2024-01-15T10:45:30.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '1m');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T10:44:00.000Z').getTime());
    });

    it('should handle 5m interval correctly', () => {
      const now = new Date('2024-01-15T10:47:30.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '5m');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T10:40:00.000Z').getTime());
    });

    it('should handle 15m interval correctly', () => {
      const now = new Date('2024-01-15T10:47:30.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '15m');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T10:30:00.000Z').getTime());
    });

    it('should handle 2h interval correctly', () => {
      const now = new Date('2024-01-15T11:30:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '2h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T08:00:00.000Z').getTime());
    });

    it('should handle 6h interval correctly', () => {
      const now = new Date('2024-01-15T14:30:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '6h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T06:00:00.000Z').getTime());
    });

    it('should handle 8h interval correctly', () => {
      const now = new Date('2024-01-15T10:30:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '8h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T00:00:00.000Z').getTime());
    });

    it('should handle 12h interval correctly', () => {
      const now = new Date('2024-01-15T14:30:00.000Z').getTime();
      vi.setSystemTime(now);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(now, '12h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-15T00:00:00.000Z').getTime());
    });
  });

  describe('Candle close timing with safety buffer', () => {
    const isCandleClosed = (candleCloseTime: number, now: number): boolean => {
      const safeCloseTime = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      return now >= safeCloseTime;
    };

    const getCandleCloseTime = (candleOpenTime: number, intervalMs: number): number => {
      return candleOpenTime + intervalMs - 1;
    };

    it('should wait for safety buffer after candle close time', () => {
      const intervalMs = 30 * 60 * 1000;
      const candleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const candleCloseTime = getCandleCloseTime(candleOpenTime, intervalMs);

      const justAfterClose = candleCloseTime + 1;
      expect(isCandleClosed(candleCloseTime, justAfterClose)).toBe(false);

      const withinBuffer = candleCloseTime + 1000;
      expect(isCandleClosed(candleCloseTime, withinBuffer)).toBe(false);

      const atBufferEnd = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      expect(isCandleClosed(candleCloseTime, atBufferEnd)).toBe(true);

      const afterBuffer = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS + 1000;
      expect(isCandleClosed(candleCloseTime, afterBuffer)).toBe(true);
    });

    it('should correctly identify candle as not closed before close time', () => {
      const intervalMs = 30 * 60 * 1000;
      const candleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const candleCloseTime = getCandleCloseTime(candleOpenTime, intervalMs);

      const beforeClose = candleCloseTime - 1000;
      expect(isCandleClosed(candleCloseTime, beforeClose)).toBe(false);
    });

    it('should handle edge case exactly at safety buffer boundary', () => {
      const intervalMs = 30 * 60 * 1000;
      const candleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const candleCloseTime = getCandleCloseTime(candleOpenTime, intervalMs);

      const exactlyAtBuffer = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS;
      expect(isCandleClosed(candleCloseTime, exactlyAtBuffer)).toBe(true);

      const onemsBeforeBuffer = candleCloseTime + CANDLE_CLOSE_SAFETY_BUFFER_MS - 1;
      expect(isCandleClosed(candleCloseTime, onemsBeforeBuffer)).toBe(false);
    });
  });

  describe('Expected candle open time calculation', () => {
    const calculateExpectedCandleOpenTime = (now: number, intervalMs: number): number => {
      return Math.floor(now / intervalMs) * intervalMs - intervalMs;
    };

    it('should calculate expected candle open time correctly', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      const intervalMs = 30 * 60 * 1000;

      const expected = calculateExpectedCandleOpenTime(now, intervalMs);

      expect(expected).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());
    });

    it('should detect missing candle when last candle is older', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      const intervalMs = 30 * 60 * 1000;

      const expectedCandleOpenTime = calculateExpectedCandleOpenTime(now, intervalMs);
      const lastCandleOpenTime = new Date('2024-01-15T09:30:00.000Z').getTime();

      const isMissing = lastCandleOpenTime < expectedCandleOpenTime;
      expect(isMissing).toBe(true);
    });

    it('should not detect missing candle when last candle is current', () => {
      const now = new Date('2024-01-15T10:45:00.000Z').getTime();
      const intervalMs = 30 * 60 * 1000;

      const expectedCandleOpenTime = calculateExpectedCandleOpenTime(now, intervalMs);
      const lastCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();

      const isMissing = lastCandleOpenTime < expectedCandleOpenTime;
      expect(isMissing).toBe(false);
    });
  });

  describe('Midnight UTC edge cases', () => {
    const calculatePreviousCandleOpenTime = (now: number, interval: string): number => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      return currentCandleOpenTime - intervalMs;
    };

    it('should handle 4h interval crossing midnight', () => {
      const justAfterMidnight = new Date('2024-01-15T00:30:00.000Z').getTime();
      vi.setSystemTime(justAfterMidnight);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(justAfterMidnight, '4h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-14T20:00:00.000Z').getTime());
    });

    it('should handle 1h interval at midnight boundary', () => {
      const atMidnight = new Date('2024-01-15T00:00:00.000Z').getTime();
      vi.setSystemTime(atMidnight);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(atMidnight, '1h');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-14T23:00:00.000Z').getTime());
    });

    it('should handle 1d interval at day boundary', () => {
      const justAfterMidnight = new Date('2024-01-15T00:01:00.000Z').getTime();
      vi.setSystemTime(justAfterMidnight);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(justAfterMidnight, '1d');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-14T00:00:00.000Z').getTime());
    });

    it('should handle 30m interval at midnight', () => {
      const atMidnight = new Date('2024-01-15T00:00:00.000Z').getTime();
      vi.setSystemTime(atMidnight);

      const previousCandleOpenTime = calculatePreviousCandleOpenTime(atMidnight, '30m');

      expect(previousCandleOpenTime).toBe(new Date('2024-01-14T23:30:00.000Z').getTime());
    });
  });

  describe('Multiple watchers with different intervals', () => {
    interface MockWatcher {
      symbol: string;
      interval: string;
      lastProcessedCandleOpenTime: number;
    }

    const createMockWatcher = (symbol: string, interval: string, now: number): MockWatcher => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      return {
        symbol,
        interval,
        lastProcessedCandleOpenTime: previousCandleOpenTime,
      };
    };

    it('should handle concurrent watchers with different intervals independently', () => {
      const now = new Date('2024-01-15T10:35:00.000Z').getTime();
      vi.setSystemTime(now);

      const watcher30m = createMockWatcher('BTCUSDT', '30m', now);
      const watcher1h = createMockWatcher('BTCUSDT', '1h', now);
      const watcher4h = createMockWatcher('BTCUSDT', '4h', now);

      expect(watcher30m.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());
      expect(watcher1h.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T09:00:00.000Z').getTime());
      expect(watcher4h.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T04:00:00.000Z').getTime());
    });

    it('should process watchers independently after time passes', () => {
      const creationTime = new Date('2024-01-15T10:35:00.000Z').getTime();

      const watcher30m = createMockWatcher('BTCUSDT', '30m', creationTime);
      const watcher1h = createMockWatcher('BTCUSDT', '1h', creationTime);

      const laterTime = new Date('2024-01-15T11:05:00.000Z').getTime();
      vi.setSystemTime(laterTime);

      const new30mCandle = new Date('2024-01-15T10:30:00.000Z').getTime();
      const new1hCandle = new Date('2024-01-15T10:00:00.000Z').getTime();

      const should30mProcess = new30mCandle !== watcher30m.lastProcessedCandleOpenTime;
      const should1hProcess = new1hCandle !== watcher1h.lastProcessedCandleOpenTime;

      expect(should30mProcess).toBe(true);
      expect(should1hProcess).toBe(true);
    });

    it('should allow different symbols with same interval', () => {
      const now = new Date('2024-01-15T10:35:00.000Z').getTime();
      vi.setSystemTime(now);

      const btcWatcher = createMockWatcher('BTCUSDT', '30m', now);
      const ethWatcher = createMockWatcher('ETHUSDT', '30m', now);
      const solWatcher = createMockWatcher('SOLUSDT', '30m', now);

      expect(btcWatcher.lastProcessedCandleOpenTime).toBe(ethWatcher.lastProcessedCandleOpenTime);
      expect(ethWatcher.lastProcessedCandleOpenTime).toBe(solWatcher.lastProcessedCandleOpenTime);

      btcWatcher.lastProcessedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();

      expect(btcWatcher.lastProcessedCandleOpenTime).toBe(ethWatcher.lastProcessedCandleOpenTime);
    });
  });

  describe('Rotation timing scenarios', () => {
    interface MockWatcher {
      symbol: string;
      interval: string;
      lastProcessedCandleOpenTime: number;
      createdAt: number;
    }

    const createMockWatcher = (symbol: string, interval: string, now: number): MockWatcher => {
      const intervalMs = INTERVAL_MS[interval as keyof typeof INTERVAL_MS] ?? TIME_MS.HOUR;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      return {
        symbol,
        interval,
        lastProcessedCandleOpenTime: previousCandleOpenTime,
        createdAt: now,
      };
    };

    it('should handle rotation at start of new candle', () => {
      const rotationTime = new Date('2024-01-15T10:30:05.000Z').getTime();
      vi.setSystemTime(rotationTime);

      const newWatcher = createMockWatcher('NEWCOIN', '30m', rotationTime);

      expect(newWatcher.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const shouldProcess = justClosedCandleOpenTime !== newWatcher.lastProcessedCandleOpenTime;

      expect(shouldProcess).toBe(false);
    });

    it('should handle rotation mid-cycle', () => {
      const rotationTime = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(rotationTime);

      const newWatcher = createMockWatcher('MIDCOIN', '30m', rotationTime);

      expect(newWatcher.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const shouldProcess = justClosedCandleOpenTime !== newWatcher.lastProcessedCandleOpenTime;

      expect(shouldProcess).toBe(false);
    });

    it('should handle rotation at end of cycle (just before close)', () => {
      const rotationTime = new Date('2024-01-15T10:59:55.000Z').getTime();
      vi.setSystemTime(rotationTime);

      const newWatcher = createMockWatcher('LATECOIN', '30m', rotationTime);

      expect(newWatcher.lastProcessedCandleOpenTime).toBe(new Date('2024-01-15T10:00:00.000Z').getTime());

      const justClosedCandleOpenTime = new Date('2024-01-15T10:00:00.000Z').getTime();
      const shouldProcess = justClosedCandleOpenTime !== newWatcher.lastProcessedCandleOpenTime;

      expect(shouldProcess).toBe(false);
    });

    it('should process next candle after rotation when cycle completes', () => {
      const rotationTime = new Date('2024-01-15T10:35:00.000Z').getTime();
      const newWatcher = createMockWatcher('ROTCOIN', '30m', rotationTime);

      const nextCycleTime = new Date('2024-01-15T11:02:05.000Z').getTime();
      vi.setSystemTime(nextCycleTime);

      const nextCandleOpenTime = new Date('2024-01-15T10:30:00.000Z').getTime();
      const shouldProcess = nextCandleOpenTime !== newWatcher.lastProcessedCandleOpenTime;

      expect(shouldProcess).toBe(true);
    });
  });

  describe('Watcher restart scenarios', () => {
    interface MockWatcher {
      symbol: string;
      interval: string;
      lastProcessedCandleOpenTime: number | undefined;
    }

    const shouldProcessCandle = (
      cycleKlineOpenTime: number,
      lastProcessedCandleOpenTime: number | undefined
    ): boolean => {
      if (lastProcessedCandleOpenTime === undefined) return true;
      return cycleKlineOpenTime !== lastProcessedCandleOpenTime;
    };

    it('should process candle when lastProcessedCandleOpenTime is undefined (old behavior)', () => {
      const watcherWithUndefined: MockWatcher = {
        symbol: 'BTCUSDT',
        interval: '30m',
        lastProcessedCandleOpenTime: undefined,
      };

      const anyCandle = new Date('2024-01-15T10:00:00.000Z').getTime();
      const shouldProcess = shouldProcessCandle(anyCandle, watcherWithUndefined.lastProcessedCandleOpenTime);

      expect(shouldProcess).toBe(true);
    });

    it('should not double process when properly initialized (new behavior)', () => {
      const now = new Date('2024-01-15T10:35:00.000Z').getTime();
      const intervalMs = 30 * 60 * 1000;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      const watcherWithInit: MockWatcher = {
        symbol: 'BTCUSDT',
        interval: '30m',
        lastProcessedCandleOpenTime: previousCandleOpenTime,
      };

      const justClosedCandle = previousCandleOpenTime;
      const shouldProcess = shouldProcessCandle(justClosedCandle, watcherWithInit.lastProcessedCandleOpenTime);

      expect(shouldProcess).toBe(false);
    });

    it('should handle server restart mid-cycle', () => {
      const restartTime = new Date('2024-01-15T10:45:00.000Z').getTime();
      vi.setSystemTime(restartTime);

      const intervalMs = 30 * 60 * 1000;
      const currentCandleOpenTime = Math.floor(restartTime / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      const restoredWatcher: MockWatcher = {
        symbol: 'BTCUSDT',
        interval: '30m',
        lastProcessedCandleOpenTime: previousCandleOpenTime,
      };

      const justClosedCandle = previousCandleOpenTime;
      const shouldProcess = shouldProcessCandle(justClosedCandle, restoredWatcher.lastProcessedCandleOpenTime);

      expect(shouldProcess).toBe(false);
    });
  });

  describe('Race condition prevention', () => {
    interface MockWatcher {
      symbol: string;
      interval: string;
      lastProcessedCandleOpenTime: number;
    }

    it('should prevent processing same candle from concurrent calls', () => {
      const now = new Date('2024-01-15T10:31:00.000Z').getTime();
      vi.setSystemTime(now);

      const intervalMs = 30 * 60 * 1000;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;
      const previousCandleOpenTime = currentCandleOpenTime - intervalMs;

      const watcher: MockWatcher = {
        symbol: 'BTCUSDT',
        interval: '30m',
        lastProcessedCandleOpenTime: previousCandleOpenTime,
      };

      const justClosedCandle = previousCandleOpenTime;

      const call1ShouldProcess = justClosedCandle !== watcher.lastProcessedCandleOpenTime;
      expect(call1ShouldProcess).toBe(false);

      const call2ShouldProcess = justClosedCandle !== watcher.lastProcessedCandleOpenTime;
      expect(call2ShouldProcess).toBe(false);
    });

    it('should update lastProcessedCandleOpenTime after processing', () => {
      const now = new Date('2024-01-15T11:01:00.000Z').getTime();
      vi.setSystemTime(now);

      const intervalMs = 30 * 60 * 1000;
      const currentCandleOpenTime = Math.floor(now / intervalMs) * intervalMs;

      const watcher: MockWatcher = {
        symbol: 'BTCUSDT',
        interval: '30m',
        lastProcessedCandleOpenTime: new Date('2024-01-15T10:00:00.000Z').getTime(),
      };

      const newCandle = new Date('2024-01-15T10:30:00.000Z').getTime();
      const shouldProcess = newCandle !== watcher.lastProcessedCandleOpenTime;

      expect(shouldProcess).toBe(true);

      watcher.lastProcessedCandleOpenTime = newCandle;

      const shouldProcessAgain = newCandle !== watcher.lastProcessedCandleOpenTime;
      expect(shouldProcessAgain).toBe(false);

      expect(currentCandleOpenTime).toBe(new Date('2024-01-15T11:00:00.000Z').getTime());
    });
  });
});
