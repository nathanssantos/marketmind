import { describe, it, expect, beforeEach } from 'vitest';
import { GapClassifier } from '../../exchange/interactive-brokers/gap-classifier';
import type { MarketCalendar } from '../../exchange/interactive-brokers/types';
import type { Kline } from '@marketmind/types';

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

const createKline = (openTime: number, closeTime: number): Kline => ({
  openTime,
  closeTime,
  open: '100',
  high: '101',
  low: '99',
  close: '100.50',
  volume: '1000',
  quoteVolume: '100500',
  trades: 50,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50250',
});

describe('GapClassifier', () => {
  let classifier: GapClassifier;

  beforeEach(() => {
    classifier = new GapClassifier(createTestCalendar());
  });

  describe('classifyGap', () => {
    it('should classify weekend gap as WEEKEND', () => {
      const fridayClose = new Date('2025-01-24T16:00:00-05:00');
      const mondayOpen = new Date('2025-01-27T09:30:00-05:00');

      const gap = classifier.classifyGap(fridayClose, mondayOpen, '1m');

      expect(gap.type).toBe('WEEKEND');
      expect(gap.isLegitimate).toBe(true);
    });

    it('should classify overnight gap as OVERNIGHT', () => {
      const dayClose = new Date('2025-01-27T16:00:00-05:00');
      const nextDayOpen = new Date('2025-01-28T09:30:00-05:00');

      const gap = classifier.classifyGap(dayClose, nextDayOpen, '1m');

      expect(gap.type).toBe('OVERNIGHT');
      expect(gap.isLegitimate).toBe(true);
    });

    it('should classify holiday gap as HOLIDAY', () => {
      const beforeHoliday = new Date('2025-01-17T16:00:00-05:00');
      const afterHoliday = new Date('2025-01-21T09:30:00-05:00');

      const gap = classifier.classifyGap(beforeHoliday, afterHoliday, '1m');

      expect(gap.type).toBe('HOLIDAY');
      expect(gap.isLegitimate).toBe(true);
    });

    it('should classify early close gap as EARLY_CLOSE', () => {
      const earlyClose = new Date('2025-11-28T13:00:00-05:00');
      const nextDayOpen = new Date('2025-11-29T09:30:00-05:00');

      const gap = classifier.classifyGap(earlyClose, nextDayOpen, '1m');

      expect(gap.isLegitimate).toBe(true);
    });

    it('should classify unexpected gaps as UNEXPECTED', () => {
      const gapStart = new Date('2025-01-27T10:00:00-05:00');
      const gapEnd = new Date('2025-01-27T14:00:00-05:00');

      const gap = classifier.classifyGap(gapStart, gapEnd, '1m');

      expect(gap.type).toBe('UNEXPECTED');
      expect(gap.isLegitimate).toBe(false);
    });

    it('should calculate expected klines based on interval', () => {
      const gapStart = new Date('2025-01-27T10:00:00-05:00');
      const gapEnd = new Date('2025-01-27T11:00:00-05:00');

      const gap1m = classifier.classifyGap(gapStart, gapEnd, '1m');
      expect(gap1m.expectedKlines).toBe(60);

      const gap5m = classifier.classifyGap(gapStart, gapEnd, '5m');
      expect(gap5m.expectedKlines).toBe(12);
    });

    it('should include duration in milliseconds', () => {
      const gapStart = new Date('2025-01-27T10:00:00-05:00');
      const gapEnd = new Date('2025-01-27T11:00:00-05:00');

      const gap = classifier.classifyGap(gapStart, gapEnd, '1m');

      expect(gap.durationMs).toBe(3600000);
    });
  });

  describe('detectGaps', () => {
    it('should return empty array for klines with less than 2 entries', () => {
      const klines: Kline[] = [];
      const gaps = classifier.detectGaps(klines, '1m', {
        marketType: 'STOCK',
        includeExtendedHours: false,
      });

      expect(gaps).toHaveLength(0);
    });

    it('should return empty array for continuous klines', () => {
      const baseTime = new Date('2025-01-27T10:00:00-05:00').getTime();
      const klines: Kline[] = [
        createKline(baseTime, baseTime + 59999),
        createKline(baseTime + 60000, baseTime + 119999),
        createKline(baseTime + 120000, baseTime + 179999),
      ];

      const gaps = classifier.detectGaps(klines, '1m', {
        marketType: 'STOCK',
        includeExtendedHours: false,
      });

      expect(gaps).toHaveLength(0);
    });

    it('should detect gaps for crypto markets', () => {
      const baseTime = new Date('2025-01-27T10:00:00-05:00').getTime();
      const klines: Kline[] = [
        createKline(baseTime, baseTime + 59999),
        createKline(baseTime + 300000, baseTime + 359999),
      ];

      const gaps = classifier.detectGaps(klines, '1m', {
        marketType: 'CRYPTO',
        includeExtendedHours: false,
      });

      expect(gaps).toHaveLength(1);
      expect(gaps[0]?.type).toBe('UNEXPECTED');
    });

    it('should filter out legitimate gaps for stock markets', () => {
      const fridayClose = new Date('2025-01-24T16:00:00-05:00').getTime();
      const mondayOpen = new Date('2025-01-27T09:30:00-05:00').getTime();

      const klines: Kline[] = [
        createKline(fridayClose - 60000, fridayClose - 1),
        createKline(mondayOpen, mondayOpen + 59999),
      ];

      const gaps = classifier.detectGaps(klines, '1m', {
        marketType: 'STOCK',
        includeExtendedHours: false,
      });

      expect(gaps).toHaveLength(0);
    });

    it('should detect unexpected gaps during trading hours', () => {
      const baseTime = new Date('2025-01-27T10:00:00-05:00').getTime();
      const klines: Kline[] = [
        createKline(baseTime, baseTime + 59999),
        createKline(baseTime + 7200000, baseTime + 7259999),
      ];

      const gaps = classifier.detectGaps(klines, '1m', {
        marketType: 'STOCK',
        includeExtendedHours: false,
      });

      expect(gaps.length).toBeGreaterThan(0);
      expect(gaps[0]?.type).toBe('UNEXPECTED');
    });
  });

  describe('getExpectedGapsPerDay', () => {
    it('should return 1 for overnight gap', () => {
      expect(classifier.getExpectedGapsPerDay()).toBe(1);
    });
  });

  describe('getExpectedGapsPerWeek', () => {
    it('should return 6 (5 overnight + 1 weekend)', () => {
      expect(classifier.getExpectedGapsPerWeek()).toBe(6);
    });
  });

  describe('isWithinTradingHours', () => {
    it('should return false for weekends', () => {
      const saturday = new Date('2025-01-25T12:00:00-05:00');
      expect(classifier.isWithinTradingHours(saturday)).toBe(false);
    });

    it('should return false for holidays', () => {
      const holiday = new Date('2025-01-20T12:00:00-05:00');
      expect(classifier.isWithinTradingHours(holiday)).toBe(false);
    });
  });

  describe('getNextExpectedKlineTime', () => {
    it('should return next interval time during trading hours', () => {
      const lastClose = new Date('2025-01-27T10:00:00-05:00');
      const nextTime = classifier.getNextExpectedKlineTime(lastClose, '1m');

      expect(nextTime.getTime()).toBeGreaterThan(lastClose.getTime());
    });

    it('should skip to next market open for after-hours close', () => {
      const afterHoursClose = new Date('2025-01-27T20:00:00-05:00');
      const nextTime = classifier.getNextExpectedKlineTime(afterHoursClose, '1m');

      expect(nextTime.getTime()).toBeGreaterThan(afterHoursClose.getTime());
    });
  });
});
