import { describe, expect, it } from 'vitest';
import type { Candle } from '../../shared/types';
import { calculateEMA, calculateMovingAverages, calculateSMA } from './movingAveragesCalculation';

describe('movingAveragesCalculation', () => {
  const createCandle = (close: number): Candle => ({
    timestamp: Date.now(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  });

  describe('calculateSMA', () => {
    it('should return empty array for empty candles', () => {
      const result = calculateSMA([], 5);
      expect(result).toEqual([]);
    });

    it('should return nulls when not enough data points', () => {
      const candles = [createCandle(100), createCandle(101), createCandle(102)];
      const result = calculateSMA(candles, 5);

      expect(result).toHaveLength(3);
      expect(result).toEqual([null, null, null]);
    });

    it('should calculate SMA correctly with exact period', () => {
      const candles = [
        createCandle(100),
        createCandle(102),
        createCandle(104),
        createCandle(106),
        createCandle(108),
      ];
      const result = calculateSMA(candles, 5);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe(null);
      expect(result[1]).toBe(null);
      expect(result[2]).toBe(null);
      expect(result[3]).toBe(null);
      expect(result[4]).toBe((100 + 102 + 104 + 106 + 108) / 5);
    });

    it('should calculate SMA for period of 3', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
      ];
      const result = calculateSMA(candles, 3);

      expect(result).toEqual([
        null,
        null,
        (10 + 20 + 30) / 3,
        (20 + 30 + 40) / 3,
        (30 + 40 + 50) / 3,
      ]);
    });

    it('should calculate SMA with period of 1', () => {
      const candles = [createCandle(100), createCandle(200), createCandle(300)];
      const result = calculateSMA(candles, 1);

      expect(result).toEqual([100, 200, 300]);
    });

    it('should handle large datasets efficiently', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 1000; i++) {
        candles.push(createCandle(100 + i));
      }

      const result = calculateSMA(candles, 20);

      expect(result).toHaveLength(1000);
      expect(result[19]).not.toBe(null);
      expect(result[999]).not.toBe(null);
    });
  });

  describe('calculateEMA', () => {
    it('should return empty array for empty candles', () => {
      const result = calculateEMA([], 5);
      expect(result).toEqual([]);
    });

    it('should return nulls when not enough data points', () => {
      const candles = [createCandle(100), createCandle(101), createCandle(102)];
      const result = calculateEMA(candles, 5);

      expect(result).toHaveLength(3);
      expect(result).toEqual([null, null, null]);
    });

    it('should calculate EMA with initial SMA', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
      ];
      const result = calculateEMA(candles, 3);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe(null);
      expect(result[1]).toBe(null);
      expect(result[2]).toBe((10 + 20 + 30) / 3);

      const multiplier = 2 / (3 + 1);
      const ema3 = (40 - result[2]!) * multiplier + result[2]!;
      expect(result[3]).toBeCloseTo(ema3, 10);

      const ema4 = (50 - ema3) * multiplier + ema3;
      expect(result[4]).toBeCloseTo(ema4, 10);
    });

    it('should calculate EMA with period of 1', () => {
      const candles = [createCandle(100), createCandle(200), createCandle(300)];
      const result = calculateEMA(candles, 1);

      expect(result).toEqual([100, 200, 300]);
    });

    it('should react faster than SMA to price changes', () => {
      const candles = [
        createCandle(100),
        createCandle(100),
        createCandle(100),
        createCandle(100),
        createCandle(100),
        createCandle(150),
      ];

      const sma = calculateSMA(candles, 5);
      const ema = calculateEMA(candles, 5);

      const smaLast = sma[5]!;
      const emaLast = ema[5]!;

      expect(emaLast).toBeGreaterThan(smaLast);
    });

    it('should handle large datasets efficiently', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 1000; i++) {
        candles.push(createCandle(100 + i * 0.5));
      }

      const result = calculateEMA(candles, 20);

      expect(result).toHaveLength(1000);
      expect(result[19]).not.toBe(null);
      expect(result[999]).not.toBe(null);
    });

    it('should produce smooth values in trending market', () => {
      const candles = [
        createCandle(100),
        createCandle(101),
        createCandle(102),
        createCandle(103),
        createCandle(104),
        createCandle(105),
        createCandle(106),
        createCandle(107),
        createCandle(108),
        createCandle(109),
      ];

      const result = calculateEMA(candles, 3);

      for (let i = 3; i < result.length; i++) {
        expect(result[i]).toBeGreaterThan(result[i - 1]!);
      }
    });
  });

  describe('calculateMovingAverages', () => {
    it('should return empty array when no configs provided', () => {
      const candles = [createCandle(100)];
      const result = calculateMovingAverages(candles, []);

      expect(result).toEqual([]);
    });

    it('should filter out disabled configs', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'SMA' as const, color: '#00ff00', enabled: false },
        { period: 7, type: 'EMA' as const, color: '#0000ff', enabled: false },
      ];

      const result = calculateMovingAverages(candles, configs);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe(3);
      expect(result[0].type).toBe('SMA');
    });

    it('should calculate multiple SMAs', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'SMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(candles, configs);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe(3);
      expect(result[0].type).toBe('SMA');
      expect(result[0].color).toBe('#ff0000');
      expect(result[0].values).toHaveLength(5);

      expect(result[1].period).toBe(5);
      expect(result[1].type).toBe('SMA');
      expect(result[1].color).toBe('#00ff00');
      expect(result[1].values).toHaveLength(5);
    });

    it('should calculate multiple EMAs', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
        createCandle(60),
      ];

      const configs = [
        { period: 3, type: 'EMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'EMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(candles, configs);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe(3);
      expect(result[0].type).toBe('EMA');
      expect(result[1].period).toBe(5);
      expect(result[1].type).toBe('EMA');
    });

    it('should calculate mixed SMA and EMA', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
        createCandle(100),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 3, type: 'EMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(candles, configs);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('SMA');
      expect(result[1].type).toBe('EMA');

      expect(result[0].values[2]).toBe((10 + 20 + 30) / 3);
      expect(result[1].values[2]).toBe((10 + 20 + 30) / 3);
      expect(result[0].values[5]).not.toBe(result[1].values[5]);
    });

    it('should preserve config properties in results', () => {
      const candles = [
        createCandle(10),
        createCandle(20),
        createCandle(30),
        createCandle(40),
        createCandle(50),
      ];

      const configs = [
        { period: 20, type: 'SMA' as const, color: '#123456', enabled: true },
        { period: 50, type: 'EMA' as const, color: '#abcdef', enabled: true },
      ];

      const result = calculateMovingAverages(candles, configs);

      expect(result[0]).toMatchObject({
        period: 20,
        type: 'SMA',
        color: '#123456',
      });

      expect(result[1]).toMatchObject({
        period: 50,
        type: 'EMA',
        color: '#abcdef',
      });
    });
  });
});
