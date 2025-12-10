import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBacktestPlayback } from './useBacktestPlayback';

describe('useBacktestPlayback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.state).toBe('idle');
    expect(result.current.speed).toBe(1);
    expect(result.current.progress).toBe(0);
  });

  it('should initialize with custom start index', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, startIndex: 50 })
    );

    expect(result.current.currentIndex).toBe(50);
  });

  it('should auto-play when enabled', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, autoPlay: true })
    );

    expect(result.current.state).toBe('playing');
  });

  it('should play and increment index', async () => {
    vi.useRealTimers();
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.play();
    });

    expect(result.current.state).toBe('playing');

    await waitFor(() => {
      expect(result.current.currentIndex).toBeGreaterThan(0);
    }, { timeout: 2000 });

    act(() => {
      result.current.pause();
    });
    vi.useFakeTimers();
  });

  it('should pause playback', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.play();
    });

    act(() => {
      result.current.pause();
    });

    expect(result.current.state).toBe('paused');
  });

  it('should stop and reset to start', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, startIndex: 50 })
    );

    act(() => {
      result.current.stop();
    });

    expect(result.current.state).toBe('idle');
    expect(result.current.currentIndex).toBe(0);
  });

  it('should step forward', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    const initialIndex = result.current.currentIndex;

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentIndex).toBe(initialIndex + 1);
  });

  it('should step backward', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, startIndex: 50 })
    );

    const initialIndex = result.current.currentIndex;

    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentIndex).toBe(initialIndex - 1);
  });

  it('should not step backward below 0', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.stepBackward();
    });

    expect(result.current.currentIndex).toBe(0);
  });

  it('should not step forward beyond total', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, startIndex: 99 })
    );

    act(() => {
      result.current.stepForward();
    });

    expect(result.current.currentIndex).toBe(99);
  });

  it('should change playback speed', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.setSpeed(2);
    });

    expect(result.current.speed).toBe(2);
  });

  it('should go to specific index', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.goToIndex(75);
    });

    expect(result.current.currentIndex).toBe(75);
  });

  it('should clamp index within bounds', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.goToIndex(150);
    });

    expect(result.current.currentIndex).toBe(99);

    act(() => {
      result.current.goToIndex(-10);
    });

    expect(result.current.currentIndex).toBe(0);
  });

  it('should calculate progress correctly', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, startIndex: 50 })
    );

    expect(result.current.progress).toBe(50);
  });

  it('should complete when reaching end', async () => {
    vi.useRealTimers();
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 5, startIndex: 4 })
    );

    act(() => {
      result.current.play();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('completed');
    }, { timeout: 7000 });
    vi.useFakeTimers();
  }, 10000);

  it('should call onIndexChange callback', async () => {
    const onIndexChange = vi.fn();
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, onIndexChange })
    );

    act(() => {
      result.current.stepForward();
    });

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it('should call onStateChange callback', () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, onStateChange })
    );

    act(() => {
      result.current.play();
    });

    expect(onStateChange).toHaveBeenCalledWith('playing');
  });

  it('should reset to default speed', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100, defaultSpeed: 2 })
    );

    act(() => {
      result.current.setSpeed(8);
      result.current.reset();
    });

    expect(result.current.speed).toBe(2);
    expect(result.current.state).toBe('idle');
    expect(result.current.currentIndex).toBe(0);
  });

  it('should not play when already playing', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.play();
    });

    const stateAfterFirstPlay = result.current.state;

    act(() => {
      result.current.play();
    });

    expect(result.current.state).toBe(stateAfterFirstPlay);
  });

  it('should not pause when not playing', () => {
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.pause();
    });

    expect(result.current.state).toBe('idle');
  });

  it('should restart from beginning when playing after completion', async () => {
    vi.useRealTimers();
    const { result } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 5 })
    );

    act(() => {
      result.current.goToIndex(4);
      result.current.play();
    });

    await waitFor(() => {
      expect(result.current.state).toBe('completed');
    }, { timeout: 2000 });

    act(() => {
      result.current.play();
    });

    expect(result.current.currentIndex).toBe(0);
    expect(result.current.state).toBe('playing');

    act(() => {
      result.current.pause();
    });
    vi.useFakeTimers();
  });

  it('should cleanup interval on unmount', () => {
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    const { result, unmount } = renderHook(() =>
      useBacktestPlayback({ totalKlines: 100 })
    );

    act(() => {
      result.current.play();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
