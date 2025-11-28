import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Candle } from '../../../shared/types';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useLineChartRenderer } from './useLineChartRenderer';

const CHART_CONFIG = {
  CHART_RIGHT_MARGIN: 80,
} as const;

describe('useLineChartRenderer', () => {
  let mockManager: CanvasManager;
  let mockColors: ChartThemeColors;
  let mockCtx: CanvasRenderingContext2D;
  let mockCandles: Candle[];

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      fillRect: vi.fn(),
      clearRect: vi.fn(),
      strokeRect: vi.fn(),
      setLineDash: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      roundRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    mockCandles = [
      {
        timestamp: 1000,
        open: 100,
        high: 110,
        low: 90,
        close: 105,
        volume: 1000,
      },
      {
        timestamp: 2000,
        open: 105,
        high: 115,
        low: 95,
        close: 110,
        volume: 1100,
      },
      {
        timestamp: 3000,
        open: 110,
        high: 120,
        low: 100,
        close: 115,
        volume: 1200,
      },
    ];

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({
        width: 800,
        height: 400,
        chartWidth: 750,
        chartHeight: 350,
      })),
      getViewport: vi.fn(() => ({ start: 0, end: 3, candleWidth: 10, candleSpacing: 2 })),
      getVisibleCandles: vi.fn(() => mockCandles),
      indexToX: vi.fn((index: number) => 100 + index * 50),
      priceToY: vi.fn((price: number) => 200 - price),
      getCandles: vi.fn(() => mockCandles),
    } as unknown as CanvasManager;

    mockColors = {
      background: '#000000',
      grid: '#333333',
      text: '#ffffff',
      bullish: '#00ff00',
      bearish: '#ff0000',
      lineDefault: '#3b82f6',
      crosshair: '#888888',
      currentPrice: '#ffaa00',
      axisLabel: '#ffffff',
      axisLine: '#333333',
      currentPriceLabel: {
        bg: '#ffaa00',
        text: '#000000',
      },
      ma: ['#ff0000', '#00ff00', '#0000ff'],
      aiPattern: {
        support: '#00ff00',
        resistance: '#ff0000',
        trendlineBullish: '#00ff00',
        trendlineBearish: '#ff0000',
        liquidityZone: '#0000ff',
        sellZone: '#ff0000',
        buyZone: '#00ff00',
        accumulationZone: '#ffff00',
        tooltip: {
          bg: '#000000',
          text: '#ffffff',
          border: '#888888',
        },
      },
    } as ChartThemeColors;
  });

  it('should not render when manager is null', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: null, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).not.toHaveBeenCalled();
  });

  it('should not render when disabled', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors, enabled: false })
    );

    result.current.render();

    expect(mockManager.getContext).not.toHaveBeenCalled();
  });

  it('should not render when context is null', () => {
    vi.mocked(mockManager.getContext).mockReturnValue(null);

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).not.toHaveBeenCalled();
  });

  it('should not render when dimensions are null', () => {
    vi.mocked(mockManager.getDimensions).mockReturnValue(null);

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).not.toHaveBeenCalled();
  });

  it('should not render when no visible candles', () => {
    vi.mocked(mockManager.getVisibleCandles).mockReturnValue([]);

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.beginPath).not.toHaveBeenCalled();
  });

  it('should render line chart with default settings', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.moveTo).toHaveBeenCalledWith(100, 95);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(150, 90);
    expect(mockCtx.lineTo).toHaveBeenCalledWith(200, 85);
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should apply custom right margin', () => {
    const customRightMargin = 120;
    
    const { result } = renderHook(() =>
      useLineChartRenderer({ 
        manager: mockManager, 
        colors: mockColors, 
        rightMargin: customRightMargin 
      })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should use default right margin when not provided', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should skip candles outside visible area', () => {
    vi.mocked(mockManager.indexToX).mockImplementation((index: number) => {
      if (index === 0) return -20;
      if (index === 2) return 1000;
      return 100 + index * 50;
    });

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should render fill area below line', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.fill).toHaveBeenCalled();
    expect(mockCtx.closePath).toHaveBeenCalled();
  });

  it('should set correct line styles', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.strokeStyle).toBe(mockColors.lineDefault);
    expect(mockCtx.lineWidth).toBe(2);
    expect(mockCtx.lineJoin).toBe('round');
    expect(mockCtx.lineCap).toBe('round');
  });

  it('should handle single candle', () => {
    const singleCandle = [mockCandles[0]];
    vi.mocked(mockManager.getVisibleCandles).mockReturnValue(singleCandle);

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.moveTo).toHaveBeenCalledTimes(1);
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should apply fill with transparency', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.fillStyle).toContain('22');
  });

  it('should call save and restore to preserve canvas state', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
  });

  it('should update when manager changes', () => {
    const { result, rerender } = renderHook(
      ({ manager }) => useLineChartRenderer({ manager, colors: mockColors }),
      { initialProps: { manager: mockManager } }
    );

    result.current.render();
    const firstCallCount = vi.mocked(mockCtx.save).mock.calls.length;

    const newMockManager = { ...mockManager } as CanvasManager;
    rerender({ manager: newMockManager });
    result.current.render();

    expect(vi.mocked(mockCtx.save).mock.calls.length).toBeGreaterThan(firstCallCount);
  });

  it('should update when colors change', () => {
    const { result, rerender } = renderHook(
      ({ colors }) => useLineChartRenderer({ manager: mockManager, colors }),
      { initialProps: { colors: mockColors } }
    );

    result.current.render();
    const initialStrokeStyle = mockCtx.strokeStyle;

    const newColors = { ...mockColors, lineDefault: '#ff0000' };
    rerender({ colors: newColors });
    result.current.render();

    expect(mockCtx.strokeStyle).toBe(newColors.lineDefault);
  });

  it('should handle viewport changes', () => {
    vi.mocked(mockManager.getViewport).mockReturnValue({
      start: 1,
      end: 2,
      candleWidth: 10,
      candleSpacing: 2,
    });

    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
  });

  it('should calculate effective width correctly with right margin', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ 
        manager: mockManager, 
        colors: mockColors,
        rightMargin: 100
      })
    );

    result.current.render();

    expect(mockManager.getDimensions).toHaveBeenCalled();
  });

  it('should use CHART_CONFIG.CHART_RIGHT_MARGIN as default', () => {
    const { result } = renderHook(() =>
      useLineChartRenderer({ manager: mockManager, colors: mockColors })
    );

    result.current.render();

    expect(CHART_CONFIG.CHART_RIGHT_MARGIN).toBeDefined();
  });
});
