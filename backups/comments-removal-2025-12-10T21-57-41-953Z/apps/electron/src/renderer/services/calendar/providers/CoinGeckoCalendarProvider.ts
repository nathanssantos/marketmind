import {
    BaseCalendarProvider,
    type CalendarEvent,
    type CalendarProviderConfig,
    type EventsResponse,
    type FetchEventsOptions,
} from '@marketmind/types';

interface CoinGeckoEvent {
  type: string;
  title: string;
  description: string;
  organizer: string;
  start_date: string;
  end_date: string;
  website: string;
  email: string;
  venue: string;
  address: string;
  city: string;
  country: string;
  screenshot: string;
}

interface CoinGeckoEventsResponse {
  data: CoinGeckoEvent[];
  count: number;
  page: number;
}

export class CoinGeckoCalendarProvider extends BaseCalendarProvider {
  private lastRequestTime = 0;
  private requestInterval: number;

  constructor(config: CalendarProviderConfig) {
    super('CoinGecko', {
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimitPerSecond: 10,
      cacheDuration: 3600000,
      ...config,
    });

    this.requestInterval = 1000 / (this.config.rateLimitPerSecond || 10);
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.requestInterval) {
      const waitTime = this.requestInterval - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
  }

  private mapEventType(type: string): CalendarEvent['type'] {
    const lowerType = type.toLowerCase();
    if (lowerType.includes('conference')) return 'conference';
    if (lowerType.includes('release')) return 'release';
    if (lowerType.includes('airdrop')) return 'airdrop';
    if (lowerType.includes('update')) return 'update';
    if (lowerType.includes('listing')) return 'listing';
    if (lowerType.includes('partnership')) return 'partnership';
    return 'other';
  }

  private calculateImportance(event: CoinGeckoEvent): CalendarEvent['importance'] {
    const title = event.title.toLowerCase();
    const type = event.type.toLowerCase();
    
    if (title.includes('launch') || title.includes('mainnet') || type.includes('conference')) {
      return 'high';
    }
    if (title.includes('update') || title.includes('release')) {
      return 'medium';
    }
    return 'low';
  }

  private normalizeEvent(event: CoinGeckoEvent): CalendarEvent {
    const startDate = new Date(event.start_date).getTime();
    const endDate = event.end_date ? new Date(event.end_date).getTime() : undefined;
    const now = Date.now();

    const calendarEvent: CalendarEvent = {
      id: `coingecko-${event.title}-${startDate}`,
      title: event.title,
      description: event.description,
      type: this.mapEventType(event.type),
      importance: this.calculateImportance(event),
      startDate,
      url: event.website,
      source: 'CoinGecko',
      isPast: startDate < now,
    };

    if (endDate !== undefined) {
      calendarEvent.endDate = endDate;
    }

    if (event.city && event.country) {
      calendarEvent.location = `${event.city}, ${event.country}`;
    }

    return calendarEvent;
  }

  async fetchEvents(options: FetchEventsOptions): Promise<EventsResponse> {
    await this.enforceRateLimit();

    const params: Record<string, string | number> = {
      page: 1,
      per_page: options.limit || 50,
    };

    if (options.from) {
      const fromDate = new Date(options.from).toISOString().split('T')[0];
      if (fromDate) {
        params['from_date'] = fromDate;
      }
    }

    if (options.to) {
      const toDate = new Date(options.to).toISOString().split('T')[0];
      if (toDate) {
        params['to_date'] = toDate;
      }
    }

    if (options.type) {
      params['type'] = options.type;
    }

    try {
      const queryString = new URLSearchParams(
        Object.entries(params).map(([key, value]) => [key, String(value)])
      ).toString();
      
      const baseUrl = this.config.baseUrl || 'https://api.coingecko.com/api/v3';
      const url = `${baseUrl}/events?${queryString}`;

      console.log('[CoinGecko Calendar] Fetching events from:', url);

      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error('CoinGecko: Rate limit exceeded');
        }
        throw new Error(`CoinGecko request failed: ${response.statusText}`);
      }

      const data = await response.json() as CoinGeckoEventsResponse;
      
      let events = data.data.map((event) => this.normalizeEvent(event));

      if (!options.includePast) {
        const now = Date.now();
        events = events.filter(e => e.startDate >= now);
      }

      if (options.importance) {
        const importanceLevel = {
          'low': 1,
          'medium': 2,
          'high': 3,
          'critical': 4,
        };
        const minLevel = importanceLevel[options.importance];
        events = events.filter(e => importanceLevel[e.importance] >= minLevel);
      }

      console.log('[CoinGecko Calendar] Successfully fetched', events.length, 'events');

      return {
        events,
        totalResults: data.count,
        page: data.page,
        pageSize: options.limit || 50,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('CoinGecko request failed: Unknown error');
    }
  }
}
