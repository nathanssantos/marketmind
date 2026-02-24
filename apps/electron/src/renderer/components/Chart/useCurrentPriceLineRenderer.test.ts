import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors.tsx';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useCurrentPriceLineRenderer } from './useCurrentPriceLineRenderer';

describe('useCurrentPriceLineRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      closePath: vi.fn(),
      setLineDash: vi.fn(),
      lineWidth: 1,
      globalAlpha: 1,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
    } as unknown as CanvasRenderingContext2D;

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
        maxPrice: 110,
      })),
      getKlines: vi.fn(() => [
        { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '102', volume: '1000', quoteVolume: '102000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '51000' },
        { openTime: 2000, closeTime: 3000, open: '102', high: '108', low: '101', close: '105', volume: '1200', quoteVolume: '126000', trades: 120, takerBuyBaseVolume: '600', takerBuyQuoteVolume: '63000' },
      ]),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 10),
    } as unknown as CanvasManager;

    mockColors = {
      bullish: '#22c55e',
      bearish: '#ef4444',
      background: '#1a1a1a',
      crosshair: 'rgba(128, 128, 128, 0.8)',
      axisLabel: '#888888',
      axisLine: '#333333',
      currentPriceLine: '#22c55e',
      currentPriceLabel: { bg: '#22c55e', text: '#ffffff' },
      lineDefault: '#666666',
      ma: ['#3b82f6', '#f59e0b', '#8b5cf6'],
      aiPattern: {
        support: '#22c55e',
        resistance: '#ef4444',
        trendlineBullish: '#22c55e',
        trendlineBearish: '#ef4444',
        liquidityZone: '#3b82f6',
        sellZone: '#ef4444',
        buyZone: '#22c55e',
        accumulationZone: '#f59e0b',
        tooltip: { bg: '#1a1a1a', text: '#ffffff', border: '#333333' },
      },
    } as ChartThemeColors;
  });

  describe('renderLine', () => {
    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.renderLine();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when no klines', () => {
      mockManager.getKlines = vi.fn(() => []);

      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render line at current price', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalledWith(0, expect.any(Number));
    });

    it('should always use dotted line style', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([2, 3]);
    });

    it('should use custom line width', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          lineWidth: 3,
        })
      );

      result.current.renderLine();

      expect(mockCtx.lineWidth).toBe(3);
    });

    it('should draw line from left edge to chartWidth', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.moveTo).toHaveBeenCalledWith(0, expect.any(Number));
      expect(mockCtx.lineTo).toHaveBeenCalledWith(728, expect.any(Number));
    });
  });

  describe('renderLabel', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('should not render when no klines', () => {
      mockManager.getKlines = vi.fn(() => []);

      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('should render price tag', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should format price with 2 decimal places', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fillText).toHaveBeenCalledWith('105.00', expect.any(Number), expect.any(Number));
    });

    it('should position tag at chartWidth + labelPadding', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fillText).toHaveBeenCalledWith(expect.any(String), 736, expect.any(Number));
    });
  });

  describe('render', () => {
    it('should call both renderLine and renderLabel', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use custom lineWidth when provided', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          lineWidth: 4,
        })
      );

      result.current.renderLine();

      expect(mockCtx.lineWidth).toBe(4);
    });

    it('should use bullish color when candle closes higher than open', () => {
      mockManager.getKlines = vi.fn(() => [
        { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '105', volume: '1000', quoteVolume: '105000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '52500' },
      ]);

      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.strokeStyle).toBe(mockColors.bullish);
    });

    it('should use bearish color when candle closes lower than open', () => {
      mockManager.getKlines = vi.fn(() => [
        { openTime: 1000, closeTime: 2000, open: '105', high: '108', low: '95', close: '100', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
      ]);

      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.strokeStyle).toBe(mockColors.bearish);
    });

    it('should always draw line to chartWidth regardless of config', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLine();

      expect(mockCtx.lineTo).toHaveBeenCalledWith(728, expect.any(Number));
    });

    it('should handle renderLine and renderLabel independently', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      vi.clearAllMocks();
      result.current.renderLine();
      
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fill).not.toHaveBeenCalled();

      vi.clearAllMocks();
      result.current.renderLabel();

      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should position price tag using drawPriceTag utility', () => {
      const { result } = renderHook(() =>
        useCurrentPriceLineRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.renderLabel();

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });
  });
});
