import { describe, expect, it } from 'vitest';
import type { Candle } from '../../shared/types';
import { detectTimeframe, optimizeCandles, simplifyCandle } from './candleOptimization';

describe('candleOptimization', () => {
  const createCandle = (timestamp: number, price: number, volume: number): Candle => ({
    timestamp,
    open: price,
    high: price + 10,
    low: price - 10,
    close: price + 5,
    volume,
  });

  describe('detectTimeframe', () => {
    it('should return unknown for empty array', () => {
      expect(detectTimeframe([])).toBe('unknown');
    });

    it('should return unknown for single candle', () => {
      const candles = [createCandle(1000000, 100, 1000)];
      expect(detectTimeframe(candles)).toBe('unknown');
    });

    it('should detect 1m timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(1060000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('1m');
    });

    it('should detect 5m timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(1300000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('5m');
    });

    it('should detect 15m timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(1900000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('15m');
    });

    it('should detect 30m timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(2800000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('30m');
    });

    it('should detect 1h timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(4600000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('1h');
    });

    it('should detect 4h timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(15400000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('4h');
    });

    it('should detect 1d timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(87400000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('1d');
    });

    it('should detect 1w timeframe', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(605000000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('1w');
    });

    it('should return unknown for larger intervals', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(10000000000, 100, 1000),
      ];
      expect(detectTimeframe(candles)).toBe('unknown');
    });
  });

  describe('simplifyCandle', () => {
    it('should round prices to 2 decimal places', () => {
      const candle: Candle = {
        timestamp: 1000000,
        open: 100.123456,
        high: 105.987654,
        low: 95.456789,
        close: 102.345678,
        volume: 1234.567,
      };

      const result = simplifyCandle(candle);

      expect(result.timestamp).toBe(1000000);
      expect(result.open).toBe(100.12);
      expect(result.high).toBe(105.99);
      expect(result.low).toBe(95.46);
      expect(result.close).toBe(102.35);
      expect(result.volume).toBe(1235);
    });

    it('should preserve exact values when already rounded', () => {
      const candle: Candle = {
        timestamp: 1000000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      };

      const result = simplifyCandle(candle);

      expect(result).toEqual({
        timestamp: 1000000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      });
    });
  });

  describe('optimizeCandles', () => {
    it('should return empty result for empty array', () => {
      const result = optimizeCandles([]);

      expect(result.detailed).toEqual([]);
      expect(result.simplified).toEqual([]);
      expect(result.timestampInfo).toEqual({
        first: 0,
        last: 0,
        total: 0,
        timeframe: 'unknown',
      });
    });

    it('should keep all candles detailed if less than detailedCount', () => {
      const candles = [
        createCandle(1000000, 100, 1000),
        createCandle(1060000, 101, 1100),
        createCandle(1120000, 102, 1200),
      ];

      const result = optimizeCandles(candles, 32);

      expect(result.detailed).toHaveLength(3);
      expect(result.simplified).toEqual([]);
      expect(result.timestampInfo.total).toBe(3);
      expect(result.timestampInfo.timeframe).toBe('1m');
    });

    it('should split candles into detailed and simplified', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 100; i++) {
        candles.push(createCandle(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeCandles(candles, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified).toHaveLength(68);
      expect(result.timestampInfo.total).toBe(100);
      expect(result.timestampInfo.first).toBe(1000000);
      expect(result.timestampInfo.last).toBe(1000000 + 99 * 60000);
    });

    it('should downsample when simplified count exceeds MAX_SIMPLIFIED_CANDLES', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 2000; i++) {
        candles.push(createCandle(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeCandles(candles, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified.length).toBeLessThanOrEqual(1000);
      expect(result.timestampInfo.total).toBe(2000);
    });

    it('should use custom detailedCount parameter', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 100; i++) {
        candles.push(createCandle(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeCandles(candles, 50);

      expect(result.detailed).toHaveLength(50);
      expect(result.simplified).toHaveLength(50);
    });

    it('should correctly simplify candles with rounding', () => {
      const candles: Candle[] = [
        {
          timestamp: 1000000,
          open: 100.123,
          high: 105.987,
          low: 95.456,
          close: 102.345,
          volume: 1234.567,
        },
        {
          timestamp: 1060000,
          open: 102.345,
          high: 108.123,
          low: 98.789,
          close: 105.678,
          volume: 2345.678,
        },
      ];

      const result = optimizeCandles(candles, 1);

      expect(result.simplified).toHaveLength(1);
      expect(result.simplified[0]).toEqual({
        timestamp: 1000000,
        open: 100.12,
        high: 105.99,
        low: 95.46,
        close: 102.35,
        volume: 1235,
      });
    });

    it('should handle edge case with exactly MAX_SIMPLIFIED_CANDLES remaining', () => {
      const candles: Candle[] = [];
      for (let i = 0; i < 1032; i++) {
        candles.push(createCandle(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeCandles(candles, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified).toHaveLength(1000);
    });
  });
});
