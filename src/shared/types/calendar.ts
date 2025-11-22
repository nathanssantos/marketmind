export type EventType = 'conference' | 'release' | 'airdrop' | 'update' | 'listing' | 'partnership' | 'other';

export type EventImportance = 'low' | 'medium' | 'high' | 'critical';

export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  type: EventType;
  importance: EventImportance;
  startDate: number;
  endDate?: number;
  symbols?: string[];
  url?: string;
  source: string;
  location?: string;
  isPast: boolean;
}

export interface FetchEventsOptions {
  symbols?: string[];
  type?: EventType;
  importance?: EventImportance;
  from?: number;
  to?: number;
  limit?: number;
  includePast?: boolean;
}

export interface CalendarProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  rateLimitPerSecond?: number;
  cacheDuration?: number;
}

export interface EventsResponse {
  events: CalendarEvent[];
  totalResults: number;
  page?: number;
  pageSize?: number;
}

export abstract class BaseCalendarProvider {
  protected config: CalendarProviderConfig;
  protected name: string;

  constructor(name: string, config: CalendarProviderConfig) {
    this.name = name;
    this.config = config;
  }

  abstract fetchEvents(options: FetchEventsOptions): Promise<EventsResponse>;
  
  getName(): string {
    return this.name;
  }
  
  getConfig(): CalendarProviderConfig {
    return this.config;
  }
}

export interface CalendarServiceConfig {
  primaryProvider: BaseCalendarProvider;
  fallbackProviders?: BaseCalendarProvider[];
  defaultCacheDuration?: number;
}

export interface CalendarCacheEntry {
  data: EventsResponse;
  timestamp: number;
  expiresAt: number;
}

export interface EventsFilter {
  type?: EventType;
  importance?: EventImportance;
  symbols?: string[];
  searchQuery?: string;
  dateFrom?: number;
  dateTo?: number;
  includePast?: boolean;
}

export interface CalendarSettings {
  enabled: boolean;
  showOnChart: boolean;
  minImportanceForChart: EventImportance;
  daysAhead: number;
  daysBehind: number;
  correlateWithAI: boolean;
}
