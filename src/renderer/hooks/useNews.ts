import { useState, useEffect, useCallback, useMemo } from 'react';
import type { NewsArticle, FetchNewsOptions, NewsFilter } from '@shared/types';
import { NewsService } from '../services/news/NewsService';
import { CryptoPanicProvider } from '../services/news/providers/CryptoPanicProvider';
import { NewsAPIProvider } from '../services/news/providers/NewsAPIProvider';

interface UseNewsOptions extends FetchNewsOptions {
  filter?: NewsFilter | undefined;
  enabled?: boolean | undefined;
  refetchInterval?: number | undefined;
}

interface UseNewsReturn {
  articles: NewsArticle[];
  loading: boolean;
  error: Error | null;
  totalResults: number;
  refetch: () => Promise<void>;
  clearCache: () => void;
}

const newsService = new NewsService({
  primaryProvider: new CryptoPanicProvider({
    apiKey: import.meta.env['VITE_CRYPTOPANIC_API_KEY'],
  }),
  fallbackProviders: [
    new NewsAPIProvider({
      apiKey: import.meta.env['VITE_NEWSAPI_API_KEY'],
    }),
  ],
  defaultCacheDuration: 300000,
});

export const useNews = (options: UseNewsOptions = {}): UseNewsReturn => {
  const { filter, enabled = true, refetchInterval, ...fetchOptions } = options;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalResults, setTotalResults] = useState(0);

  // Stringify options to avoid infinite loops from object reference changes
  const optionsKey = JSON.stringify({ filter, fetchOptions });

  const fetchNews = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = filter
        ? await newsService.getNewsWithFilter(fetchOptions, filter)
        : await newsService.fetchNews(fetchOptions);

      setArticles(response.articles);
      setTotalResults(response.totalResults);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch news');
      setError(error);
      // Silent error - don't spam console
      setArticles([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, optionsKey]);

  useEffect(() => {
    // Only fetch if enabled
    if (!enabled) return;

    // Initial fetch
    fetchNews();

    // Setup interval if specified
    if (refetchInterval) {
      const interval = setInterval(fetchNews, refetchInterval);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [fetchNews, refetchInterval, enabled]);

  const clearCache = useCallback(() => {
    newsService.clearCache();
  }, []);

  return useMemo(
    () => ({
      articles,
      loading,
      error,
      totalResults,
      refetch: fetchNews,
      clearCache,
    }),
    [articles, loading, error, totalResults, fetchNews, clearCache]
  );
};
