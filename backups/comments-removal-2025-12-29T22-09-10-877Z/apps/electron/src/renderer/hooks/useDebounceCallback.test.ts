import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDebounceCallback } from './useDebounceCallback';

describe('useDebounceCallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should call callback after delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 500));

    act(() => {
      result.current();
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should debounce multiple calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 300));

    act(() => {
      result.current();
      result.current();
      result.current();
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should reset timer on subsequent calls', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 200));

    act(() => {
      result.current();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      result.current();
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to callback', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebounceCallback((a: number, b: string) => callback(a, b), 100)
    );

    act(() => {
      result.current(42, 'test');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledWith(42, 'test');
  });

  it('should use latest arguments when debounced', () => {
    const callback = vi.fn();
    const { result } = renderHook(() =>
      useDebounceCallback((value: string) => callback(value), 100)
    );

    act(() => {
      result.current('first');
      result.current('second');
      result.current('third');
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith('third');
  });

  it('should cleanup timer on unmount', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useDebounceCallback(callback, 500));

    act(() => {
      result.current();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('should update callback reference', () => {
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    const { result, rerender } = renderHook(
      ({ cb }) => useDebounceCallback(cb, 100),
      { initialProps: { cb: callback1 } }
    );

    act(() => {
      result.current();
    });

    rerender({ cb: callback2 });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should handle zero delay', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounceCallback(callback, 0));

    act(() => {
      result.current();
    });

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should return a stable function reference', () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(() => useDebounceCallback(callback, 100));

    const firstRef = result.current;
    rerender();
    const secondRef = result.current;

    expect(firstRef).toBe(secondRef);
  });

  it('should create new reference when delay changes', () => {
    const callback = vi.fn();
    const { result, rerender } = renderHook(
      ({ delay }) => useDebounceCallback(callback, delay),
      { initialProps: { delay: 100 } }
    );

    const firstRef = result.current;
    rerender({ delay: 200 });
    const secondRef = result.current;

    expect(firstRef).not.toBe(secondRef);
  });
});
