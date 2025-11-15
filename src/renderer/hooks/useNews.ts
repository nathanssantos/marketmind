import { useState, useEffect, useCallback, useMemo } from 'react';
import type { NewsArticle, FetchNewsOptions, NewsFilter } from '@shared/types';
import { NewsService } from '../services/news/NewsService';
import { CryptoPanicProvider } from '../services/news/providers/CryptoPanicProvider';
import { NewsAPIProvider } from '../services/news/providers/NewsAPIProvider';

interface UseNewsOptions extends FetchNewsOptions {
  filter?: NewsFilter | undefined;
  enabled?: boolean | undefined;
  refetchInterval?: number | undefined;
  service?: NewsService | undefined;
}

interface UseNewsReturn {
  articles: NewsArticle[];
  loading: boolean;
  error: Error | null;
  totalResults: number;
  refetch: () => Promise<void>;
  clearCache: () => void;
}

let defaultNewsService: NewsService | null = null;

const getDefaultNewsService = (): NewsService => {
  if (!defaultNewsService) {
    defaultNewsService = new NewsService({
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
  }
  return defaultNewsService;
};

export const useNews = (options: UseNewsOptions = {}): UseNewsReturn => {
  const { filter, enabled = true, refetchInterval, service: providedService, ...fetchOptions } = options;

  const newsService = useMemo(
    () => providedService || getDefaultNewsService(),
    [providedService]
  );

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [totalResults, setTotalResults] = useState(0);

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
      setArticles([]);
      setTotalResults(0);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, optionsKey, newsService]);

  useEffect(() => {
    if (!enabled) return;

    fetchNews();

    if (refetchInterval) {
      const interval = setInterval(fetchNews, refetchInterval);
      return () => clearInterval(interval);
    }

    return undefined;
  }, [fetchNews, refetchInterval, enabled]);

  const clearCache = useCallback(() => {
    newsService.clearCache();
  }, [newsService]);

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
