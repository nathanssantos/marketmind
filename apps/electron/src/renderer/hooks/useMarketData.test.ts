import type { KlineData } from '@shared/types';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketDataService } from '../services/market/MarketDataService';
import { useMarketData } from './useMarketData';

describe('useMarketData', () => {
  let mockService: MarketDataService;
  const mockKlineData: KlineData = {
    symbol: 'BTCUSDT',
    interval: '1h',
    klines: [
      { openTime: 1000, closeTime: 2000, open: '100', high: '110', low: '95', close: '105', volume: '1000', quoteVolume: '105000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '52500' },
      { openTime: 2000, closeTime: 3000, open: '105', high: '115', low: '100', close: '110', volume: '1500', quoteVolume: '165000', trades: 150, takerBuyBaseVolume: '750', takerBuyQuoteVolume: '82500' },
    ],
  };

  beforeEach(() => {
    mockService = {
      fetchKlines: vi.fn().mockResolvedValue(mockKlineData),
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

    expect(result.current.data).toEqual(mockKlineData);
    expect(result.current.error).toBe(null);
    expect(mockService.fetchKlines).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 500,
    });
  });

  it('should handle fetch errors', async () => {
    const error = new Error('Network error');
    mockService.fetchKlines = vi.fn().mockRejectedValue(error);

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
    mockService.fetchKlines = vi.fn().mockRejectedValue('String error');

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

    expect(mockService.fetchKlines).toHaveBeenCalledTimes(1);

    await result.current.refetch();

    expect(mockService.fetchKlines).toHaveBeenCalledTimes(2);
  });

  it('should update data when symbol changes', async () => {
    const { result, rerender } = renderHook(
      ({ symbol }) => useMarketData(mockService, { symbol, interval: '1h' }),
      { initialProps: { symbol: 'BTCUSDT' } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchKlines).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      limit: 500,
    });

    rerender({ symbol: 'ETHUSDT' });

    await waitFor(() => {
      expect(mockService.fetchKlines).toHaveBeenCalledWith({
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
      expect(mockService.fetchKlines).toHaveBeenCalledWith({
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

    expect(mockService.fetchKlines).toHaveBeenCalledWith({
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

    expect(mockService.fetchKlines).not.toHaveBeenCalled();
    expect(result.current.data).toBe(null);
  });

  it('should start fetching when enabled changes to true', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h', enabled }),
      { initialProps: { enabled: false } }
    );

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(mockService.fetchKlines).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockService.fetchKlines).toHaveBeenCalled();
  });

  it('should clear error on successful refetch', async () => {
    const error = new Error('Network error');
    mockService.fetchKlines = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mockKlineData);

    const { result } = renderHook(() =>
      useMarketData(mockService, { symbol: 'BTCUSDT', interval: '1h' })
    );

    await waitFor(() => {
      expect(result.current.error).toEqual(error);
    });

    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.error).toBe(null);
      expect(result.current.data).toEqual(mockKlineData);
    });
  });
});
