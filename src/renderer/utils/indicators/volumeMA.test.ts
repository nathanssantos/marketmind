import { describe, expect, it } from 'vitest';
import { calculateVolumeMA, getVolumeMAPeriod } from './volume';
import type { Kline } from '../../../shared/types';

const createCandle = (volume: number, index: number): Candle => ({
  timestamp: 1000000 + index * 60000,
  open: 100,
  high: 105,
  low: 95,
  close: 100,
  volume,
});

describe('Volume Moving Average', () => {
  describe('getVolumeMAPeriod', () => {
    it('should return 20 for intraday timeframes', () => {
      expect(getVolumeMAPeriod('1m')).toBe(20);
      expect(getVolumeMAPeriod('5m')).toBe(20);
      expect(getVolumeMAPeriod('15m')).toBe(20);
      expect(getVolumeMAPeriod('30m')).toBe(20);
      expect(getVolumeMAPeriod('1h')).toBe(20);
      expect(getVolumeMAPeriod('4h')).toBe(20);
    });

    it('should return 20 for daily timeframe', () => {
      expect(getVolumeMAPeriod('1d')).toBe(20);
    });

    it('should return 14 for 3-day timeframe', () => {
      expect(getVolumeMAPeriod('3d')).toBe(14);
    });

    it('should return 10 for weekly and monthly timeframes', () => {
      expect(getVolumeMAPeriod('1w')).toBe(10);
      expect(getVolumeMAPeriod('1M')).toBe(10);
    });

    it('should return default 20 for unknown timeframes', () => {
      expect(getVolumeMAPeriod('unknown')).toBe(20);
      expect(getVolumeMAPeriod('5s')).toBe(20);
    });
  });

  describe('calculateVolumeMA', () => {
    it('should return empty values for empty candles array', () => {
      const result = calculateVolumeMA([], 20);
      expect(result.values).toEqual([]);
      expect(result.period).toBe(20);
    });

    it('should return empty values for period <= 0', () => {
      const candles = [createCandle(1000, 0), createCandle(2000, 1)];
      const result = calculateVolumeMA(candles, 0);
      expect(result.values).toEqual([]);
    });

    it('should return null for periods before enough data', () => {
      const candles = [
        createCandle(1000, 0),
        createCandle(2000, 1),
        createCandle(3000, 2),
      ];
      const result = calculateVolumeMA(candles, 5);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(null);
      expect(result.values[2]).toBe(null);
    });

    it('should calculate correct SMA for volume', () => {
      const candles = [
        createCandle(100, 0),
        createCandle(200, 1),
        createCandle(300, 2),
        createCandle(400, 3),
        createCandle(500, 4),
      ];
      
      const result = calculateVolumeMA(candles, 3);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(null);
      expect(result.values[2]).toBe(200);
      expect(result.values[3]).toBe(300);
      expect(result.values[4]).toBe(400);
    });

    it('should handle period 1 correctly', () => {
      const candles = [
        createCandle(1000, 0),
        createCandle(2000, 1),
        createCandle(3000, 2),
      ];
      
      const result = calculateVolumeMA(candles, 1);
      
      expect(result.values[0]).toBe(1000);
      expect(result.values[1]).toBe(2000);
      expect(result.values[2]).toBe(3000);
    });

    it('should calculate MA correctly for period 20', () => {
      const candles = Array.from({ length: 25 }, (_, i) => createCandle((i + 1) * 100, i));
      
      const result = calculateVolumeMA(candles, 20);
      
      for (let i = 0; i < 19; i++) {
        expect(result.values[i]).toBe(null);
      }
      
      const expected19 = (100 * (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20)) / 20;
      expect(result.values[19]).toBe(expected19);
    });

    it('should handle large volumes correctly', () => {
      const candles = [
        createCandle(1_000_000, 0),
        createCandle(2_000_000, 1),
        createCandle(3_000_000, 2),
      ];
      
      const result = calculateVolumeMA(candles, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(1_500_000);
      expect(result.values[2]).toBe(2_500_000);
    });

    it('should handle zero volumes correctly', () => {
      const candles = [
        createCandle(0, 0),
        createCandle(0, 1),
        createCandle(100, 2),
      ];
      
      const result = calculateVolumeMA(candles, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(0);
      expect(result.values[2]).toBe(50);
    });

    it('should maintain correct period in result', () => {
      const candles = [createCandle(1000, 0)];
      const result = calculateVolumeMA(candles, 10);
      
      expect(result.period).toBe(10);
    });

    it('should handle decimal volumes correctly', () => {
      const candles = [
        createCandle(100.5, 0),
        createCandle(200.5, 1),
        createCandle(300.5, 2),
      ];
      
      const result = calculateVolumeMA(candles, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(150.5);
      expect(result.values[2]).toBe(250.5);
    });
  });

  describe('calculateVolumeMA edge cases', () => {
    it('should handle candles with very high volumes', () => {
      const candles = [
        createCandle(Number.MAX_SAFE_INTEGER, 0),
        createCandle(Number.MAX_SAFE_INTEGER, 1),
      ];
      
      const result = calculateVolumeMA(candles, 2);
      expect(result.values[1]).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should produce correct rolling window', () => {
      const candles = [
        createCandle(10, 0),
        createCandle(20, 1),
        createCandle(30, 2),
        createCandle(40, 3),
        createCandle(50, 4),
      ];
      
      const result = calculateVolumeMA(candles, 3);
      
      expect(result.values[2]).toBe(20);
      expect(result.values[3]).toBe(30);
      expect(result.values[4]).toBe(40);
    });
  });
});
