import { describe, expect, it } from 'vitest';
import { calculateBounds } from './boundsCalculation';

describe('boundsCalculation', () => {
  const createKline = (low: number, high: number, volume: number): Kline => ({
    openTime: Date.now(),
    open: (low + high) / 2,
    high,
    low,
    close: (low + high) / 2,
    volume,
  });

  describe('calculateBounds', () => {
    it('should return zero bounds for empty klines array', () => {
      const result = calculateBounds([], 0, 10);
      
      expect(result).toEqual({
        minPrice: 0,
        maxPrice: 0,
        minVolume: 0,
        maxVolume: 0,
      });
    });

    it('should calculate bounds for single kline', () => {
      const klines = [createKline(100, 110, 1000)];
      const result = calculateBounds(klines, 0, 1);
      
      expect(result).toEqual({
        minPrice: 100,
        maxPrice: 110,
        minVolume: 1000,
        maxVolume: 1000,
      });
    });

    it('should calculate bounds for multiple klines', () => {
      const klines = [
        createKline(100, 110, 1000),
        createKline(95, 105, 1500),
        createKline(105, 115, 800),
      ];
      const result = calculateBounds(klines, 0, 3);
      
      expect(result).toEqual({
        minPrice: 95,
        maxPrice: 115,
        minVolume: 800,
        maxVolume: 1500,
      });
    });

    it('should respect viewport bounds', () => {
      const klines = [
        createKline(100, 110, 1000),
        createKline(90, 100, 1500),
        createKline(110, 120, 800),
        createKline(105, 115, 900),
      ];
      const result = calculateBounds(klines, 1, 3);
      
      expect(result).toEqual({
        minPrice: 90,
        maxPrice: 120,
        minVolume: 800,
        maxVolume: 1500,
      });
    });

    it('should handle fractional viewport indices', () => {
      const klines = [
        createKline(100, 110, 1000),
        createKline(95, 105, 1500),
        createKline(105, 115, 800),
      ];
      const result = calculateBounds(klines, 0.5, 2.5);
      
      expect(result).toEqual({
        minPrice: 95,
        maxPrice: 115,
        minVolume: 800,
        maxVolume: 1500,
      });
    });

    it('should clamp viewport to klines array bounds', () => {
      const klines = [
        createKline(100, 110, 1000),
        createKline(95, 105, 1500),
      ];
      const result = calculateBounds(klines, -5, 10);
      
      expect(result).toEqual({
        minPrice: 95,
        maxPrice: 110,
        minVolume: 1000,
        maxVolume: 1500,
      });
    });

    it('should return zero bounds for viewport outside klines range', () => {
      const klines = [
        createKline(100, 110, 1000),
      ];
      const result = calculateBounds(klines, 5, 10);
      
      expect(result).toEqual({
        minPrice: 0,
        maxPrice: 0,
        minVolume: 0,
        maxVolume: 0,
      });
    });

    it('should handle identical prices and volumes', () => {
      const klines = [
        createKline(100, 100, 1000),
        createKline(100, 100, 1000),
      ];
      const result = calculateBounds(klines, 0, 2);
      
      expect(result).toEqual({
        minPrice: 100,
        maxPrice: 100,
        minVolume: 1000,
        maxVolume: 1000,
      });
    });
  });
});
