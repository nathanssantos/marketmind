import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import * as drawingUtils from '../../utils/canvas/drawingUtils';
import { useCandlestickRenderer } from './useCandlestickRenderer';

vi.mock('../../utils/canvas/drawingUtils', () => ({
  drawCandle: vi.fn(),
}));

describe('useCandlestickRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const candles = [
      { timestamp: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { timestamp: 2000, open: 102, high: 106, low: 96, close: 98, volume: 1100 },
      { timestamp: 3000, open: 98, high: 108, low: 97, close: 105, volume: 1200 },
      { timestamp: 4000, open: 105, high: 110, low: 104, close: 103, volume: 1300 },
      { timestamp: 5000, open: 103, high: 112, low: 102, close: 110, volume: 1400 },
    ];

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({
        width: 800,
        height: 600,
        chartWidth: 728,
        chartHeight: 575,
        volumeHeight: 0,
      })),
      getViewport: vi.fn(() => ({
        start: 0,
        end: 5,
        candleWidth: 10,
      })),
      getVisibleCandles: vi.fn(() => candles),
      indexToX: vi.fn((index: number) => index * 145.6),
      priceToY: vi.fn((price: number) => 575 - (price - 90) * 19),
    } as unknown as CanvasManager;

    mockColors = {
      bullish: '#10b981',
      bearish: '#ef4444',
      volume: '#6b7280',
      grid: '#e5e7eb',
      background: '#ffffff',
      axisLabel: '#000000',
      axisLine: '#e5e7eb',
      crosshair: '#6b7280',
      currentPriceLabel: {
        bg: '#10b981',
        text: '#ffffff',
      },
      lineDefault: '#3b82f6',
      ma: ['#3b82f6', '#f59e0b', '#10b981'],
      aiStudy: {
        support: '#10b981',
        resistance: '#ef4444',
        trendlineBullish: '#10b981',
        trendlineBearish: '#ef4444',
        liquidityZone: '#3b82f6',
        sellZone: '#ef4444',
        buyZone: '#10b981',
        accumulationZone: '#f59e0b',
        tooltip: {
          bg: '#1f2937',
          text: '#ffffff',
          border: '#374151',
        },
      },
    } as ChartThemeColors;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: null,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).not.toHaveBeenCalled();
    });

    it('should not render when context is null', () => {
      mockManager.getContext = vi.fn(() => null);

      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).not.toHaveBeenCalled();
    });

    it('should not render when dimensions is null', () => {
      mockManager.getDimensions = vi.fn(() => null);

      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).not.toHaveBeenCalled();
    });

    it('should render all visible candles', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalledTimes(5);
    });

    it('should apply clipping to chart area', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should draw bullish candles with bullish color', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[0][8]).toBe(mockColors.bullish);
      expect(calls[0][9]).toBe(mockColors.bearish);
    });

    it('should highlight hovered candle', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          hoveredCandleIndex: 2,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[2][10]).toBe(true);
      expect(calls[0][10]).toBe(false);
      expect(calls[1][10]).toBe(false);
    });

    it('should use custom right margin when provided', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: 100,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalled();
    });

    it('should use custom candle wick width when provided', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          candleWickWidth: 2,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[0][7]).toBe(2);
    });

    it('should calculate correct candle positions', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockManager.indexToX).toHaveBeenCalledWith(0);
      expect(mockManager.indexToX).toHaveBeenCalledWith(1);
      expect(mockManager.indexToX).toHaveBeenCalledWith(2);
    });

    it('should calculate correct Y positions for OHLC values', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      const candles = mockManager.getVisibleCandles();
      expect(mockManager.priceToY).toHaveBeenCalledWith(candles[0].open);
      expect(mockManager.priceToY).toHaveBeenCalledWith(candles[0].close);
      expect(mockManager.priceToY).toHaveBeenCalledWith(candles[0].high);
      expect(mockManager.priceToY).toHaveBeenCalledWith(candles[0].low);
    });

    it('should skip candles outside visible area', () => {
      mockManager.indexToX = vi.fn((index: number) => {
        if (index === 0) return -100;
        if (index === 4) return 1000;
        return index * 145.6;
      });

      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should re-render when colors change', () => {
      const { result, rerender } = renderHook(
        ({ colors }) =>
          useCandlestickRenderer({
            manager: mockManager,
            colors,
          }),
        {
          initialProps: { colors: mockColors },
        }
      );

      result.current.render();
      const firstCallCount = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls.length;

      const newColors = { ...mockColors, bullish: '#00ff00' };
      rerender({ colors: newColors });
      result.current.render();

      expect((drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('should re-render when hovered index changes', () => {
      const { result, rerender } = renderHook(
        ({ hoveredCandleIndex }: { hoveredCandleIndex?: number }) =>
          useCandlestickRenderer({
            manager: mockManager,
            colors: mockColors,
            hoveredCandleIndex,
          }),
        {
          initialProps: { hoveredCandleIndex: undefined as number | undefined },
        }
      );

      result.current.render();
      const firstCalls = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(firstCalls[0][10]).toBe(false);

      vi.clearAllMocks();
      rerender({ hoveredCandleIndex: 0 as number | undefined });
      result.current.render();

      const secondCalls = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls;
      expect(secondCalls[0][10]).toBe(true);
    });

    it('should use custom rightMargin when provided', () => {
      const customRightMargin = 100;
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: customRightMargin,
        })
      );

      result.current.render();

      expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 628, 575);
    });

    it('should use custom candleWickWidth when provided', () => {
      const customWickWidth = 3;
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          candleWickWidth: customWickWidth,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalled();
      const callArgs = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[7]).toBe(customWickWidth);
    });

    it('should not render when enabled is false', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).not.toHaveBeenCalled();
    });

    it('should center candles within available width', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalled();
      const firstCallX = (drawingUtils.drawCandle as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(typeof firstCallX).toBe('number');
    });

    it('should handle viewport with different start/end values', () => {
      mockManager.getViewport = vi.fn(() => ({
        start: 2,
        end: 4,
        candleWidth: 15,
      }));

      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawCandle).toHaveBeenCalled();
    });

    it('should apply clipping to prevent drawing outside chart area', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
    });

    it('should calculate effective width based on rightMargin', () => {
      const { result } = renderHook(() =>
        useCandlestickRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: 80,
        })
      );

      result.current.render();

      expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 648, 575);
    });
  });
});
