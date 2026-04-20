import type { Kline, Viewport } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChartData } from './useChartData';

const mockKlines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
  openTime: Date.now() + i * 60000,
  open: 100 + i,
  high: 105 + i,
  low: 95 + i,
  close: 100 + i,
  volume: 1000,
  closeTime: Date.now() + (i + 1) * 60000,
  quoteAssetVolume: 100000,
  numberOfTrades: 100,
  takerBuyBaseAssetVolume: 500,
  takerBuyQuoteAssetVolume: 50000,
}));

const mockViewport: Viewport = {
  start: 0,
  end: 50,
  priceMin: 90,
  priceMax: 150,
  width: 800,
  height: 600,
};

describe('useChartData', () => {
  it('should return visible klines within viewport', () => {
    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport: mockViewport,
      })
    );

    expect(result.current.visibleKlines).toHaveLength(50);
    expect(result.current.visibleStart).toBe(0);
    expect(result.current.visibleEnd).toBe(50);
  });

  it('should calculate price range', () => {
    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport: mockViewport,
      })
    );

    expect(result.current.priceRange).toBe(60);
  });

  it('should calculate time range', () => {
    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport: mockViewport,
      })
    );

    expect(result.current.timeRange).toBe(50);
  });

  it('should handle empty klines array', () => {
    const { result } = renderHook(() =>
      useChartData({
        klines: [],
        viewport: mockViewport,
      })
    );

    expect(result.current.visibleKlines).toHaveLength(0);
    expect(result.current.isEmpty).toBe(true);
  });

  it('should handle viewport beyond klines range', () => {
    const viewport: Viewport = {
      ...mockViewport,
      start: 90,
      end: 150,
    };

    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport,
      })
    );

    expect(result.current.visibleEnd).toBe(100);
    expect(result.current.visibleKlines).toHaveLength(10);
  });

  it('should handle negative viewport start', () => {
    const viewport: Viewport = {
      ...mockViewport,
      start: -10,
      end: 20,
    };

    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport,
      })
    );

    expect(result.current.visibleStart).toBe(0);
    expect(result.current.visibleKlines).toHaveLength(20);
  });

  it('should update when viewport changes', () => {
    const { result, rerender } = renderHook(
      ({ viewport }) =>
        useChartData({
          klines: mockKlines,
          viewport,
        }),
      {
        initialProps: { viewport: mockViewport },
      }
    );

    const _initialLength = result.current.visibleKlines.length;

    const newViewport: Viewport = {
      ...mockViewport,
      start: 25,
      end: 75,
    };

    rerender({ viewport: newViewport });

    expect(result.current.visibleKlines).toHaveLength(50);
    expect(result.current.visibleStart).toBe(25);
    expect(result.current.visibleEnd).toBe(75);
  });

  it('should not be empty with valid data', () => {
    const { result } = renderHook(() =>
      useChartData({
        klines: mockKlines,
        viewport: mockViewport,
      })
    );

    expect(result.current.isEmpty).toBe(false);
  });
});
