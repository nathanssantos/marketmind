import type { Kline, MarketEvent } from '@marketmind/types';
import { getCalendarService } from '@renderer/services/calendar';
import { useCallback, useEffect, useRef, useState } from 'react';

const REFETCH_DEBOUNCE_MS = 500;
const PAST_DAYS_MS = 60 * 24 * 60 * 60 * 1000;
const FUTURE_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export interface UseMarketEventsProps {
  klines: Kline[];
  enabled?: boolean;
}

export interface UseMarketEventsReturn {
  events: MarketEvent[];
  loading: boolean;
  error: Error | null;
  refetch: () => void;
}

export const useMarketEvents = ({
  klines,
  enabled = true,
}: UseMarketEventsProps): UseMarketEventsReturn => {
  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFetchRangeRef = useRef<{ start: number; end: number } | null>(null);

  const fetchEvents = useCallback(async (startTime: number, endTime: number): Promise<void> => {
    if (!enabled) return;

    const isSameRange =
      lastFetchRangeRef.current &&
      lastFetchRangeRef.current.start === startTime &&
      lastFetchRangeRef.current.end === endTime;

    if (isSameRange) return;

    lastFetchRangeRef.current = { start: startTime, end: endTime };

    try {
      setLoading(true);
      setError(null);

      const service = getCalendarService();
      const fetchedEvents = await service.getEventsForRange(startTime, endTime);
      setEvents(fetchedEvents);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled || klines.length === 0) {
      setEvents([]);
      return;
    }

    const now = Date.now();
    const startTime = now - PAST_DAYS_MS;
    const endTime = now + FUTURE_DAYS_MS;

    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);

    fetchTimeoutRef.current = setTimeout(() => {
      fetchEvents(startTime, endTime);
    }, REFETCH_DEBOUNCE_MS);

    return () => {
      if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    };
  }, [klines.length, enabled, fetchEvents]);

  const refetch = useCallback((): void => {
    lastFetchRangeRef.current = null;
    if (klines.length === 0) return;

    const now = Date.now();
    const startTime = now - PAST_DAYS_MS;
    const endTime = now + FUTURE_DAYS_MS;

    fetchEvents(startTime, endTime);
  }, [klines.length, fetchEvents]);

  return { events, loading, error, refetch };
};
