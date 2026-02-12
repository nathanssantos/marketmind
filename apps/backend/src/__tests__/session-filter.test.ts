import { describe, it, expect } from 'vitest';
import { checkSessionCondition, SESSION_FILTER } from '../utils/filters/session-filter';

const utcTimestamp = (hour: number, minute = 0): number => {
  const date = new Date();
  date.setUTCHours(hour, minute, 0, 0);
  return date.getTime();
};

describe('checkSessionCondition', () => {
  describe('default session window (13:00-16:00 UTC)', () => {
    it('should allow trade at 13:00 UTC (start of session)', () => {
      const result = checkSessionCondition(utcTimestamp(13));

      expect(result.isAllowed).toBe(true);
      expect(result.currentHourUtc).toBe(13);
      expect(result.isInSession).toBe(true);
      expect(result.reason).toContain('within session');
    });

    it('should allow trade at 14:00 UTC (mid-session)', () => {
      const result = checkSessionCondition(utcTimestamp(14));

      expect(result.isAllowed).toBe(true);
      expect(result.isInSession).toBe(true);
    });

    it('should allow trade at 15:00 UTC (near end of session)', () => {
      const result = checkSessionCondition(utcTimestamp(15));

      expect(result.isAllowed).toBe(true);
    });

    it('should block trade at 16:00 UTC (session end, exclusive)', () => {
      const result = checkSessionCondition(utcTimestamp(16));

      expect(result.isAllowed).toBe(false);
      expect(result.isInSession).toBe(false);
      expect(result.reason).toContain('outside session');
    });

    it('should block trade at 12:00 UTC (before session)', () => {
      const result = checkSessionCondition(utcTimestamp(12));

      expect(result.isAllowed).toBe(false);
      expect(result.isInSession).toBe(false);
    });

    it('should block trade at 0:00 UTC (midnight)', () => {
      const result = checkSessionCondition(utcTimestamp(0));

      expect(result.isAllowed).toBe(false);
    });

    it('should block trade at 23:00 UTC (late night)', () => {
      const result = checkSessionCondition(utcTimestamp(23));

      expect(result.isAllowed).toBe(false);
    });
  });

  describe('custom session window (same-day)', () => {
    it('should allow trade within custom window 9:00-17:00', () => {
      const result = checkSessionCondition(utcTimestamp(10), 9, 17);

      expect(result.isAllowed).toBe(true);
      expect(result.isInSession).toBe(true);
    });

    it('should block trade outside custom window 9:00-17:00', () => {
      const result = checkSessionCondition(utcTimestamp(8), 9, 17);

      expect(result.isAllowed).toBe(false);
    });

    it('should handle window 0:00-6:00 (early morning)', () => {
      const result = checkSessionCondition(utcTimestamp(3), 0, 6);

      expect(result.isAllowed).toBe(true);
    });
  });

  describe('overnight session window (wraps around midnight)', () => {
    it('should allow trade at 22:00 UTC for 20:00-04:00 window', () => {
      const result = checkSessionCondition(utcTimestamp(22), 20, 4);

      expect(result.isAllowed).toBe(true);
      expect(result.isInSession).toBe(true);
    });

    it('should allow trade at 2:00 UTC for 20:00-04:00 window', () => {
      const result = checkSessionCondition(utcTimestamp(2), 20, 4);

      expect(result.isAllowed).toBe(true);
    });

    it('should block trade at 10:00 UTC for 20:00-04:00 window', () => {
      const result = checkSessionCondition(utcTimestamp(10), 20, 4);

      expect(result.isAllowed).toBe(false);
    });

    it('should block trade at 4:00 UTC for 20:00-04:00 window (end exclusive)', () => {
      const result = checkSessionCondition(utcTimestamp(4), 20, 4);

      expect(result.isAllowed).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle negative start UTC via normalization', () => {
      const result = checkSessionCondition(utcTimestamp(23), -1, 4);

      expect(result.isAllowed).toBe(true);
    });

    it('should handle hours > 24 via normalization', () => {
      const result = checkSessionCondition(utcTimestamp(2), 25, 4);

      expect(result.isAllowed).toBe(true);
    });

    it('should include currentHourUtc in reason', () => {
      const result = checkSessionCondition(utcTimestamp(14));

      expect(result.reason).toContain('14:00 UTC');
    });
  });

  describe('SESSION_FILTER constants', () => {
    it('should export correct default values', () => {
      expect(SESSION_FILTER.DEFAULT_START_UTC).toBe(13);
      expect(SESSION_FILTER.DEFAULT_END_UTC).toBe(16);
    });
  });
});
