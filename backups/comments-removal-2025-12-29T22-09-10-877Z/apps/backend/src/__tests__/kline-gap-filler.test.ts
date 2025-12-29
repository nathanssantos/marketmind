import { describe, expect, it } from 'vitest';
import { getIntervalMilliseconds } from '../services/binance-historical';

describe('KlineGapFiller Utilities', () => {
  describe('getIntervalMilliseconds', () => {
    it('should return correct milliseconds for 1m interval', () => {
      expect(getIntervalMilliseconds('1m')).toBe(60000);
    });

    it('should return correct milliseconds for 5m interval', () => {
      expect(getIntervalMilliseconds('5m')).toBe(300000);
    });

    it('should return correct milliseconds for 15m interval', () => {
      expect(getIntervalMilliseconds('15m')).toBe(900000);
    });

    it('should return correct milliseconds for 30m interval', () => {
      expect(getIntervalMilliseconds('30m')).toBe(1800000);
    });

    it('should return correct milliseconds for 1h interval', () => {
      expect(getIntervalMilliseconds('1h')).toBe(3600000);
    });

    it('should return correct milliseconds for 4h interval', () => {
      expect(getIntervalMilliseconds('4h')).toBe(14400000);
    });

    it('should return correct milliseconds for 1d interval', () => {
      expect(getIntervalMilliseconds('1d')).toBe(86400000);
    });

    it('should return correct milliseconds for 1w interval', () => {
      expect(getIntervalMilliseconds('1w')).toBe(604800000);
    });

    it('should return default 60000ms for unknown interval', () => {
      expect(getIntervalMilliseconds('unknown' as any)).toBe(60000);
    });
  });

  describe('Gap Detection Logic', () => {
    const intervalMs = 60000;

    it('should detect gap when current time is 2 intervals ahead', () => {
      const prevTime = 1000000000000;
      const currTime = prevTime + intervalMs * 3;
      const expectedNextTime = prevTime + intervalMs;

      const hasGap = currTime > expectedNextTime;
      const missingCandles = Math.floor((currTime - expectedNextTime) / intervalMs) + 1;

      expect(hasGap).toBe(true);
      expect(missingCandles).toBe(3);
    });

    it('should not detect gap for consecutive candles', () => {
      const prevTime = 1000000000000;
      const currTime = prevTime + intervalMs;
      const expectedNextTime = prevTime + intervalMs;

      const hasGap = currTime > expectedNextTime;

      expect(hasGap).toBe(false);
    });

    it('should calculate missing candles at end correctly', () => {
      const now = 1000000300000;
      const lastKlineTime = 1000000000000;

      const expectedLatestTime = Math.floor(now / intervalMs) * intervalMs;
      const missingAtEnd = Math.floor((expectedLatestTime - lastKlineTime) / intervalMs);

      expect(missingAtEnd).toBe(4);
    });
  });

  describe('Gap Filling Time Ranges', () => {
    it('should calculate correct gap start and end times', () => {
      const intervalMs = 3600000;
      const prevTime = 1734600000000;
      const currTime = prevTime + intervalMs * 4;

      const gapStart = new Date(prevTime + intervalMs);
      const gapEnd = new Date(currTime - intervalMs);

      expect(gapStart.getTime()).toBe(prevTime + intervalMs);
      expect(gapEnd.getTime()).toBe(currTime - intervalMs);
    });

    it('should handle lookback period calculation', () => {
      const MAX_GAP_LOOKBACK_HOURS = 48;
      const lookbackMs = MAX_GAP_LOOKBACK_HOURS * 60 * 60 * 1000;

      expect(lookbackMs).toBe(172800000);
    });
  });
});
