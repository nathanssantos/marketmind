import type { CalendarEventQuery, MarketEvent } from '@marketmind/types';
import { BACKEND_TRPC_URL } from '@shared/constants/api';
import { BaseCalendarProvider } from './CalendarProviderAdapter';

interface EconomicEventResponse {
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

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export class EconomicCalendarProvider extends BaseCalendarProvider {
  readonly id = 'economic-calendar';
  readonly name = 'Economic Calendar';

  override async initialize(): Promise<void> {
    this.initialized = true;
  }

  override async getEvents(query: CalendarEventQuery): Promise<MarketEvent[]> {
    try {
      const from = formatDate(query.startTime);
      const to = formatDate(query.endTime);
      const input = encodeURIComponent(JSON.stringify({ from, to }));
      const url = `${BACKEND_TRPC_URL}/economicCalendar.getEvents?input=${input}`;

      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) return [];

      const json = await response.json();
      const events: EconomicEventResponse[] = json.result?.data ?? [];

      return events.map((e) => ({
        id: e.id,
        type: 'economic_event' as const,
        timestamp: e.timestamp,
        title: e.event,
        icon: e.icon,
        priority: e.priority,
        source: 'economic-calendar',
        metadata: {
          country: e.country,
          actual: e.actual,
          estimate: e.estimate,
          previous: e.previous,
          unit: e.unit,
          impact: e.impact,
        },
      }));
    } catch {
      return [];
    }
  }

  override isAvailable(): boolean {
    return true;
  }

  override getSupportedEventTypes(): string[] {
    return ['economic_event'];
  }
}
