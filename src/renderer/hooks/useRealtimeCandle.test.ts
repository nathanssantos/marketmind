import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRealtimeCandle } from './useRealtimeCandle';
import { MarketDataService } from '../services/market/MarketDataService';
import type { Kline } from '@shared/types';

describe('useRealtimeCandle', () => {
  let mockService: MarketDataService;
  let unsubscribeMock: ReturnType<typeof vi.fn>;
  const mockCandle: Candle = {
    timestamp: 1000,
    open: 100,
    high: 110,
    low: 95,
    close: 105,
    volume: 1000,
  };

  beforeEach(() => {
    unsubscribeMock = vi.fn();
    mockService = {
      subscribeToUpdates: vi.fn().mockReturnValue(unsubscribeMock),
    } as unknown as MarketDataService;
  });

  it('should subscribe to updates on mount', () => {
    renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
      })
    );

    expect(mockService.subscribeToUpdates).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      callback: expect.any(Function),
    });
  });

  it('should call onUpdate when update is received', () => {
    const onUpdate = vi.fn();

    renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
        onUpdate,
      })
    );

    const subscribeCall = (mockService.subscribeToUpdates as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const callback = subscribeCall?.callback;

    if (!callback) throw new Error('Callback not found');

    callback({ candle: mockCandle, isFinal: false, symbol: 'BTCUSDT', interval: '1h' });

    expect(onUpdate).toHaveBeenCalledWith(mockCandle, false);
  });

  it('should call onUpdate with isFinal flag', () => {
    const onUpdate = vi.fn();

    renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
        onUpdate,
      })
    );

    const subscribeCall = (mockService.subscribeToUpdates as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const callback = subscribeCall?.callback;

    if (!callback) throw new Error('Callback not found');

    callback({ candle: mockCandle, isFinal: true, symbol: 'BTCUSDT', interval: '1h' });

    expect(onUpdate).toHaveBeenCalledWith(mockCandle, true);
  });

  it('should not call onUpdate if not provided', () => {
    renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
      })
    );

    const subscribeCall = (mockService.subscribeToUpdates as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const callback = subscribeCall?.callback;

    if (!callback) throw new Error('Callback not found');

    expect(() => {
      callback({ candle: mockCandle, isFinal: false, symbol: 'BTCUSDT', interval: '1h' });
    }).not.toThrow();
  });

  it('should unsubscribe on unmount', () => {
    const { unmount } = renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
      })
    );

    expect(unsubscribeMock).not.toHaveBeenCalled();

    unmount();

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('should resubscribe when symbol changes', () => {
    const { rerender } = renderHook(
      ({ symbol }) =>
        useRealtimeCandle(mockService, {
          symbol,
          interval: '1h',
        }),
      { initialProps: { symbol: 'BTCUSDT' } }
    );

    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);
    expect(mockService.subscribeToUpdates).toHaveBeenCalledWith({
      symbol: 'BTCUSDT',
      interval: '1h',
      callback: expect.any(Function),
    });

    rerender({ symbol: 'ETHUSDT' });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(2);
    expect(mockService.subscribeToUpdates).toHaveBeenLastCalledWith({
      symbol: 'ETHUSDT',
      interval: '1h',
      callback: expect.any(Function),
    });
  });

  it('should resubscribe when interval changes', () => {
    type IntervalType = '1h' | '1d';
    
    const { rerender } = renderHook(
      ({ interval }: { interval: IntervalType }) =>
        useRealtimeCandle(mockService, {
          symbol: 'BTCUSDT',
          interval,
        }),
      { initialProps: { interval: '1h' as IntervalType } }
    );

    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);

    rerender({ interval: '1d' as IntervalType });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(2);
    expect(mockService.subscribeToUpdates).toHaveBeenLastCalledWith({
      symbol: 'BTCUSDT',
      interval: '1d',
      callback: expect.any(Function),
    });
  });

  it('should not subscribe when enabled is false', () => {
    renderHook(() =>
      useRealtimeCandle(mockService, {
        symbol: 'BTCUSDT',
        interval: '1h',
        enabled: false,
      })
    );

    expect(mockService.subscribeToUpdates).not.toHaveBeenCalled();
  });

  it('should subscribe when enabled changes to true', () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useRealtimeCandle(mockService, {
          symbol: 'BTCUSDT',
          interval: '1h',
          enabled,
        }),
      { initialProps: { enabled: false } }
    );

    expect(mockService.subscribeToUpdates).not.toHaveBeenCalled();

    rerender({ enabled: true });

    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);
  });

  it('should unsubscribe when enabled changes to false', () => {
    const { rerender } = renderHook(
      ({ enabled }) =>
        useRealtimeCandle(mockService, {
          symbol: 'BTCUSDT',
          interval: '1h',
          enabled,
        }),
      { initialProps: { enabled: true } }
    );

    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });

    expect(unsubscribeMock).toHaveBeenCalledTimes(1);
  });

  it('should update onUpdate callback without resubscribing', () => {
    const onUpdate1 = vi.fn();
    const onUpdate2 = vi.fn();

    const { rerender } = renderHook(
      ({ onUpdate }) =>
        useRealtimeCandle(mockService, {
          symbol: 'BTCUSDT',
          interval: '1h',
          onUpdate,
        }),
      { initialProps: { onUpdate: onUpdate1 } }
    );

    const subscribeCall1 = (mockService.subscribeToUpdates as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    const callback = subscribeCall1?.callback;

    if (!callback) throw new Error('Callback not found');

    callback({ candle: mockCandle, isFinal: false, symbol: 'BTCUSDT', interval: '1h' });

    expect(onUpdate1).toHaveBeenCalledWith(mockCandle, false);
    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);

    rerender({ onUpdate: onUpdate2 });

    expect(mockService.subscribeToUpdates).toHaveBeenCalledTimes(1);

    callback({ candle: mockCandle, isFinal: true, symbol: 'BTCUSDT', interval: '1h' });

    expect(onUpdate2).toHaveBeenCalledWith(mockCandle, true);
    expect(onUpdate1).toHaveBeenCalledTimes(1);
  });
});
