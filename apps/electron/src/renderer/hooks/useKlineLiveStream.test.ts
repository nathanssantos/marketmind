import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline } from '@marketmind/types';

const { streamHandlers } = vi.hoisted(() => ({ streamHandlers: [] as Array<(kline: unknown) => void> }));

vi.mock('./useBackendKlines', () => ({
  useKlineStream: (_symbol: string, _interval: string, onUpdate: (kline: unknown) => void) => {
    streamHandlers[0] = onUpdate;
    return { isConnected: true, isSubscribing: false };
  },
}));

import { MIN_UPDATE_INTERVAL_MS } from '../constants/defaults';
import { useKlineLiveStream } from './useKlineLiveStream';
import { useConnectionStore } from '../store/connectionStore';

const MINUTE_MS = 60_000;
const T0 = Date.UTC(2026, 8, 26, 12, 0, 0);
const WATCHDOG_TICK_MS = 1_000;
const RAF_MS = 16;
const SILENCE_MS_FOR_1M = 2 * MINUTE_MS;

const bar = (openTime: number, close = '100'): Kline => ({
  openTime,
  closeTime: openTime + MINUTE_MS - 1,
  open: close,
  high: close,
  low: close,
  close,
  volume: '1',
  quoteVolume: '100',
  trades: 1,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

const baseKlines = [bar(T0 - 2 * MINUTE_MS), bar(T0 - MINUTE_MS), bar(T0, '105')];

const renderStream = () => {
  const refetchKlines = vi.fn().mockResolvedValue(undefined);
  const hook = renderHook(() =>
    useKlineLiveStream({ symbol: 'BTCUSDT', timeframe: '1m', marketType: 'FUTURES', baseKlines, enabled: true, refetchKlines }),
  );
  return { hook, refetchKlines };
};

const currentKlines = (hook: ReturnType<typeof renderStream>['hook']): Kline[] =>
  hook.result.current.klineSource.klinesRef.current;

const emitStreamUpdate = (openTime: number, close: string): void => {
  act(() => {
    streamHandlers[0]?.({
      symbol: 'BTCUSDT',
      interval: '1m',
      marketType: 'FUTURES',
      openTime,
      closeTime: openTime + MINUTE_MS - 1,
      open: '105',
      high: close,
      low: '104',
      close,
      volume: '3',
      isClosed: false,
      timestamp: Date.now(),
    });
    vi.advanceTimersByTime(MIN_UPDATE_INTERVAL_MS + 3 * RAF_MS);
  });
};

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date', 'requestAnimationFrame', 'cancelAnimationFrame'],
  });
  vi.setSystemTime(T0 + 30_000);
  useConnectionStore.getState().setWsConnected(true);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useKlineLiveStream rollover watchdog', () => {
  it('opens the next bar locally when the stream misses the rollover', () => {
    const { hook, refetchKlines } = renderStream();

    act(() => {
      vi.setSystemTime(T0 + MINUTE_MS + 2_500);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    const klines = currentKlines(hook);
    const last = klines[klines.length - 1]!;
    expect(last.openTime).toBe(T0 + MINUTE_MS);
    expect(last.open).toBe('105');
    expect(last.close).toBe('105');
    expect(last.volume).toBe('0');
    expect(refetchKlines).not.toHaveBeenCalled();
  });

  it('keeps the current bar while the rollover grace period has not elapsed', () => {
    const { hook } = renderStream();

    act(() => {
      vi.setSystemTime(T0 + MINUTE_MS + 500);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    const klines = currentKlines(hook);
    expect(klines[klines.length - 1]!.openTime).toBe(T0);
  });

  it('replaces the synthetic bar when the real update for that minute arrives', () => {
    const { hook } = renderStream();
    act(() => {
      vi.setSystemTime(T0 + MINUTE_MS + 2_500);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    emitStreamUpdate(T0 + MINUTE_MS, '108');

    const klines = currentKlines(hook);
    expect(klines.filter((k) => k.openTime === T0 + MINUTE_MS)).toHaveLength(1);
    expect(klines[klines.length - 1]!.close).toBe('108');
  });

  it('does not synthesize while the socket is disconnected', () => {
    useConnectionStore.getState().setWsConnected(false);
    const { hook } = renderStream();

    act(() => {
      vi.setSystemTime(T0 + MINUTE_MS + 2_500);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    const klines = currentKlines(hook);
    expect(klines[klines.length - 1]!.openTime).toBe(T0);
  });

  it('asks for a resync instead of synthesizing across a large hole', () => {
    const { hook, refetchKlines } = renderStream();

    act(() => {
      vi.setSystemTime(T0 + 10 * MINUTE_MS + 2_500);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    const klines = currentKlines(hook);
    expect(klines[klines.length - 1]!.openTime).toBe(T0);
    expect(refetchKlines).toHaveBeenCalledTimes(1);
  });

  it('refetches once when the stream stays silent, then backs off', () => {
    const { refetchKlines } = renderStream();

    act(() => {
      vi.setSystemTime(T0 + 30_000 + SILENCE_MS_FOR_1M + WATCHDOG_TICK_MS);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });
    expect(refetchKlines).toHaveBeenCalledTimes(1);

    act(() => {
      vi.setSystemTime(T0 + 30_000 + SILENCE_MS_FOR_1M + 20 * WATCHDOG_TICK_MS);
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });
    expect(refetchKlines).toHaveBeenCalledTimes(1);
  });

  it('refetches when the stream resumes with a hole after the last bar', () => {
    const { hook, refetchKlines } = renderStream();

    emitStreamUpdate(T0 + 3 * MINUTE_MS, '111');
    act(() => {
      vi.advanceTimersByTime(WATCHDOG_TICK_MS);
    });

    const klines = currentKlines(hook);
    expect(klines[klines.length - 1]!.openTime).toBe(T0 + 3 * MINUTE_MS);
    expect(refetchKlines).toHaveBeenCalledTimes(1);
  });

  it('refetches when the socket reconnects', () => {
    const { refetchKlines } = renderStream();

    act(() => {
      useConnectionStore.getState().setWsConnected(false);
    });
    act(() => {
      useConnectionStore.getState().setWsConnected(true);
    });

    expect(refetchKlines).toHaveBeenCalledTimes(1);
  });
});
