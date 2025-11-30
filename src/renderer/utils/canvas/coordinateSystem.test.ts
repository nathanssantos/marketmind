import { describe, expect, it } from 'vitest';
import {
  calculateBounds,
  priceToY,
  yToPrice,
  volumeToHeight,
  indexToX,
  xToIndex,
  clampViewport,
  type Bounds,
  type Dimensions,
} from './coordinateSystem';
import type { Kline, Viewport } from '@shared/types';

const createViewport = (start: number, end: number): Viewport => ({
  start,
  end,
  candleWidth: 8,
  candleSpacing: 2,
});

describe('coordinateSystem', () => {
  const mockCandles: Kline[] = [
    { timestamp: 1000, open: 100, high: 110, low: 95, close: 105, volume: 1000 },
    { timestamp: 2000, open: 105, high: 115, low: 100, close: 110, volume: 1500 },
    { timestamp: 3000, open: 110, high: 120, low: 105, close: 115, volume: 2000 },
    { timestamp: 4000, open: 115, high: 125, low: 110, close: 120, volume: 1800 },
    { timestamp: 5000, open: 120, high: 130, low: 115, close: 125, volume: 1200 },
  ];

  const mockDimensions: Dimensions = {
    width: 1000,
    height: 800,
    chartHeight: 640,
    volumeHeight: 160,
    chartWidth: 1000,
  };

  describe('calculateBounds', () => {
    it('should calculate bounds correctly for all visible candles', () => {
      const bounds = calculateBounds(mockCandles, createViewport(0, 5));

      expect(bounds.minPrice).toBe(95);
      expect(bounds.maxPrice).toBe(130);
      expect(bounds.minVolume).toBe(1000);
      expect(bounds.maxVolume).toBe(2000);
    });

    it('should handle partial viewport', () => {
      const bounds = calculateBounds(mockCandles, createViewport(1, 3));

      expect(bounds.minPrice).toBe(100);
      expect(bounds.maxPrice).toBe(120);
    });

    it('should return zeros for empty visible candles', () => {
      const bounds = calculateBounds(mockCandles, createViewport(10, 20));

      expect(bounds.minPrice).toBe(0);
      expect(bounds.maxPrice).toBe(0);
    });

    it('should handle empty candles array', () => {
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
    it('should clamp viewport within candle bounds', () => {
      const clamped = clampViewport(createViewport(-10, 100), 50, 10);

      expect(clamped.start).toBeGreaterThanOrEqual(0);
      expect(clamped.end).toBeLessThanOrEqual(50);
    });

    it('should enforce minimum visible candles', () => {
      const clamped = clampViewport(createViewport(10, 12), 50, 10);

      expect(clamped.end - clamped.start).toBeGreaterThanOrEqual(10);
    });

    it('should handle viewport starting before 0', () => {
      const clamped = clampViewport(createViewport(-5, 10), 50, 10);

      expect(clamped.start).toBe(0);
    });

    it('should handle viewport ending beyond candles', () => {
      const clamped = clampViewport(createViewport(40, 60), 50, 10);

      expect(clamped.end).toBe(50);
    });

    it('should preserve valid viewport', () => {
      const clamped = clampViewport(createViewport(10, 30), 50, 10);

      expect(clamped.start).toBe(10);
      expect(clamped.end).toBe(30);
    });
  });
});
