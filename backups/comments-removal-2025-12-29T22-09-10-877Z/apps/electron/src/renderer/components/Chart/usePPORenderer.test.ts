import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { usePPORenderer } from './usePPORenderer';

describe('usePPORenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    volumeBullish: 'rgba(38, 166, 154, 0.5)',
    volumeBearish: 'rgba(239, 83, 80, 0.5)',
    currentPriceLine: '#2196F3',
    crosshairLine: '#758696',
    wick: '#838383',
    ppo: {
      line: 'rgba(33, 150, 243, 0.8)',
      signal: 'rgba(255, 152, 0, 0.8)',
      histogramPositive: 'rgba(38, 166, 154, 0.6)',
      histogramNegative: 'rgba(239, 83, 80, 0.6)',
    },
  };

  const mockPpoData = {
    ppo: [1.5, 1.8, 1.2, 1.6, 1.4],
    signal: [1.2, 1.4, 1.3, 1.5, 1.3],
    histogram: [0.3, 0.4, -0.1, 0.1, 0.1],
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
        end: 5,
        klineWidth: 100,
      })),
      getPanelInfo: vi.fn(() => ({
        y: 400,
        height: 80,
      })),
      indexToX: vi.fn((index: number) => index * 140),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        usePPORenderer({
          manager: null,
          ppoData: mockPpoData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        usePPORenderer({
          manager: mockManager,
          ppoData: mockPpoData,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when ppoData is null', () => {
      const { result } = renderHook(() =>
        usePPORenderer({
          manager: mockManager,
          ppoData: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render PPO when enabled with valid data', () => {
      const { result } = renderHook(() =>
        usePPORenderer({
          manager: mockManager,
          ppoData: mockPpoData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        usePPORenderer({
          manager: mockManager,
          ppoData: mockPpoData,
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
        usePPORenderer({
          manager: mockManager,
          ppoData: mockPpoData,
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
        usePPORenderer({
          manager: mockManager,
          ppoData: mockPpoData,
          colors: mockColors,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
