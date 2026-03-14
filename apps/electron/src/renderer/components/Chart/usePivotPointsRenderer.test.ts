import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { usePivotPointsRenderer } from './usePivotPointsRenderer';

describe('usePivotPointsRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    pivotPoints: {
      support: 'rgba(34, 197, 94, 0.6)',
      resistance: 'rgba(239, 68, 68, 0.6)',
    },
  };

  const mockPivotData = {
    pivots: [
      { index: 5, price: 105, type: 'high' as const, strength: 'strong' as const },
      { index: 10, price: 95, type: 'low' as const, strength: 'medium' as const },
      { index: 15, price: 110, type: 'high' as const, strength: 'weak' as const },
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
      arc: vi.fn(),
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
        usePivotPointsRenderer({
          manager: null,
          pivotData: mockPivotData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when pivotData is null', () => {
      const { result } = renderHook(() =>
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render pivot points when enabled with valid data', () => {
      const { result } = renderHook(() =>
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should draw circles for pivot points', () => {
      const { result } = renderHook(() =>
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.arc).toHaveBeenCalled();
      expect(mockCtx.fill).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
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
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
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
        usePivotPointsRenderer({
          manager: mockManager,
          pivotData: mockPivotData,
          colors: mockColors,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
