import {
  US_MARKET_REGULAR_SESSION,
  US_MARKET_EXTENDED_HOURS,
  NYSE_HOLIDAYS_2025,
  NYSE_EARLY_CLOSES_2025,
} from './constants';
import type { MarketSession, MarketCalendar } from './types';

export type SessionType = 'PRE_MARKET' | 'REGULAR' | 'AFTER_HOURS' | 'CLOSED';

export interface MarketStatus {
  isOpen: boolean;
  sessionType: SessionType;
  currentSession?: MarketSession;
  nextOpen?: Date;
  nextClose?: Date;
  isHoliday: boolean;
  isEarlyClose: boolean;
  earlyCloseTime?: string;
}

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

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const parts = timeStr.split(':');
  return {
    hours: parseInt(parts[0] ?? '0', 10),
    minutes: parseInt(parts[1] ?? '0', 10),
  };
};

const getTimeInMinutes = (hours: number, minutes: number): number => {
  return hours * 60 + minutes;
};

const getNYTime = (date: Date = new Date()): { hours: number; minutes: number; dayOfWeek: number; dateKey: string } => {
  const nyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = nyFormatter.formatToParts(date);
  const getValue = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';

  const hours = parseInt(getValue('hour'), 10);
  const minutes = parseInt(getValue('minute'), 10);
  const weekday = getValue('weekday');
  const year = getValue('year');
  const month = getValue('month');
  const day = getValue('day');

  const dayOfWeekMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    hours,
    minutes,
    dayOfWeek: dayOfWeekMap[weekday] ?? 0,
    dateKey: `${year}-${month}-${day}`,
  };
};

export class MarketHoursService {
  private calendar: MarketCalendar;

  constructor(calendar: MarketCalendar = NYSE_CALENDAR) {
    this.calendar = calendar;
  }

  isHoliday(date: Date = new Date()): boolean {
    return this.calendar.holidays.some((holiday) => isSameDay(date, holiday));
  }

  isEarlyCloseDay(date: Date = new Date()): boolean {
    const dateKey = formatDateKey(date);
    return this.calendar.earlyCloses.has(dateKey);
  }

  getEarlyCloseTime(date: Date = new Date()): string | undefined {
    const dateKey = formatDateKey(date);
    return this.calendar.earlyCloses.get(dateKey);
  }

