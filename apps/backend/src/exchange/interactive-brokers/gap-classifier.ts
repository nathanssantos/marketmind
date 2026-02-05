import type { Kline } from '@marketmind/types';
import type { GapInfo, MarketCalendar } from './types';
import { MarketHoursService } from './market-hours';
import { NYSE_HOLIDAYS_2025, NYSE_EARLY_CLOSES_2025 } from './constants';

const TIME_MS = {
  '1m': 60_000,
  '5m': 300_000,
  '15m': 900_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '4h': 14_400_000,
  '1d': 86_400_000,
  '1w': 604_800_000,
} as const;

type TimeInterval = keyof typeof TIME_MS;

const NYSE_CALENDAR: MarketCalendar = {
  timezone: 'America/New_York',
  sessions: [
    { name: 'PRE_MARKET', open: '04:00', close: '09:30', isCore: false },
    { name: 'REGULAR', open: '09:30', close: '16:00', isCore: true },
    { name: 'AFTER_HOURS', open: '16:00', close: '20:00', isCore: false },
  ],
  holidays: [...NYSE_HOLIDAYS_2025],
  earlyCloses: NYSE_EARLY_CLOSES_2025,
};

const OVERNIGHT_GAP_HOURS = {
  min: 14,
  max: 18,
} as const;

export interface GapDetectionConfig {
  marketType: 'CRYPTO' | 'STOCK';
  calendar?: MarketCalendar;
  includeExtendedHours: boolean;
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const getDayOfWeek = (date: Date): number => {
  const nyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
  });
  const weekday = nyFormatter.format(date);
  const dayOfWeekMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return dayOfWeekMap[weekday] ?? 0;
};

const eachDayOfInterval = (start: Date, end: Date): Date[] => {
  const days: Date[] = [];
  const current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return days;
};

export class GapClassifier {
  private marketHoursService: MarketHoursService;
  private calendar: MarketCalendar;

  constructor(calendar: MarketCalendar = NYSE_CALENDAR) {
    this.calendar = calendar;
    this.marketHoursService = new MarketHoursService(calendar);
  }

  classifyGap(gapStart: Date, gapEnd: Date, interval: TimeInterval): GapInfo {
    const durationMs = gapEnd.getTime() - gapStart.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
    const expectedKlines = Math.floor(durationMs / TIME_MS[interval]);

    const startDay = getDayOfWeek(gapStart);
    const endDay = getDayOfWeek(gapEnd);

    if (startDay === 5 && (endDay === 1 || endDay === 0)) {
      return {
        type: 'WEEKEND',
        start: gapStart,
        end: gapEnd,
        durationMs,
        expectedKlines,
        isLegitimate: true,
      };
    }

    if (startDay === 6 || endDay === 0) {
      return {
        type: 'WEEKEND',
        start: gapStart,
        end: gapEnd,
        durationMs,
        expectedKlines,
        isLegitimate: true,
      };
    }

    const datesInGap = eachDayOfInterval(gapStart, gapEnd);
    const hasHoliday = datesInGap.some((d) =>
      this.calendar.holidays.some((h) => isSameDay(d, h))
    );

    if (hasHoliday) {
      return {
        type: 'HOLIDAY',
        start: gapStart,
        end: gapEnd,
        durationMs,
        expectedKlines,
        isLegitimate: true,
      };
    }

    const formatDateKey = (date: Date): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const startDateKey = formatDateKey(gapStart);
    const isEarlyClose = this.calendar.earlyCloses.has(startDateKey);

    if (isEarlyClose && durationHours >= 14 && durationHours <= 22) {
      return {
        type: 'EARLY_CLOSE',
        start: gapStart,
        end: gapEnd,
        durationMs,
        expectedKlines,
        isLegitimate: true,
      };
    }

    if (durationHours >= OVERNIGHT_GAP_HOURS.min && durationHours <= OVERNIGHT_GAP_HOURS.max) {
      return {
        type: 'OVERNIGHT',
        start: gapStart,
        end: gapEnd,
        durationMs,
        expectedKlines,
        isLegitimate: true,
      };
    }

    return {
      type: 'UNEXPECTED',
      start: gapStart,
      end: gapEnd,
      durationMs,
      expectedKlines,
      isLegitimate: false,
    };
  }

  detectGaps(klines: Kline[], interval: TimeInterval, config: GapDetectionConfig): GapInfo[] {
    const gaps: GapInfo[] = [];
    const intervalMs = TIME_MS[interval];

    if (!intervalMs || klines.length < 2) {
      return gaps;
    }

    for (let i = 1; i < klines.length; i++) {
      const prevKline = klines[i - 1];
      const currKline = klines[i];

      if (!prevKline || !currKline) continue;

      const timeDiff = currKline.openTime - prevKline.closeTime;

      if (config.marketType === 'CRYPTO') {
        if (timeDiff > intervalMs * 1.5) {
          gaps.push({
            type: 'UNEXPECTED',
            start: new Date(prevKline.closeTime),
            end: new Date(currKline.openTime),
            durationMs: timeDiff,
            expectedKlines: Math.floor(timeDiff / intervalMs),
            isLegitimate: false,
          });
        }
      } else {
        if (timeDiff > intervalMs * 1.5) {
          const gapInfo = this.classifyGap(
            new Date(prevKline.closeTime),
            new Date(currKline.openTime),
            interval
          );

          if (!gapInfo.isLegitimate) {
            gaps.push(gapInfo);
          }
        }
      }
    }

    return gaps;
  }

  getExpectedGapsPerDay(): number {
    return 1;
  }

  getExpectedGapsPerWeek(): number {
    return 5 + 1;
  }

  isWithinTradingHours(date: Date, includeExtendedHours = false): boolean {
    return this.marketHoursService.isMarketOpen(includeExtendedHours, date);
  }

  getNextExpectedKlineTime(lastKlineClose: Date, interval: TimeInterval): Date {
    const intervalMs = TIME_MS[interval];
    let nextTime = new Date(lastKlineClose.getTime() + intervalMs);

    for (let i = 0; i < 10; i++) {
      if (this.isWithinTradingHours(nextTime, true)) {
        return nextTime;
      }
      nextTime = this.marketHoursService.getNextMarketOpen(nextTime);
    }

    return nextTime;
  }
}

export const gapClassifier = new GapClassifier();
