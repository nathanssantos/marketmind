import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import * as drawingUtils from '../../utils/canvas/drawingUtils';
import { useKlineRenderer } from './useKlineRenderer';

vi.mock('../../utils/canvas/drawingUtils', () => ({
  drawKline: vi.fn(),
}));

describe('useKlineRenderer', () => {
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

    const klines = [
      { openTime: 1000, closeTime: 1000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 2000, closeTime: 2000, open: '102', high: '106', low: '96', close: '98', volume: '1100', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 3000, closeTime: 3000, open: '98', high: '108', low: '97', close: '105', volume: '1200', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 4000, closeTime: 4000, open: '105', high: '110', low: '104', close: '103', volume: '1300', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 5000, closeTime: 5000, open: '103', high: '112', low: '102', close: '110', volume: '1400', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
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
        klineWidth: 10,
      })),
      getVisibleKlines: vi.fn(() => klines),
      getKlines: vi.fn(() => klines),
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
      aiPattern: {
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
        useKlineRenderer({
          manager: null,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).not.toHaveBeenCalled();
    });

    it('should not render when context is null', () => {
      mockManager.getContext = vi.fn(() => null);

      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).not.toHaveBeenCalled();
    });

    it('should not render when dimensions is null', () => {
      mockManager.getDimensions = vi.fn(() => null);

      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).not.toHaveBeenCalled();
    });

    it('should render all visible klines', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalledTimes(5);
    });

    it('should apply clipping to chart area', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
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

    it('should draw bullish klines with bullish color', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[0][8]).toBe(mockColors.bullish);
      expect(calls[0][9]).toBe(mockColors.bearish);
    });

    it('should highlight hovered kline', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          hoveredKlineIndex: 2,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[2][10]).toBe(true);
      expect(calls[0][10]).toBe(false);
      expect(calls[1][10]).toBe(false);
    });

    it('should use custom right margin when provided', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: 100,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalled();
    });

    it('should use custom kline wick width when provided', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          klineWickWidth: 2,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock
        .calls;
      expect(calls[0][7]).toBe(2);
    });

    it('should calculate correct kline positions', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
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
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockManager.priceToY).toHaveBeenCalledWith(100);
      expect(mockManager.priceToY).toHaveBeenCalledWith(102);
      expect(mockManager.priceToY).toHaveBeenCalledWith(105);
      expect(mockManager.priceToY).toHaveBeenCalledWith(95);
    });

    it('should skip klines outside visible area', () => {
      mockManager.indexToX = vi.fn((index: number) => {
        if (index === 0) return -100;
        if (index === 4) return 1000;
        return index * 145.6;
      });

      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
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
          useKlineRenderer({
            manager: mockManager,
            colors,
          }),
        {
          initialProps: { colors: mockColors },
        }
      );

      result.current.render();
      const firstCallCount = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls.length;

      const newColors = { ...mockColors, bullish: '#00ff00' };
      rerender({ colors: newColors });
      result.current.render();

      expect((drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(firstCallCount);
    });

    it('should re-render when hovered index changes', () => {
      const { result, rerender } = renderHook(
        ({ hoveredKlineIndex }: { hoveredKlineIndex?: number }) =>
          useKlineRenderer({
            manager: mockManager,
            colors: mockColors,
            hoveredKlineIndex,
          }),
        {
          initialProps: { hoveredKlineIndex: undefined as number | undefined },
        }
      );

      result.current.render();
      const firstCalls = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls;
      expect(firstCalls[0][10]).toBe(false);

      vi.clearAllMocks();
      rerender({ hoveredKlineIndex: 0 as number | undefined });
      result.current.render();

      const secondCalls = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls;
      expect(secondCalls[0][10]).toBe(true);
    });

    it('should use full chartWidth (rightMargin is deprecated)', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 728, 575);
    });

    it('should use custom klineWickWidth when provided', () => {
      const customWickWidth = 3;
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          klineWickWidth: customWickWidth,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalled();
      const callArgs = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(callArgs[7]).toBe(customWickWidth);
    });

    it('should not render when enabled is false', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).not.toHaveBeenCalled();
    });

    it('should center klines within available width', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalled();
      const firstCallX = (drawingUtils.drawKline as ReturnType<typeof vi.fn>).mock.calls[0][1];
      expect(typeof firstCallX).toBe('number');
    });

    it('should handle viewport with different start/end values', () => {
      mockManager.getViewport = vi.fn(() => ({
        start: 2,
        end: 4,
        klineWidth: 15,
      }));

      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawKline).toHaveBeenCalled();
    });

    it('should apply clipping to prevent drawing outside chart area', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
    });

  });
});
