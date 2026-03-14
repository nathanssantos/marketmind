import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useFVGRenderer } from './useFVGRenderer';

describe('useFVGRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    fvg: {
      bullish: 'rgba(34, 197, 94, 0.15)',
      bearish: 'rgba(239, 68, 68, 0.15)',
      bullishBorder: 'rgba(34, 197, 94, 0.4)',
      bearishBorder: 'rgba(239, 68, 68, 0.4)',
    },
  };

  const mockFvgData = {
    gaps: [
      { index: 5, high: 108, low: 105, type: 'bullish' as const, filled: false },
      { index: 10, high: 100, low: 97, type: 'bearish' as const, filled: false },
      { index: 15, high: 112, low: 110, type: 'bullish' as const, filled: true },
    ],
  };

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
      fillRect: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      clip: vi.fn(),
      setLineDash: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      lineWidth: 1,
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
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
      getViewport: vi.fn(() => ({
        start: 0,
        end: 20,
        klineWidth: 35,
      })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 35),
      indexToCenterX: vi.fn((index: number) => index * 35 + 17.5),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: null,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when fvgData is null', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should render FVG zones when enabled with valid data', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should draw rectangles for unfilled gaps', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should render unfilled FVG zones that started before the visible viewport', () => {
      const managerWithOffset = {
        ...mockManager,
        getViewport: vi.fn(() => ({ start: 50, end: 80, klineWidth: 35 })),
        indexToX: vi.fn((index: number) => (index - 50) * 35),
        indexToCenterX: vi.fn((index: number) => (index - 50) * 35 + 17.5),
      } as unknown as CanvasManager;

      const oldGapData = {
        gaps: [
          { index: 10, high: 108, low: 105, type: 'bullish' as const, filled: false },
        ],
      };

      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: managerWithOffset,
          fvgData: oldGapData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number), expect.any(Number));
    });

    it('should not draw filled gaps', () => {
      const filledOnlyData = {
        gaps: [{ index: 5, high: 108, low: 105, type: 'bullish' as const, filled: true }],
      };

      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: filledOnlyData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
          enabled: true,
        })
      );

      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() =>
        useFVGRenderer({
          manager: mockManager,
          fvgData: mockFvgData,
          colors: mockColors,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
