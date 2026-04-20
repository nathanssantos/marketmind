import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useKlineRenderer } from './useKlineRenderer';

vi.mock('../../utils/canvas/drawingUtils', () => ({
  drawCandleLabel: vi.fn(),
}));

const createMockCtx = (): CanvasRenderingContext2D => ({
  save: vi.fn(),
  restore: vi.fn(),
  beginPath: vi.fn(),
  rect: vi.fn(),
  clip: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  arc: vi.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  shadowColor: '',
  shadowBlur: 0,
  globalAlpha: 1,
} as unknown as CanvasRenderingContext2D);

describe('useKlineRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = createMockCtx();

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
      indexToCenterX: vi.fn((index: number) => index * 145.6 + 72.8),
      priceToY: vi.fn((price: number) => 575 - (price - 90) * 19),
      isFlipped: vi.fn(() => false),
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
      currentPriceLabel: { bg: '#10b981', text: '#ffffff' },
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
        tooltip: { bg: '#1f2937', text: '#ffffff', border: '#374151' },
      },
    } as ChartThemeColors;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: null, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors, enabled: false })
      );
      result.current.render();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should not render when context is null', () => {
      mockManager.getContext = vi.fn(() => null);
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should not render when dimensions is null', () => {
      mockManager.getDimensions = vi.fn(() => null);
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should apply clipping to chart area', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.rect).toHaveBeenCalledWith(0, 0, 728, 575);
      expect(mockCtx.clip).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should batch stroke wicks into single path per color', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should batch body fillRect per color', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should compute Y positions for OHLC values', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockManager.priceToY).toHaveBeenCalledWith(100);
      expect(mockManager.priceToY).toHaveBeenCalledWith(102);
      expect(mockManager.priceToY).toHaveBeenCalledWith(105);
      expect(mockManager.priceToY).toHaveBeenCalledWith(95);
    });

    it('should call indexToX for each visible kline', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      result.current.render();
      expect(mockManager.indexToX).toHaveBeenCalledWith(0);
      expect(mockManager.indexToX).toHaveBeenCalledWith(1);
      expect(mockManager.indexToX).toHaveBeenCalledWith(2);
    });

    it('should skip klines outside visible area', () => {
      mockManager.indexToX = vi.fn((index: number) => {
        if (index === 0) return -1000;
        if (index === 4) return 10000;
        return index * 145.6;
      });
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      expect(() => result.current.render()).not.toThrow();
    });

    it('should handle viewport with different start/end values', () => {
      mockManager.getViewport = vi.fn(() => ({ start: 2, end: 4, klineWidth: 15 }));
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      expect(() => result.current.render()).not.toThrow();
    });

    it('should render hovered kline with shadow blur isolation', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          hoveredKlineIndex: 2,
        })
      );
      result.current.render();
      const saveCalls = (mockCtx.save as ReturnType<typeof vi.fn>).mock.calls.length;
      const restoreCalls = (mockCtx.restore as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(saveCalls).toBeGreaterThanOrEqual(2);
      expect(restoreCalls).toBeGreaterThanOrEqual(2);
    });

    it('should honor custom klineWickWidth', () => {
      const { result } = renderHook(() =>
        useKlineRenderer({
          manager: mockManager,
          colors: mockColors,
          klineWickWidth: 7,
        })
      );
      result.current.render();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should not crash when no klines are visible', () => {
      mockManager.getVisibleKlines = vi.fn(() => []);
      const { result } = renderHook(() =>
        useKlineRenderer({ manager: mockManager, colors: mockColors })
      );
      expect(() => result.current.render()).not.toThrow();
    });
  });
});
