import { describe, expect, it } from 'vitest';
import { calculateSMA, calculateEMA, calculateMovingAverage } from './movingAverages';
import type { Candle } from '@shared/types';

describe('movingAverages', () => {
  const mockCandles: Candle[] = [
    { timestamp: 1000, open: 10, high: 12, low: 9, close: 11, volume: 100 },
    { timestamp: 2000, open: 11, high: 13, low: 10, close: 12, volume: 110 },
    { timestamp: 3000, open: 12, high: 14, low: 11, close: 13, volume: 120 },
    { timestamp: 4000, open: 13, high: 15, low: 12, close: 14, volume: 130 },
    { timestamp: 5000, open: 14, high: 16, low: 13, close: 15, volume: 140 },
    { timestamp: 6000, open: 15, high: 17, low: 14, close: 16, volume: 150 },
    { timestamp: 7000, open: 16, high: 18, low: 15, close: 17, volume: 160 },
    { timestamp: 8000, open: 17, high: 19, low: 16, close: 18, volume: 170 },
    { timestamp: 9000, open: 18, high: 20, low: 17, close: 19, volume: 180 },
    { timestamp: 10000, open: 19, high: 21, low: 18, close: 20, volume: 190 },
  ];

  describe('calculateSMA', () => {
    it('should return empty array for empty candles', () => {
      expect(calculateSMA([], 5)).toEqual([]);
    });

    it('should return empty array for period <= 0', () => {
      expect(calculateSMA(mockCandles, 0)).toEqual([]);
      expect(calculateSMA(mockCandles, -1)).toEqual([]);
    });

    it('should return nulls for initial values', () => {
      const result = calculateSMA(mockCandles, 3);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
    });

    it('should calculate SMA correctly for period 3', () => {
      const result = calculateSMA(mockCandles, 3);
      
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).toBe((11 + 12 + 13) / 3); // 12
      expect(result[3]).toBe((12 + 13 + 14) / 3); // 13
      expect(result[4]).toBe((13 + 14 + 15) / 3); // 14
    });

    it('should calculate SMA correctly for period 5', () => {
      const result = calculateSMA(mockCandles, 5);
      
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).toBeNull();
      expect(result[3]).toBeNull();
      expect(result[4]).toBe((11 + 12 + 13 + 14 + 15) / 5); // 13
      expect(result[5]).toBe((12 + 13 + 14 + 15 + 16) / 5); // 14
    });

    it('should handle period equal to candles length', () => {
      const result = calculateSMA(mockCandles, 10);
      
      for (let i = 0; i < 9; i++) {
        expect(result[i]).toBeNull();
      }
      
      const sum = mockCandles.reduce((acc, c) => acc + c.close, 0);
      expect(result[9]).toBe(sum / 10);
    });

    it('should return all nulls when period > candles length', () => {
      const result = calculateSMA(mockCandles, 15);
      
      expect(result.every(v => v === null)).toBe(true);
      expect(result.length).toBe(mockCandles.length);
    });
  });

  describe('calculateEMA', () => {
    it('should return empty array for empty candles', () => {
      expect(calculateEMA([], 5)).toEqual([]);
    });

    it('should return empty array for period <= 0', () => {
      expect(calculateEMA(mockCandles, 0)).toEqual([]);
      expect(calculateEMA(mockCandles, -1)).toEqual([]);
    });

    it('should return nulls for initial values', () => {
      const result = calculateEMA(mockCandles, 3);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
    });

    it('should start with SMA for first EMA value', () => {
      const result = calculateEMA(mockCandles, 3);
      const expectedFirstEMA = (11 + 12 + 13) / 3;
      
      expect(result[2]).toBe(expectedFirstEMA);
    });

    it('should calculate EMA correctly for period 3', () => {
      const result = calculateEMA(mockCandles, 3);
      const multiplier = 2 / (3 + 1); // 0.5
      
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      
      const firstEMA = (11 + 12 + 13) / 3; // 12
      expect(result[2]).toBe(firstEMA);
      
      const secondEMA = (14 - firstEMA) * multiplier + firstEMA;
      expect(result[3]).toBe(secondEMA);
      
      const thirdEMA = (15 - secondEMA) * multiplier + secondEMA;
      expect(result[4]).toBe(thirdEMA);
    });

    it('should calculate EMA correctly for period 5', () => {
      const result = calculateEMA(mockCandles, 5);
      const multiplier = 2 / (5 + 1); // 0.333...
      
      for (let i = 0; i < 4; i++) {
        expect(result[i]).toBeNull();
      }
      
      const firstEMA = (11 + 12 + 13 + 14 + 15) / 5; // 13
      expect(result[4]).toBe(firstEMA);
      
      const secondEMA = (16 - firstEMA) * multiplier + firstEMA;
      expect(result[5]).toBeCloseTo(secondEMA, 10);
    });

    it('should handle period equal to candles length', () => {
      const result = calculateEMA(mockCandles, 10);
      
      for (let i = 0; i < 9; i++) {
        expect(result[i]).toBeNull();
      }
      
      const sum = mockCandles.reduce((acc, c) => acc + c.close, 0);
      expect(result[9]).toBe(sum / 10);
    });

    it('should return all nulls when period > candles length', () => {
      const result = calculateEMA(mockCandles, 15);
      
      expect(result.every(v => v === null)).toBe(true);
      expect(result.length).toBe(mockCandles.length);
    });

    it('should react faster to price changes than SMA', () => {
      const volatileCandles: Candle[] = [
        ...mockCandles.slice(0, 5),
        { timestamp: 6000, open: 15, high: 30, low: 14, close: 30, volume: 150 },
        { timestamp: 7000, open: 30, high: 32, low: 29, close: 31, volume: 160 },
      ];

      const sma = calculateSMA(volatileCandles, 5);
      const ema = calculateEMA(volatileCandles, 5);

      const smaLast = sma[sma.length - 1] || 0;
      const emaLast = ema[ema.length - 1] || 0;

      expect(emaLast).toBeGreaterThan(smaLast);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should call calculateSMA when type is SMA', () => {
      const result = calculateMovingAverage(mockCandles, 3, 'SMA');
      const expected = calculateSMA(mockCandles, 3);
      
      expect(result).toEqual(expected);
    });

    it('should call calculateEMA when type is EMA', () => {
      const result = calculateMovingAverage(mockCandles, 3, 'EMA');
      const expected = calculateEMA(mockCandles, 3);
      
      expect(result).toEqual(expected);
    });

    it('should handle period 20', () => {
      const longCandles = Array.from({ length: 50 }, (_, i) => ({
        timestamp: (i + 1) * 1000,
        open: 100 + i,
        high: 102 + i,
        low: 99 + i,
        close: 101 + i,
        volume: 1000 + i * 10,
      }));

      const smaResult = calculateMovingAverage(longCandles, 20, 'SMA');
      const emaResult = calculateMovingAverage(longCandles, 20, 'EMA');

      expect(smaResult.filter(v => v !== null).length).toBeGreaterThan(0);
      expect(emaResult.filter(v => v !== null).length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle single candle', () => {
      const single = [mockCandles[0]!];
      
      const sma1 = calculateSMA(single, 1);
      expect(sma1[0]).toBe(11);
      
      const ema1 = calculateEMA(single, 1);
      expect(ema1[0]).toBe(11);
    });

    it('should handle candles with same price', () => {
      const flatCandles = Array.from({ length: 10 }, (_, i) => ({
        timestamp: (i + 1) * 1000,
        open: 100,
        high: 100,
        low: 100,
        close: 100,
        volume: 1000,
      }));

      const sma = calculateSMA(flatCandles, 5);
      const ema = calculateEMA(flatCandles, 5);

      const smaFiltered = sma.filter((v): v is number => v !== null);
      const emaFiltered = ema.filter((v): v is number => v !== null);

      smaFiltered.forEach(v => expect(v).toBe(100));
      emaFiltered.forEach(v => expect(v).toBe(100));
    });

    it('should handle decreasing prices', () => {
      const decreasingCandles = Array.from({ length: 10 }, (_, i) => ({
        timestamp: (i + 1) * 1000,
        open: 100 - i,
        high: 102 - i,
        low: 99 - i,
        close: 100 - i,
        volume: 1000,
      }));

      const sma = calculateSMA(decreasingCandles, 3);
      const ema = calculateEMA(decreasingCandles, 3);

      expect(sma.filter(v => v !== null).length).toBeGreaterThan(0);
      expect(ema.filter(v => v !== null).length).toBeGreaterThan(0);

      const smaFiltered = sma.filter((v): v is number => v !== null);
      for (let i = 1; i < smaFiltered.length; i++) {
        expect(smaFiltered[i]).toBeLessThan(smaFiltered[i - 1]!);
      }
    });
  });
});
