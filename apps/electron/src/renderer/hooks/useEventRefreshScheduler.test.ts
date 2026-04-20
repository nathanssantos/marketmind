import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEventRefreshScheduler, type ActiveWatcher } from './useEventRefreshScheduler';

describe('useEventRefreshScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should not call onRefresh when disabled', () => {
    const onRefresh = vi.fn();

    renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: [],
        chartInterval: '1h',
        enabled: false,
        onRefresh,
      })
    );

    vi.advanceTimersByTime(3600000);

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('should use chart interval when no watchers are active', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: [],
        chartInterval: '30m',
        enabled: true,
        onRefresh,
      })
    );

    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should use minimum watcher interval when watchers are active', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    const watchers: ActiveWatcher[] = [
      { interval: '4h' },
      { interval: '30m' },
      { interval: '1h' },
    ];

    renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: watchers,
        chartInterval: '1d',
        enabled: true,
        onRefresh,
      })
    );

    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should refresh at cycle boundaries', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:15:00Z').getTime();
    vi.setSystemTime(now);

    renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: [],
        chartInterval: '30m',
        enabled: true,
        onRefresh,
      })
    );

    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(15 * 60 * 1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30 * 60 * 1000);

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('should clean up timers on unmount', () => {
    const onRefresh = vi.fn();
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const _clearIntervalSpy = vi.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: [],
        chartInterval: '1h',
        enabled: true,
        onRefresh,
      })
    );

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should reconfigure when watchers change', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    const { rerender } = renderHook(
      ({ watchers }) =>
        useEventRefreshScheduler({
          activeWatchers: watchers,
          chartInterval: '1h',
          enabled: true,
          onRefresh,
        }),
      { initialProps: { watchers: [] as ActiveWatcher[] } }
    );

    vi.advanceTimersByTime(1 * 60 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ watchers: [{ interval: '30m' }] });

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('should handle interval change', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    const { rerender } = renderHook(
      ({ interval }) =>
        useEventRefreshScheduler({
          activeWatchers: [],
          chartInterval: interval,
          enabled: true,
          onRefresh,
        }),
      { initialProps: { interval: '1h' as const } }
    );

    vi.advanceTimersByTime(1 * 60 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ interval: '4h' as const });

    vi.advanceTimersByTime(4 * 60 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('should stop refresh when disabled after being enabled', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    const { rerender } = renderHook(
      ({ enabled }) =>
        useEventRefreshScheduler({
          activeWatchers: [],
          chartInterval: '30m',
          enabled,
          onRefresh,
        }),
      { initialProps: { enabled: true } }
    );

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('should default to 1h when chart interval is invalid', () => {
    const onRefresh = vi.fn();
    const now = new Date('2024-01-15T14:00:00Z').getTime();
    vi.setSystemTime(now);

    renderHook(() =>
      useEventRefreshScheduler({
        activeWatchers: [],
        chartInterval: 'invalid' as any,
        enabled: true,
        onRefresh,
      })
    );

    vi.advanceTimersByTime(1 * 60 * 60 * 1000);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
