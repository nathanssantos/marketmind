import { describe, expect, it } from 'vitest';
import { calculateVolumeMA, getVolumeMAPeriod } from './volume';

const createKline = (volume: number, index: number): Kline => ({
  openTime: 1000000 + index * 60000,
  closeTime: 1000000 + (index + 1) * 60000,
  open: '100',
  high: '105',
  low: '95',
  close: '100',
  volume: volume.toString(),
  quoteVolume: (volume * 100).toString(),
  trades: 100,
  takerBuyBaseVolume: (volume * 0.5).toString(),
  takerBuyQuoteVolume: (volume * 50).toString(),
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
    it('should return empty values for empty klines array', () => {
      const result = calculateVolumeMA([], 20);
      expect(result.values).toEqual([]);
      expect(result.period).toBe(20);
    });

    it('should return empty values for period <= 0', () => {
      const klines = [createKline(1000, 0), createKline(2000, 1)];
      const result = calculateVolumeMA(klines, 0);
      expect(result.values).toEqual([]);
    });

    it('should return null for periods before enough data', () => {
      const klines = [
        createKline(1000, 0),
        createKline(2000, 1),
        createKline(3000, 2),
      ];
      const result = calculateVolumeMA(klines, 5);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(null);
      expect(result.values[2]).toBe(null);
    });

    it('should calculate correct SMA for volume', () => {
      const klines = [
        createKline(100, 0),
        createKline(200, 1),
        createKline(300, 2),
        createKline(400, 3),
        createKline(500, 4),
      ];
      
      const result = calculateVolumeMA(klines, 3);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(null);
      expect(result.values[2]).toBe(200);
      expect(result.values[3]).toBe(300);
      expect(result.values[4]).toBe(400);
    });

    it('should handle period 1 correctly', () => {
      const klines = [
        createKline(1000, 0),
        createKline(2000, 1),
        createKline(3000, 2),
      ];
      
      const result = calculateVolumeMA(klines, 1);
      
      expect(result.values[0]).toBe(1000);
      expect(result.values[1]).toBe(2000);
      expect(result.values[2]).toBe(3000);
    });

    it('should calculate MA correctly for period 20', () => {
      const klines = Array.from({ length: 25 }, (_, i) => createKline((i + 1) * 100, i));
      
      const result = calculateVolumeMA(klines, 20);
      
      for (let i = 0; i < 19; i++) {
        expect(result.values[i]).toBe(null);
      }
      
      const expected19 = (100 * (1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20)) / 20;
      expect(result.values[19]).toBe(expected19);
    });

    it('should handle large volumes correctly', () => {
      const klines = [
        createKline(1_000_000, 0),
        createKline(2_000_000, 1),
        createKline(3_000_000, 2),
      ];
      
      const result = calculateVolumeMA(klines, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(1_500_000);
      expect(result.values[2]).toBe(2_500_000);
    });

    it('should handle zero volumes correctly', () => {
      const klines = [
        createKline(0, 0),
        createKline(0, 1),
        createKline(100, 2),
      ];
      
      const result = calculateVolumeMA(klines, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(0);
      expect(result.values[2]).toBe(50);
    });

    it('should maintain correct period in result', () => {
      const klines = [createKline(1000, 0)];
      const result = calculateVolumeMA(klines, 10);
      
      expect(result.period).toBe(10);
    });

    it('should handle decimal volumes correctly', () => {
      const klines = [
        createKline(100.5, 0),
        createKline(200.5, 1),
        createKline(300.5, 2),
      ];
      
      const result = calculateVolumeMA(klines, 2);
      
      expect(result.values[0]).toBe(null);
      expect(result.values[1]).toBe(150.5);
      expect(result.values[2]).toBe(250.5);
    });
  });

  describe('calculateVolumeMA edge cases', () => {
    it('should handle klines with very high volumes', () => {
      const klines = [
        createKline(Number.MAX_SAFE_INTEGER, 0),
        createKline(Number.MAX_SAFE_INTEGER, 1),
      ];
      
      const result = calculateVolumeMA(klines, 2);
      expect(result.values[1]).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('should produce correct rolling window', () => {
      const klines = [
        createKline(10, 0),
        createKline(20, 1),
        createKline(30, 2),
        createKline(40, 3),
        createKline(50, 4),
      ];
      
      const result = calculateVolumeMA(klines, 3);
      
      expect(result.values[2]).toBe(20);
      expect(result.values[3]).toBe(30);
      expect(result.values[4]).toBe(40);
    });
  });
});
