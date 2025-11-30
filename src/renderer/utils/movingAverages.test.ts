import { describe, expect, it } from 'vitest';
import type { Kline } from '../../shared/types';
import { calculateEMA, calculateMovingAverages, calculateSMA } from './movingAverages';

describe('movingAveragesCalculation', () => {
  const createKline = (close: number): Kline => ({
    openTime: Date.now(),
    open: close,
    high: close + 1,
    low: close - 1,
    close,
    volume: 1000,
  });

  describe('calculateSMA', () => {
    it('should return empty array for empty klines', () => {
      const result = calculateSMA([], 5);
      expect(result).toEqual([]);
    });

    it('should return nulls when not enough data points', () => {
      const klines = [createKline(100), createKline(101), createKline(102)];
      const result = calculateSMA(klines, 5);

      expect(result).toHaveLength(3);
      expect(result).toEqual([null, null, null]);
    });

    it('should calculate SMA correctly with exact period', () => {
      const klines = [
        createKline(100),
        createKline(102),
        createKline(104),
        createKline(106),
        createKline(108),
      ];
      const result = calculateSMA(klines, 5);

      expect(result).toHaveLength(5);
      expect(result[0]).toBe(null);
      expect(result[1]).toBe(null);
      expect(result[2]).toBe(null);
      expect(result[3]).toBe(null);
      expect(result[4]).toBe((100 + 102 + 104 + 106 + 108) / 5);
    });

    it('should calculate SMA for period of 3', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
      ];
      const result = calculateSMA(klines, 3);

      expect(result).toEqual([
        null,
        null,
        (10 + 20 + 30) / 3,
        (20 + 30 + 40) / 3,
        (30 + 40 + 50) / 3,
      ]);
    });

    it('should calculate SMA with period of 1', () => {
      const klines = [createKline(100), createKline(200), createKline(300)];
      const result = calculateSMA(klines, 1);

      expect(result).toEqual([100, 200, 300]);
    });

    it('should handle large datasets efficiently', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 1000; i++) {
        klines.push(createKline(100 + i));
      }

      const result = calculateSMA(klines, 20);

      expect(result).toHaveLength(1000);
      expect(result[19]).not.toBe(null);
      expect(result[999]).not.toBe(null);
    });
  });

  describe('calculateEMA', () => {
    it('should return empty array for empty klines', () => {
      const result = calculateEMA([], 5);
      expect(result).toEqual([]);
    });

    it('should return nulls when not enough data points', () => {
      const klines = [createKline(100), createKline(101), createKline(102)];
      const result = calculateEMA(klines, 5);

      expect(result).toHaveLength(3);
      expect(result).toEqual([null, null, null]);
    });

    it('should calculate EMA with initial SMA', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
      ];
      const result = calculateEMA(klines, 3);

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
      const klines = [createKline(100), createKline(200), createKline(300)];
      const result = calculateEMA(klines, 1);

      expect(result).toEqual([100, 200, 300]);
    });

    it('should react faster than SMA to price changes', () => {
      const klines = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(150),
      ];

      const sma = calculateSMA(klines, 5);
      const ema = calculateEMA(klines, 5);

      const smaLast = sma[5]!;
      const emaLast = ema[5]!;

      expect(emaLast).toBeGreaterThan(smaLast);
    });

    it('should handle large datasets efficiently', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 1000; i++) {
        klines.push(createKline(100 + i * 0.5));
      }

      const result = calculateEMA(klines, 20);

      expect(result).toHaveLength(1000);
      expect(result[19]).not.toBe(null);
      expect(result[999]).not.toBe(null);
    });

    it('should produce smooth values in trending market', () => {
      const klines = [
        createKline(100),
        createKline(101),
        createKline(102),
        createKline(103),
        createKline(104),
        createKline(105),
        createKline(106),
        createKline(107),
        createKline(108),
        createKline(109),
      ];

      const result = calculateEMA(klines, 3);

      for (let i = 3; i < result.length; i++) {
        expect(result[i]).toBeGreaterThan(result[i - 1]!);
      }
    });
  });

  describe('calculateMovingAverages', () => {
    it('should return empty array when no configs provided', () => {
      const klines = [createKline(100)];
      const result = calculateMovingAverages(klines, []);

      expect(result).toEqual([]);
    });

    it('should filter out disabled configs', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'SMA' as const, color: '#00ff00', enabled: false },
        { period: 7, type: 'EMA' as const, color: '#0000ff', enabled: false },
      ];

      const result = calculateMovingAverages(klines, configs);

      expect(result).toHaveLength(1);
      expect(result[0].period).toBe(3);
      expect(result[0].type).toBe('SMA');
    });

    it('should calculate multiple SMAs', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'SMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(klines, configs);

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
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
        createKline(60),
      ];

      const configs = [
        { period: 3, type: 'EMA' as const, color: '#ff0000', enabled: true },
        { period: 5, type: 'EMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(klines, configs);

      expect(result).toHaveLength(2);
      expect(result[0].period).toBe(3);
      expect(result[0].type).toBe('EMA');
      expect(result[1].period).toBe(5);
      expect(result[1].type).toBe('EMA');
    });

    it('should calculate mixed SMA and EMA', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
        createKline(100),
      ];

      const configs = [
        { period: 3, type: 'SMA' as const, color: '#ff0000', enabled: true },
        { period: 3, type: 'EMA' as const, color: '#00ff00', enabled: true },
      ];

      const result = calculateMovingAverages(klines, configs);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('SMA');
      expect(result[1].type).toBe('EMA');

      expect(result[0].values[2]).toBe((10 + 20 + 30) / 3);
      expect(result[1].values[2]).toBe((10 + 20 + 30) / 3);
      expect(result[0].values[5]).not.toBe(result[1].values[5]);
    });

    it('should preserve config properties in results', () => {
      const klines = [
        createKline(10),
        createKline(20),
        createKline(30),
        createKline(40),
        createKline(50),
      ];

      const configs = [
        { period: 20, type: 'SMA' as const, color: '#123456', enabled: true },
        { period: 50, type: 'EMA' as const, color: '#abcdef', enabled: true },
      ];

      const result = calculateMovingAverages(klines, configs);

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
