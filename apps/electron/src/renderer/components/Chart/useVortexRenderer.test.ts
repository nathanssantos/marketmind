import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useVortexRenderer } from './useVortexRenderer';

describe('useVortexRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    vortex: { viPlusLine: '#26a69a', viMinusLine: '#ef5350' },
  };

  const mockVortexData = { viPlus: [1.1, 1.2, 1.15, 0.9, 1.05], viMinus: [0.9, 0.85, 0.95, 1.1, 0.95] };

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
      getPanelInfo: vi.fn(() => ({ y: 400, height: 80 })),
      indexToX: vi.fn((index: number) => index * 140),
      indexToCenterX: vi.fn((index: number) => index * 140 + 70),
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: null, vortexData: mockVortexData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: mockManager, vortexData: mockVortexData, colors: mockColors, enabled: false }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when vortexData is null', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: mockManager, vortexData: null, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render Vortex when enabled with valid data', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: mockManager, vortexData: mockVortexData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: mockManager, vortexData: mockVortexData, colors: mockColors, enabled: true }));
      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() => useVortexRenderer({ manager: mockManager, vortexData: mockVortexData, colors: mockColors }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
