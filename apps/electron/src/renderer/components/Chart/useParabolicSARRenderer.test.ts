import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useParabolicSARRenderer } from './useParabolicSARRenderer';

describe('useParabolicSARRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    parabolicSar: { bullish: '#4caf50', bearish: '#f44336' },
  };

  const mockParabolicSarData = {
    sar: [98, 97, 96, 104, 105],
    trend: ['down' as const, 'down' as const, 'down' as const, 'up' as const, 'up' as const],
  };

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), fill: vi.fn(), fillText: vi.fn(), fillRect: vi.fn(), closePath: vi.fn(),
      rect: vi.fn(), clip: vi.fn(), setLineDash: vi.fn(), arc: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      lineWidth: 1, strokeStyle: '', fillStyle: '', font: '',
      textAlign: 'left' as CanvasTextAlign, textBaseline: 'alphabetic' as CanvasTextBaseline,
    } as unknown as CanvasRenderingContext2D;

    mockManager = {
      getContext: vi.fn(() => mockCtx),
      getDimensions: vi.fn(() => ({ width: 800, height: 600, chartWidth: 728, chartHeight: 575, volumeHeight: 0 })),
      getViewport: vi.fn(() => ({ start: 0, end: 5, klineWidth: 100 })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 140),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: null, parabolicSarData: mockParabolicSarData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: mockManager, parabolicSarData: mockParabolicSarData, colors: mockColors, enabled: false }));
      result.current.render();
      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('should not render when parabolicSarData is null', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: mockManager, parabolicSarData: null, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.fill).not.toHaveBeenCalled();
    });

    it('should render Parabolic SAR when enabled with valid data', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: mockManager, parabolicSarData: mockParabolicSarData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: mockManager, parabolicSarData: mockParabolicSarData, colors: mockColors, enabled: true }));
      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() => useParabolicSARRenderer({ manager: mockManager, parabolicSarData: mockParabolicSarData, colors: mockColors }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
