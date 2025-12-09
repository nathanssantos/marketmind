import type { Interval } from '@marketmind/types';
import { describe, expect, it, vi } from 'vitest';
import { calculateStartTime, getIntervalMilliseconds } from '../services/binance-historical';

vi.mock('binance-api-node', () => ({
  default: vi.fn(() => ({
    candles: vi.fn(),
  })),
}));

describe('Binance Historical Klines', () => {
  describe('getIntervalMilliseconds', () => {
    it('should return correct milliseconds for 1m interval', () => {
      expect(getIntervalMilliseconds('1m' as Interval)).toBe(60000);
    });

    it('should return correct milliseconds for 1h interval', () => {
      expect(getIntervalMilliseconds('1h' as Interval)).toBe(3600000);
    });

    it('should return correct milliseconds for 1d interval', () => {
      expect(getIntervalMilliseconds('1d' as Interval)).toBe(86400000);
    });

    it('should return default for unknown interval', () => {
      expect(getIntervalMilliseconds('invalid' as Interval)).toBe(60000);
    });
  });

  describe('calculateStartTime', () => {
    it('should calculate correct start time for 100 periods back', () => {
      const interval = '1m' as Interval;
      const periodsBack = 100;
      const startTime = calculateStartTime(interval, periodsBack);
      
      const expected = new Date(Date.now() - 60000 * 100);
      const diff = Math.abs(startTime.getTime() - expected.getTime());
      
      expect(diff).toBeLessThan(1000);
    });

    it('should calculate correct start time for 1h interval', () => {
      const interval = '1h' as Interval;
      const periodsBack = 24;
      const startTime = calculateStartTime(interval, periodsBack);
      
      const expected = new Date(Date.now() - 3600000 * 24);
      const diff = Math.abs(startTime.getTime() - expected.getTime());
      
      expect(diff).toBeLessThan(1000);
    });
  });
});
