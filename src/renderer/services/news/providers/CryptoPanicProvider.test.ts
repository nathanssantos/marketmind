import type { NewsProviderConfig } from '@shared/types';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CryptoPanicProvider } from './CryptoPanicProvider';

vi.mock('axios');

const mockCryptoPanicPost = {
  id: 123456,
  kind: 'news',
  domain: 'example.com',
  source: {
    title: 'CryptoNews',
    region: 'en',
    domain: 'cryptonews.com',
    path: null,
  },
  title: 'Bitcoin reaches new all-time high',
  published_at: '2024-01-15T12:00:00Z',
  slug: 'bitcoin-reaches-new-all-time-high',
  url: 'https://example.com/article/123456',
  created_at: '2024-01-15T12:00:00Z',
  votes: {
    negative: 5,
    positive: 100,
    important: 50,
    liked: 80,
    disliked: 3,
    lol: 2,
    toxic: 1,
    saved: 40,
    comments: 25,
  },
  currencies: [
    {
      code: 'BTC',
      title: 'Bitcoin',
      slug: 'bitcoin',
      url: 'https://cryptopanic.com/news/bitcoin/',
    },
  ],
};

const mockCryptoPanicResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [mockCryptoPanicPost],
};

describe('CryptoPanicProvider', () => {
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
        apiKey: 'test-key',
      };

      const provider = new CryptoPanicProvider(config);

      expect(provider).toBeInstanceOf(CryptoPanicProvider);
      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://cryptopanic.com/api/v1',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should create instance with custom base URL', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
      };

      new CryptoPanicProvider(config);

      expect(axios.create).toHaveBeenCalledWith({
        baseURL: 'https://custom.api.com',
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    it('should configure rate limiting', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
        rateLimitPerSecond: 5,
      };

      const provider = new CryptoPanicProvider(config);

      expect(provider).toBeInstanceOf(CryptoPanicProvider);
    });
  });

  describe('fetchNews', () => {
    it('should fetch news successfully', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: {
          auth_token: 'test-key',
          public: 'true',
          kind: 'news',
        },
      });

      expect(result.articles).toHaveLength(1);
      expect(result.totalResults).toBe(1);
      expect(result.articles[0]?.id).toBe('cryptopanic-123456');
      expect(result.articles[0]?.title).toBe('Bitcoin reaches new all-time high');
      expect(result.articles[0]?.source).toBe('CryptoNews');
      expect(result.articles[0]?.symbols).toEqual(['BTC']);
    });

    it('should use free tier when no API key', async () => {
      const config: NewsProviderConfig = {};

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({});

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          auth_token: 'free',
        }),
      });
    });

    it('should filter by symbols', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ symbols: ['BTC', 'ETH'] });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          currencies: 'BTC,ETH',
        }),
      });
    });

    it('should respect page size limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ limit: 30 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          page_size: 30,
        }),
      });
    });

    it('should cap page size at 50', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ limit: 100 });

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          page_size: 50,
        }),
      });
    });

    it('should calculate positive sentiment', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              ...mockCryptoPanicPost,
              votes: {
                ...mockCryptoPanicPost.votes,
                positive: 100,
                negative: 10,
              },
            },
          ],
        },
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.sentiment).toBe('positive');
    });

    it('should calculate negative sentiment', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              ...mockCryptoPanicPost,
              votes: {
                negative: 100,
                positive: 10,
                important: 5,
                liked: 5,
                disliked: 50,
                lol: 0,
                toxic: 30,
                saved: 0,
                comments: 0,
              },
            },
          ],
        },
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.sentiment).toBe('negative');
    });

    it('should calculate neutral sentiment', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              ...mockCryptoPanicPost,
              votes: {
                negative: 40,
                positive: 50,
                important: 10,
                liked: 10,
                disliked: 20,
                lol: 0,
                toxic: 10,
                saved: 0,
                comments: 0,
              },
            },
          ],
        },
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.sentiment).toBe('neutral');
    });

    it('should handle posts without currencies', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          count: 1,
          next: null,
          previous: null,
          results: [
            {
              ...mockCryptoPanicPost,
              currencies: undefined,
            },
          ],
        },
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.symbols).toBeUndefined();
    });

    it('should include crypto category', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(result.articles[0]?.categories).toEqual(['crypto']);
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

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('CryptoPanic: Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 429,
          data: {},
        },
      });

      vi.mocked(axios.isAxiosError).mockReturnValue(true);

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('CryptoPanic: Rate limit exceeded');
    });

    it('should handle general API errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
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

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow(
        'CryptoPanic request failed: Internal server error'
      );
    });

    it('should handle non-axios errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      const customError = new Error('Network error');
      mockAxiosInstance.get.mockRejectedValue(customError);

      vi.mocked(axios.isAxiosError).mockReturnValue(false);

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('Network error');
    });
  });

  describe('searchNews', () => {
    it('should search news with query and limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.searchNews('bitcoin', 15);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          page_size: 15,
        }),
      });

      expect(result.articles).toHaveLength(1);
    });

    it('should use default limit of 10', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockAxiosInstance.get.mockResolvedValue({
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.searchNews('ethereum');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/posts/', {
        params: expect.objectContaining({
          page_size: 10,
        }),
      });
    });
  });
});
