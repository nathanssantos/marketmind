import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useFibonacciRenderer } from './useFibonacciRenderer';

describe('useFibonacciRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
    fibonacci: {
      level0: 'rgba(128, 128, 128, 0.5)',
      level236: 'rgba(255, 193, 7, 0.5)',
      level382: 'rgba(255, 152, 0, 0.5)',
      level50: 'rgba(156, 39, 176, 0.5)',
      level618: 'rgba(76, 175, 80, 0.5)',
      level786: 'rgba(33, 150, 243, 0.5)',
      level100: 'rgba(128, 128, 128, 0.5)',
      level127: 'rgba(244, 67, 54, 0.3)',
      level161: 'rgba(244, 67, 54, 0.3)',
    },
  };

  const mockFibonacciData = {
    levels: [
      { level: 0, price: 100, label: '0%' },
      { level: 0.236, price: 102.36, label: '23.6%' },
      { level: 0.382, price: 103.82, label: '38.2%' },
      { level: 0.5, price: 105, label: '50%' },
      { level: 0.618, price: 106.18, label: '61.8%' },
      { level: 0.786, price: 107.86, label: '78.6%' },
      { level: 1, price: 110, label: '100%' },
    ],
    high: 110,
    low: 100,
    trend: 'up' as const,
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
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: null,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when fibonacciData is null', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();
      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render fibonacci levels when enabled with valid data', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should draw horizontal lines for fibonacci levels', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.moveTo).toHaveBeenCalled();
      expect(mockCtx.lineTo).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should draw labels for fibonacci levels', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
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
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
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
        useFibonacciRenderer({
          manager: mockManager,
          fibonacciData: mockFibonacciData,
          colors: mockColors,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
