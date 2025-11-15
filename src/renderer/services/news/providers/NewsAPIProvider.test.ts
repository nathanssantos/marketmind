import type { NewsProviderConfig } from '@shared/types';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NewsAPIProvider } from './NewsAPIProvider';

vi.mock('axios');

const mockNewsAPIArticle = {
  source: {
    id: 'crypto-news',
    name: 'Crypto News',
  },
  author: 'John Doe',
  title: 'Bitcoin and Ethereum reach new highs',
  description: 'BTC and ETH prices surge as market sentiment improves',
  url: 'https://example.com/article/123',
  urlToImage: 'https://example.com/image.jpg',
  publishedAt: '2024-01-15T12:00:00Z',
  content: 'Full article content here...',
};

const mockNewsAPIResponse = {
  status: 'ok',
  totalResults: 1,
  articles: [mockNewsAPIArticle],
};

describe('NewsAPIProvider', () => {
  let mockAxiosInstance: {
    get: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockAxiosInstance = {
      get: vi.fn(),
    };

    vi.mocked(axios.create).mockReturnValue(mockAxiosInstance as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      const provider = new NewsAPIProvider(config);

      expect(provider).toBeInstanceOf(NewsAPIProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://newsapi.org/v2',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should create instance with custom base URL', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
        baseUrl: 'https://custom.newsapi.com',
      };

      new NewsAPIProvider(config);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://custom.newsapi.com',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should configure rate limiting', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
        rateLimitPerSecond: 10,
      };

      const provider = new NewsAPIProvider(config);

      expect(provider).toBeInstanceOf(NewsAPIProvider);
    });
  });

  describe('fetchNews', () => {
    it('should throw error when API key is missing', async () => {
      const config: NewsProviderConfig = {};

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('NewsAPI: API key is required');
    });

    it('should fetch news successfully', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: {
          apiKey: 'test-api-key',
          pageSize: 20,
          language: 'en',
          q: 'finance OR crypto OR stock market',
        },
      });

      expect(result.articles).toHaveLength(1);
      expect(result.totalResults).toBe(1);
      expect(result.articles[0]?.title).toBe('Bitcoin and Ethereum reach new highs');
      expect(result.articles[0]?.source).toBe('Crypto News');
      expect(result.articles[0]?.author).toBe('John Doe');
    });

    it('should use custom query', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      await provider.fetchNews({ query: 'bitcoin' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          q: 'bitcoin',
        }),
      });
    });

    it('should use custom limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      await provider.fetchNews({ limit: 50 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          pageSize: 50,
        }),
      });
    });

    it('should use custom language', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      await provider.fetchNews({ language: 'pt' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          language: 'pt',
        }),
      });
    });

    it('should use date range', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      const from = Date.parse('2024-01-01');
      const to = Date.parse('2024-01-31');

      await provider.fetchNews({ from, to });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          from: new Date(from).toISOString(),
          to: new Date(to).toISOString(),
        }),
      });
    });

    it('should map general category to business', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      await provider.fetchNews({ category: 'general' });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          category: 'business',
        }),
      });
    });

    it('should extract crypto symbols from text', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.symbols).toContain('BTC');
      expect(result.articles[0]?.symbols).toContain('ETH');
    });

    it('should filter out articles without title or description', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'ok',
          totalResults: 3,
          articles: [
            mockNewsAPIArticle,
            { ...mockNewsAPIArticle, title: '' },
            { ...mockNewsAPIArticle, description: '' },
          ],
        },
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles).toHaveLength(1);
    });

    it('should handle articles without optional fields', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              ...mockNewsAPIArticle,
              author: null,
              urlToImage: null,
              content: null,
            },
          ],
        },
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.author).toBeUndefined();
      expect(result.articles[0]?.imageUrl).toBeUndefined();
      expect(result.articles[0]?.content).toBeUndefined();
    });

    it('should generate unique article IDs', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.id).toMatch(/^newsapi-\d+-/);
    });

    it('should handle non-ok status', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'error',
          totalResults: 0,
          articles: [],
        },
      });

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('NewsAPI error: error');
    });

    it('should handle 401 unauthorized error', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'invalid-key',
      };

      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 401,
          data: {},
        },
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('NewsAPI: Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          data: {},
        },
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('NewsAPI: Rate limit exceeded');
    });

    it('should handle general API errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
        message: 'Request failed',
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow(
        'NewsAPI request failed: Internal server error'
      );
    });

    it('should handle non-axios errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      const customError = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(customError);

      vi.mocked(axios.isAxiosError).mockReturnValue(false);

      const provider = new NewsAPIProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('Network error');
    });

    it('should extract multiple crypto symbols', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              ...mockNewsAPIArticle,
              title: 'BTC ETH SOL ADA prices surge',
              description: 'Multiple cryptocurrencies including DOGE and MATIC see gains',
            },
          ],
        },
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.symbols).toContain('BTC');
      expect(result.articles[0]?.symbols).toContain('ETH');
      expect(result.articles[0]?.symbols).toContain('SOL');
      expect(result.articles[0]?.symbols).toContain('ADA');
      expect(result.articles[0]?.symbols).toContain('DOGE');
      expect(result.articles[0]?.symbols).toContain('MATIC');
    });

    it('should deduplicate extracted symbols', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              ...mockNewsAPIArticle,
              title: 'BTC price analysis',
              description: 'BTC continues to rise',
            },
          ],
        },
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      const btcCount = result.articles[0]?.symbols?.filter((s) => s === 'BTC').length;
      expect(btcCount).toBe(1);
    });

    it('should handle case-insensitive symbol extraction', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          status: 'ok',
          totalResults: 1,
          articles: [
            {
              ...mockNewsAPIArticle,
              title: 'btc and Btc',
              description: 'BTC price',
            },
          ],
        },
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.symbols).toEqual(['BTC']);
    });
  });

  describe('searchNews', () => {
    it('should search news with query and limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      const result = await provider.searchNews('bitcoin', 25);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          q: 'bitcoin',
          pageSize: 25,
        }),
      });

      expect(result.articles).toHaveLength(1);
    });

    it('should use default limit of 10', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-api-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockNewsAPIResponse,
      });

      const provider = new NewsAPIProvider(config);
      await provider.searchNews('ethereum');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/everything', {
        params: expect.objectContaining({
          pageSize: 10,
        }),
      });
    });
  });
});
