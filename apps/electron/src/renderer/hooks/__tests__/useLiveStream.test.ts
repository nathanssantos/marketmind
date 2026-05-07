import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const listeners: Record<string, Handler[]> = {};

const on = vi.fn((event: string, handler: Handler) => {
  (listeners[event] ??= []).push(handler);
});

vi.mock('../socket', () => ({
  useSocketEvent: (event: string, handler: Handler, enabled = true): void => {
    if (!enabled) return;
    on(event, handler);
  },
}));

vi.mock('../../utils/canvas/perfMonitor', () => ({
  perfMonitor: {
    recordLiveStreamReceived: vi.fn(),
    recordLiveStreamFlushed: vi.fn(),
  },
}));

const panState = { active: false };
vi.mock('../../store/panActivityStore', () => ({
  isPanActive: () => panState.active,
}));

vi.mock('../../services/liveStreamPolicies', () => ({
  getPolicyFor: vi.fn(() => ({ throttleMs: 100, panMultiplier: 4, coalesce: 'shallow' })),
  DEFAULT_POLICY: { throttleMs: 0, panMultiplier: 1, coalesce: 'off' },
}));

import { useLiveStream } from '../useLiveStream';

const emit = (event: string, payload: unknown) => {
  (listeners[event] ?? []).forEach((h) => h(payload));
};

interface BookTicker {
  symbol: string;
  bidPrice: number;
  askPrice: number;
}

describe('useLiveStream', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    on.mockClear();
    panState.active = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('publishes the very first payload immediately (no throttle delay on cold start)', () => {
    const { result } = renderHook(() => useLiveStream('bookTicker:update'));
    expect(result.current).toBeNull();

    const payload: BookTicker = { symbol: 'BTC', bidPrice: 100, askPrice: 101 };
    act(() => emit('bookTicker:update', payload));
    expect(result.current).toEqual(payload);
  });

  it('coalesces a burst inside the throttle window and flushes the latest', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveStream('bookTicker:update'));

    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 100, askPrice: 101 }));
    expect(result.current).toEqual({ symbol: 'BTC', bidPrice: 100, askPrice: 101 });

    // Next two updates land inside the 100ms throttle window — they
    // shouldn't reach React state synchronously.
    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 102, askPrice: 103 }));
    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 105, askPrice: 106 }));
    expect(result.current).toEqual({ symbol: 'BTC', bidPrice: 100, askPrice: 101 });

    // Advance past the window — the LATEST payload is published, not
    // the first or second of the burst.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toEqual({ symbol: 'BTC', bidPrice: 105, askPrice: 106 });
  });

  it('drops the flush when the new payload is shallow-equal to the last published one', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveStream('bookTicker:update'));

    const first: BookTicker = { symbol: 'BTC', bidPrice: 100, askPrice: 101 };
    act(() => emit('bookTicker:update', first));
    const after1 = result.current;

    // Same VALUES, different reference. Without coalesce we'd publish.
    // With shallow coalesce, the flush is suppressed — `result.current`
    // keeps the first reference unchanged.
    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 100, askPrice: 101 }));
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toBe(after1);
  });

  it('extends the throttle window while pan is active (panMultiplier 4×)', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLiveStream('bookTicker:update'));

    // Cold-start emit publishes immediately.
    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 100, askPrice: 101 }));

    panState.active = true;

    // Emit during pan: stretches the next flush from 100ms to 400ms.
    act(() => emit('bookTicker:update', { symbol: 'BTC', bidPrice: 200, askPrice: 201 }));

    // Old window (100ms) — should NOT have flushed yet.
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(result.current).toEqual({ symbol: 'BTC', bidPrice: 100, askPrice: 101 });

    // Past the stretched window.
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toEqual({ symbol: 'BTC', bidPrice: 200, askPrice: 201 });
  });

  it('does not subscribe when enabled=false', () => {
    renderHook(() => useLiveStream('bookTicker:update', { enabled: false }));
    expect(on).not.toHaveBeenCalled();
  });
});
