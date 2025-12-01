import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSymbolSearch } from './useSymbolSearch';
import type { MarketDataService } from '../services/market/MarketDataService';
import type { Symbol } from '@shared/types';

describe('useSymbolSearch', () => {
  let mockService: MarketDataService;
  const mockSymbols: Symbol[] = [
    { symbol: 'BTCUSDT', baseAsset: 'BTC', quoteAsset: 'USDT', displayName: 'BTC/USDT' },
    { symbol: 'ETHUSDT', baseAsset: 'ETH', quoteAsset: 'USDT', displayName: 'ETH/USDT' },
  ];

  beforeEach(() => {
    mockService = {
      searchSymbols: vi.fn().mockResolvedValue(mockSymbols),
    } as unknown as MarketDataService;
  });

  it('should initialize with empty symbols', () => {
    const { result } = renderHook(() => useSymbolSearch(mockService));

    expect(result.current.symbols).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('should search symbols when query is provided', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 100 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(mockService.searchSymbols).toHaveBeenCalledWith('BTC');
      expect(result.current.symbols).toEqual(mockSymbols);
    }, { timeout: 1000 });
  });

  it('should not search when query is too short', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService));

    result.current.search('B');

    await new Promise(resolve => setTimeout(resolve, 400));

    expect(mockService.searchSymbols).not.toHaveBeenCalled();
    expect(result.current.symbols).toEqual([]);
  });

  it('should respect custom minQueryLength', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService, { minQueryLength: 1, debounceMs: 50 }));

    result.current.search('B');

    await waitFor(() => {
      expect(mockService.searchSymbols).toHaveBeenCalledWith('B');
    }, { timeout: 1000 });

    await waitFor(() => {
      expect(result.current.symbols).toEqual(mockSymbols);
    }, { timeout: 1000 });
  });

  it('should debounce search queries', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 200 }));

    result.current.search('B');
    result.current.search('BT');
    result.current.search('BTC');

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockService.searchSymbols).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mockService.searchSymbols).toHaveBeenCalledTimes(1);
    });

    expect(mockService.searchSymbols).toHaveBeenCalledWith('BTC');
  });

  it('should handle search errors', async () => {
    const error = new Error('Search failed');
    mockService.searchSymbols = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 100 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    }, { timeout: 500 });

    expect(result.current.symbols).toEqual([]);
  });

  it('should handle non-Error rejections', async () => {
    mockService.searchSymbols = vi.fn().mockRejectedValue('String error');

    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 100 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error);
    }, { timeout: 500 });

    expect(result.current.error?.message).toBe('Failed to search symbols');
  });

  it('should clear symbols when empty query is provided', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 100 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(result.current.symbols).toEqual(mockSymbols);
    }, { timeout: 500 });

    result.current.search('');

    await new Promise(resolve => setTimeout(resolve, 200));

    expect(result.current.symbols).toEqual([]);
  });

  it('should show loading state during search', async () => {
    let resolveSearch: (value: Symbol[]) => void;
    const searchPromise = new Promise<Symbol[]>(resolve => {
      resolveSearch = resolve;
    });
    
    mockService.searchSymbols = vi.fn().mockReturnValue(searchPromise);

    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 50 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    }, { timeout: 500 });

    resolveSearch!(mockSymbols);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  it('should clear error on successful search', async () => {
    const error = new Error('Search failed');
    mockService.searchSymbols = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mockSymbols);

    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 100 }));

    result.current.search('BTC');

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    }, { timeout: 500 });

    result.current.search('ETH');

    await waitFor(() => {
      expect(result.current.error).toBe(null);
    }, { timeout: 500 });
    
    expect(result.current.symbols).toEqual(mockSymbols);
  });

  it('should cancel pending search when new query is provided', async () => {
    const { result } = renderHook(() => useSymbolSearch(mockService, { debounceMs: 200 }));

    result.current.search('BTC');

    await new Promise(resolve => setTimeout(resolve, 100));

    result.current.search('ETH');

    await waitFor(() => {
      expect(mockService.searchSymbols).toHaveBeenCalledTimes(1);
    });

    expect(mockService.searchSymbols).toHaveBeenCalledWith('ETH');
    expect(mockService.searchSymbols).not.toHaveBeenCalledWith('BTC');
  });
});
