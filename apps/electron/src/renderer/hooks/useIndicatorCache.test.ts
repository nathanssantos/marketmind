import type { Kline } from '@marketmind/types';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useIndicatorMemoize, useStableKlines } from './useIndicatorCache';

const createMockKline = (close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('useIndicatorMemoize', () => {
  it('should memoize result when inputs unchanged', () => {
    const calculator = vi.fn(() => ({ values: [1, 2, 3] }));
    const klines = [createMockKline(100, 0), createMockKline(101, 1)];
    const params = [14];

    const { rerender } = renderHook(
      ({ klines, params }) =>
        useIndicatorMemoize(calculator, klines, params),
      { initialProps: { klines, params } }
    );

    expect(calculator).toHaveBeenCalledTimes(1);

    rerender({ klines, params });
    expect(calculator).toHaveBeenCalledTimes(1);
  });

  it('should recalculate when klines change', () => {
    const calculator = vi.fn(() => ({ values: [1, 2, 3] }));
    const klines1 = [createMockKline(100, 0)];
    const klines2 = [createMockKline(100, 0), createMockKline(101, 1)];
    const params = [14];

    const { rerender } = renderHook(
      ({ klines, params }) =>
        useIndicatorMemoize(calculator, klines, params),
      { initialProps: { klines: klines1, params } }
    );

    expect(calculator).toHaveBeenCalledTimes(1);

    rerender({ klines: klines2, params });
    expect(calculator).toHaveBeenCalledTimes(2);
  });

  it('should recalculate when params change', () => {
    const calculator = vi.fn(() => ({ values: [1, 2, 3] }));
    const klines = [createMockKline(100, 0)];

    const { rerender } = renderHook(
      ({ klines, params }) =>
        useIndicatorMemoize(calculator, klines, params),
      { initialProps: { klines, params: [14] } }
    );

    expect(calculator).toHaveBeenCalledTimes(1);

    rerender({ klines, params: [20] });
    expect(calculator).toHaveBeenCalledTimes(2);
  });

  it('should handle empty klines', () => {
    const calculator = vi.fn(() => ({ values: [] }));
    const klines: Kline[] = [];
    const params = [14];

    const { result } = renderHook(() =>
      useIndicatorMemoize(calculator, klines, params)
    );

    expect(result.current).toEqual({ values: [] });
  });
});

describe('useStableKlines', () => {
  it('should return same reference when klines unchanged', () => {
    const klines = [createMockKline(100, 0), createMockKline(101, 1)];

    const { result, rerender } = renderHook(
      ({ klines }) => useStableKlines(klines),
      { initialProps: { klines } }
    );

    const firstResult = result.current;

    rerender({ klines });
    expect(result.current).toBe(firstResult);
  });

  it('should return new reference when klines change', () => {
    const klines1 = [createMockKline(100, 0)];
    const klines2 = [createMockKline(100, 0), createMockKline(101, 1)];

    const { result, rerender } = renderHook(
      ({ klines }) => useStableKlines(klines),
      { initialProps: { klines: klines1 } }
    );

    const firstResult = result.current;

    rerender({ klines: klines2 });
    expect(result.current).not.toBe(firstResult);
    expect(result.current).toHaveLength(2);
  });

  it('should detect change in last kline close price', () => {
    const klines1 = [createMockKline(100, 0)];
    const klines2 = [createMockKline(101, 0)];

    const { result, rerender } = renderHook(
      ({ klines }) => useStableKlines(klines),
      { initialProps: { klines: klines1 } }
    );

    const firstResult = result.current;

    rerender({ klines: klines2 });
    expect(result.current).not.toBe(firstResult);
  });

  it('should handle empty array', () => {
    const { result } = renderHook(() => useStableKlines([]));
    expect(result.current).toEqual([]);
  });
});
