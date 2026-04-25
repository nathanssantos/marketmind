import type { CalendarEventQuery, CalendarServiceConfig, MarketEvent } from '@marketmind/types';
import type { CalendarProviderAdapter } from './CalendarProviderAdapter';
import { EconomicCalendarProvider } from './EconomicCalendarProvider';
import { StaticMarketSessionProvider } from './StaticMarketSessionProvider';

const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000;
const DEFAULT_MAX_EVENTS_PER_DAY = 50;

interface CacheEntry {
  events: MarketEvent[];
  timestamp: number;
  queryHash: string;
}

const hashQuery = (query: CalendarEventQuery): string =>
  `${query.startTime}-${query.endTime}-${query.types?.join(',') ?? ''}-${query.sources?.join(',') ?? ''}`;

export class CalendarService {
  private providers: Map<string, CalendarProviderAdapter> = new Map();
  private cache: Map<string, CacheEntry> = new Map();
  private config: CalendarServiceConfig;
  private initialized = false;

  constructor(config?: Partial<CalendarServiceConfig>) {
    this.config = {
      providers: config?.providers ?? [],
      cacheTimeout: config?.cacheTimeout ?? DEFAULT_CACHE_TIMEOUT,
      maxEventsPerDay: config?.maxEventsPerDay ?? DEFAULT_MAX_EVENTS_PER_DAY,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const staticProvider = new StaticMarketSessionProvider();
    await staticProvider.initialize();
    this.providers.set(staticProvider.id, staticProvider);

    const economicProvider = new EconomicCalendarProvider();
    await economicProvider.initialize();
    this.providers.set(economicProvider.id, economicProvider);

    for (const providerConfig of this.config.providers) {
      if (providerConfig.enabled && this.providers.has(providerConfig.id)) {
        const provider = this.providers.get(providerConfig.id)!;
        await provider.initialize(providerConfig);
      }
    }

    this.initialized = true;
  }

  registerProvider(provider: CalendarProviderAdapter): void {
    this.providers.set(provider.id, provider);
  }

  unregisterProvider(providerId: string): void {
    this.providers.delete(providerId);
  }

  async getEvents(query: CalendarEventQuery): Promise<MarketEvent[]> {
    if (!this.initialized) await this.initialize();

    const queryHash = hashQuery(query);
    const cached = this.cache.get(queryHash);

    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.events;
    }

    const allEvents: MarketEvent[] = [];
    const targetSources = query.sources ?? Array.from(this.providers.keys());

    for (const providerId of targetSources) {
      const provider = this.providers.get(providerId);
      if (!provider?.isAvailable()) continue;

      try {
        const events = await provider.getEvents(query);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching events from provider ${providerId}:`, error);
      }
    }

    const sortedEvents = allEvents.sort((a, b) => a.timestamp - b.timestamp);
    const deduplicatedEvents = this.deduplicateEvents(sortedEvents);

    this.cache.set(queryHash, {
      events: deduplicatedEvents,
      timestamp: Date.now(),
      queryHash,
    });

    return deduplicatedEvents;
  }

  async getEventsForRange(startTime: number, endTime: number): Promise<MarketEvent[]> {
    return this.getEvents({ startTime, endTime });
  }

  async getEventsForNextWeek(): Promise<MarketEvent[]> {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    return this.getEvents({ startTime: now, endTime: now + oneWeekMs });
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.entries())
      .filter(([_, provider]) => provider.isAvailable())
      .map(([id]) => id);
  }

  getAllSupportedEventTypes(): string[] {
    const types = new Set<string>();
    for (const provider of this.providers.values()) {
      if (provider.isAvailable()) {
        provider.getSupportedEventTypes().forEach((type) => types.add(type));
      }
    }
    return Array.from(types);
  }

  clearCache(): void {
    this.cache.clear();
  }

  private deduplicateEvents(events: MarketEvent[]): MarketEvent[] {
    const seen = new Set<string>();
    return events.filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    });
  }
}

let calendarServiceInstance: CalendarService | null = null;

export const getCalendarService = (): CalendarService => {
  calendarServiceInstance ??= new CalendarService();
  return calendarServiceInstance;
};

export const resetCalendarService = (): void => {
  calendarServiceInstance = null;
};
