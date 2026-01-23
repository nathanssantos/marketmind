export type MarketEventType = 'market_open' | 'market_close' | 'economic_event' | 'earnings' | 'dividend' | 'custom';
export type EventIconType = 'flag' | 'emoji' | 'image' | 'icon';
export interface EventIcon {
    type: EventIconType;
    value: string;
}
export type EventPriority = 'low' | 'medium' | 'high' | 'critical';
export interface MarketEvent {
    id: string;
    type: MarketEventType;
    timestamp: number;
    endTimestamp?: number;
    title: string;
    description?: string;
    icon: EventIcon;
    priority: EventPriority;
    source: string;
    metadata?: Record<string, unknown>;
}
export interface MarketSession {
    id: string;
    name: string;
    shortName: string;
    country: string;
    timezone: string;
    openTime: {
        hour: number;
        minute: number;
    };
    closeTime: {
        hour: number;
        minute: number;
    };
    lunchBreak?: {
        start: {
            hour: number;
            minute: number;
        };
        end: {
            hour: number;
            minute: number;
        };
    };
    tradingDays: number[];
    icon: EventIcon;
    enabled: boolean;
}
export interface CalendarEventQuery {
    startTime: number;
    endTime: number;
    types?: MarketEventType[];
    sources?: string[];
    symbols?: string[];
}
export interface CalendarProvider {
    id: string;
    name: string;
    enabled: boolean;
    apiKey?: string;
    baseUrl?: string;
}
export interface CalendarServiceConfig {
    providers: CalendarProvider[];
    cacheTimeout: number;
    maxEventsPerDay: number;
}
//# sourceMappingURL=events.d.ts.map