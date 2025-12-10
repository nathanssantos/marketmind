import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartAnimation } from './useChartAnimation';

describe('useChartAnimation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with stopped state', () => {
    const { result } = renderHook(() => useChartAnimation());

    expect(result.current.isAnimating).toBe(false);
    expect(result.current.fps).toBe(0);
    expect(result.current.frameCount).toBe(0);
  });

  it('should start animation', () => {
    const { result } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.start();
    });

    expect(result.current.isAnimating).toBe(true);
  });

  it('should stop animation', () => {
    const { result } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.start();
    });

    expect(result.current.isAnimating).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isAnimating).toBe(false);
  });

  it('should toggle animation state', () => {
    const { result } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isAnimating).toBe(true);

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isAnimating).toBe(false);
  });

  it('should call onFrame when animating', async () => {
    vi.useRealTimers();
    const onFrame = vi.fn();
    const { result } = renderHook(() => useChartAnimation({ onFrame }));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(onFrame).toHaveBeenCalled();
    }, { timeout: 1000 });

    act(() => {
      result.current.stop();
    });
    vi.useFakeTimers();
  });

  it('should increment frame count', async () => {
    vi.useRealTimers();
    const { result } = renderHook(() => useChartAnimation());

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(result.current.frameCount).toBeGreaterThan(0);
    }, { timeout: 1000 });

    act(() => {
      result.current.stop();
    });
    vi.useFakeTimers();
  });

  it('should not start when disabled', () => {
    const { result } = renderHook(() =>
      useChartAnimation({ enabled: false })
    );

    act(() => {
      result.current.start();
    });

    expect(result.current.isAnimating).toBe(false);
  });

  it('should not start when already animating', () => {
    const { result } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.start();
    });

    const firstState = result.current.isAnimating;

    act(() => {
      result.current.start();
    });

    expect(result.current.isAnimating).toBe(firstState);
  });

  it('should not stop when not animating', () => {
    const { result } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.stop();
    });

    expect(result.current.isAnimating).toBe(false);
  });

  it('should request single render', () => {
    const onFrame = vi.fn();
    const { result } = renderHook(() => useChartAnimation({ onFrame }));

    act(() => {
      result.current.requestRender();
    });

    expect(onFrame).toHaveBeenCalledTimes(0);

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(result.current.isAnimating).toBe(false);
  });

  it('should cleanup on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(
      window,
      'cancelAnimationFrame'
    );
    const { result, unmount } = renderHook(() => useChartAnimation());

    act(() => {
      result.current.start();
    });

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
  });

  it('should respect custom fps', async () => {
    vi.useRealTimers();
    const onFrame = vi.fn();
    const { result } = renderHook(() =>
      useChartAnimation({ fps: 30, onFrame })
    );

    await act(async () => {
      result.current.start();
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    act(() => {
      result.current.stop();
    });

    expect(onFrame.mock.calls.length).toBeLessThanOrEqual(35);
    expect(onFrame.mock.calls.length).toBeGreaterThanOrEqual(24);
    vi.useFakeTimers();
  });

  it('should pass timestamp and deltaTime to onFrame', async () => {
    vi.useRealTimers();
    const onFrame = vi.fn();
    const { result } = renderHook(() => useChartAnimation({ onFrame }));

    await act(async () => {
      result.current.start();
    });

    await waitFor(() => {
      expect(onFrame).toHaveBeenCalled();
    }, { timeout: 1000 });

    act(() => {
      result.current.stop();
    });

    const [timestamp, deltaTime] = onFrame.mock.calls[0];
    expect(typeof timestamp).toBe('number');
    expect(typeof deltaTime).toBe('number');
    vi.useFakeTimers();
  });
});
