import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const listeners: Record<string, Handler[]> = {};

const on = vi.fn((event: string, handler: Handler) => {
  (listeners[event] ??= []).push(handler);
});
const off = vi.fn((event: string, handler: Handler) => {
  listeners[event] = (listeners[event] ?? []).filter((h) => h !== handler);
});

vi.mock('../../../hooks/useWebSocket', () => ({
  useWebSocket: () => ({
    isConnected: true,
    on,
    off,
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        'chart.streamHealth.degradedTitle': 'Exchange stream degraded',
        'chart.streamHealth.degradedDescription': 'No updates received — reconnecting automatically.',
      };
      return map[key] ?? key;
    },
  }),
}));

import { useStreamHealth } from '../../../hooks/useStreamHealth';
import { StreamHealthBanner } from './StreamHealthBanner';

const emit = (event: string, payload: unknown): void => {
  (listeners[event] ?? []).forEach((h) => h(payload));
};

function TestHarness(): JSX.Element {
  const health = useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' });
  return (
    <ChakraProvider value={defaultSystem}>
      <StreamHealthBanner status={health.status} />
    </ChakraProvider>
  );
}

describe('StreamHealthBanner + useStreamHealth (browser)', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    on.mockClear();
    off.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('does not render the banner while stream is healthy', () => {
    render(<TestHarness />);
    expect(screen.queryByText('Exchange stream degraded')).toBeNull();
  });

  test('renders the banner when backend emits stream:health degraded', async () => {
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        reason: 'binance-stream-silent',
        lastMessageAt: Date.now() - 120_000,
      });
    });

    expect(screen.getByText('Exchange stream degraded')).toBeTruthy();
  });

  test('hides the banner after a hide-debounce when backend emits stream:health healthy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: Date.now(),
      });
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeTruthy();

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'healthy',
        lastMessageAt: Date.now(),
      });
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeNull();
  });

  test('stays visible during a flicker (degraded → healthy → degraded within hide-debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeTruthy();

    await act(async () => {
      emit('kline:update', {
        symbol: 'BTCUSDT', interval: '1m',
        openTime: Date.now(), closeTime: Date.now() + 60_000,
        open: '50000', high: '50500', low: '49500', close: '50200',
        volume: '10', isClosed: false, timestamp: Date.now(),
      });
      vi.advanceTimersByTime(500);
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeTruthy();

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
      vi.advanceTimersByTime(100);
    });
    expect(screen.queryByText('Exchange stream degraded')).toBeTruthy();
  });

  test('ignores stream:health events for a different symbol', async () => {
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'ETHUSDT',
        interval: '1m',
        marketType: 'FUTURES',
        status: 'degraded',
        lastMessageAt: Date.now(),
      });
    });

    expect(screen.queryByText('Exchange stream degraded')).toBeNull();
  });
});
