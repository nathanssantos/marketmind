import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useKlineOptimizerWorker } from './useKlineOptimizerWorker';
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

describe('useKlineOptimizerWorker', () => {
  const mockKlines = [
    createMockKline({ openTime: 1000, close: 100 }),
    createMockKline({ openTime: 2000, close: 105 }),
    createMockKline({ openTime: 3000, close: 110 }),
  ];

  it('should return null when disabled', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker(mockKlines, false));
    expect(result.current).toBeNull();
  });

  it('should return null when klines are empty', () => {
    const { result } = renderHook(() => useKlineOptimizerWorker([], true));
    expect(result.current).toBeNull();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useKlineOptimizerWorker(mockKlines, true))).not.toThrow();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useKlineOptimizerWorker(mockKlines, true));
    expect(() => unmount()).not.toThrow();
  });

  it('should handle re-render with new klines', () => {
    const { rerender } = renderHook(
      ({ klines }) => useKlineOptimizerWorker(klines, true),
      { initialProps: { klines: mockKlines } },
    );
    const newKlines = [...mockKlines, createMockKline({ openTime: 4000, close: 108 })];
    expect(() => rerender({ klines: newKlines })).not.toThrow();
  });

  it('should handle toggle from disabled to enabled', () => {
    const { rerender } = renderHook(
      ({ enabled }) => useKlineOptimizerWorker(mockKlines, enabled),
      { initialProps: { enabled: false } },
    );
    expect(() => rerender({ enabled: true })).not.toThrow();
  });

  it('should accept custom detailedCount', () => {
    expect(() => renderHook(() => useKlineOptimizerWorker(mockKlines, true, 100))).not.toThrow();
  });

  it('should return null when toggled from enabled to disabled', () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useKlineOptimizerWorker(mockKlines, enabled),
      { initialProps: { enabled: true } },
    );
    rerender({ enabled: false });
    expect(result.current).toBeNull();
  });

  it('should handle re-render without issues', () => {
    const { rerender } = renderHook(() => useKlineOptimizerWorker(mockKlines, true));
    expect(() => rerender()).not.toThrow();
    expect(() => rerender()).not.toThrow();
  });

  it('should handle single kline', () => {
    const singleKline = [createMockKline()];
    expect(() => renderHook(() => useKlineOptimizerWorker(singleKline, true))).not.toThrow();
  });
});
