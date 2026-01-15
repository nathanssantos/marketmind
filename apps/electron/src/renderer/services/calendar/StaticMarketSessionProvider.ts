import type { CalendarEventQuery, MarketEvent, MarketSession } from '@marketmind/types';
import { getEnabledSessions } from '@shared/constants/marketSessions';
import { BaseCalendarProvider } from './CalendarProviderAdapter';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const timezoneOffsetCache = new Map<string, number>();

const getTimezoneOffset = (timezone: string, date: Date): number => {
  const cacheKey = `${timezone}-${date.getFullYear()}-${date.getMonth()}`;
  const cached = timezoneOffsetCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
  const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
  const offset = utcDate.getTime() - tzDate.getTime();

  timezoneOffsetCache.set(cacheKey, offset);
  return offset;
};

const createTimestamp = (
  date: Date,
  time: { hour: number; minute: number },
  timezone: string,
): number => {
  const localDate = new Date(date);
  localDate.setHours(time.hour, time.minute, 0, 0);

  const localOffsetMs = localDate.getTimezoneOffset() * 60 * 1000;
  const tzOffsetMs = getTimezoneOffset(timezone, localDate);

  return localDate.getTime() + tzOffsetMs - localOffsetMs;
};

const formatDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const generateSessionEvents = (
  session: MarketSession,
  startTime: number,
  endTime: number,
): MarketEvent[] => {
  const events: MarketEvent[] = [];
  const startDate = new Date(startTime);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(endTime);
  endDate.setHours(23, 59, 59, 999);

  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);

  for (let i = 0; i < totalDays; i++) {
    const currentDate = new Date(startDate.getTime() + i * MS_PER_DAY);
    const dayOfWeek = currentDate.getDay();

    if (!session.tradingDays.includes(dayOfWeek)) continue;

    const openTimestamp = createTimestamp(currentDate, session.openTime, session.timezone);
    const closeTimestamp = createTimestamp(currentDate, session.closeTime, session.timezone);

    if (openTimestamp > endTime || closeTimestamp < startTime) continue;

    const dateKey = formatDateKey(currentDate);

    if (openTimestamp >= startTime && openTimestamp <= endTime) {
      events.push({
        id: `${session.id}-open-${dateKey}`,
        type: 'market_open',
        timestamp: openTimestamp,
        title: `${session.shortName} Open`,
        description: `${session.name} market opens`,
        icon: session.icon,
        priority: 'medium',
        source: 'static-market-sessions',
        metadata: {
          sessionId: session.id,
          country: session.country,
          timezone: session.timezone,
        },
      });
    }

    if (closeTimestamp >= startTime && closeTimestamp <= endTime) {
      events.push({
        id: `${session.id}-close-${dateKey}`,
        type: 'market_close',
        timestamp: closeTimestamp,
        title: `${session.shortName} Close`,
        description: `${session.name} market closes`,
        icon: session.icon,
        priority: 'medium',
        source: 'static-market-sessions',
        metadata: {
          sessionId: session.id,
          country: session.country,
          timezone: session.timezone,
        },
      });
    }
  }

  return events;
};

export class StaticMarketSessionProvider extends BaseCalendarProvider {
  readonly id = 'static-market-sessions';
  readonly name = 'Static Market Sessions';

  private sessions: MarketSession[] = [];

  override async initialize(): Promise<void> {
    this.sessions = getEnabledSessions();
    this.initialized = true;
  }

  override async getEvents(query: CalendarEventQuery): Promise<MarketEvent[]> {
    if (!this.initialized) await this.initialize();

    const { startTime, endTime, types } = query;
    const allEvents: MarketEvent[] = [];

    for (const session of this.sessions) {
      const sessionEvents = generateSessionEvents(session, startTime, endTime);
      allEvents.push(...sessionEvents);
    }

    const filteredEvents = types
      ? allEvents.filter((event) => types.includes(event.type))
      : allEvents;

    return filteredEvents.sort((a, b) => a.timestamp - b.timestamp);
  }

  override isAvailable(): boolean {
    return true;
  }

  override getSupportedEventTypes(): string[] {
    return ['market_open', 'market_close'];
  }

  setSessions(sessions: MarketSession[]): void {
    this.sessions = sessions;
  }
}
