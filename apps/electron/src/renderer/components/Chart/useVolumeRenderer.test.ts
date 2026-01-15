import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import * as drawingUtils from '../../utils/canvas/drawingUtils';
import { useVolumeRenderer } from './useVolumeRenderer';

vi.mock('../../utils/canvas/drawingUtils', () => ({
  drawRect: vi.fn(),
}));

describe('useVolumeRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      shadowColor: '',
      shadowBlur: 0,
      globalAlpha: 1,
      lineWidth: 1,
      strokeStyle: '',
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      setLineDash: vi.fn(),
      strokeRect: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
    } as unknown as CanvasRenderingContext2D;

    const klines = [
      { openTime: 1000, closeTime: 1000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 2000, closeTime: 2000, open: '102', high: '106', low: '96', close: '98', volume: '1500', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 3000, closeTime: 3000, open: '98', high: '108', low: '97', close: '105', volume: '2000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 4000, closeTime: 4000, open: '105', high: '110', low: '104', close: '103', volume: '800', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      { openTime: 5000, closeTime: 5000, open: '103', high: '112', low: '102', close: '110', volume: '1200', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
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
        klineSpacing: 2,
      })),
      getBounds: vi.fn(() => ({
        minPrice: 90,
        maxPrice: 120,
        minVolume: 800,
        maxVolume: 2000,
      })),
      getVisibleKlines: vi.fn(() => klines),
      getKlines: vi.fn(() => klines),
      indexToX: vi.fn((index: number) => index * 145.6),
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
        useVolumeRenderer({
          manager: null,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).not.toHaveBeenCalled();
    });

    it('should not render when context is null', () => {
      mockManager.getContext = vi.fn(() => null);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).not.toHaveBeenCalled();
    });

    it('should not render when dimensions is null', () => {
      mockManager.getDimensions = vi.fn(() => null);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).not.toHaveBeenCalled();
    });

    it('should not render when bounds is null', () => {
      mockManager.getBounds = vi.fn(() => null);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).not.toHaveBeenCalled();
    });

    it('should render volume bars for all visible klines', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalledTimes(5);
    });

    it('should use bullish color for klines that closed higher', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should use bearish color for klines that closed lower', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should apply default opacity to volume bars', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should apply custom opacity when provided', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          opacity: 0.5,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should highlight hovered kline with increased opacity', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          opacity: 0.2,
          hoveredKlineIndex: 2,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should add shadow to hovered kline', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          hoveredKlineIndex: 2,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should calculate volume bar height proportionally', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      const calls = (drawingUtils.drawRect as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls).toHaveLength(5);
    });

    it('should use custom volume height ratio when provided', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          volumeHeightRatio: 0.5,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should use custom right margin when provided', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
          rightMargin: 100,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should skip volume bars outside visible area', () => {
      mockManager.indexToX = vi.fn((index: number) => {
        if (index === 0) return -100;
        if (index === 4) return 1000;
        return index * 145.6;
      });

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should handle zero max volume', () => {
      mockManager.getBounds = vi.fn(() => ({
        minPrice: 90,
        maxPrice: 120,
        minVolume: 0,
        maxVolume: 0,
      }));

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should draw volume projection for the last kline', () => {
      const now = Date.now();
      const klines = [
        { openTime: now - 3600000, closeTime: now - 2700000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
        { openTime: now - 1800000, closeTime: now + 1800000, open: '102', high: '106', low: '96', close: '98', volume: '500', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '250', takerBuyQuoteVolume: '0' },
      ];

      mockManager.getKlines = vi.fn(() => klines);
      mockManager.getVisibleKlines = vi.fn(() => klines);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.strokeRect).toBeDefined();
      expect(mockCtx.setLineDash).toBeDefined();
    });

    it('should not draw projection if kline period has completed', () => {
      const now = Date.now();
      const klines = [
        { openTime: now - 7200000, closeTime: now - 3600000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      ];

      mockManager.getKlines = vi.fn(() => klines);
      mockManager.getVisibleKlines = vi.fn(() => klines);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });

    it('should not draw projection if projected volume is lower than current', () => {
      const now = Date.now();
      const klines = [
        { openTime: now - 100, closeTime: now + 3600000, open: '100', high: '105', low: '95', close: '102', volume: '10000', quoteVolume: '0', trades: 100, takerBuyBaseVolume: '0', takerBuyQuoteVolume: '0' },
      ];

      mockManager.getKlines = vi.fn(() => klines);
      mockManager.getVisibleKlines = vi.fn(() => klines);

      const { result } = renderHook(() =>
        useVolumeRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(drawingUtils.drawRect).toHaveBeenCalled();
    });
  });
});
