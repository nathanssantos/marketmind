import type { Kline, TimeInterval } from '@marketmind/types';
import { useCallback, useEffect, useRef } from 'react';
import type { MarketDataService } from '../services/market/MarketDataService';

interface UseRealtimeKlineOptions {
  symbol: string;
  interval: TimeInterval;
  enabled?: boolean;
  onUpdate?: (kline: Kline, isFinal: boolean) => void;
}

export const useRealtimeKline = (
  service: MarketDataService,
  options: UseRealtimeKlineOptions
): void => {
  const { symbol, interval, enabled = true, onUpdate } = options;
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleUpdate = useCallback((kline: Kline, isFinal: boolean) => {
    if (onUpdateRef.current) {
      onUpdateRef.current(kline, isFinal);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const unsubscribe = service.subscribeToUpdates({
      symbol,
      interval,
      callback: (update) => {
        handleUpdate(update.kline, update.isFinal);
      },
    });

    return () => {
      unsubscribe();
    };
  }, [service, symbol, interval, enabled, handleUpdate]);
};
