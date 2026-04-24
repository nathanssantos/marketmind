import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Kline, MarketType } from '@marketmind/types';

let visibilityCallback: ((state: any) => void) | undefined;

vi.mock('../useBackendKlines', () => ({
  useKlineStream: vi.fn(),
}));

vi.mock('../useVisibilityChange', () => ({
  useVisibilityChange: vi.fn((options?: { onBecameVisible?: (state: any) => void }) => {
    visibilityCallback = options?.onBecameVisible;
    return {
      isVisible: true,
      needsRefresh: false,
      clearRefreshNeeded: vi.fn(),
      lastVisibleTime: Date.now(),
    };
  }),
}));

import { useKlineLiveStream } from '../useKlineLiveStream';
import { useKlineStream } from '../useBackendKlines';

const makeKline = (openTime: number, close = '100'): Kline => ({
  openTime,
  closeTime: openTime + 59_999,
  open: '100',
  high: '110',
  low: '90',
  close,
  volume: '1000',
  quoteVolume: '100000',
  trades: 50,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
});

const BASE_TIME = 1700000000000;
const INTERVAL_MS_1H = 3_600_000;

const makeBaseKlines = (count: number, startTime = BASE_TIME): Kline[] =>
  Array.from({ length: count }, (_, i) => makeKline(startTime + i * INTERVAL_MS_1H));

describe('useKlineLiveStream', () => {
  let mockRefetch: ReturnType<typeof vi.fn>;
  let klineUpdateHandler: ((kline: any) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockRefetch = vi.fn().mockResolvedValue(undefined);
    visibilityCallback = undefined;
    klineUpdateHandler = undefined;

    (useKlineStream as ReturnType<typeof vi.fn>).mockImplementation(
      (_symbol: string, _interval: string, handler: (kline: any) => void) => {
        klineUpdateHandler = handler;
        return { isConnected: true, isSubscribing: false };
      }
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderLiveStream = (overrides = {}) => {
    const baseKlines = makeBaseKlines(10);
    return renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES' as MarketType,
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
        ...overrides,
      })
    );
  };

  it('should return baseKlines when no live updates', () => {
    const baseKlines = makeBaseKlines(5);
    const { result } = renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    expect(result.current.displayKlines).toBe(baseKlines);
  });

  it('should return empty array when baseKlines is undefined', () => {
    const { result } = renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines: undefined,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    expect(result.current.displayKlines).toEqual([]);
  });

  it('should update live klines when new kline arrives (same openTime)', async () => {
    const baseKlines = makeBaseKlines(5);
    const lastBase = baseKlines[baseKlines.length - 1]!;

    const { result } = renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
      klineUpdateHandler?.({
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: lastBase.openTime,
        closeTime: lastBase.closeTime,
        open: '100',
        high: '115',
        low: '90',
        close: '112',
        volume: '1500',
        isClosed: false,
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    const display = result.current.displayKlines;
    expect(display.length).toBe(5);
    expect(display[display.length - 1]?.close).toBe('112');
  });

  it('should append new candle when openTime advances', async () => {
    const baseKlines = makeBaseKlines(5);
    const lastBase = baseKlines[baseKlines.length - 1]!;
    const newOpenTime = lastBase.openTime + INTERVAL_MS_1H;

    const { result } = renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
      klineUpdateHandler?.({
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: newOpenTime,
        closeTime: newOpenTime + 3_599_999,
        open: '112',
        high: '115',
        low: '110',
        close: '113',
        volume: '800',
        isClosed: false,
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    expect(result.current.displayKlines.length).toBe(6);
    expect(result.current.displayKlines[5]?.close).toBe('113');
  });

  it('should process isFinal updates immediately', async () => {
    const baseKlines = makeBaseKlines(3);
    const lastBase = baseKlines[baseKlines.length - 1]!;

    const { result } = renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    await act(async () => {
      klineUpdateHandler?.({
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: lastBase.openTime,
        closeTime: lastBase.closeTime,
        open: '100',
        high: '120',
        low: '90',
        close: '118',
        volume: '2000',
        isClosed: true,
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    const lastDisplay = result.current.displayKlines[result.current.displayKlines.length - 1];
    expect(lastDisplay?.close).toBe('118');
  });

  it('should reset live klines on symbol change', async () => {
    const baseKlines = makeBaseKlines(5);
    const lastBase = baseKlines[baseKlines.length - 1]!;

    const { result, rerender } = renderHook(
      ({ symbol }: { symbol: string }) =>
        useKlineLiveStream({
          symbol,
          timeframe: '1h',
          marketType: 'FUTURES',
          baseKlines,
          enabled: true,
          refetchKlines: mockRefetch,
        }),
      { initialProps: { symbol: 'BTCUSDT' } }
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
      klineUpdateHandler?.({
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: lastBase.openTime + INTERVAL_MS_1H,
        closeTime: lastBase.openTime + INTERVAL_MS_1H + 3_599_999,
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '500',
        isClosed: false,
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    expect(result.current.displayKlines.length).toBe(6);

    rerender({ symbol: 'ETHUSDT' });

    expect(result.current.displayKlines).toBe(baseKlines);
  });

  it('should trigger refetch on visibility restore after 5+ seconds', async () => {
    renderLiveStream();

    expect(visibilityCallback).toBeDefined();

    await act(async () => {
      visibilityCallback?.({
        isVisible: true,
        wasHidden: true,
        hiddenDuration: 10_000,
        lastVisibleTime: Date.now(),
      });
      await vi.runAllTimersAsync();
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });

  it('should NOT trigger refetch on visibility restore after < 5 seconds', async () => {
    renderLiveStream();

    await act(async () => {
      visibilityCallback?.({
        isVisible: true,
        wasHidden: true,
        hiddenDuration: 3_000,
        lastVisibleTime: Date.now(),
      });
      await vi.runAllTimersAsync();
    });

    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('should trigger refetch when gap is detected', async () => {
    const baseKlines = makeBaseKlines(5);
    const lastBase = baseKlines[baseKlines.length - 1]!;
    const gapOpenTime = lastBase.openTime + INTERVAL_MS_1H * 5;

    renderHook(() =>
      useKlineLiveStream({
        symbol: 'BTCUSDT',
        timeframe: '1h',
        marketType: 'FUTURES',
        baseKlines,
        enabled: true,
        refetchKlines: mockRefetch,
      })
    );

    await act(async () => {
      vi.advanceTimersByTime(200);
      klineUpdateHandler?.({
        symbol: 'BTCUSDT',
        interval: '1h',
        openTime: gapOpenTime,
        closeTime: gapOpenTime + 3_599_999,
        open: '100',
        high: '110',
        low: '90',
        close: '105',
        volume: '500',
        isClosed: false,
        timestamp: Date.now(),
      });
      vi.advanceTimersByTime(200);
      await vi.runAllTimersAsync();
    });

    expect(mockRefetch).toHaveBeenCalled();
  });
});