  isWeekend(date: Date = new Date()): boolean {
    const { dayOfWeek } = getNYTime(date);
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  getCurrentSession(date: Date = new Date()): SessionType {
    if (this.isWeekend(date) || this.isHoliday(date)) {
      return 'CLOSED';
    }

    const { hours, minutes, dateKey } = getNYTime(date);
    const currentMinutes = getTimeInMinutes(hours, minutes);

    const regularOpen = parseTime(US_MARKET_REGULAR_SESSION.open);
    const regularOpenMinutes = getTimeInMinutes(regularOpen.hours, regularOpen.minutes);

    let regularCloseMinutes = getTimeInMinutes(
      parseTime(US_MARKET_REGULAR_SESSION.close).hours,
      parseTime(US_MARKET_REGULAR_SESSION.close).minutes
    );

    const earlyClose = this.calendar.earlyCloses.get(dateKey);
    if (earlyClose) {
      const earlyCloseTime = parseTime(earlyClose);
      regularCloseMinutes = getTimeInMinutes(earlyCloseTime.hours, earlyCloseTime.minutes);
    }

    const preMarketOpen = parseTime(US_MARKET_EXTENDED_HOURS.preMarket.open);
    const preMarketOpenMinutes = getTimeInMinutes(preMarketOpen.hours, preMarketOpen.minutes);

    const afterHoursClose = parseTime(US_MARKET_EXTENDED_HOURS.afterHours.close);
    const afterHoursCloseMinutes = getTimeInMinutes(afterHoursClose.hours, afterHoursClose.minutes);

    if (currentMinutes >= preMarketOpenMinutes && currentMinutes < regularOpenMinutes) {
      return 'PRE_MARKET';
    }

    if (currentMinutes >= regularOpenMinutes && currentMinutes < regularCloseMinutes) {
      return 'REGULAR';
    }

    if (currentMinutes >= regularCloseMinutes && currentMinutes < afterHoursCloseMinutes) {
      return 'AFTER_HOURS';
    }

    return 'CLOSED';
  }

  isMarketOpen(includeExtendedHours = false, date: Date = new Date()): boolean {
    const session = this.getCurrentSession(date);

    if (session === 'REGULAR') return true;
    if (includeExtendedHours && (session === 'PRE_MARKET' || session === 'AFTER_HOURS')) return true;

    return false;
  }

  getMarketStatus(date: Date = new Date()): MarketStatus {
    const sessionType = this.getCurrentSession(date);
    const isHoliday = this.isHoliday(date);
    const isEarlyClose = this.isEarlyCloseDay(date);
    const earlyCloseTime = this.getEarlyCloseTime(date);

    const currentSession = this.calendar.sessions.find((s) => s.name === sessionType);

    return {
      isOpen: sessionType === 'REGULAR',
      sessionType,
      currentSession,
      nextOpen: sessionType === 'CLOSED' ? this.getNextMarketOpen(date) : undefined,
      nextClose: sessionType !== 'CLOSED' ? this.getNextMarketClose(date) : undefined,
      isHoliday,
      isEarlyClose,
      earlyCloseTime,
    };
  }

  getNextMarketOpen(date: Date = new Date()): Date {
    const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    let checkDate = new Date(nyDate);

    const { hours, minutes } = getNYTime(date);
    const currentMinutes = getTimeInMinutes(hours, minutes);
    const regularOpen = parseTime(US_MARKET_REGULAR_SESSION.open);
    const regularOpenMinutes = getTimeInMinutes(regularOpen.hours, regularOpen.minutes);

    if (currentMinutes >= regularOpenMinutes && !this.isWeekend(date) && !this.isHoliday(date)) {
      checkDate.setDate(checkDate.getDate() + 1);
    }

    for (let i = 0; i < 10; i++) {
      if (!this.isWeekend(checkDate) && !this.isHoliday(checkDate)) {
        const result = new Date(checkDate);
        result.setHours(regularOpen.hours, regularOpen.minutes, 0, 0);
        return result;
      }
      checkDate.setDate(checkDate.getDate() + 1);
    }

    const fallback = new Date(checkDate);
    fallback.setHours(regularOpen.hours, regularOpen.minutes, 0, 0);
    return fallback;
  }

  getNextMarketClose(date: Date = new Date()): Date {
    const nyDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const { dateKey } = getNYTime(date);

    const earlyClose = this.calendar.earlyCloses.get(dateKey);
    const closeTime = earlyClose
      ? parseTime(earlyClose)
      : parseTime(US_MARKET_REGULAR_SESSION.close);

    const result = new Date(nyDate);
    result.setHours(closeTime.hours, closeTime.minutes, 0, 0);
    return result;
  }

  getSessionsForDate(date: Date = new Date()): MarketSession[] {
    if (this.isWeekend(date) || this.isHoliday(date)) {
      return [];
    }

    const { dateKey } = getNYTime(date);
    const earlyClose = this.calendar.earlyCloses.get(dateKey);

    if (earlyClose) {
      return this.calendar.sessions.map((session) => {
        if (session.name === 'REGULAR') {
          return { ...session, close: earlyClose };
        }
        if (session.name === 'AFTER_HOURS') {
          return { ...session, open: earlyClose };
        }
        return session;
      });
    }

    return this.calendar.sessions;
  }

  getTradingHoursString(date: Date = new Date()): string {
    const sessions = this.getSessionsForDate(date);
    if (sessions.length === 0) {
      return 'Market Closed';
    }

    const regular = sessions.find((s) => s.isCore);
    if (regular) {
      return `${regular.open} - ${regular.close} ET`;
    }

    return 'Market Closed';
  }
}

export const marketHoursService = new MarketHoursService();
