import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useMACDRenderer } from './useMACDRenderer';

describe('useMACDRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    macd: {
      macdLine: '#2962ff',
      signalLine: '#ff6d00',
      histogramPositive: '#26a69a',
      histogramNegative: '#ef5350',
      zeroLine: 'rgba(128, 128, 128, 0.3)',
    },
  };

  const mockMacdData = { macd: [0.5, 0.8, 0.3, -0.2, 0.6], signal: [0.4, 0.6, 0.5, 0.1, 0.3], histogram: [0.1, 0.2, -0.2, -0.3, 0.3] };

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
      const { result } = renderHook(() => useMACDRenderer({ manager: null, macdData: mockMacdData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() => useMACDRenderer({ manager: mockManager, macdData: mockMacdData, colors: mockColors, enabled: false }));
      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when macdData is null', () => {
      const { result } = renderHook(() => useMACDRenderer({ manager: mockManager, macdData: null, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should render MACD when enabled with valid data', () => {
      const { result } = renderHook(() => useMACDRenderer({ manager: mockManager, macdData: mockMacdData, colors: mockColors, enabled: true }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() => useMACDRenderer({ manager: mockManager, macdData: mockMacdData, colors: mockColors, enabled: true }));
      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() => useMACDRenderer({ manager: mockManager, macdData: mockMacdData, colors: mockColors }));
      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
