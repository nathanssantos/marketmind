import type { Kline } from '@shared/types';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChartViewport } from './useChartViewport';

const mockKlines: Kline[] = Array.from({ length: 100 }, (_, i) => ({
  openTime: Date.now() + i * 60000,
  open: 100 + Math.random() * 10,
  high: 105 + Math.random() * 10,
  low: 95 + Math.random() * 10,
  close: 100 + Math.random() * 10,
  volume: 1000,
  closeTime: Date.now() + (i + 1) * 60000,
  quoteAssetVolume: 100000,
  numberOfTrades: 100,
  takerBuyBaseAssetVolume: 500,
  takerBuyQuoteAssetVolume: 50000,
}));

describe('useChartViewport', () => {
  it('should initialize with default viewport', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
      })
    );

    expect(result.current.viewport).toBeDefined();
    expect(result.current.zoom).toBe(1);
    expect(result.current.pan).toBe(0);
  });

  it('should zoom in', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
      })
    );

    const initialZoom = result.current.zoom;

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.zoom).toBeGreaterThan(initialZoom);
    expect(result.current.zoom).toBe(initialZoom * 1.2);
  });

  it('should zoom out', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
        initialZoom: 2,
      })
    );

    const initialZoom = result.current.zoom;

    act(() => {
      result.current.zoomOut();
    });

    expect(result.current.zoom).toBeLessThan(initialZoom);
    expect(result.current.zoom).toBe(initialZoom / 1.2);
  });

  it('should not zoom beyond limits', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
      })
    );

    act(() => {
      for (let i = 0; i < 20; i++) {
        result.current.zoomIn();
      }
    });

    expect(result.current.zoom).toBeLessThanOrEqual(10);

    act(() => {
      for (let i = 0; i < 50; i++) {
        result.current.zoomOut();
      }
    });

    expect(result.current.zoom).toBeGreaterThanOrEqual(0.1);
  });

  it('should pan left and right', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
      })
    );

    act(() => {
      result.current.panRight();
    });

    expect(result.current.pan).toBe(10);

    act(() => {
      result.current.panLeft();
    });

    expect(result.current.pan).toBe(0);
  });

  it('should not pan below zero', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
      })
    );

    act(() => {
      result.current.panLeft();
    });

    expect(result.current.pan).toBe(0);
  });

  it('should reset to initial state', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
        initialZoom: 2,
        initialPan: 5,
      })
    );

    act(() => {
      result.current.zoomIn();
      result.current.panRight();
    });

    act(() => {
      result.current.reset();
    });

    expect(result.current.zoom).toBe(2);
    expect(result.current.pan).toBe(5);
  });

  it('should fit to data', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
        initialZoom: 3,
        initialPan: 10,
      })
    );

    act(() => {
      result.current.fitToData();
    });

    expect(result.current.zoom).toBe(1);
    expect(result.current.pan).toBe(0);
  });

  it('should handle empty klines array', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: [],
        width: 800,
        height: 600,
      })
    );

    expect(result.current.viewport.start).toBe(0);
    expect(result.current.viewport.end).toBe(100);
  });

  it('should update viewport when dimensions change', () => {
    const { result, rerender } = renderHook(
      ({ width, height }) =>
        useChartViewport({
          klines: mockKlines,
          width,
          height,
        }),
      {
        initialProps: { width: 800, height: 600 },
      }
    );

    const initialViewport = result.current.viewport;

    rerender({ width: 1000, height: 800 });

    expect(result.current.viewport.width).toBe(1000);
    expect(result.current.viewport.height).toBe(800);
    expect(result.current.viewport).not.toEqual(initialViewport);
  });

  it('should apply padding to price range', () => {
    const { result } = renderHook(() =>
      useChartViewport({
        klines: mockKlines,
        width: 800,
        height: 600,
        padding: 0.1,
      })
    );

    const prices = mockKlines.flatMap((k) => [k.open, k.high, k.low, k.close]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    expect(result.current.viewport.priceMin).toBeLessThan(minPrice);
    expect(result.current.viewport.priceMax).toBeGreaterThan(maxPrice);
  });
});
