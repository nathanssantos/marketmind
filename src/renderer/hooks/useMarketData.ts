import type { KlineData, TimeInterval } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import type { MarketDataService } from '../services/market/MarketDataService';

interface UseMarketDataOptions {
  symbol: string;
  interval: TimeInterval;
  limit?: number;
  enabled?: boolean;
}

interface UseMarketDataReturn {
  data: KlineData | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useMarketData = (
  service: MarketDataService,
  options: UseMarketDataOptions
): UseMarketDataReturn => {
  const { symbol, interval, limit = 500, enabled = true } = options;
  const [data, setData] = useState<KlineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const result = await service.fetchKlines({
        symbol,
        interval,
        limit,
      });

      setData(result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch market data');
      setError(error);
      console.error('Failed to fetch market data:', error);
    } finally {
      setLoading(false);
    }
  }, [service, symbol, interval, limit, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
};
