import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useIchimokuRenderer } from './useIchimokuRenderer';

describe('useIchimokuRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    ichimoku: {
      tenkan: '#2962ff',
      kijun: '#b71c1c',
      chikou: '#7c4dff',
      senkouAFill: 'rgba(38, 166, 154, 0.2)',
      senkouBFill: 'rgba(239, 83, 80, 0.2)',
    },
  };

  const mockIchimokuData = {
    tenkan: [100, 102, 104],
    kijun: [98, 100, 102],
    chikou: [101, 103, 105],
    senkouA: [99, 101, 103],
    senkouB: [97, 99, 101],
  };

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(), closePath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), setLineDash: vi.fn(), measureText: vi.fn(() => ({ width: 50 })),
      lineWidth: 1, strokeStyle: '', fillStyle: '', font: '',
      textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 728, chartHeight: 575, volumeHeight: 0 })),
      getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 100 })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 140),
      indexToCenterX: vi.fn((index: number) => index * 140 + 70),
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: null, ichimokuData: mockIchimokuData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: mockManager, ichimokuData: mockIchimokuData, colors: mockColors, enabled: false }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when ichimokuData is null', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: mockManager, ichimokuData: null, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render Ichimoku when enabled with valid data', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: mockManager, ichimokuData: mockIchimokuData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: mockManager, ichimokuData: mockIchimokuData, colors: mockColors, enabled: true }));
      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() => useIchimokuRenderer({ manager: mockManager, ichimokuData: mockIchimokuData, colors: mockColors }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
