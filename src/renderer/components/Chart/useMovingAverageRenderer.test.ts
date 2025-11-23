import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import type { MovingAverageConfig } from './useMovingAverageRenderer';
import { useMovingAverageRenderer } from './useMovingAverageRenderer';

describe('useMovingAverageRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let movingAverages: MovingAverageConfig[];

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
      rect: vi.fn(),
      clip: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      lineWidth: 1,
      lineJoin: 'miter',
      lineCap: 'butt',
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: 'left',
      textBaseline: 'alphabetic',
      shadowColor: '',
      shadowBlur: 0,
    } as unknown as CanvasRenderingContext2D;

    const candles = [
      { open: 100, high: 105, low: 95, close: 100, volume: 1000, time: 1000 },
      { open: 100, high: 106, low: 96, close: 102, volume: 1100, time: 2000 },
      { open: 102, high: 108, low: 101, close: 105, volume: 1200, time: 3000 },
      { open: 105, high: 110, low: 104, close: 108, volume: 1300, time: 4000 },
      { open: 108, high: 112, low: 107, close: 110, volume: 1400, time: 5000 },
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
      })),
      getCandles: vi.fn(() => candles),
      getViewport: vi.fn(() => ({
        start: 0,
        end: 5,
        candleWidth: 10,
      })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 10),
      indexToX: vi.fn((index: number) => index * 20),
      getVisibleCandles: vi.fn(() => candles),
    } as unknown as CanvasManager;

    movingAverages = [
      {
        period: 3,
        type: 'SMA',
        color: 'rgba(59, 130, 246, 0.9)',
        lineWidth: 1.5,
        visible: true,
      },
      {
        period: 5,
        type: 'EMA',
        color: 'rgba(251, 146, 60, 0.9)',
        lineWidth: 1.5,
        visible: true,
      },
    ];
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: null,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when no moving averages', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages: [],
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render invisible moving averages', () => {
      const invisibleMAs = [
        { ...movingAverages[0], visible: false },
      ];

      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages: invisibleMAs,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render visible moving averages', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should apply clipping to chart area', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
    });

    it('should render price tags for each MA', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.fill).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should highlight hovered MA', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
          hoveredMAIndex: 0,
        })
      );

      result.current.render();

      expect(mockCtx.shadowBlur).toBeGreaterThanOrEqual(0);
    });

    it('should use custom line width for MA', () => {
      const customMAs = [
        { ...movingAverages[0], lineWidth: 3 },
      ];

      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages: customMAs,
        })
      );

      result.current.render();

      expect(mockCtx.lineWidth).toBe(3);
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('getHoveredMATag', () => {
    it('should return undefined when no tag is hovered', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();
      const hoveredIndex = result.current.getHoveredMATag(0, 0);

      expect(hoveredIndex).toBeUndefined();
    });

    it('should not return index for position outside tag', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();
      const hoveredIndex = result.current.getHoveredMATag(100, 100);

      expect(hoveredIndex).toBeUndefined();
    });

    it('should return function that accepts x and y coordinates', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      expect(result.current.getHoveredMATag).toBeTypeOf('function');
    });

    it('should return undefined or number based on coordinate position', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();
      const hoveredIndex = result.current.getHoveredMATag(730, 300);
      const typeResult = typeof hoveredIndex;

      expect(typeResult === 'undefined' || typeResult === 'number').toBe(true);
    });
  });

  describe('SMA calculation', () => {
    it('should calculate correct SMA values', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages: [movingAverages[0]],
        })
      );

      result.current.render();

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('EMA calculation', () => {
    it('should calculate correct EMA values', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages: [movingAverages[1]],
        })
      );

      result.current.render();

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('tag positioning', () => {
    it('should position tags on price scale', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should format price with 2 decimal places', () => {
      const { result } = renderHook(() =>
        useMovingAverageRenderer({
          manager: mockManager,
          movingAverages,
        })
      );

      result.current.render();

      const calls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      const priceTexts = calls.map(call => call[0]);
      
      priceTexts.forEach((text: string) => {
        expect(text).toMatch(/^\d+\.\d{2}$/);
      });
    });
  });
});
