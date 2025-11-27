import { CalendarService } from '@renderer/services/calendar/CalendarService';
import { CoinGeckoCalendarProvider } from '@renderer/services/calendar/providers/CoinGeckoCalendarProvider';
import type {
    CalendarEvent,
    CalendarSettings,
    EventImportance,
    EventsFilter,
} from '@shared/types';
import { useCallback, useEffect, useRef, useState } from 'react';

let defaultCalendarService: CalendarService | null = null;

const DEFAULT_SETTINGS: CalendarSettings = {
  enabled: false,
  showOnChart: true,
  minImportanceForChart: 'medium',
  daysAhead: 30,
  daysBehind: 7,
  correlateWithAI: false,
};

export const useCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [initialized, setInitialized] = useState(false);
  
  const calendarServiceRef = useRef<CalendarService | null>(null);
  const refetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadSettings = useCallback(async () => {
    try {
      const storedSettings = localStorage.getItem('marketmind-calendar-settings');
      if (storedSettings) {
        const parsed = JSON.parse(storedSettings);
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (err) {
      console.error('[useCalendar] Failed to load settings:', err);
    }
  }, []);

  const saveSettings = useCallback(async (newSettings: CalendarSettings) => {
    try {
      localStorage.setItem('marketmind-calendar-settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (err) {
      console.error('[useCalendar] Failed to save settings:', err);
    }
  }, []);

  const initializeCalendarService = useCallback(async (): Promise<CalendarService> => {
    if (defaultCalendarService) {
      return defaultCalendarService;
    }

    const coinGeckoProvider = new CoinGeckoCalendarProvider({});

    defaultCalendarService = new CalendarService({
      primaryProvider: coinGeckoProvider,
      fallbackProviders: [],
      defaultCacheDuration: 600000,
    });

    return defaultCalendarService;
  }, []);

  const fetchEvents = useCallback(async (filter: EventsFilter = {}) => {
    if (!settings.enabled) {
      console.log('[useCalendar] Calendar disabled, skipping fetch');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (!calendarServiceRef.current) {
        calendarServiceRef.current = await initializeCalendarService();
      }

      const now = Date.now();
      const from = now - (settings.daysBehind * 24 * 60 * 60 * 1000);
      const to = now + (settings.daysAhead * 24 * 60 * 60 * 1000);

      const response = await calendarServiceRef.current.fetchEvents({
        from,
        to,
        includePast: settings.daysBehind > 0,
        ...filter,
      });

      let filteredEvents = response.events;

      if (Object.keys(filter).length > 0) {
        filteredEvents = calendarServiceRef.current.filterEvents(response.events, filter);
      }

      setEvents(filteredEvents);
      setError(null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch events');
      setError(error);
      console.error('[useCalendar] Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }, [settings, initializeCalendarService]);

  const getChartEvents = useCallback((symbols?: string[]): CalendarEvent[] => {
    if (!settings.showOnChart || !settings.enabled) {
      return [];
    }

    const importanceLevel = {
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4,
    };

    return events.filter(event => {
      if (importanceLevel[event.importance] < importanceLevel[settings.minImportanceForChart]) {
        return false;
      }

      if (symbols && symbols.length > 0) {
        if (!event.symbols?.some(s => symbols.includes(s))) {
          return false;
        }
      }

      return true;
    });
  }, [events, settings]);

  const filterEvents = useCallback((filter: EventsFilter): CalendarEvent[] => {
    if (!calendarServiceRef.current) return events;
    return calendarServiceRef.current.filterEvents(events, filter);
  }, [events]);

  const toggleEnabled = useCallback(() => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const toggleShowOnChart = useCallback(() => {
    const newSettings = { ...settings, showOnChart: !settings.showOnChart };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const setMinImportanceForChart = useCallback((importance: EventImportance) => {
    const newSettings = { ...settings, minImportanceForChart: importance };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const setDaysAhead = useCallback((days: number) => {
    const newSettings = { ...settings, daysAhead: Math.max(1, Math.min(90, days)) };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const setDaysBehind = useCallback((days: number) => {
    const newSettings = { ...settings, daysBehind: Math.max(0, Math.min(90, days)) };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const toggleCorrelateWithAI = useCallback(() => {
    const newSettings = { ...settings, correlateWithAI: !settings.correlateWithAI };
    saveSettings(newSettings);
  }, [settings, saveSettings]);

  const setupPolling = useCallback(() => {
    if (refetchIntervalRef.current) {
      clearInterval(refetchIntervalRef.current);
      refetchIntervalRef.current = null;
    }

    if (settings.enabled) {
      refetchIntervalRef.current = setInterval(() => {
        console.log('[useCalendar] Auto-refetching events');
        fetchEvents();
      }, 3600000);
    }
  }, [settings.enabled, fetchEvents]);

  useEffect(() => {
    const initialize = async () => {
      await loadSettings();
      setInitialized(true);
    };
    initialize();
  }, [loadSettings]);

  useEffect(() => {
    if (initialized && settings.enabled) {
      fetchEvents();
      setupPolling();
    }

    return () => {
      if (refetchIntervalRef.current) {
        clearInterval(refetchIntervalRef.current);
      }
    };
  }, [initialized, settings.enabled, fetchEvents, setupPolling]);

  return {
    events,
    loading,
    error,
    settings,
    
    fetchEvents,
    getChartEvents,
    filterEvents,
    
    toggleEnabled,
    toggleShowOnChart,
    toggleCorrelateWithAI,
    setMinImportanceForChart,
    setDaysAhead,
    setDaysBehind,
    saveSettings,
  };
};
