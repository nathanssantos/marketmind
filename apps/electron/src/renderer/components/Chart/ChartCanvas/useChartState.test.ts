import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartState, useCursorManager } from './useChartState';
import type { Kline } from '@marketmind/types';

const createMockKline = (overrides?: Partial<Kline>): Kline => ({
  symbol: 'BTCUSDT',
  interval: '1h',
  openTime: Date.now() - 3600000,
  closeTime: Date.now(),
  open: '50000',
  high: '51000',
  low: '49000',
  close: '50500',
  volume: '1000',
  quoteVolume: '50000000',
  trades: 10000,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '25000000',
  ...overrides,
});

describe('useChartState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    expect(result.current.state.tooltipData.visible).toBe(false);
    expect(result.current.state.tooltipData.kline).toBeNull();
    expect(result.current.state.orderToClose).toBeNull();
    expect(result.current.state.stochasticData).toBeNull();
  });

  it('should set tooltip data', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    const mockKline = createMockKline();

    act(() => {
      result.current.actions.setTooltip({
        kline: mockKline,
        x: 100,
        y: 200,
        visible: true,
        klineIndex: 5,
      });
    });

    expect(result.current.state.tooltipData.visible).toBe(true);
    expect(result.current.state.tooltipData.kline).toEqual(mockKline);
    expect(result.current.state.tooltipData.x).toBe(100);
    expect(result.current.state.tooltipData.y).toBe(200);
    expect(result.current.state.tooltipData.klineIndex).toBe(5);
  });

  it('should hide tooltip', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    const mockKline = createMockKline();

    act(() => {
      result.current.actions.setTooltip({
        kline: mockKline,
        x: 100,
        y: 200,
        visible: true,
      });
    });

    expect(result.current.state.tooltipData.visible).toBe(true);

    act(() => {
      result.current.actions.hideTooltip();
    });

    expect(result.current.state.tooltipData.visible).toBe(false);
    expect(result.current.state.tooltipData.kline).toBeNull();
  });

  it('should set orderToClose', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    act(() => {
      result.current.actions.setOrderToClose('order-123');
    });

    expect(result.current.state.orderToClose).toBe('order-123');

    act(() => {
      result.current.actions.setOrderToClose(null);
    });

    expect(result.current.state.orderToClose).toBeNull();
  });

  it('should provide refs for interaction tracking', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    expect(result.current.refs.mousePosition.current).toBeNull();
    expect(result.current.refs.orderPreview.current).toBeNull();
    expect(result.current.refs.hoveredMAIndex.current).toBeUndefined();
    expect(result.current.refs.cursor.current).toBe('crosshair');
    expect(result.current.refs.tooltipEnabled.current).toBe(true);
  });

  it('should allow modifying refs', () => {
    const { result } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    result.current.refs.mousePosition.current = { x: 50, y: 100 };
    result.current.refs.orderPreview.current = { price: 50000, type: 'long' };
    result.current.refs.hoveredMAIndex.current = 2;

    expect(result.current.refs.mousePosition.current).toEqual({ x: 50, y: 100 });
    expect(result.current.refs.orderPreview.current).toEqual({ price: 50000, type: 'long' });
    expect(result.current.refs.hoveredMAIndex.current).toBe(2);
  });
});

describe('useCursorManager', () => {
  it('should return crosshair as default cursor', () => {
    const canvasRef = { current: null };
    const { result } = renderHook(() => useCursorManager(canvasRef));

    expect(result.current.getCursor()).toBe('crosshair');
  });

  it('should update cursor when setCursor is called', () => {
    const canvasRef = { current: null };
    const { result } = renderHook(() => useCursorManager(canvasRef));

    act(() => {
      result.current.setCursor('pointer');
    });

    expect(result.current.getCursor()).toBe('pointer');
  });

  it('should update canvas style when canvas element exists', () => {
    const mockCanvas = document.createElement('canvas');
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() => useCursorManager(canvasRef));

    act(() => {
      result.current.setCursor('grab');
    });

    expect(mockCanvas.style.cursor).toBe('grab');
    expect(result.current.getCursor()).toBe('grab');
  });

  it('should not update if cursor is the same', () => {
    const mockCanvas = document.createElement('canvas');
    mockCanvas.style.cursor = 'crosshair';
    const canvasRef = { current: mockCanvas };
    const { result } = renderHook(() => useCursorManager(canvasRef));

    act(() => {
      result.current.setCursor('crosshair');
    });

    expect(mockCanvas.style.cursor).toBe('crosshair');
  });
});

describe('useChartState cleanup', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should clean up timeouts on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    const { result, unmount } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    result.current.refs.interactionTimeout.current = setTimeout(() => {}, 1000);
    result.current.refs.tooltipDebounce.current = setTimeout(() => {}, 1000);

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });

  it('should clean up animation frames on unmount', () => {
    const cancelAnimationFrameSpy = vi.spyOn(global, 'cancelAnimationFrame');
    const { result, unmount } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    result.current.refs.mouseMoveRaf.current = requestAnimationFrame(() => {});

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('should handle cleanup when refs are null', () => {
    const { unmount } = renderHook(() =>
      useChartState({ klines: [], movingAverages: [] })
    );

    expect(() => unmount()).not.toThrow();
  });
});
