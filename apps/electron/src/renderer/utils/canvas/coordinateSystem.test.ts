import type { Kline, Viewport } from '@marketmind/types';
import { CHART_CONFIG } from '@shared/constants';
import { describe, expect, it } from 'vitest';
import {
    calculateBounds,
    clampViewport,
    indexToX,
    priceToY,
    volumeToHeight,
    xToIndex,
    yToPrice,
    type Bounds,
    type Dimensions,
} from './coordinateSystem';

const createViewport = (start: number, end: number): Viewport => ({
  start,
  end,
  klineWidth: 8,
  klineSpacing: 2,
});

describe('coordinateSystem', () => {
  const mockKlines: Kline[] = [
    { openTime: 1000, closeTime: 2000, open: '100', high: '110', low: '95', close: '105', volume: '1000', quoteVolume: '105000', trades: 100, takerBuyBaseVolume: '500', takerBuyQuoteVolume: '52500' },
    { openTime: 2000, closeTime: 3000, open: '105', high: '115', low: '100', close: '110', volume: '1500', quoteVolume: '165000', trades: 150, takerBuyBaseVolume: '750', takerBuyQuoteVolume: '82500' },
    { openTime: 3000, closeTime: 4000, open: '110', high: '120', low: '105', close: '115', volume: '2000', quoteVolume: '230000', trades: 200, takerBuyBaseVolume: '1000', takerBuyQuoteVolume: '115000' },
    { openTime: 4000, closeTime: 5000, open: '115', high: '125', low: '110', close: '120', volume: '1800', quoteVolume: '216000', trades: 180, takerBuyBaseVolume: '900', takerBuyQuoteVolume: '108000' },
    { openTime: 5000, closeTime: 6000, open: '120', high: '130', low: '115', close: '125', volume: '1200', quoteVolume: '150000', trades: 120, takerBuyBaseVolume: '600', takerBuyQuoteVolume: '75000' },
  ];

  const mockDimensions: Dimensions = {
    width: 1000,
    height: 800,
    chartHeight: 640,
    volumeHeight: 160,
    chartWidth: 1000,
  };

  describe('calculateBounds', () => {
    it('should calculate bounds correctly for all visible klines with padding', () => {
      const bounds = calculateBounds(mockKlines, createViewport(0, 5));

      expect(bounds.minPrice).toBe(77.5);
      expect(bounds.maxPrice).toBe(147.5);
      expect(bounds.minVolume).toBe(1000);
      expect(bounds.maxVolume).toBe(2000);
    });

    it('should handle partial viewport with padding', () => {
      const bounds = calculateBounds(mockKlines, createViewport(1, 3));

      expect(bounds.minPrice).toBe(90);
      expect(bounds.maxPrice).toBe(130);
    });

    it('should return zeros for empty visible klines', () => {
      const bounds = calculateBounds(mockKlines, createViewport(10, 20));

      expect(bounds.minPrice).toBe(0);
      expect(bounds.maxPrice).toBe(0);
    });

    it('should handle empty klines array', () => {
      const bounds = calculateBounds([], createViewport(0, 5));

      expect(bounds.minPrice).toBe(0);
      expect(bounds.maxPrice).toBe(0);
      expect(bounds.minVolume).toBe(0);
      expect(bounds.maxVolume).toBe(0);
    });
  });

  describe('priceToY and yToPrice', () => {
    const bounds: Bounds = {
      minPrice: 100,
      maxPrice: 200,
      minVolume: 1000,
      maxVolume: 2000,
    };

    it('should convert price to Y coordinate and back', () => {
      const originalPrice = 150;
      const y = priceToY(originalPrice, bounds, mockDimensions, 10, 10);
      const recoveredPrice = yToPrice(y, bounds, mockDimensions, 10, 10);

      expect(recoveredPrice).toBeCloseTo(originalPrice, 2);
    });

    it('should handle price at min bound', () => {
      const y = priceToY(100, bounds, mockDimensions, 10, 10);
      const expectedY = mockDimensions.chartHeight - 10;

      expect(y).toBe(expectedY);
    });

    it('should handle price at max bound', () => {
      const y = priceToY(200, bounds, mockDimensions, 10, 10);
      
      expect(y).toBe(10);
    });

    it('should handle zero price range', () => {
      const flatBounds: Bounds = { ...bounds, minPrice: 150, maxPrice: 150 };
      const y = priceToY(150, flatBounds, mockDimensions, 10, 10);

      expect(y).toBe(mockDimensions.chartHeight / 2);
    });
  });

  describe('volumeToHeight', () => {
    const bounds: Bounds = {
      minPrice: 100,
      maxPrice: 200,
      minVolume: 1000,
      maxVolume: 2000,
    };

    it('should convert volume to height correctly', () => {
      const height = volumeToHeight(1500, bounds, mockDimensions);
      const expectedHeight = (1500 / 2000) * mockDimensions.volumeHeight;

      expect(height).toBe(expectedHeight);
    });

    it('should handle volume at max', () => {
      const height = volumeToHeight(2000, bounds, mockDimensions);

      expect(height).toBe(mockDimensions.volumeHeight);
    });

    it('should handle zero max volume', () => {
      const zeroBounds: Bounds = { ...bounds, maxVolume: 0 };
      const height = volumeToHeight(1500, zeroBounds, mockDimensions);

      expect(height).toBe(0);
    });
  });

  describe('indexToX and xToIndex', () => {
    it('should convert index to X and back', () => {
      const originalIndex = 5.5;
      const x = indexToX(originalIndex, createViewport(0, 10), mockDimensions.chartWidth);
      const recoveredIndex = xToIndex(x, createViewport(0, 10), mockDimensions.chartWidth);

      expect(recoveredIndex).toBeCloseTo(originalIndex, 2);
    });

    it('should handle index at start', () => {
      const x = indexToX(0, createViewport(0, 10), mockDimensions.chartWidth);

      expect(x).toBe(0);
    });

    it('should handle fractional indices', () => {
      const x1 = indexToX(5, createViewport(0, 10), mockDimensions.chartWidth);
      const x2 = indexToX(5.5, createViewport(0, 10), mockDimensions.chartWidth);
      const x3 = indexToX(6, createViewport(0, 10), mockDimensions.chartWidth);

      expect(x2).toBeGreaterThan(x1);
      expect(x2).toBeLessThan(x3);
    });
  });

  describe('clampViewport', () => {
    it('should clamp viewport start to 0 and allow end to extend into future', () => {
      const clamped = clampViewport(createViewport(-10, 100), 50, { minKlinesVisible: 10 });
      const visibleRange = 100 - (-10);
      const maxFuture = Math.max(5, Math.floor(visibleRange * CHART_CONFIG.FUTURE_VIEWPORT_EXTENSION));
      const maxEnd = 50 + maxFuture;

      expect(clamped.start).toBeGreaterThanOrEqual(0);
      expect(clamped.end).toBeLessThanOrEqual(maxEnd);
    });

    it('should enforce minimum visible klines', () => {
      const clamped = clampViewport(createViewport(10, 12), 50, { minKlinesVisible: 10 });

      expect(clamped.end - clamped.start).toBeGreaterThanOrEqual(10);
    });

    it('should handle viewport starting before 0', () => {
      const clamped = clampViewport(createViewport(-5, 10), 50, { minKlinesVisible: 10 });

      expect(clamped.start).toBe(0);
    });

    it('should allow viewport to extend past klines into future', () => {
      const clamped = clampViewport(createViewport(40, 60), 50, { minKlinesVisible: 10 });
      const visibleRange = 60 - 40;
      const maxFuture = Math.max(5, Math.floor(visibleRange * CHART_CONFIG.FUTURE_VIEWPORT_EXTENSION));
      const maxEnd = 50 + maxFuture;

      expect(clamped.end).toBeLessThanOrEqual(maxEnd);
      expect(clamped.end).toBeGreaterThanOrEqual(50);
    });

    it('should preserve valid viewport within bounds', () => {
      const clamped = clampViewport(createViewport(10, 30), 50, { minKlinesVisible: 10 });

      expect(clamped.start).toBe(10);
      expect(clamped.end).toBe(30);
    });

    it('should respect futureExtension option when set to 0', () => {
      const clamped = clampViewport(createViewport(40, 60), 50, { minKlinesVisible: 10, futureExtension: 0 });

      expect(clamped.end).toBe(50);
    });
  });
});
