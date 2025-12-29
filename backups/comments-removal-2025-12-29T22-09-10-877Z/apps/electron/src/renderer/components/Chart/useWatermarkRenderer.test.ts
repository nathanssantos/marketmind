import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChartThemeColors } from '../../hooks/useChartColors';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useWatermarkRenderer } from './useWatermarkRenderer';

describe('useWatermarkRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  let mockColors: ChartThemeColors;

  beforeEach(() => {
    vi.clearAllMocks();

    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      fillText: vi.fn(),
      font: '',
      fillStyle: '',
      textAlign: '',
      textBaseline: '',
      globalAlpha: 0,
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
    } as unknown as CanvasManager;

    mockColors = {
      bullish: '#10b981',
      bearish: '#ef4444',
      volume: '#6b7280',
      grid: '#e5e7eb',
      background: '#ffffff',
      axisLabel: '#000000',
      axisLine: '#e5e7eb',
      crosshair: '#6b7280',
      currentPriceLabel: {
        bg: '#10b981',
        text: '#ffffff',
      },
      text: '#000000',
      movingAverages: {
        ma1: '#3b82f6',
        ma2: '#f59e0b',
        ma3: '#ec4899',
      },
      stochastic: {
        k: '#3b82f6',
        d: '#f59e0b',
        overbought: '#ef4444',
        oversold: '#10b981',
        gridLine: '#e5e7eb',
        axisLabel: '#6b7280',
      },
      rsi: {
        line: '#8b5cf6',
        overbought: '#ef4444',
        oversold: '#10b981',
        gridLine: '#e5e7eb',
        axisLabel: '#6b7280',
      },
    };
  });

  describe('render', () => {
    it('should render watermark with symbol only', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('BTCUSDT', 364, 287.5);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render watermark with symbol and timeframe', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillText).toHaveBeenCalledWith('BTCUSDT 1h', 364, 287.5);
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should render watermark with FUTURES label on separate line for FUTURES market type', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'FUTURES',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalledTimes(2);
      expect(mockCtx.fillText).toHaveBeenNthCalledWith(1, 'BTCUSDT 1h', 364, expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenNthCalledWith(2, 'FUTURES', 364, expect.any(Number));
    });

    it('should render watermark without FUTURES label for SPOT market type', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'SPOT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalledTimes(1);
      expect(mockCtx.fillText).toHaveBeenCalledWith('BTCUSDT 1h', 364, 287.5);
    });

    it('should render FUTURES watermark with symbol only (no timeframe) on separate lines', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'ETHUSDT',
          marketType: 'FUTURES',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalledTimes(2);
      expect(mockCtx.fillText).toHaveBeenNthCalledWith(1, 'ETHUSDT', 364, expect.any(Number));
      expect(mockCtx.fillText).toHaveBeenNthCalledWith(2, 'FUTURES', 364, expect.any(Number));
    });

    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: null,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: false,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should not render when symbol is undefined', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should set correct canvas properties with responsive font size', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.globalAlpha).toBe(0.05);
      expect(mockCtx.font).toBe('bold 69px sans-serif');
      expect(mockCtx.fillStyle).toBe('#000000');
      expect(mockCtx.textAlign).toBe('center');
      expect(mockCtx.textBaseline).toBe('middle');
    });

    it('should calculate center position correctly', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'ETHUSDT',
          enabled: true,
        })
      );

      result.current.render();

      const centerX = 728 / 2;
      const centerY = 575 / 2;

      expect(mockCtx.fillText).toHaveBeenCalledWith('ETHUSDT', centerX, centerY);
    });

    it('should not render when context is null', () => {
      const managerWithoutContext = {
        ...mockManager,
        getContext: vi.fn(() => null),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: managerWithoutContext,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should not render when dimensions are null', () => {
      const managerWithoutDimensions = {
        ...mockManager,
        getDimensions: vi.fn(() => null),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: managerWithoutDimensions,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).not.toHaveBeenCalled();
    });

    it('should use responsive font size based on canvas dimensions', () => {
      const smallManager = {
        ...mockManager,
        getDimensions: vi.fn(() => ({
          width: 400,
          height: 300,
          chartWidth: 350,
          chartHeight: 250,
          volumeHeight: 0,
        })),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: smallManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.font).toBe('bold 30px sans-serif');
    });

    it('should clamp font size to minimum 24px for very small canvas', () => {
      const tinyManager = {
        ...mockManager,
        getDimensions: vi.fn(() => ({
          width: 150,
          height: 100,
          chartWidth: 130,
          chartHeight: 80,
          volumeHeight: 0,
        })),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: tinyManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.font).toBe('bold 24px sans-serif');
    });

    it('should clamp font size to maximum 96px for very large canvas', () => {
      const largeManager = {
        ...mockManager,
        getDimensions: vi.fn(() => ({
          width: 2000,
          height: 1500,
          chartWidth: 1900,
          chartHeight: 1400,
          volumeHeight: 0,
        })),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: largeManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.font).toBe('bold 96px sans-serif');
    });

    it('should use smaller font size for FUTURES label on second line', () => {
      const { result } = renderHook(() =>
        useWatermarkRenderer({
          manager: mockManager,
          colors: mockColors,
          symbol: 'BTCUSDT',
          timeframe: '1h',
          marketType: 'FUTURES',
          enabled: true,
        })
      );

      result.current.render();

      const calls = (mockCtx.fillText as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.length).toBe(2);

      const fontSizes = mockCtx.font.split(' ');
      const lastFontSize = parseInt(fontSizes[1] || '');
      expect(lastFontSize).toBe(34);
    });
  });
});
