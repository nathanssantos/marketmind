import { useEffect, useCallback, useRef } from 'react';
import type { TimeInterval, Kline } from '@shared/types';
import type { MarketDataService } from '../services/market/MarketDataService';

interface UseRealtimeCandleOptions {
  symbol: string;
  interval: TimeInterval;
  enabled?: boolean;
  onUpdate?: (candle: Kline, isFinal: boolean) => void;
}

export const useRealtimeCandle = (
  service: MarketDataService,
  options: UseRealtimeCandleOptions
): void => {
  const { symbol, interval, enabled = true, onUpdate } = options;
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleUpdate = useCallback((candle: Kline, isFinal: boolean) => {
    if (onUpdateRef.current) {
      onUpdateRef.current(candle, isFinal);
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
