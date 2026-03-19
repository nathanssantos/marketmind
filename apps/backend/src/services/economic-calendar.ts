import { logger } from './logger';

export interface EconomicEvent {
  id: string;
  event: string;
  country: string;
  timestamp: number;
  impact: number;
  actual: string | null;
  estimate: string | null;
  previous: string | null;
  unit: string;
  currency: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  icon: { type: 'emoji'; value: string };
}

interface FinnhubEconomicEvent {
  actual?: number | null;
  country: string;
  estimate?: number | null;
  event: string;
  impact: number;
  prev?: number | null;
  time: string;
  unit: string;
  currency?: string;
}

interface FinnhubResponse {
  economicCalendar?: FinnhubEconomicEvent[];
}

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1/calendar/economic';
const CACHE_TTL = 3_600_000;

const CRITICAL_PATTERNS = [/\bFOMC\b/i, /\bFed Interest Rate\b/i, /\bFederal Funds Rate\b/i];
const HIGH_PATTERNS = [
  /\bCPI\b/i, /\bNon-?Farm Payroll/i, /\bNFP\b/i, /\bGDP\b/i, /\bPCE\b/i,
  /\bUnemployment Rate\b/i, /\bPPI\b/i, /\bRetail Sales\b/i,
];
const FED_PATTERNS = [/\bFed\b/i, /\bFOMC\b/i, /\bFederal\b/i];
const INFLATION_PATTERNS = [/\bCPI\b/i, /\bPPI\b/i, /\binflation\b/i];
const EMPLOYMENT_PATTERNS = [/\bNon-?Farm/i, /\bNFP\b/i, /\bemployment\b/i, /\bjobless\b/i, /\bUnemployment\b/i];
const GDP_PATTERNS = [/\bGDP\b/i];

const matchesAny = (text: string, patterns: RegExp[]): boolean =>
  patterns.some((p) => p.test(text));

const getPriority = (event: string, impact: number): EconomicEvent['priority'] => {
  if (matchesAny(event, CRITICAL_PATTERNS)) return 'critical';
  if (matchesAny(event, HIGH_PATTERNS)) return 'high';
  if (impact >= 3) return 'medium';
  return 'low';
};

const getIcon = (event: string): EconomicEvent['icon'] => {
  if (matchesAny(event, FED_PATTERNS)) return { type: 'emoji', value: '\u{1F3DB}\uFE0F' };
  if (matchesAny(event, INFLATION_PATTERNS)) return { type: 'emoji', value: '\u{1F4CA}' };
  if (matchesAny(event, EMPLOYMENT_PATTERNS)) return { type: 'emoji', value: '\u{1F4BC}' };
  if (matchesAny(event, GDP_PATTERNS)) return { type: 'emoji', value: '\u{1F4B0}' };
  return { type: 'emoji', value: '\u{1F4C5}' };
};

const formatValue = (value: number | null | undefined, unit: string): string | null => {
  if (value === null || value === undefined) return null;
  return unit === '%' ? `${value}%` : `${value}${unit ? ` ${unit}` : ''}`;
};

const parseTimestamp = (date: string, time: string): number => {
  const t = time || '12:00:00';
  return new Date(`${date}T${t}Z`).getTime();
};

export class EconomicCalendarService {
  private cache: { data: EconomicEvent[]; from: string; to: string; timestamp: number } | null = null;

  async getEvents(from: string, to: string): Promise<EconomicEvent[]> {
    const cached = this.getFromCache(from, to);
    if (cached) return cached;

    const apiKey = process.env['FINNHUB_API_KEY'];
    if (!apiKey) {
      logger.warn('FINNHUB_API_KEY not set, economic calendar disabled');
      return [];
    }

    try {
      const url = `${FINNHUB_BASE_URL}?from=${from}&to=${to}&token=${apiKey}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });

      if (!response.ok) {
        logger.warn({ status: response.status }, 'Failed to fetch economic calendar from Finnhub');
        return [];
      }

      const json = (await response.json()) as FinnhubResponse;
      const rawEvents = json.economicCalendar ?? [];

      const events: EconomicEvent[] = rawEvents
        .filter((e) => e.country === 'US')
        .map((e, i) => ({
          id: `finnhub-${from}-${i}`,
          event: e.event,
          country: e.country,
          timestamp: parseTimestamp(from, e.time),
          impact: e.impact,
          actual: formatValue(e.actual, e.unit),
          estimate: formatValue(e.estimate, e.unit),
          previous: formatValue(e.prev, e.unit),
          unit: e.unit,
          currency: e.currency ?? 'USD',
          priority: getPriority(e.event, e.impact),
          icon: getIcon(e.event),
        }));

      this.setCache(from, to, events);
      return events;
    } catch (error) {
      logger.error({ error }, 'Error fetching economic calendar');
      return [];
    }
  }

  private getFromCache(from: string, to: string): EconomicEvent[] | null {
    if (!this.cache) return null;
    if (this.cache.from !== from || this.cache.to !== to) return null;
    if (Date.now() - this.cache.timestamp > CACHE_TTL) return null;
    return this.cache.data;
  }

  private setCache(from: string, to: string, data: EconomicEvent[]): void {
    this.cache = { data, from, to, timestamp: Date.now() };
  }

  clearCache(): void {
    this.cache = null;
  }
}

let economicCalendarService: EconomicCalendarService | null = null;

export const getEconomicCalendarService = (): EconomicCalendarService => {
  if (!economicCalendarService) {
    economicCalendarService = new EconomicCalendarService();
  }
  return economicCalendarService;
};
