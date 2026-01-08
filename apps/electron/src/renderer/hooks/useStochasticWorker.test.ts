import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStochasticWorker } from './useStochasticWorker';
import { workerPool } from '@/renderer/utils/WorkerPool';
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    workerPool.terminateAll();
  });

  it('should initialize hook without throwing', () => {
    expect(() => renderHook(() => useStochasticWorker())).not.toThrow();
  });

  it('should return calculateStochastic function', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(result.current.calculateStochastic).toBeTypeOf('function');
  });

  it('should return terminate function', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(result.current.terminate).toBeTypeOf('function');
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useStochasticWorker());
    expect(() => unmount()).not.toThrow();
  });

  it('should terminate without throwing', () => {
    const { result } = renderHook(() => useStochasticWorker());
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should register worker in pool on mount', () => {
    renderHook(() => useStochasticWorker());
    expect(workerPool.has('stochastic')).toBe(true);
  });

  it('should return a promise when calculateStochastic is called', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];
    const promise = result.current.calculateStochastic(mockKlines, 14, 3, 3);
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should handle worker not being available after unmount', async () => {
    const { result, unmount } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    const promise = result.current.calculateStochastic(mockKlines, 14, 3, 3);
    expect(promise).toBeInstanceOf(Promise);

    unmount();
  });

  it('should accept different k period, k smoothing, and d period parameters', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    expect(() => result.current.calculateStochastic(mockKlines, 5, 3, 3)).not.toThrow();
    expect(() => result.current.calculateStochastic(mockKlines, 14, 3, 5)).not.toThrow();
    expect(() => result.current.calculateStochastic(mockKlines, 21, 5, 7)).not.toThrow();
  });

  it('should handle multiple consecutive calls', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    const promise1 = result.current.calculateStochastic(mockKlines, 14, 3, 3);
    const promise2 = result.current.calculateStochastic(mockKlines, 14, 3, 3);

    expect(promise1).toBeInstanceOf(Promise);
    expect(promise2).toBeInstanceOf(Promise);
    expect(promise1).not.toBe(promise2);
  });

  it('should handle empty klines array', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const promise = result.current.calculateStochastic([], 14, 3, 3);
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should work with multiple klines', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [
      createMockKline({ openTime: 1000, close: 100 }),
      createMockKline({ openTime: 2000, close: 105 }),
      createMockKline({ openTime: 3000, close: 110 }),
      createMockKline({ openTime: 4000, close: 108 }),
      createMockKline({ openTime: 5000, close: 112 }),
    ];

    const promise = result.current.calculateStochastic(mockKlines, 14, 3, 3);
    expect(promise).toBeInstanceOf(Promise);
  });

  it('should not throw when terminate is called multiple times', () => {
    const { result } = renderHook(() => useStochasticWorker());

    expect(() => result.current.terminate()).not.toThrow();
    expect(() => result.current.terminate()).not.toThrow();
    expect(() => result.current.terminate()).not.toThrow();
  });

  it('should handle re-render without issues', () => {
    const { rerender } = renderHook(() => useStochasticWorker());

    expect(() => rerender()).not.toThrow();
    expect(() => rerender()).not.toThrow();
  });

  it('should maintain function identity across re-renders', () => {
    const { result, rerender } = renderHook(() => useStochasticWorker());

    const initialCalculate = result.current.calculateStochastic;
    const initialTerminate = result.current.terminate;

    rerender();

    expect(result.current.calculateStochastic).toBe(initialCalculate);
    expect(result.current.terminate).toBe(initialTerminate);
  });

  it('should accept valid kPeriod values', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    [5, 10, 14, 21, 28].forEach((kPeriod) => {
      expect(() => result.current.calculateStochastic(mockKlines, kPeriod, 3, 3)).not.toThrow();
    });
  });

  it('should accept valid kSmoothing values', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    [1, 3, 5, 7].forEach((kSmoothing) => {
      expect(() => result.current.calculateStochastic(mockKlines, 14, kSmoothing, 3)).not.toThrow();
    });
  });

  it('should accept valid dPeriod values', () => {
    const { result } = renderHook(() => useStochasticWorker());
    const mockKlines = [createMockKline()];

    [3, 5, 7, 9, 14].forEach((dPeriod) => {
      expect(() => result.current.calculateStochastic(mockKlines, 14, 3, dPeriod)).not.toThrow();
    });
  });
});
