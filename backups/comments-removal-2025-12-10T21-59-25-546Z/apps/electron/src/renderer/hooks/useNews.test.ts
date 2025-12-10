import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useNews } from './useNews';
import type { NewsArticle } from '@marketmind/types';
import type { NewsService } from '../services/news/NewsService';

describe('useNews', () => {
  const mockArticles: NewsArticle[] = [
    {
      id: '1',
      title: 'Bitcoin News',
      description: 'Test news',
      url: 'https://example.com',
      source: 'Test',
      publishedAt: Date.now(),
      sentiment: 'positive',
    },
    {
      id: '2',
      title: 'Ethereum News',
      description: 'Test news 2',
      url: 'https://example.com/2',
      source: 'Test',
      publishedAt: Date.now(),
      sentiment: 'neutral',
    },
  ];

  let mockService: NewsService;
  let mockFetchNews: ReturnType<typeof vi.fn>;
  let mockGetNewsWithFilter: ReturnType<typeof vi.fn>;
  let mockClearCache: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetchNews = vi.fn().mockResolvedValue({
      articles: mockArticles,
      totalResults: 2,
    });

    mockGetNewsWithFilter = vi.fn().mockResolvedValue({
      articles: mockArticles.filter(a => a.sentiment === 'positive'),
      totalResults: 1,
    });

    mockClearCache = vi.fn();

    mockService = {
      fetchNews: mockFetchNews,
      getNewsWithFilter: mockGetNewsWithFilter,
      clearCache: mockClearCache,
    } as unknown as NewsService;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should initialize with empty articles', () => {
    const { result } = renderHook(() => useNews({ enabled: false, service: mockService }));

    expect(result.current.articles).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
    expect(result.current.totalResults).toBe(0);
  });

  it('should fetch news on mount', async () => {
    const { result } = renderHook(() => useNews({ service: mockService }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.articles).toEqual(mockArticles);
    expect(result.current.totalResults).toBe(2);
    expect(result.current.error).toBe(null);
    expect(mockFetchNews).toHaveBeenCalled();
  });

  it('should not fetch when enabled is false', async () => {
    renderHook(() => useNews({ enabled: false, service: mockService }));

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetchNews).not.toHaveBeenCalled();
  });

  it('should handle fetch errors', async () => {
    const error = new Error('Fetch failed');
    mockFetchNews.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useNews({ service: mockService }));

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    });

    expect(result.current.articles).toEqual([]);
    expect(result.current.totalResults).toBe(0);
  });

  it('should handle non-Error rejections', async () => {
    mockFetchNews.mockRejectedValueOnce('String error');

    const { result } = renderHook(() => useNews({ service: mockService }));

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    });

    expect(result.current.error?.message).toBe('Failed to fetch news');
  });

  it('should refetch when refetch is called', async () => {
    const { result } = renderHook(() => useNews({ service: mockService }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCount = mockFetchNews.mock.calls.length;

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockFetchNews.mock.calls.length).toBeGreaterThan(callCount);
  });

  it('should fetch news with filter', async () => {
    const { result } = renderHook(() =>
      useNews({
        service: mockService,
        filter: {
          sentiment: 'positive',
        },
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockGetNewsWithFilter).toHaveBeenCalled();
    expect(result.current.articles.length).toBe(1);
    expect(result.current.articles[0]?.sentiment).toBe('positive');
  });

  it('should clear cache when clearCache is called', () => {
    const { result } = renderHook(() => useNews({ enabled: false, service: mockService }));

    act(() => {
      result.current.clearCache();
    });

    expect(mockClearCache).toHaveBeenCalled();
  });

  it('should refetch at specified interval', async () => {
    vi.useFakeTimers();

    renderHook(() => useNews({ service: mockService, refetchInterval: 1000 }));

    await vi.advanceTimersByTimeAsync(100);
    const initialCalls = mockFetchNews.mock.calls.length;

    await vi.advanceTimersByTimeAsync(1000);

    expect(mockFetchNews.mock.calls.length).toBeGreaterThan(initialCalls);
  });

  it('should clear interval on unmount', async () => {
    vi.useFakeTimers();

    const { unmount } = renderHook(() => useNews({ service: mockService, refetchInterval: 1000 }));

    await vi.advanceTimersByTimeAsync(100);
    const callsBeforeUnmount = mockFetchNews.mock.calls.length;

    unmount();

    await vi.advanceTimersByTimeAsync(2000);

    expect(mockFetchNews.mock.calls.length).toBe(callsBeforeUnmount);
  });

  it('should update when options change', async () => {
    const { rerender } = renderHook(
      ({ symbols }) => useNews({ service: mockService, symbols }),
      { initialProps: { symbols: ['BTCUSDT'] } }
    );

    await waitFor(() => {
      expect(mockFetchNews).toHaveBeenCalled();
    });

    const callCount = mockFetchNews.mock.calls.length;

    rerender({ symbols: ['ETHUSDT'] });

    await waitFor(() => {
      expect(mockFetchNews.mock.calls.length).toBeGreaterThan(callCount);
    });
  });

  it('should start fetching when enabled changes to true', async () => {
    const { rerender } = renderHook(
      ({ enabled }) => useNews({ service: mockService, enabled }),
      { initialProps: { enabled: false } }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockFetchNews).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(mockFetchNews).toHaveBeenCalled();
    });
  });

  it('should clear error on successful refetch', async () => {
    const error = new Error('Fetch failed');
    mockFetchNews
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({
        articles: mockArticles,
        totalResults: 2,
      });

    const { result } = renderHook(() => useNews({ service: mockService }));

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.articles).toEqual(mockArticles);
    });
  });

  it('should handle filter changes', async () => {
    const { rerender } = renderHook(
      ({ filter }) => useNews({ service: mockService, filter }),
      {
        initialProps: {
          filter: undefined as { sentiment: 'positive' | 'neutral' | 'negative' } | undefined,
        },
      }
    );

    await waitFor(() => {
      expect(mockFetchNews).toHaveBeenCalled();
    });

    rerender({ filter: { sentiment: 'positive' as const } });

    await waitFor(() => {
      expect(mockGetNewsWithFilter).toHaveBeenCalled();
    });
  });

  it('should use provided service over default', async () => {
    const customService = {
      fetchNews: vi.fn().mockResolvedValue({
        articles: [],
        totalResults: 0,
      }),
      getNewsWithFilter: vi.fn(),
      clearCache: vi.fn(),
    } as unknown as NewsService;

    renderHook(() => useNews({ service: customService }));

    await waitFor(() => {
      expect(customService.fetchNews).toHaveBeenCalled();
    });

    expect(mockFetchNews).not.toHaveBeenCalled();
  });
});
