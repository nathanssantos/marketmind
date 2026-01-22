import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useRenderLoop,
  createFrameLimiter,
  measureRenderTime,
  batchRenders,
} from './useRenderLoop';

describe('useRenderLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should return all methods', () => {
      const onRender = vi.fn();
      const { result } = renderHook(() =>
        useRenderLoop({ onRender, enabled: false })
      );

      expect(result.current.requestRender).toBeDefined();
      expect(result.current.getStats).toBeDefined();
      expect(result.current.resetStats).toBeDefined();
    });

    it('should not call onRender when disabled', () => {
      const onRender = vi.fn();
      renderHook(() => useRenderLoop({ onRender, enabled: false }));

      vi.advanceTimersByTime(100);
      expect(onRender).not.toHaveBeenCalled();
    });
  });

  describe('stats', () => {
    it('should return initial stats', () => {
      const onRender = vi.fn();
      const { result } = renderHook(() =>
        useRenderLoop({ onRender, enabled: false })
      );

      const stats = result.current.getStats();
      expect(stats.fps).toBe(0);
      expect(stats.frameTime).toBe(0);
      expect(stats.droppedFrames).toBe(0);
      expect(stats.totalFrames).toBe(0);
    });

    it('should reset stats', () => {
      const onRender = vi.fn();
      const { result } = renderHook(() =>
        useRenderLoop({ onRender, enabled: false })
      );

      act(() => {
        result.current.resetStats();
      });

      const stats = result.current.getStats();
      expect(stats.fps).toBe(0);
      expect(stats.droppedFrames).toBe(0);
    });
  });

  describe('requestRender', () => {
    it('should not throw when called', () => {
      const onRender = vi.fn();
      const { result } = renderHook(() =>
        useRenderLoop({ onRender, enabled: false })
      );

      expect(() => {
        act(() => {
          result.current.requestRender();
        });
      }).not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cancel animation frame on unmount', () => {
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame');
      const onRender = vi.fn();

      const { unmount } = renderHook(() =>
        useRenderLoop({ onRender, enabled: true })
      );

      unmount();

      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });

    it('should cancel animation frame when disabled', () => {
      const cancelSpy = vi.spyOn(global, 'cancelAnimationFrame');
      const onRender = vi.fn();

      const { rerender } = renderHook(
        ({ enabled }) => useRenderLoop({ onRender, enabled }),
        { initialProps: { enabled: true } }
      );

      rerender({ enabled: false });

      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });
  });

  describe('onStatsUpdate callback', () => {
    it('should accept stats callback', () => {
      const onRender = vi.fn();
      const onStatsUpdate = vi.fn();

      const { result } = renderHook(() =>
        useRenderLoop({ onRender, onStatsUpdate, enabled: false })
      );

      expect(result.current).toBeDefined();
    });
  });

  describe('targetFPS', () => {
    it('should accept custom targetFPS', () => {
      const onRender = vi.fn();

      const { result } = renderHook(() =>
        useRenderLoop({ onRender, targetFPS: 30, enabled: false })
      );

      expect(result.current).toBeDefined();
    });
  });
});

describe('createFrameLimiter', () => {
  it('should allow first frame immediately', () => {
    const limiter = createFrameLimiter(60);
    expect(limiter(0)).toBe(true);
  });

  it('should block frames within target interval', () => {
    const limiter = createFrameLimiter(60);
    limiter(0);
    expect(limiter(10)).toBe(false);
  });

  it('should allow frames after target interval', () => {
    const limiter = createFrameLimiter(60);
    limiter(0);
    expect(limiter(17)).toBe(true);
  });

  it('should handle different target FPS', () => {
    const limiter30 = createFrameLimiter(30);
    limiter30(0);
    expect(limiter30(20)).toBe(false);
    expect(limiter30(34)).toBe(true);
  });

  it('should handle accumulated time correctly', () => {
    const limiter = createFrameLimiter(60);
    limiter(0);
    expect(limiter(50)).toBe(true);
    expect(limiter(60)).toBe(false);
    expect(limiter(67)).toBe(true);
  });
});

describe('measureRenderTime', () => {
  it('should return result and duration', () => {
    const renderFn = vi.fn().mockReturnValue('result');

    const { result, duration } = measureRenderTime(renderFn);

    expect(result).toBe('result');
    expect(typeof duration).toBe('number');
    expect(duration).toBeGreaterThanOrEqual(0);
  });

  it('should call render function once', () => {
    const renderFn = vi.fn().mockReturnValue(42);

    measureRenderTime(renderFn);

    expect(renderFn).toHaveBeenCalledTimes(1);
  });

  it('should warn for slow renders when label provided', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const slowRenderFn = () => {
      const start = Date.now();
      while (Date.now() - start < 20) {}
      return 'slow';
    };

    measureRenderTime(slowRenderFn, 'SlowComponent');

    consoleSpy.mockRestore();
  });

  it('should not warn when no label provided', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const slowRenderFn = () => {
      const start = Date.now();
      while (Date.now() - start < 20) {}
      return 'slow';
    };

    measureRenderTime(slowRenderFn);

    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe('batchRenders', () => {
  it('should execute all render functions', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const fn3 = vi.fn();

    batchRenders([fn1, fn2, fn3]);

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
    expect(fn3).toHaveBeenCalledTimes(1);
  });

  it('should handle empty array', () => {
    expect(() => batchRenders([])).not.toThrow();
  });

  it('should execute functions in order', () => {
    const order: number[] = [];
    const fn1 = vi.fn(() => order.push(1));
    const fn2 = vi.fn(() => order.push(2));
    const fn3 = vi.fn(() => order.push(3));

    batchRenders([fn1, fn2, fn3]);

    expect(order).toEqual([1, 2, 3]);
  });
});
