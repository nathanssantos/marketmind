export interface SessionDefinition {
  id: string;
  name: string;
  timezone: string;
  preScanTime: string;
  sessionOpen: string;
  sessionClose: string;
  daysOfWeek: number[];
  defaultPresets: string[];
}

export const SESSION_REGISTRY: SessionDefinition[] = [
  {
    id: 'US_NYSE',
    name: 'US NYSE',
    timezone: 'America/New_York',
    preScanTime: '08:30',
    sessionOpen: '09:30',
    sessionClose: '16:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    defaultPresets: ['best-for-long', 'best-for-short', 'momentum-leaders', 'volume-spike'],
  },
  {
    id: 'CHINA_SSE',
    name: 'China SSE',
    timezone: 'Asia/Shanghai',
    preScanTime: '08:30',
    sessionOpen: '09:30',
    sessionClose: '15:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    defaultPresets: ['best-for-long', 'best-for-short', 'volume-spike'],
  },
  {
    id: 'JAPAN_TSE',
    name: 'Japan TSE',
    timezone: 'Asia/Tokyo',
    preScanTime: '08:00',
    sessionOpen: '09:00',
    sessionClose: '15:00',
    daysOfWeek: [1, 2, 3, 4, 5],
    defaultPresets: ['best-for-long', 'best-for-short', 'volume-spike'],
  },
  {
    id: 'UK_LSE',
    name: 'UK LSE',
    timezone: 'Europe/London',
    preScanTime: '07:00',
    sessionOpen: '08:00',
    sessionClose: '16:30',
    daysOfWeek: [1, 2, 3, 4, 5],
    defaultPresets: ['best-for-long', 'best-for-short', 'momentum-leaders'],
  },
  {
    id: 'CRYPTO',
    name: 'Crypto',
    timezone: 'UTC',
    preScanTime: '00:00',
    sessionOpen: '00:00',
    sessionClose: '23:59',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    defaultPresets: ['best-for-long', 'best-for-short', 'momentum-leaders', 'volume-spike', 'straight-line-movers'],
  },
];

const parseTime = (timeStr: string): { hours: number; minutes: number } => {
  const [h, m] = timeStr.split(':');
  return { hours: parseInt(h ?? '0', 10), minutes: parseInt(m ?? '0', 10) };
};

const getTimeInTimezone = (timezone: string, date: Date = new Date()): { hours: number; minutes: number; dayOfWeek: number } => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    weekday: 'short',
  });

  const parts = formatter.formatToParts(date);
  const getValue = (type: string): string => parts.find((p) => p.type === type)?.value ?? '0';

  const dayOfWeekMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    hours: parseInt(getValue('hour'), 10),
    minutes: parseInt(getValue('minute'), 10),
    dayOfWeek: dayOfWeekMap[getValue('weekday')] ?? 0,
  };
};

export type SessionStatus = 'pre_scan' | 'open' | 'closed';

export const getSessionStatus = (session: SessionDefinition, date: Date = new Date()): SessionStatus => {
  const { hours, minutes, dayOfWeek } = getTimeInTimezone(session.timezone, date);
  if (!session.daysOfWeek.includes(dayOfWeek)) return 'closed';

  const currentMinutes = hours * 60 + minutes;
  const preScan = parseTime(session.preScanTime);
  const open = parseTime(session.sessionOpen);
  const close = parseTime(session.sessionClose);

  const preScanMinutes = preScan.hours * 60 + preScan.minutes;
  const openMinutes = open.hours * 60 + open.minutes;
  const closeMinutes = close.hours * 60 + close.minutes;

  if (session.id === 'CRYPTO') return 'open';
  if (currentMinutes >= preScanMinutes && currentMinutes < openMinutes) return 'pre_scan';
  if (currentMinutes >= openMinutes && currentMinutes < closeMinutes) return 'open';
  return 'closed';
};

export const getActiveSessions = (date: Date = new Date()): Array<SessionDefinition & { status: SessionStatus }> =>
  SESSION_REGISTRY
    .map((s) => ({ ...s, status: getSessionStatus(s, date) }))
    .filter((s) => s.status !== 'closed');

export const getSessionById = (id: string): SessionDefinition | undefined =>
  SESSION_REGISTRY.find((s) => s.id === id);
