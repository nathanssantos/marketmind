import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  useVirtualizedKlines,
  getVisibleRange,
  isKlineVisible,
  calculateOptimalBuffer,
} from './useVirtualizedKlines';
import type { Kline, Viewport } from '@marketmind/types';

const createMockKlines = (count: number): Kline[] => {
  return Array.from({ length: count }, (_, i) => ({
    openTime: i * 60000,
    closeTime: (i + 1) * 60000 - 1,
    open: 100 + i,
    high: 105 + i,
    low: 95 + i,
    close: 102 + i,
    volume: 1000 + i * 10,
    quoteVolume: 100000 + i * 1000,
    trades: 100 + i,
    takerBuyBaseVolume: 500 + i * 5,
    takerBuyQuoteVolume: 50000 + i * 500,
    symbol: 'BTCUSDT',
    interval: '1m',
  }));
};

const createViewport = (start: number, end: number): Viewport => ({
  start,
  end,
  klineWidth: 10,
});

describe('useVirtualizedKlines', () => {
  describe('basic functionality', () => {
    it('should return all klines when disabled', () => {
      const klines = createMockKlines(100);
      const viewport = createViewport(40, 60);

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport, enabled: false })
      );

      expect(result.current.visibleKlines).toHaveLength(100);
      expect(result.current.isBuffered).toBe(false);
    });

    it('should return empty array for empty klines', () => {
      const klines: Kline[] = [];
      const viewport = createViewport(0, 10);

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport })
      );

      expect(result.current.visibleKlines).toHaveLength(0);
      expect(result.current.totalCount).toBe(0);
    });

    it('should slice klines with buffer', () => {
      const klines = createMockKlines(200);
      const viewport = createViewport(100, 120);
      const buffer = 20;

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport, buffer })
      );

      expect(result.current.startIndex).toBe(80);
      expect(result.current.endIndex).toBe(140);
      expect(result.current.visibleKlines).toHaveLength(60);
      expect(result.current.isBuffered).toBe(true);
    });

    it('should clamp to array bounds', () => {
      const klines = createMockKlines(50);
      const viewport = createViewport(0, 20);
      const buffer = 30;

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport, buffer })
      );

      expect(result.current.startIndex).toBe(0);
      expect(result.current.endIndex).toBe(50);
    });

    it('should handle viewport at end of array', () => {
      const klines = createMockKlines(100);
      const viewport = createViewport(90, 100);
      const buffer = 20;

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport, buffer })
      );

      expect(result.current.startIndex).toBe(70);
      expect(result.current.endIndex).toBe(100);
    });
  });

  describe('caching behavior', () => {
    it('should return cached result when viewport within buffer', () => {
      const klines = createMockKlines(200);
      const buffer = 50;

      const { result, rerender } = renderHook(
        ({ viewport }) => useVirtualizedKlines({ klines, viewport, buffer }),
        { initialProps: { viewport: createViewport(100, 120) } }
      );

      const firstResult = result.current;

      rerender({ viewport: createViewport(105, 125) });

      expect(result.current).toBe(firstResult);
    });

    it('should recalculate when viewport moves outside buffer', () => {
      const klines = createMockKlines(200);
      const buffer = 20;

      const { result, rerender } = renderHook(
        ({ viewport }) => useVirtualizedKlines({ klines, viewport, buffer }),
        { initialProps: { viewport: createViewport(50, 70) } }
      );

      const firstStartIndex = result.current.startIndex;

      rerender({ viewport: createViewport(100, 120) });

      expect(result.current.startIndex).not.toBe(firstStartIndex);
    });

    it('should recalculate when klines reference changes', () => {
      let klines = createMockKlines(100);
      const viewport = createViewport(40, 60);

      const { result, rerender } = renderHook(
        ({ klines: k }) => useVirtualizedKlines({ klines: k, viewport }),
        { initialProps: { klines } }
      );

      const firstResult = result.current;

      klines = createMockKlines(100);
      rerender({ klines });

      expect(result.current).not.toBe(firstResult);
    });
  });

  describe('totalCount', () => {
    it('should return correct total count', () => {
      const klines = createMockKlines(500);
      const viewport = createViewport(200, 250);

      const { result } = renderHook(() =>
        useVirtualizedKlines({ klines, viewport, buffer: 30 })
      );

      expect(result.current.totalCount).toBe(500);
    });
  });
});

describe('getVisibleRange', () => {
  it('should calculate visible range without buffer', () => {
    const viewport = createViewport(10.5, 20.7);
    const result = getVisibleRange(viewport, 100);

    expect(result.start).toBe(10);
    expect(result.end).toBe(21);
  });

  it('should calculate visible range with buffer', () => {
    const viewport = createViewport(50, 70);
    const result = getVisibleRange(viewport, 100, 20);

    expect(result.start).toBe(30);
    expect(result.end).toBe(90);
  });

  it('should clamp to array bounds', () => {
    const viewport = createViewport(5, 15);
    const result = getVisibleRange(viewport, 20, 30);

    expect(result.start).toBe(0);
    expect(result.end).toBe(20);
  });
});

describe('isKlineVisible', () => {
  it('should return true for kline in viewport', () => {
    const viewport = createViewport(10, 20);
    expect(isKlineVisible(15, viewport)).toBe(true);
  });

  it('should return false for kline outside viewport', () => {
    const viewport = createViewport(10, 20);
    expect(isKlineVisible(5, viewport)).toBe(false);
    expect(isKlineVisible(25, viewport)).toBe(false);
  });

  it('should include buffer in visibility check', () => {
    const viewport = createViewport(10, 20);
    expect(isKlineVisible(5, viewport, 10)).toBe(true);
    expect(isKlineVisible(25, viewport, 10)).toBe(true);
  });

  it('should handle edge cases', () => {
    const viewport = createViewport(10, 20);
    expect(isKlineVisible(10, viewport)).toBe(true);
    expect(isKlineVisible(20, viewport)).toBe(true);
    expect(isKlineVisible(9, viewport)).toBe(false);
    expect(isKlineVisible(21, viewport)).toBe(false);
  });
});

describe('calculateOptimalBuffer', () => {
  it('should calculate buffer based on viewport range', () => {
    const buffer = calculateOptimalBuffer(100);
    expect(buffer).toBe(50);
  });

  it('should increase buffer with higher scroll speed', () => {
    const normalBuffer = calculateOptimalBuffer(100, 1);
    const fastBuffer = calculateOptimalBuffer(100, 2);

    expect(fastBuffer).toBeGreaterThan(normalBuffer);
  });

  it('should clamp scroll speed factor', () => {
    const verySlowBuffer = calculateOptimalBuffer(100, 0.1);
    const minBuffer = calculateOptimalBuffer(100, 0.5);

    expect(verySlowBuffer).toBe(minBuffer);

    const veryFastBuffer = calculateOptimalBuffer(100, 10);
    const maxBuffer = calculateOptimalBuffer(100, 2);

    expect(veryFastBuffer).toBe(maxBuffer);
  });
});
