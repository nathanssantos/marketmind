import type {
    BaseCalendarProvider,
    CalendarCacheEntry,
    CalendarEvent,
    CalendarServiceConfig,
    EventsFilter,
    EventsResponse,
    FetchEventsOptions,
} from '@shared/types';

export class CalendarService {
  private primaryProvider: BaseCalendarProvider;
  private fallbackProviders: BaseCalendarProvider[];
  private cache: Map<string, CalendarCacheEntry> = new Map();
  private defaultCacheDuration: number;

  constructor(config: CalendarServiceConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProviders = config.fallbackProviders || [];
    this.defaultCacheDuration = config.defaultCacheDuration || 3600000;
  }

  private getCacheKey(options: FetchEventsOptions): string {
    return JSON.stringify({
      symbols: options.symbols?.sort(),
      type: options.type,
      importance: options.importance,
      from: options.from,
      to: options.to,
      limit: options.limit,
      includePast: options.includePast,
    });
  }

  private getFromCache(key: string): EventsResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache(key: string, data: EventsResponse): void {
    const entry: CalendarCacheEntry = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.defaultCacheDuration,
    };
    this.cache.set(key, entry);
  }

  async fetchEvents(options: FetchEventsOptions = {}): Promise<EventsResponse> {
    const cacheKey = this.getCacheKey(options);
    const cached = this.getFromCache(cacheKey);
    
    if (cached) {
      console.log('[CalendarService] Returning cached events');
      return cached;
    }

    const providers = [this.primaryProvider, ...this.fallbackProviders];
    const errors: Error[] = [];

    for (const provider of providers) {
      try {
        console.log(`[CalendarService] Trying provider: ${provider.getName()}`);
        const response = await provider.fetchEvents(options);
        this.setCache(cacheKey, response);
        return response;
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Unknown error');
        errors.push(err);
        console.warn(`[CalendarService] Provider ${provider.getName()} failed:`, err.message);
      }
    }

    if (errors.length === 1) {
      throw errors[0];
    }

    throw new Error(
      `All calendar providers failed: ${errors.map(e => e.message).join(', ')}`
    );
  }

  filterEvents(events: CalendarEvent[], filter: EventsFilter): CalendarEvent[] {
    return events.filter(event => {
      if (filter.type && event.type !== filter.type) return false;
      if (filter.importance) {
        const importanceLevel = {
          'low': 1,
          'medium': 2,
          'high': 3,
          'critical': 4,
        };
        if (importanceLevel[event.importance] < importanceLevel[filter.importance]) {
          return false;
        }
      }
      if (filter.symbols && filter.symbols.length > 0) {
        if (!event.symbols || !event.symbols.some(s => filter.symbols!.includes(s))) {
          return false;
        }
      }
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const searchText = `${event.title} ${event.description || ''}`.toLowerCase();
        if (!searchText.includes(query)) return false;
      }
      if (filter.dateFrom && event.startDate < filter.dateFrom) return false;
      if (filter.dateTo && event.startDate > filter.dateTo) return false;
      if (!filter.includePast && event.isPast) return false;
      
      return true;
    });
  }

  clearCache(): void {
    this.cache.clear();
  }

  getPrimaryProvider(): BaseCalendarProvider {
    return this.primaryProvider;
  }

  getFallbackProviders(): BaseCalendarProvider[] {
    return this.fallbackProviders;
  }
}
