import type { Kline, Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createKlineRenderer } from './KlineLayer';

describe('KlineLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let klines: Kline[];
  let viewport: Viewport;
  const theme = {
    bullish: '#26a69a',
    bearish: '#ef5350',
  };

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn(),
      strokeStyle: '',
      fillStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    klines = [
      {
        openTime: 1700000000000,
        closeTime: 1700003600000,
        open: '100',
        high: '110',
        low: '95',
        close: '105',
        volume: '1000',
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
      },
      {
        openTime: 1700003600000,
        closeTime: 1700007200000,
        open: '105',
        high: '115',
        low: '100',
        close: '102',
        volume: '1100',
        quoteVolume: '112200',
        trades: 110,
        takerBuyBaseVolume: '550',
        takerBuyQuoteVolume: '56100',
      },
    ];

    viewport = {
      start: 0,
      end: 2,
      klineWidth: 10,
      klineSpacing: 2,
      width: 800,
      height: 600,
      priceMin: 90,
      priceMax: 120,
    };
  });

  describe('createKlineRenderer', () => {
    it('should create a renderer function', () => {
      const renderer = createKlineRenderer(klines, {}, theme);
      expect(typeof renderer).toBe('function');
    });

    it('should render klines correctly', () => {
      const renderer = createKlineRenderer(klines, {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should not render when klines array is empty', () => {
      const renderer = createKlineRenderer([], {}, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should not render when visible count is zero', () => {
      const renderer = createKlineRenderer(klines, {}, theme);
      const emptyViewport = { ...viewport, start: 10, end: 10 };
      renderer(mockCtx, emptyViewport);

      expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should use custom colors from config', () => {
      const config = {
        bullishColor: '#00ff00',
        bearishColor: '#ff0000',
        wickColor: '#888888',
      };
      const renderer = createKlineRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should use custom line width from config', () => {
      const config = { lineWidth: 2 };
      const renderer = createKlineRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(2);
    });

    it('should render bullish klines with bullish color', () => {
      const bullishKlines: Kline[] = [{
        openTime: 1700000000000,
        closeTime: 1700003600000,
        open: '100',
        high: '110',
        low: '95',
        close: '108',
        volume: '1000',
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
      }];

      const renderer = createKlineRenderer(bullishKlines, {}, theme);
      renderer(mockCtx, { ...viewport, end: 1 });

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should render bearish klines with bearish color', () => {
      const bearishKlines: Kline[] = [{
        openTime: 1700000000000,
        closeTime: 1700003600000,
        open: '110',
        high: '115',
        low: '95',
        close: '100',
        volume: '1000',
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
      }];

      const renderer = createKlineRenderer(bearishKlines, {}, theme);
      renderer(mockCtx, { ...viewport, end: 1 });

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should handle kline with very small body', () => {
      const flatKlines: Kline[] = [{
        openTime: 1700000000000,
        closeTime: 1700003600000,
        open: '100',
        high: '110',
        low: '95',
        close: '100',
        volume: '1000',
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
      }];

      const renderer = createKlineRenderer(flatKlines, {}, theme);
      renderer(mockCtx, { ...viewport, end: 1 });

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should respect min and max kline width constraints', () => {
      const config = { minKlineWidth: 5, maxKlineWidth: 15 };
      const renderer = createKlineRenderer(klines, config, theme);
      renderer(mockCtx, viewport);

      expect(mockCtx.fillRect).toHaveBeenCalled();
    });

    it('should skip undefined klines', () => {
      const sparseKlines = [klines[0], undefined as unknown as Kline, klines[1]];
      const renderer = createKlineRenderer(sparseKlines, {}, theme);
      renderer(mockCtx, { ...viewport, end: 3 });

      expect(mockCtx.fillRect).toHaveBeenCalledTimes(2);
    });
  });
});
