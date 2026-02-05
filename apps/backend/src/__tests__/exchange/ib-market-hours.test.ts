import { describe, it, expect, beforeEach } from 'vitest';
import { MarketHoursService } from '../../exchange/interactive-brokers/market-hours';
import type { MarketCalendar } from '../../exchange/interactive-brokers/types';

const createTestCalendar = (): MarketCalendar => ({
  timezone: 'America/New_York',
  sessions: [
    { name: 'PRE_MARKET', open: '04:00', close: '09:30', isCore: false },
    { name: 'REGULAR', open: '09:30', close: '16:00', isCore: true },
    { name: 'AFTER_HOURS', open: '16:00', close: '20:00', isCore: false },
  ],
  holidays: [new Date(2025, 0, 20, 12, 0, 0)],
  earlyCloses: new Map([['2025-11-28', '13:00']]),
});

describe('MarketHoursService', () => {
  let service: MarketHoursService;

  beforeEach(() => {
    service = new MarketHoursService(createTestCalendar());
  });

  describe('isHoliday', () => {
    it('should return true for holiday dates', () => {
      const holidayDate = new Date(2025, 0, 20, 12, 0, 0);
      expect(service.isHoliday(holidayDate)).toBe(true);
    });

    it('should return false for non-holiday dates', () => {
      const normalDate = new Date(2025, 0, 21, 12, 0, 0);
      expect(service.isHoliday(normalDate)).toBe(false);
    });
  });

  describe('isWeekend', () => {
    it('should return true for Saturday', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      expect(service.isWeekend(saturday)).toBe(true);
    });

    it('should return true for Sunday', () => {
      const sunday = new Date('2025-01-26T12:00:00-05:00');
      expect(service.isWeekend(sunday)).toBe(true);
    });

    it('should return false for weekdays', () => {
      const monday = new Date('2025-01-27T12:00:00-05:00');
      expect(service.isWeekend(monday)).toBe(false);
    });
  });

  describe('isEarlyCloseDay', () => {
    it('should return true for early close dates', () => {
      const earlyCloseDate = new Date('2025-11-28T12:00:00-05:00');
      expect(service.isEarlyCloseDay(earlyCloseDate)).toBe(true);
    });

    it('should return false for normal trading days', () => {
      const normalDate = new Date('2025-01-27T12:00:00-05:00');
      expect(service.isEarlyCloseDay(normalDate)).toBe(false);
    });
  });

  describe('getEarlyCloseTime', () => {
    it('should return early close time for early close dates', () => {
      const earlyCloseDate = new Date('2025-11-28T12:00:00-05:00');
      expect(service.getEarlyCloseTime(earlyCloseDate)).toBe('13:00');
    });

    it('should return undefined for normal trading days', () => {
      const normalDate = new Date('2025-01-27T12:00:00-05:00');
      expect(service.getEarlyCloseTime(normalDate)).toBeUndefined();
    });
  });

  describe('getCurrentSession', () => {
    it('should return CLOSED for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      expect(service.getCurrentSession(saturday)).toBe('CLOSED');
    });

    it('should return CLOSED for holidays', () => {
      const holiday = new Date(2025, 0, 20, 12, 0, 0);
      expect(service.getCurrentSession(holiday)).toBe('CLOSED');
    });
  });

  describe('isMarketOpen', () => {
    it('should return false for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      expect(service.isMarketOpen(false, saturday)).toBe(false);
      expect(service.isMarketOpen(true, saturday)).toBe(false);
    });

    it('should return false for holidays', () => {
      const holiday = new Date(2025, 0, 20, 12, 0, 0);
      expect(service.isMarketOpen(false, holiday)).toBe(false);
    });
  });

  describe('getMarketStatus', () => {
    it('should return correct status for holidays', () => {
      const holiday = new Date(2025, 0, 20, 12, 0, 0);
      const status = service.getMarketStatus(holiday);

      expect(status.isOpen).toBe(false);
      expect(status.sessionType).toBe('CLOSED');
      expect(status.isHoliday).toBe(true);
    });

    it('should return correct status for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      const status = service.getMarketStatus(saturday);

      expect(status.isOpen).toBe(false);
      expect(status.sessionType).toBe('CLOSED');
    });

    it('should return correct status for early close days', () => {
      const earlyCloseDate = new Date('2025-11-28T12:00:00-05:00');
      const status = service.getMarketStatus(earlyCloseDate);

      expect(status.isEarlyClose).toBe(true);
      expect(status.earlyCloseTime).toBe('13:00');
    });
  });

  describe('getNextMarketOpen', () => {
    it('should skip weekends when finding next open', () => {
      const friday = new Date('2025-01-24T20:00:00-05:00');
      const nextOpen = service.getNextMarketOpen(friday);

      expect(nextOpen.getDay()).not.toBe(0);
      expect(nextOpen.getDay()).not.toBe(6);
    });
  });

  describe('getSessionsForDate', () => {
    it('should return empty array for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      const sessions = service.getSessionsForDate(saturday);
      expect(sessions).toHaveLength(0);
    });

    it('should return empty array for holidays', () => {
      const holiday = new Date(2025, 0, 20, 12, 0, 0);
      const sessions = service.getSessionsForDate(holiday);
      expect(sessions).toHaveLength(0);
    });

    it('should return adjusted sessions for early close days', () => {
      const earlyCloseDate = new Date('2025-11-28T12:00:00-05:00');
      const sessions = service.getSessionsForDate(earlyCloseDate);

      const regularSession = sessions.find((s) => s.name === 'REGULAR');
      expect(regularSession?.close).toBe('13:00');
    });

    it('should return normal sessions for regular trading days', () => {
      const normalDate = new Date('2025-01-27T12:00:00-05:00');
      const sessions = service.getSessionsForDate(normalDate);

      expect(sessions).toHaveLength(3);
      const regularSession = sessions.find((s) => s.name === 'REGULAR');
      expect(regularSession?.close).toBe('16:00');
    });
  });

  describe('getTradingHoursString', () => {
    it('should return Market Closed for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      expect(service.getTradingHoursString(saturday)).toBe('Market Closed');
    });

    it('should return trading hours for regular days', () => {
      const normalDate = new Date('2025-01-27T12:00:00-05:00');
      const hoursString = service.getTradingHoursString(normalDate);
      expect(hoursString).toMatch(/\d{2}:\d{2} - \d{2}:\d{2} ET/);
    });

    it('should return early close hours for early close days', () => {
      const earlyCloseDate = new Date('2025-11-28T12:00:00-05:00');
      const hoursString = service.getTradingHoursString(earlyCloseDate);
      expect(hoursString).toContain('13:00');
    });
  });
});
