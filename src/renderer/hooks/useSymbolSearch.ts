import type { Symbol } from '@shared/types';
import { useCallback, useEffect, useState } from 'react';
import { MarketDataService } from '../services/market/MarketDataService';

interface UseSymbolSearchOptions {
  minQueryLength?: number;
  debounceMs?: number;
}

interface UseSymbolSearchReturn {
  symbols: Symbol[];
  loading: boolean;
  error: Error | null;
  search: (query: string) => void;
}

export const useSymbolSearch = (
  service: MarketDataService,
  options: UseSymbolSearchOptions = {}
): UseSymbolSearchReturn => {
  const { minQueryLength = 2, debounceMs = 300 } = options;
  const [symbols, setSymbols] = useState<Symbol[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const performSearch = useCallback(async (query: string) => {
    if (query.length < minQueryLength) {
      setSymbols([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await service.searchSymbols(query);
      setSymbols(results);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to search symbols');
      setError(error);
      console.error('Symbol search failed:', error);
    } finally {
      setLoading(false);
    }
  }, [service, minQueryLength]);

  useEffect(() => {
    if (!searchQuery) {
      setSymbols([]);
      return;
    }

    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, debounceMs, performSearch]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  return {
    symbols,
    loading,
    error,
    search,
  };
};
