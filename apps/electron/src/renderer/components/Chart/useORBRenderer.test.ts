import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useORBRenderer } from './useORBRenderer';
import type { MarketEvent } from '@marketmind/types';

vi.mock('@shared/constants/marketSessions', () => ({
  getSessionById: (id: string) => ({
    id,
    shortName: id.toUpperCase(),
    color: '#4488ff',
  }),
}));

const makeKline = (openTime: number, high: number, low: number) => ({
  symbol: 'BTCUSDT',
  interval: '5m' as const,
  openTime,
  closeTime: openTime + 5 * 60_000 - 1,
  open: (high + low) / 2,
  high,
  low,
  close: (high + low) / 2,
  volume: 100,
  quoteVolume: 100,
  trades: 10,
  takerBuyBaseVolume: 50,
  takerBuyQuoteVolume: 50,
});

describe('useORBRenderer', () => {
  let mockManager: CanvasManager;
  let mockCtx: CanvasRenderingContext2D;
  const mockColors = {
    candleBullish: '#26a69a',
    candleBearish: '#ef5350',
    background: '#1e222d',
    gridLines: '#363A45',
    text: '#D9D9D9',
    axisLabel: '#848E9C',
  };

  const sessionOpen = 1700000000000;
  const sessionClose = sessionOpen + 8 * 60 * 60_000;

  const marketEvents: MarketEvent[] = [
    { type: 'market_open', timestamp: sessionOpen, label: 'Open', metadata: { sessionId: 'nyse' } },
    { type: 'market_close', timestamp: sessionClose, label: 'Close', metadata: { sessionId: 'nyse' } },
  ];

  const klines = [
    makeKline(sessionOpen, 105, 100),
    makeKline(sessionOpen + 5 * 60_000, 110, 102),
    makeKline(sessionOpen + 10 * 60_000, 108, 101),
    makeKline(sessionOpen + 15 * 60_000, 112, 106),
    makeKline(sessionOpen + 20 * 60_000, 115, 109),
    makeKline(sessionOpen + 25 * 60_000, 113, 107),
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
      globalAlpha: 1,
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
      getKlines: vi.fn(() => klines),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 35),
      indexToCenterX: vi.fn((index: number) => index * 35 + 17.5),
      timestampToX: vi.fn((ts: number) => ((ts - sessionOpen) / (5 * 60_000)) * 35),
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: null,
          colors: mockColors,
          enabled: true,
          marketEvents,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
          marketEvents,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should not render when no market events', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents: [],
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should render ORB zones when enabled with valid data', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
          orbPeriodMinutes: 15,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should draw dashed lines at high, low, and mid levels', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
          orbPeriodMinutes: 15,
        })
      );

      result.current.render();

      expect(mockCtx.setLineDash).toHaveBeenCalledWith([6, 3]);
      expect(mockCtx.setLineDash).toHaveBeenCalledWith([2, 4]);
      expect(mockCtx.stroke).toHaveBeenCalled();
    });

    it('should draw ORB label', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
          orbPeriodMinutes: 15,
        })
      );

      result.current.render();

      expect(mockCtx.fillText).toHaveBeenCalledWith(
        expect.stringContaining('ORB'),
        expect.any(Number),
        expect.any(Number),
      );
    });

    it('should not render when interval is larger than ORB period', () => {
      const hourlyKlines = [
        makeKline(sessionOpen, 105, 100),
        makeKline(sessionOpen + 60 * 60_000, 110, 102),
      ];

      const hourlyManager = {
        ...mockManager,
        getKlines: vi.fn(() => hourlyKlines),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useORBRenderer({
          manager: hourlyManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
          orbPeriodMinutes: 15,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
        })
      );

      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          marketEvents,
        })
      );

      result.current.render();
      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use default orbPeriodMinutes of 15', () => {
      const { result } = renderHook(() =>
        useORBRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          marketEvents,
        })
      );

      result.current.render();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });
  });
});
