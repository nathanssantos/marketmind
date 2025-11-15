import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useMarketData } from './useMarketData';
import { MarketDataService } from '../services/market/MarketDataService';
import type { CandleData } from '@shared/types';

describe('useMarketData', () => {
  let mockService: MarketDataService;
  const mockCandleData: CandleData = {
    symbol: 'BTCUSDT',
    interval: '1h',
    candles: [
      { timestamp: 1000, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
      { timestamp: 2000, open: 105, high: 115, low: 100, close: 110, volume: 1500 },
    ],
  };

  beforeEach(() => {
    mockService = {
      fetchCandles: vi.fn().mockResolvedValue(mockCandleData),
    } as unknown as MarketDataService;
  });

  it('should fetch data on mount', async () => {
    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockCandleData);
    expect(result.current.error).toBe(null);
    expect(mockService.fetchCandles).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 500,
    });
  });

  it('should handle fetch errors', async () => {
    const error = new Error('Network error');
    mockService.fetchCandles = vi.fn().mockRejectedValue(error);

    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toEqual(error);
  });

  it('should handle non-Error rejections', async () => {
    mockService.fetchCandles = vi.fn().mockRejectedValue('String error');

    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Failed to fetch market data');
  });

  it('should refetch data when refetch is called', async () => {
    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchCandles).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    expect(mockService.fetchCandles).toHaveBeenCalledTimes(2);
  });

  it('should update data when symbol changes', async () => {
    const { result, rerender } = renderHook(
      ({ symbol }) => useMarketData(mockService, { symbol, interval: '1h' }),
      { initialProps: { symbol: 'BTCUSDT' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchCandles).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 500,
    });

    rerender({ symbol: 'ETHUSDT' });

    await waitFor(() => {
      expect(mockService.fetchCandles).toHaveBeenCalledWith({
        symbol: 'ETHUSDT',
        interval: '1h',
        limit: 500,
      });
    });
  });

  it('should update data when interval changes', async () => {
    const { result, rerender } = renderHook(
      ({ interval }: { interval: '1h' | '1d' }) => useMarketData(mockService, { symbol: 'BTCUSDT', interval }),
      { initialProps: { interval: '1h' as const } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ interval: '1d' as const });

    await waitFor(() => {
      expect(mockService.fetchCandles).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1d',
        limit: 500,
      });
    });
  });

  it('should respect custom limit', async () => {
    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h', limit: 100 })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchCandles).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 100,
    });
  });

  it('should not fetch when enabled is false', async () => {
    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h', enabled: false })
    );

    expect(result.current.loading).toBe(true);

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockService.fetchCandles).not.toHaveBeenCalled();
    expect(result.current.data).toBe(null);
  });

  it('should start fetching when enabled changes to true', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h', enabled }),
      { initialProps: { enabled: false } }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockService.fetchCandles).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchCandles).toHaveBeenCalled();
  });

  it('should clear error on successful refetch', async () => {
    const error = new Error('Network error');
    mockService.fetchCandles = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mockCandleData);

    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.data).toEqual(mockCandleData);
    });
  });
});
