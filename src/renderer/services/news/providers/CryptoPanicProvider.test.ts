import type { NewsProviderConfig } from '@shared/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CryptoPanicProvider } from './CryptoPanicProvider';

const mockElectronFetch = vi.fn();

vi.stubGlobal('window', {
  electron: {
    http: {
      fetch: mockElectronFetch,
    },
  },
});

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
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
    });

    it('should create instance with custom base URL', () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com',
      };

      const provider = new CryptoPanicProvider(config);

      expect(provider).toBeInstanceOf(CryptoPanicProvider);
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

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.fetchNews({});

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('auth_token=test-key')
      );
      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('public=true')
      );
      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('kind=news')
      );

      expect(result.articles).toHaveLength(1);
      expect(result.totalResults).toBe(1);
      expect(result.articles[0]?.id).toBe('cryptopanic-123456');
      expect(result.articles[0]?.title).toBe('Bitcoin reaches new all-time high');
      expect(result.articles[0]?.source).toBe('CryptoNews');
      expect(result.articles[0]?.symbols).toEqual(['BTC']);
    });

    it('should use free tier when no API key', async () => {
      const config: NewsProviderConfig = {};

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({});

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('auth_token=free')
      );
    });

    it('should filter by symbols', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ symbols: ['BTC', 'ETH'] });

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('currencies=BTC%2CETH')
      );
    });

    it('should respect page size limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ limit: 30 });

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('page_size=30')
      );
    });

    it('should cap page size at 50', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.fetchNews({ limit: 100 });

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('page_size=50')
      );
    });

    it('should calculate positive sentiment', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
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

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
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

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
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

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
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

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
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

      mockElectronFetch.mockResolvedValue({
        success: false,
        status: 401,
        error: 'Unauthorized',
      });

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('CryptoPanic: Invalid API key');
    });

    it('should handle 429 rate limit error', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: false,
        status: 429,
        error: 'Too Many Requests',
      });

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('CryptoPanic: Rate limit exceeded');
    });

    it('should handle general API errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: false,
        status: 500,
        statusText: 'Internal server error',
      });

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow(
        'CryptoPanic request failed: Internal server error'
      );
    });

    it('should handle non-axios errors', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockRejectedValue(new Error('Network error'));

      const provider = new CryptoPanicProvider(config);

      await expect(provider.fetchNews({})).rejects.toThrow('Network error');
    });
  });

  describe('searchNews', () => {
    it('should search news with query and limit', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      const result = await provider.searchNews('bitcoin', 15);

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('page_size=15')
      );

      expect(result.articles).toHaveLength(1);
    });

    it('should use default limit of 10', async () => {
      const config: NewsProviderConfig = {
        apiKey: 'test-key',
      };

      mockElectronFetch.mockResolvedValue({
        success: true,
        status: 200,
        data: mockCryptoPanicResponse,
      });

      const provider = new CryptoPanicProvider(config);
      await provider.searchNews('bitcoin');

      expect(mockElectronFetch).toHaveBeenCalledWith(
        expect.stringContaining('page_size=10')
      );
    });
  });
});
