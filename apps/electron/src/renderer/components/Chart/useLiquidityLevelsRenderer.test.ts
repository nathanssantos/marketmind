import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useLiquidityLevelsRenderer } from './useLiquidityLevelsRenderer';

describe('useLiquidityLevelsRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    liquidityLevels: {
      support: 'rgba(34, 197, 94, 0.6)',
      resistance: 'rgba(239, 68, 68, 0.6)',
      supportBg: 'rgba(34, 197, 94, 0.1)',
      resistanceBg: 'rgba(239, 68, 68, 0.1)',
    },
  };

  const mockLiquidityData = [
    { price: 100, type: 'support' as const, strength: 5, touches: 3 },
    { price: 110, type: 'resistance' as const, strength: 4, touches: 2 },
    { price: 95, type: 'support' as const, strength: 3, touches: 4 },
  ];

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
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: null,
          liquidityData: mockLiquidityData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when liquidityData is null', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should render liquidity levels when enabled with valid data', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should draw zones for liquidity levels', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
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
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
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
        useLiquidityLevelsRenderer({
          manager: mockManager,
          liquidityData: mockLiquidityData,
          colors: mockColors,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
