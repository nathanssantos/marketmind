import type { FetchNewsOptions, NewsArticle, NewsResponse } from '@marketmind/types';
import { BaseNewsProvider } from '@marketmind/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsService } from './NewsService';

const mockArticle: NewsArticle = {
  id: '1',
  title: 'Bitcoin reaches new high',
  description: 'Bitcoin price surges to new all-time high',
  url: 'https://example.com/article/1',
  source: 'CryptoNews',
  publishedAt: Date.now(),
  sentiment: 'positive',
  symbols: ['BTC'],
};

const mockNewsResponse: NewsResponse = {
  articles: [mockArticle],
  totalResults: 1,
};

class MockNewsProvider extends BaseNewsProvider {
  fetchNews = vi.fn();
  searchNews = vi.fn();
}

const createMockProvider = (name: string): BaseNewsProvider => {
  const provider = new MockNewsProvider(name, {});
  return provider;
};

describe('NewsService', () => {
  let primaryProvider: BaseNewsProvider;
  let fallbackProvider1: BaseNewsProvider;
  let fallbackProvider2: BaseNewsProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    primaryProvider = createMockProvider('primary');
    fallbackProvider1 = createMockProvider('fallback1');
    fallbackProvider2 = createMockProvider('fallback2');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with primary provider only', () => {
      const service = new NewsService({
        primaryProvider,
      });

      expect(service).toBeInstanceOf(NewsService);
      expect(service.getPrimaryProvider()).toBe(primaryProvider);
    });

    it('should create instance with fallback providers', () => {
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      expect(service.getFallbackProviders()).toHaveLength(2);
    });

    it('should use default cache duration', () => {
      const service = new NewsService({
        primaryProvider,
      });

      expect(service).toBeInstanceOf(NewsService);
    });

    it('should use custom cache duration', () => {
      const service = new NewsService({
        primaryProvider,
        defaultCacheDuration: 60000,
      });

      expect(service).toBeInstanceOf(NewsService);
    });
  });

  describe('fetchNews', () => {
    it('should fetch news from primary provider', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.fetchNews();

      expect(result).toEqual(mockNewsResponse);
      expect(primaryProvider.fetchNews).toHaveBeenCalledWith({});
    });

    it('should fetch news with options', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      const options: FetchNewsOptions = {
        query: 'bitcoin',
        symbols: ['BTC'],
        limit: 20,
      };

      const result = await service.fetchNews(options);

      expect(result).toEqual(mockNewsResponse);
      expect(primaryProvider.fetchNews).toHaveBeenCalledWith(options);
    });

    it('should use fallback provider when primary fails', async () => {
      vi.mocked(primaryProvider.fetchNews).mockRejectedValue(new Error('Primary failed'));
      vi.mocked(fallbackProvider1.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      const result = await service.fetchNews();

      expect(result).toEqual(mockNewsResponse);
      expect(primaryProvider.fetchNews).toHaveBeenCalled();
      expect(fallbackProvider1.fetchNews).toHaveBeenCalled();
    });

    it('should try multiple fallback providers in order', async () => {
      vi.mocked(primaryProvider.fetchNews).mockRejectedValue(new Error('Primary failed'));
      vi.mocked(fallbackProvider1.fetchNews).mockRejectedValue(new Error('Fallback1 failed'));
      vi.mocked(fallbackProvider2.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      const result = await service.fetchNews();

      expect(result).toEqual(mockNewsResponse);
      expect(primaryProvider.fetchNews).toHaveBeenCalled();
      expect(fallbackProvider1.fetchNews).toHaveBeenCalled();
      expect(fallbackProvider2.fetchNews).toHaveBeenCalled();
    });

    it('should throw error when all providers fail', async () => {
      vi.mocked(primaryProvider.fetchNews).mockRejectedValue(new Error('Primary failed'));
      vi.mocked(fallbackProvider1.fetchNews).mockRejectedValue(new Error('Fallback failed'));

      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      await expect(service.fetchNews()).rejects.toThrow('Fallback failed');
    });

    it('should throw single error when only primary provider fails', async () => {
      const error = new Error('Primary provider failed');
      vi.mocked(primaryProvider.fetchNews).mockRejectedValue(error);

      const service = new NewsService({
        primaryProvider,
      });

      await expect(service.fetchNews()).rejects.toThrow('Primary provider failed');
    });

    it('should throw generic error when no providers configured', async () => {
      vi.mocked(primaryProvider.fetchNews).mockRejectedValue(new Error('No enabled providers'));
      
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [],
      });

      vi.mocked(primaryProvider.fetchNews).mockImplementation(() => {
        throw new Error('All news providers failed');
      });

      await expect(service.fetchNews()).rejects.toThrow();
    });

    it('should cache successful responses', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.fetchNews({ query: 'bitcoin' });
      await service.fetchNews({ query: 'bitcoin' });

      expect(primaryProvider.fetchNews).toHaveBeenCalledTimes(1);
    });

    it('should use different cache keys for different options', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.fetchNews({ query: 'bitcoin' });
      await service.fetchNews({ query: 'ethereum' });
      await service.fetchNews({ symbols: ['BTC'] });

      expect(primaryProvider.fetchNews).toHaveBeenCalledTimes(3);
    });

    it('should invalidate cache after duration', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
        defaultCacheDuration: 1000,
      });

      await service.fetchNews({ query: 'bitcoin' });

      vi.advanceTimersByTime(1001);

      await service.fetchNews({ query: 'bitcoin' });

      expect(primaryProvider.fetchNews).toHaveBeenCalledTimes(2);
    });

    it('should not invalidate cache before duration', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
        defaultCacheDuration: 1000,
      });

      await service.fetchNews({ query: 'bitcoin' });

      vi.advanceTimersByTime(500);

      await service.fetchNews({ query: 'bitcoin' });

      expect(primaryProvider.fetchNews).toHaveBeenCalledTimes(1);
    });

    it('should handle symbols array in cache key', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.fetchNews({ symbols: ['BTC', 'ETH'] });
      await service.fetchNews({ symbols: ['ETH', 'BTC'] });

      expect(primaryProvider.fetchNews).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchNews', () => {
    it('should search news with query', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.searchNews('bitcoin');

      expect(result).toEqual(mockNewsResponse);
      expect(primaryProvider.fetchNews).toHaveBeenCalledWith({
        query: 'bitcoin',
        limit: 10,
      });
    });

    it('should search news with custom limit', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.searchNews('ethereum', 20);

      expect(primaryProvider.fetchNews).toHaveBeenCalledWith({
        query: 'ethereum',
        limit: 20,
      });
    });
  });

  describe('getNewsWithFilter', () => {
    it('should filter by sentiment', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', sentiment: 'positive' },
        { ...mockArticle, id: '2', sentiment: 'negative' },
        { ...mockArticle, id: '3', sentiment: 'positive' },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 3,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter({}, { sentiment: 'positive' });

      expect(result.articles).toHaveLength(2);
      expect(result.totalResults).toBe(2);
      expect(result.articles.every((a) => a.sentiment === 'positive')).toBe(true);
    });

    it('should filter by symbols', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', symbols: ['BTC'] },
        { ...mockArticle, id: '2', symbols: ['ETH'] },
        { ...mockArticle, id: '3', symbols: ['BTC', 'ETH'] },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 3,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter({}, { symbols: ['BTC'] });

      expect(result.articles).toHaveLength(2);
      expect(result.articles.every((a) => a.symbols?.includes('BTC'))).toBe(true);
    });

    it('should filter by search query in title', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', title: 'Bitcoin reaches new high', description: 'BTC news' },
        { ...mockArticle, id: '2', title: 'Ethereum price analysis', description: 'ETH news' },
        { ...mockArticle, id: '3', title: 'Bitcoin market update', description: 'BTC update' },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 3,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter({}, { searchQuery: 'bitcoin' });

      expect(result.articles).toHaveLength(2);
      expect(result.articles.every((a) => a.title.toLowerCase().includes('bitcoin'))).toBe(true);
    });

    it('should filter by search query in description', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', description: 'Bitcoin price surges', title: 'News 1' },
        { ...mockArticle, id: '2', description: 'Ethereum update', title: 'News 2' },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 2,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter({}, { searchQuery: 'bitcoin' });

      expect(result.articles).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      const now = Date.now();
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', publishedAt: now - 1000 },
        { ...mockArticle, id: '2', publishedAt: now - 2000 },
        { ...mockArticle, id: '3', publishedAt: now - 3000 },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 3,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter(
        {},
        {
          dateFrom: now - 2500,
          dateTo: now - 500,
        }
      );

      expect(result.articles).toHaveLength(2);
    });

    it('should apply multiple filters', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', sentiment: 'positive', symbols: ['BTC'], title: 'Bitcoin up' },
        { ...mockArticle, id: '2', sentiment: 'negative', symbols: ['BTC'], title: 'Bitcoin down' },
        { ...mockArticle, id: '3', sentiment: 'positive', symbols: ['ETH'], title: 'Ethereum up' },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 3,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter(
        {},
        {
          sentiment: 'positive',
          symbols: ['BTC'],
        }
      );

      expect(result.articles).toHaveLength(1);
      expect(result.articles[0]?.id).toBe('1');
    });

    it('should return empty array when no articles match filter', async () => {
      const articles: NewsArticle[] = [
        { ...mockArticle, id: '1', sentiment: 'positive' },
        { ...mockArticle, id: '2', sentiment: 'positive' },
      ];

      vi.mocked(primaryProvider.fetchNews).mockResolvedValue({
        articles,
        totalResults: 2,
      });

      const service = new NewsService({
        primaryProvider,
      });

      const result = await service.getNewsWithFilter({}, { sentiment: 'negative' });

      expect(result.articles).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });
  });

  describe('setPrimaryProvider', () => {
    it('should change primary provider and clear cache', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.fetchNews({ query: 'bitcoin' });

      expect(service.getCacheSize()).toBe(1);

      const newProvider = createMockProvider('new');
      service.setPrimaryProvider(newProvider);

      expect(service.getPrimaryProvider()).toBe(newProvider);
      expect(service.getCacheSize()).toBe(0);
    });
  });

  describe('addFallbackProvider', () => {
    it('should add new fallback provider', () => {
      const service = new NewsService({
        primaryProvider,
      });

      expect(service.getFallbackProviders()).toHaveLength(0);

      service.addFallbackProvider(fallbackProvider1);

      expect(service.getFallbackProviders()).toHaveLength(1);
      expect(service.getFallbackProviders()[0]).toBe(fallbackProvider1);
    });

    it('should not add duplicate providers', () => {
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      service.addFallbackProvider(fallbackProvider1);

      expect(service.getFallbackProviders()).toHaveLength(1);
    });
  });

  describe('removeFallbackProvider', () => {
    it('should remove fallback provider by name', () => {
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      expect(service.getFallbackProviders()).toHaveLength(2);

      service.removeFallbackProvider('fallback1');

      expect(service.getFallbackProviders()).toHaveLength(1);
      expect(service.getFallbackProviders()[0]).toBe(fallbackProvider2);
    });

    it('should handle removing non-existent provider', () => {
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1],
      });

      service.removeFallbackProvider('non-existent');

      expect(service.getFallbackProviders()).toHaveLength(1);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached entries', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      await service.fetchNews({ query: 'bitcoin' });
      await service.fetchNews({ query: 'ethereum' });

      expect(service.getCacheSize()).toBe(2);

      service.clearCache();

      expect(service.getCacheSize()).toBe(0);
    });
  });

  describe('getCacheSize', () => {
    it('should return correct cache size', async () => {
      vi.mocked(primaryProvider.fetchNews).mockResolvedValue(mockNewsResponse);

      const service = new NewsService({
        primaryProvider,
      });

      expect(service.getCacheSize()).toBe(0);

      await service.fetchNews({ query: 'bitcoin' });
      expect(service.getCacheSize()).toBe(1);

      await service.fetchNews({ query: 'ethereum' });
      expect(service.getCacheSize()).toBe(2);

      await service.fetchNews({ query: 'bitcoin' });
      expect(service.getCacheSize()).toBe(2);
    });
  });

  describe('getters', () => {
    it('should get primary provider', () => {
      const service = new NewsService({
        primaryProvider,
      });

      expect(service.getPrimaryProvider()).toBe(primaryProvider);
    });

    it('should get fallback providers', () => {
      const service = new NewsService({
        primaryProvider,
        fallbackProviders: [fallbackProvider1, fallbackProvider2],
      });

      const fallbacks = service.getFallbackProviders();

      expect(fallbacks).toHaveLength(2);
      expect(fallbacks[0]).toBe(fallbackProvider1);
      expect(fallbacks[1]).toBe(fallbackProvider2);
    });
  });
});
