import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import * as drawingUtils from '../../utils/canvas/drawingUtils';
import * as formatters from '../../utils/formatters';
import { useGridRenderer } from './useGridRenderer';

vi.mock('../../utils/canvas/drawingUtils', () => ({
  drawGrid: vi.fn(),
  drawLine: vi.fn(),
  drawText: vi.fn(),
}));

vi.mock('../../utils/formatters', () => ({
  formatPrice: vi.fn((price: number) => price.toFixed(2)),
  formatTimestamp: vi.fn((timestamp: number) => new Date(timestamp).toLocaleTimeString()),
}));

describe('useGridRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const candles = [
      { timestamp: 1000000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
      { timestamp: 2000000, open: 102, high: 106, low: 96, close: 98, volume: 1100 },
      { timestamp: 3000000, open: 98, high: 108, low: 97, close: 105, volume: 1200 },
      { timestamp: 4000000, open: 105, high: 110, low: 104, close: 103, volume: 1300 },
      { timestamp: 5000000, open: 103, high: 112, low: 102, close: 110, volume: 1400 },
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
      getBounds: vi.fn(() => ({
        minPrice: 90,
        maxPrice: 120,
        minVolume: 800,
        maxVolume: 2000,
      })),
      getViewport: vi.fn(() => ({
        start: 0,
        end: 5,
        candleWidth: 10,
        candleSpacing: 2,
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
        useGridRenderer({
          manager: null,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).not.toHaveBeenCalled();
    });

    it('should not render when context is null', () => {
      mockManager.getContext = vi.fn(() => null);

      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).not.toHaveBeenCalled();
    });

    it('should not render when dimensions is null', () => {
      mockManager.getDimensions = vi.fn(() => null);

      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).not.toHaveBeenCalled();
    });

    it('should not render when bounds is null', () => {
      mockManager.getBounds = vi.fn(() => null);

      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).not.toHaveBeenCalled();
    });

    it('should render grid with default horizontal and vertical lines', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).toHaveBeenCalledWith(
        mockCtx,
        800,
        575,
        5,
        10,
        mockColors.grid,
        expect.any(Number),
      );
    });

    it('should render grid with custom horizontal lines', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          horizontalLines: 8,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).toHaveBeenCalledWith(
        mockCtx,
        800,
        575,
        8,
        10,
        mockColors.grid,
        expect.any(Number),
      );
    });

    it('should render grid with custom vertical lines', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          verticalLines: 15,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).toHaveBeenCalledWith(
        mockCtx,
        800,
        575,
        5,
        15,
        mockColors.grid,
        expect.any(Number),
      );
    });

    it('should render grid with custom line width', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          gridLineWidth: 2,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).toHaveBeenCalledWith(
        mockCtx,
        800,
        575,
        5,
        10,
        mockColors.grid,
        2,
      );
    });

    it('should draw price labels on the right axis', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawText).toHaveBeenCalled();
      expect(formatters.formatPrice).toHaveBeenCalled();
    });

    it('should draw time labels on the bottom axis', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(formatters.formatTimestamp).toHaveBeenCalled();
    });

    it('should draw axis lines', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawLine).toHaveBeenCalled();
    });

    it('should clear price scale area with background color', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use custom padding right when provided', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          paddingRight: 100,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should use custom right margin when provided', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: 50,
        })
      );

      result.current.render();

      expect(drawingUtils.drawText).toHaveBeenCalled();
    });

    it('should handle empty candles array', () => {
      mockManager.getVisibleCandles = vi.fn(() => []);

      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawGrid).toHaveBeenCalled();
    });

    it('should skip time labels outside visible area', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(formatters.formatTimestamp).toHaveBeenCalled();
    });

    it('should skip price labels outside chart height', () => {
      mockManager.priceToY = vi.fn((price: number) => {
        if (price < 95) return 700;
        if (price > 115) return -100;
        return 300;
      });

      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawText).toHaveBeenCalled();
    });

    it('should calculate price step correctly', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          horizontalLines: 5,
        })
      );

      result.current.render();

      expect(mockManager.priceToY).toHaveBeenCalled();
    });

    it('should calculate time label step correctly', () => {
      const { result } = renderHook(() =>
        useGridRenderer({
          manager: mockManager,
          colors: mockColors,
          verticalLines: 10,
        })
      );

      result.current.render();

      expect(mockManager.indexToX).toHaveBeenCalled();
    });
  });
});
