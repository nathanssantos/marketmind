import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useStochasticWorker } from './useStochasticWorker';
import type { Kline } from '@marketmind/types';

const createMockKline = (overrides: Partial<Kline> = {}): Kline => ({
  openTime: 1000,
  closeTime: 2000,
  open: 100,
  high: 110,
  low: 90,
  close: 105,
  volume: 1000,
  quoteVolume: 100000,
  trades: 100,
  takerBuyBaseVolume: 500,
  takerBuyQuoteVolume: 50000,
  ...overrides,
});

describe('useStochasticWorker', () => {
  const mockKlines = [
    createMockKline({ openTime: 1000, close: 100 }),
    createMockKline({ openTime: 2000, close: 105 }),
    createMockKline({ openTime: 3000, close: 110 }),
  ];

  it('should return null when disabled', () => {
    const { result } = renderHook(() => useStochasticWorker(mockKlines, false));
    expect(result.current).toBeNull();
  });

  it('should return null when klines are empty', () => {
    const { result } = renderHook(() => useStochasticWorker([], true));
    expect(result.current).toBeNull();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true))).not.toThrow();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useStochasticWorker(mockKlines, true));
    expect(() => unmount()).not.toThrow();
  });

  it('should handle re-render with new klines', () => {
    const { rerender } = renderHook(({ klines }) => useStochasticWorker(klines, true), {
      initialProps: { klines: mockKlines },
    });
    const newKlines = [...mockKlines, createMockKline({ openTime: 4000, close: 108 })];
    expect(() => rerender({ klines: newKlines })).not.toThrow();
  });

  it('should handle toggle from disabled to enabled', () => {
    const { rerender } = renderHook(({ enabled }) => useStochasticWorker(mockKlines, enabled), {
      initialProps: { enabled: false },
    });
    expect(() => rerender({ enabled: true })).not.toThrow();
  });

  it('should accept custom kPeriod', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 5))).not.toThrow();
  });

  it('should accept custom kSmoothing', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 14, 5))).not.toThrow();
  });

  it('should accept custom dPeriod', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 14, 3, 5))).not.toThrow();
  });

  it('should accept all custom parameters', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 21, 5, 7))).not.toThrow();
  });

  it('should handle re-render without issues', () => {
    const { rerender } = renderHook(() => useStochasticWorker(mockKlines, true));
    expect(() => rerender()).not.toThrow();
    expect(() => rerender()).not.toThrow();
  });

  it('should return null when toggled from enabled to disabled', () => {
    const { result, rerender } = renderHook(({ enabled }) => useStochasticWorker(mockKlines, enabled), {
      initialProps: { enabled: true },
    });
    rerender({ enabled: false });
    expect(result.current).toBeNull();
  });

  it('should accept various kPeriod values', () => {
    [5, 10, 14, 21, 28].forEach((kPeriod) => {
      expect(() => renderHook(() => useStochasticWorker(mockKlines, true, kPeriod))).not.toThrow();
    });
  });

  it('should accept various kSmoothing values', () => {
    [1, 3, 5, 7].forEach((kSmoothing) => {
      expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 14, kSmoothing))).not.toThrow();
    });
  });

  it('should accept various dPeriod values', () => {
    [3, 5, 7, 9, 14].forEach((dPeriod) => {
      expect(() => renderHook(() => useStochasticWorker(mockKlines, true, 14, 3, dPeriod))).not.toThrow();
    });
  });

  it('should use default parameters when not specified', () => {
    expect(() => renderHook(() => useStochasticWorker(mockKlines, true))).not.toThrow();
  });

  it('should handle single kline', () => {
    const singleKline = [createMockKline()];
    expect(() => renderHook(() => useStochasticWorker(singleKline, true))).not.toThrow();
  });

  it('should handle many klines', () => {
    const manyKlines = Array.from({ length: 100 }, (_, i) =>
      createMockKline({ openTime: i * 1000, close: 100 + Math.sin(i) * 10 }),
    );
    expect(() => renderHook(() => useStochasticWorker(manyKlines, true))).not.toThrow();
  });
});
