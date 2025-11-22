import type { FetchNewsOptions, NewsArticle, NewsFilter } from '@shared/types';
import { useCallback, useEffect, useMemo, useState } from 'react';
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
let isInitializing = false;
let initPromise: Promise<NewsService> | null = null;

const initializeNewsService = async (): Promise<NewsService> => {
  if (defaultNewsService) {
    return defaultNewsService;
  }

  if (isInitializing && initPromise) {
    return initPromise;
  }

  isInitializing = true;
  initPromise = (async () => {
    try {
      const newsApiResult = await window.electron.secureStorage.getApiKey('newsapi');
      const newsApiKey = newsApiResult.apiKey || import.meta.env['VITE_NEWSAPI_API_KEY'] || '';

      if (!newsApiKey) {
        throw new Error('NewsAPI key is required. CryptoPanic is currently blocked by Cloudflare protection.');
      }

      defaultNewsService = new NewsService({
        primaryProvider: new NewsAPIProvider({
          apiKey: newsApiKey,
        }),
        fallbackProviders: [],
        defaultCacheDuration: 300000,
      });

      return defaultNewsService;
    } finally {
      isInitializing = false;
      initPromise = null;
    }
  })();

  return initPromise;
};

const getDefaultNewsService = (): NewsService => {
  if (defaultNewsService) {
    return defaultNewsService;
  }

  const cryptoPanicKey = import.meta.env['VITE_CRYPTOPANIC_API_KEY'] || '';
  const newsApiKey = import.meta.env['VITE_NEWSAPI_API_KEY'] || '';

  defaultNewsService = new NewsService({
    primaryProvider: new CryptoPanicProvider({
      apiKey: cryptoPanicKey,
    }),
    fallbackProviders: newsApiKey ? [
      new NewsAPIProvider({
        apiKey: newsApiKey,
      }),
    ] : [],
    defaultCacheDuration: 300000,
  });

  initializeNewsService().then((service) => {
    defaultNewsService = service;
  });

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

  const optionsKey = useMemo(
    () => JSON.stringify({ filter, fetchOptions }),
    [filter, fetchOptions]
  );

  const fetchNews = useCallback(async () => {
    if (!enabled) return;

    console.log('[useNews] Fetching news...', { enabled, symbols: fetchOptions.symbols, limit: fetchOptions.limit });

    setLoading(true);
    setError(null);

    try {
      const response = filter
        ? await newsService.getNewsWithFilter(fetchOptions, filter)
        : await newsService.fetchNews(fetchOptions);

      console.log('[useNews] News fetched successfully:', response.articles.length, 'articles');
      setArticles(response.articles);
      setTotalResults(response.totalResults);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch news');
      console.error('[useNews] Failed to fetch news:', error.message);
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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (defaultNewsService) {
      defaultNewsService.clearCache();
      defaultNewsService = null;
    }
  });
}
