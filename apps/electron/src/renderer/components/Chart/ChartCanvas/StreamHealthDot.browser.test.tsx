import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../components/ui/color-mode', () => ({
  useColorMode: () => ({ colorMode: 'dark', toggleColorMode: vi.fn(), setColorMode: vi.fn() }),
  ColorModeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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
import { StreamHealthDot } from './StreamHealthDot';

const emit = (event: string, payload: unknown): void => {
  (listeners[event] ?? []).forEach((h) => h(payload));
};

function TestHarness(): JSX.Element {
  const health = useStreamHealth({ symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES' });
  return (
    <ChakraProvider value={defaultSystem}>
      <StreamHealthDot status={health.status} />
    </ChakraProvider>
  );
}

describe('StreamHealthDot + useStreamHealth (browser)', () => {
  beforeEach(() => {
    Object.keys(listeners).forEach((k) => delete listeners[k]);
    on.mockClear();
    off.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('no dot while stream is healthy', () => {
    render(<TestHarness />);
    expect(screen.queryByTestId('stream-health-dot')).toBeNull();
  });

  test('dot appears immediately when backend emits degraded', async () => {
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', reason: 'binance-stream-silent',
        lastMessageAt: Date.now() - 120_000,
      });
    });

    expect(screen.getByTestId('stream-health-dot')).toBeTruthy();
  });

  test('dot disappears after hide-debounce when backend reports healthy', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
    });
    expect(screen.getByTestId('stream-health-dot')).toBeTruthy();

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'healthy', lastMessageAt: Date.now(),
      });
    });
    expect(screen.getByTestId('stream-health-dot')).toBeTruthy();

    await act(async () => {
      vi.advanceTimersByTime(3_500);
    });
    expect(screen.queryByTestId('stream-health-dot')).toBeNull();
  });

  test('stays visible during a flicker (degraded → healthy → degraded within debounce)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
    });

    await act(async () => {
      emit('kline:update', {
        symbol: 'BTCUSDT', interval: '1m',
        openTime: Date.now(), closeTime: Date.now() + 60_000,
        open: '50000', high: '50500', low: '49500', close: '50200',
        volume: '10', isClosed: false, timestamp: Date.now(),
      });
      vi.advanceTimersByTime(500);
    });
    expect(screen.getByTestId('stream-health-dot')).toBeTruthy();

    await act(async () => {
      emit('stream:health', {
        symbol: 'BTCUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('stream-health-dot')).toBeTruthy();
  });

  test('ignores events for a different symbol', async () => {
    render(<TestHarness />);

    await act(async () => {
      emit('stream:health', {
        symbol: 'ETHUSDT', interval: '1m', marketType: 'FUTURES',
        status: 'degraded', lastMessageAt: Date.now(),
      });
    });

    expect(screen.queryByTestId('stream-health-dot')).toBeNull();
  });
});
