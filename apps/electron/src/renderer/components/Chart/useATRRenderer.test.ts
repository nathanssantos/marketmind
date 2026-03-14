import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CanvasManager } from '../../utils/canvas/CanvasManager';
import { useATRRenderer } from './useATRRenderer';

vi.mock('@marketmind/indicators', () => ({
  calculateATR: vi.fn((klines: unknown[], period: number) => {
    const klinesArray = klines as Array<{ high: string; low: string; close: string }>;
    return klinesArray.map((_, i) => (i >= period - 1 ? 100 + i * 10 : undefined));
  }),
}));

describe('useATRRenderer', () => {
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

    const klines = [
      { openTime: 1000, closeTime: 2000, open: '100', high: '110', low: '95', close: '105', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
      { openTime: 2000, closeTime: 3000, open: '105', high: '115', low: '100', close: '112', volume: '1100', quoteVolume: '112200', trades: 110, takerBuyBaseVolume: '550', takerBuyQuoteVolume: '56100' },
      { openTime: 3000, closeTime: 4000, open: '112', high: '120', low: '108', close: '115', volume: '1200', quoteVolume: '126000', trades: 120, takerBuyBaseVolume: '600', takerBuyQuoteVolume: '63000' },
      { openTime: 4000, closeTime: 5000, open: '115', high: '118', low: '105', close: '108', volume: '1300', quoteVolume: '140400', trades: 130, takerBuyBaseVolume: '650', takerBuyQuoteVolume: '70200' },
      { openTime: 5000, closeTime: 6000, open: '108', high: '112', low: '100', close: '102', volume: '1400', quoteVolume: '154000', trades: 140, takerBuyBaseVolume: '700', takerBuyQuoteVolume: '77000' },
      { openTime: 6000, closeTime: 7000, open: '102', high: '108', low: '98', close: '105', volume: '1500', quoteVolume: '157500', trades: 150, takerBuyBaseVolume: '750', takerBuyQuoteVolume: '78750' },
    ];

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
        minPrice: 90,
        maxPrice: 130,
      })),
      getKlines: vi.fn(() => klines),
      getViewport: vi.fn(() => ({
        start: 0,
        end: 6,
        klineWidth: 10,
      })),
      priceToY: vi.fn((price: number) => 300 - (price - 100) * 5),
      indexToX: vi.fn((index: number) => index * 20),
      indexToCenterX: vi.fn((index: number) => index * 20 + 10),
      getVisibleKlines: vi.fn(() => klines),
    } as unknown as CanvasManager;
  });

  describe('render', () => {
    it('should not render when manager is null', () => {
      const { result } = renderHook(() =>
        useATRRenderer({
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
        useATRRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: false,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should not render when klines are insufficient for period', () => {
      const shortKlines = [
        { openTime: 1000, closeTime: 2000, open: '100', high: '110', low: '95', close: '105', volume: '1000', quoteVolume: '100000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '50000' },
      ];

      const shortManager = {
        ...mockManager,
        getKlines: vi.fn(() => shortKlines),
      } as unknown as CanvasManager;

      const { result } = renderHook(() =>
        useATRRenderer({
          manager: shortManager,
          colors: mockColors,
          enabled: true,
          period: 14,
        })
      );

      result.current.render();

      expect(mockCtx.stroke).not.toHaveBeenCalled();
    });

    it('should save and restore context when rendering', () => {
      const { result } = renderHook(() =>
        useATRRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          period: 3,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should accept custom period prop', () => {
      const { result } = renderHook(() =>
        useATRRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          period: 5,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should accept custom multiplier prop', () => {
      const { result } = renderHook(() =>
        useATRRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
          period: 3,
          multiplier: 3.0,
        })
      );

      result.current.render();

      expect(mockCtx.save).toHaveBeenCalled();
    });
  });

  describe('hook return value', () => {
    it('should return render function', () => {
      const { result } = renderHook(() =>
        useATRRenderer({
          manager: mockManager,
          colors: mockColors,
          enabled: true,
        })
      );

      expect(result.current.render).toBeTypeOf('function');
    });
  });
});
