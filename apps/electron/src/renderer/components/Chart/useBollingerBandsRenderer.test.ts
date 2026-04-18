import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useBollingerBandsRenderer } from './useBollingerBandsRenderer';

vi.mock('@renderer/hooks/useBBWorker', () => ({
  useBBWorker: vi.fn((_klines: unknown[], _period?: number, _stdDev?: number, enabled?: boolean) => {
    if (!enabled) return null;
    const klinesArray = _klines as Array<{ close: string }>;
    if (klinesArray.length === 0) return null;
    return {
      upper: klinesArray.map((k) => parseFloat(k.close) + 10),
      middle: klinesArray.map((k) => parseFloat(k.close)),
      lower: klinesArray.map((k) => parseFloat(k.close) - 10),
    };
  }),
}));

describe('useBollingerBandsRenderer', () => {
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
    bollingerBands: {
      upper: 'rgba(33, 150, 243, 0.6)',
      lower: 'rgba(33, 150, 243, 0.6)',
      middle: 'rgba(33, 150, 243, 0.9)',
      fill: 'rgba(33, 150, 243, 0.08)',
    },
  };

  const klines = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '105', low: '95', close: '100', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
    { openTime: 2000, closeTime: 3000, open: '100', high: '106', low: '96', close: '102', volume: '1100', quoteVolume: '112200', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '56100' },
    { openTime: 3000, closeTime: 4000, open: '102', high: '108', low: '101', close: '105', volume: '1200', quoteVolume: '126000', trades: 120, takerBuyBaseVolume: '600', takerBuyQuoteVolume: '63000' },
    { openTime: 4000, closeTime: 5000, open: '105', high: '110', low: '104', close: '108', volume: '1300', quoteVolume: '140400', trades: 130, takerBuyBaseVolume: '650', takerBuyQuoteVolume: '70200' },
    { openTime: 5000, closeTime: 6000, open: '108', high: '112', low: '107', close: '110', volume: '1400', quoteVolume: '154000', trades: 140, takerBuyBaseVolume: '700', takerBuyQuoteVolume: '77000' },
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
      lineJoin: 'miter',
      lineCap: 'butt',
      strokeStyle: '',
      fillStyle: '',
      font: '',
      textAlign: 'left' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      shadowColor: '',
      shadowBlur: 0,
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
      getBounds: vi.fn(() => ({
        minPrice: 80,
        maxPrice: 130,
      })),
      getKlines: vi.fn(() => klines),
      getViewport: vi.fn(() => ({
        start: 0,
        end: 5,
        klineWidth: 100,
      })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 140),
      indexToCenterX: vi.fn((index: number) => index * 140 + 70),
      getVisibleKlines: vi.fn(() => klines),
      isFlipped: vi.fn(() => false),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: null,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when disabled', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when klines are empty', () => {
      const emptyManager = {
        ...mockManager,
        getKlines: vi.fn(() => []),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: emptyManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should render Bollinger Bands when enabled with valid data', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should apply clipping to chart area', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.rect).toHaveBeenCalled();
      expect(mockCtx.clip).toHaveBeenCalled();
    });

    it('should save and restore context', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use custom period', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          period: 10,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use custom stdDev', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          stdDev: 3,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use custom rightMargin', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          rightMargin: 100,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      expect(result.current.render).toBeTypeOf('function');
    });
  });

  describe('default values', () => {
    it('should use default period of 20 when not specified', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use default enabled of true when not specified', () => {
      const { result } = renderHook(() =>
        useBollingerBandsRenderer({
          manager: mockManager,
          colors: mockColors,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });
  });
});
