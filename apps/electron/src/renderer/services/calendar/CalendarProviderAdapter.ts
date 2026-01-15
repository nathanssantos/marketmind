import type { CalendarEventQuery, CalendarProvider, MarketEvent } from '@marketmind/types';

export interface CalendarProviderAdapter {
  readonly id: string;
  readonly name: string;

  initialize(config: CalendarProvider): Promise<void>;

  getEvents(query: CalendarEventQuery): Promise<MarketEvent[]>;

  isAvailable(): boolean;

  getSupportedEventTypes(): string[];
}

export abstract class BaseCalendarProvider implements CalendarProviderAdapter {
  abstract readonly id: string;
  abstract readonly name: string;

  protected config: CalendarProvider | null = null;
  protected initialized = false;

  async initialize(config: CalendarProvider): Promise<void> {
    this.config = config;
    this.initialized = true;
  }

  abstract getEvents(query: CalendarEventQuery): Promise<MarketEvent[]>;

  isAvailable(): boolean {
    return this.initialized && (this.config?.enabled ?? false);
  }

  abstract getSupportedEventTypes(): string[];
}
