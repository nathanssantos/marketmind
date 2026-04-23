import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const listeners: Record<string, Handler[]> = {};

const on = vi.fn((event: string, handler: Handler) => {
  (listeners[event] ??= []).push(handler);
});
const off = vi.fn((event: string, handler: Handler) => {
  listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
});

vi.mock('../useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    on,
    off,
  }),
}));

import { useStreamHealth } from '../useStreamHealth';

const emit = (event: string, payload: unknown) => {
  (listeners[event] ?? []).forEach((h) => h(payload));
};

describe('useStreamHealth', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    on.mockClear();
    off.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts healthy and tracks backend stream:health events', () => {
    const { result } = renderHook(() =>
      useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' }),
    );

    expect(result.current.status).toBe('healthy');

    act(() => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        reason: 'binance-stream-silent',
        lastMessageAt: 1000,
      });
    });

    expect(result.current.status).toBe('degraded');
    expect(result.current.reason).toBe('binance-stream-silent');

    act(() => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'healthy',
        lastMessageAt: 2000,
      });
    });

    expect(result.current.status).toBe('healthy');
    expect(result.current.reason).toBeNull();
  });

  it('ignores events for a different symbol or interval', () => {
    const { result } = renderHook(() =>
      useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' }),
    );

    act(() => {
      emit('stream:health', {
        symbol: 'ETHUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: 1000,
      });
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '5m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: 1000,
      });
    });

    expect(result.current.status).toBe('healthy');
  });

  it('flips to healthy on any matching kline:update', () => {
    const { result } = renderHook(() =>
      useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' }),
    );

    act(() => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: 1000,
      });
    });

    expect(result.current.status).toBe('degraded');

    act(() => {
      emit('kline:update', { symbol: 'BTCUSDT', interval: '1m' });
    });

    expect(result.current.status).toBe('healthy');
  });

  it('marks degraded via local silence timer when no frames arrive', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' }),
    );

    act(() => {
      emit('kline:update', { symbol: 'BTCUSDT', interval: '1m' });
    });

    expect(result.current.status).toBe('healthy');

    act(() => {
      vi.advanceTimersByTime(61_000);
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current.status).toBe('degraded');
    expect(result.current.reason).toBe('local-silence-timeout');
  });

  it('resets state when target symbol/interval changes', () => {
    const { result, rerender } = renderHook(
      ({ symbol, interval }: { symbol: string; interval: string }) =>
        useStreamHealth({ symbol, interval, marketType: 'FUTURES' }),
      { initialProps: { symbol: 'BTCUSDT', interval: '1m' } },
    );

    act(() => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: 1000,
      });
    });
    expect(result.current.status).toBe('degraded');

    rerender({ symbol: 'ETHUSDT', interval: '1m' });
    expect(result.current.status).toBe('healthy');
    expect(result.current.reason).toBeNull();
  });
});
