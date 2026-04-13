import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useBoundsWorker } from './useBoundsWorker';
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

describe('useBoundsWorker', () => {
  const mockKlines = [
    createMockKline({ openTime: 1000, close: 100 }),
    createMockKline({ openTime: 2000, close: 105 }),
    createMockKline({ openTime: 3000, close: 110 }),
  ];

  it('should return null when disabled', () => {
    const { result } = renderHook(() => useBoundsWorker(mockKlines, 0, 10, false));
    expect(result.current).toBeNull();
  });

  it('should return null when klines are empty', () => {
    const { result } = renderHook(() => useBoundsWorker([], 0, 10, true));
    expect(result.current).toBeNull();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useBoundsWorker(mockKlines, 0, 10, true))).not.toThrow();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useBoundsWorker(mockKlines, 0, 10, true));
    expect(() => unmount()).not.toThrow();
  });

  it('should handle re-render with new viewport', () => {
    const { rerender } = renderHook(
      ({ start, end }) => useBoundsWorker(mockKlines, start, end, true),
      { initialProps: { start: 0, end: 10 } },
    );
    expect(() => rerender({ start: 5, end: 15 })).not.toThrow();
  });

  it('should handle re-render with new klines', () => {
    const { rerender } = renderHook(
      ({ klines }) => useBoundsWorker(klines, 0, 10, true),
      { initialProps: { klines: mockKlines } },
    );
    const newKlines = [...mockKlines, createMockKline({ openTime: 4000, close: 115 })];
    expect(() => rerender({ klines: newKlines })).not.toThrow();
  });

  it('should handle toggle from disabled to enabled', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useBoundsWorker(mockKlines, 0, 10, enabled),
      { initialProps: { enabled: false } },
    );
    expect(() => rerender({ enabled: true })).not.toThrow();
  });

  it('should return null when toggled from enabled to disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useBoundsWorker(mockKlines, 0, 10, enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current).toBeNull();
  });

  it('should handle zero-width viewport', () => {
    expect(() => renderHook(() => useBoundsWorker(mockKlines, 5, 5, true))).not.toThrow();
  });
});
