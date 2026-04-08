import type { Kline, Viewport } from '@marketmind/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createIndicatorRenderer, createMovingAverageRenderer } from './IndicatorLayer';

vi.mock('../../../lib/indicators', () => ({
  calculateMovingAverage: vi.fn((klines: Kline[], period: number) => {
    return klines.map((_, i) => (i >= period - 1 ? 100 + i : null));
  }),
}));

describe('IndicatorLayer', () => {
  let mockCtx: CanvasRenderingContext2D;
  let klines: Kline[];
  let viewport: Viewport;

  beforeEach(() => {
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      strokeStyle: '',
      lineWidth: 1,
    } as unknown as CanvasRenderingContext2D;

    klines = Array.from({ length: 50 }, (_, i) => ({
      openTime: 1700000000000 + i * 3600000,
      closeTime: 1700003600000 + i * 3600000,
      open: String(100 + i),
      high: String(105 + i),
      low: String(95 + i),
      close: String(102 + i),
      volume: '1000',
      quoteVolume: '100000',
      trades: 100,
      takerBuyBaseVolume: '500',
      takerBuyQuoteVolume: '50000',
    }));

    viewport = {
      start: 0,
      end: 50,
      klineWidth: 10,
      klineSpacing: 2,
      width: 800,
      height: 600,
      priceMin: 90,
      priceMax: 160,
    };
  });

  describe('createMovingAverageRenderer', () => {
    it('should create a renderer function', () => {
      const configs = [{ period: 20, color: '#ff0000' }];
      const renderer = createMovingAverageRenderer(klines, configs);
      expect(typeof renderer).toBe('function');
    });

    it('should not render when klines is empty', () => {
      const configs = [{ period: 20, color: '#ff0000' }];
      const renderer = createMovingAverageRenderer([], configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render moving average line', () => {
      const configs = [{ period: 20, color: '#ff0000' }];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.beginPath).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();
    });

    it('should use specified color', () => {
      const configs = [{ period: 20, color: '#00ff00' }];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.strokeStyle).toBe('#00ff00');
    });

    it('should use specified line width', () => {
      const configs = [{ period: 20, color: '#ff0000', lineWidth: 3 }];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(3);
    });

    it('should render multiple moving averages', () => {
      const configs = [
        { period: 10, color: '#ff0000' },
        { period: 20, color: '#00ff00' },
        { period: 50, color: '#0000ff' },
      ];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(3);
    });

    it('should use default line width of 2', () => {
      const configs = [{ period: 20, color: '#ff0000' }];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, viewport);

      expect(mockCtx.lineWidth).toBe(2);
    });

    it('should handle partial viewport', () => {
      const configs = [{ period: 20, color: '#ff0000' }];
      const renderer = createMovingAverageRenderer(klines, configs);
      renderer(mockCtx, { ...viewport, start: 20, end: 40 });

      expect(mockCtx.stroke).toHaveBeenCalled();
    });
  });

  describe('createIndicatorRenderer', () => {
    it('should create a renderer function', () => {
      const renderer = createIndicatorRenderer(klines, {});
      expect(typeof renderer).toBe('function');
    });

    it('should not render when no config is provided', () => {
      const renderer = createIndicatorRenderer(klines, {});
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render moving averages when configured', () => {
      const config = {
        movingAverages: [{ period: 20, color: '#ff0000' }],
      };
      const renderer = createIndicatorRenderer(klines, config);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).toHaveBeenCalled();
    });

    it('should not render moving averages when array is empty', () => {
      const config = { movingAverages: [] };
      const renderer = createIndicatorRenderer(klines, config);
      renderer(mockCtx, viewport);

      expect(mockCtx.save).not.toHaveBeenCalled();
    });

    it('should render multiple indicator types', () => {
      const config = {
        movingAverages: [
          { period: 10, color: '#ff0000' },
          { period: 20, color: '#00ff00' },
        ],
      };
      const renderer = createIndicatorRenderer(klines, config);
      renderer(mockCtx, viewport);

      expect(mockCtx.beginPath).toHaveBeenCalledTimes(2);
    });
  });
});
