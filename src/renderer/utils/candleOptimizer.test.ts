import { describe, expect, it } from 'vitest';
import type { Candle } from '../../shared/types';
import {
    detectTimeframe,
    formatCandlesForPrompt,
    optimizeCandles,
    simplifyCandle,
} from './candleOptimizer';

describe('candleOptimizer', () => {
  const createCandle = (timestamp: number, price: number): Candle => ({
    timestamp,
    open: price,
    high: price + 10,
    low: price - 10,
    close: price + 5,
    volume: 1000000,
  });

  describe('detectTimeframe', () => {
    it('should detect 1m timeframe', () => {
      const candles: Candle[] = [
        createCandle(1000, 100),
        createCandle(1000 + 60 * 1000, 110),
      ];
      expect(detectTimeframe(candles)).toBe('1m');
    });

    it('should detect 1h timeframe', () => {
      const candles: Candle[] = [
        createCandle(1000, 100),
        createCandle(1000 + 60 * 60 * 1000, 110),
      ];
      expect(detectTimeframe(candles)).toBe('1h');
    });

    it('should detect 1d timeframe', () => {
      const candles: Candle[] = [
        createCandle(1000, 100),
        createCandle(1000 + 24 * 60 * 60 * 1000, 110),
      ];
      expect(detectTimeframe(candles)).toBe('1d');
    });

    it('should return unknown for empty array', () => {
      expect(detectTimeframe([])).toBe('unknown');
    });

    it('should return unknown for single candle', () => {
      const candles: Candle[] = [createCandle(1000, 100)];
      expect(detectTimeframe(candles)).toBe('unknown');
    });
  });

  describe('simplifyCandle', () => {
    it('should round values to 2 decimal places', () => {
      const candle: Candle = {
        timestamp: 1000,
        open: 100.12345,
        high: 105.98765,
        low: 95.11111,
        close: 102.99999,
        volume: 1234567.89,
      };

      const simplified = simplifyCandle(candle);
      expect(simplified.open).toBe(100.12);
      expect(simplified.high).toBe(105.99);
      expect(simplified.low).toBe(95.11);
      expect(simplified.close).toBe(103);
      expect(simplified.volume).toBe(1234568);
    });

    it('should preserve timestamp', () => {
      const candle = createCandle(123456789, 100);
      const simplified = simplifyCandle(candle);
      expect(simplified.timestamp).toBe(123456789);
    });
  });

  describe('optimizeCandles', () => {
    it('should return empty data for empty array', () => {
      const result = optimizeCandles([]);
      expect(result.detailed).toHaveLength(0);
      expect(result.simplified).toHaveLength(0);
      expect(result.timestampInfo.total).toBe(0);
    });

    it('should keep last 32 candles detailed', () => {
      const candles: Candle[] = Array.from({ length: 100 }, (_, i) =>
        createCandle(i * 60000, 100 + i)
      );

      const result = optimizeCandles(candles);
      expect(result.detailed).toHaveLength(32);
      expect(result.detailed[0]?.close).toBe(173);
    });

    it('should simplify remaining candles', () => {
      const candles: Candle[] = Array.from({ length: 100 }, (_, i) =>
        createCandle(i * 60000, 100 + i)
      );

      const result = optimizeCandles(candles);
      expect(result.simplified).toHaveLength(68);
    });

    it('should downsample if too many candles', () => {
      const candles: Candle[] = Array.from({ length: 2000 }, (_, i) =>
        createCandle(i * 60000, 100 + i)
      );

      const result = optimizeCandles(candles);
      expect(result.simplified.length).toBeLessThanOrEqual(1000);
    });

    it('should set correct timestamp info', () => {
      const candles: Candle[] = [
        createCandle(1000, 100),
        createCandle(61000, 110),
        createCandle(121000, 120),
      ];

      const result = optimizeCandles(candles);
      expect(result.timestampInfo.first).toBe(1000);
      expect(result.timestampInfo.last).toBe(121000);
      expect(result.timestampInfo.total).toBe(3);
      expect(result.timestampInfo.timeframe).toBe('1m');
    });
  });

  describe('formatCandlesForPrompt', () => {
    it('should format detailed candles', () => {
      const candles: Candle[] = Array.from({ length: 25 }, (_, i) =>
        createCandle(i * 60000, 100 + i)
      );

      const optimized = optimizeCandles(candles);
      const formatted = formatCandlesForPrompt(optimized);

      expect(formatted).toContain('Recent Candles');
      expect(formatted).toContain('MOST CURRENT');
      expect(formatted).toContain('CURRENT/LATEST');
      expect(formatted).toContain('O:$');
      expect(formatted).toContain('H:$');
      expect(formatted).toContain('L:$');
      expect(formatted).toContain('C:$');
    });

    it('should format simplified candles with range', () => {
      const candles: Candle[] = Array.from({ length: 100 }, (_, i) =>
        createCandle(i * 60000, 100 + i)
      );

      const optimized = optimizeCandles(candles);
      const formatted = formatCandlesForPrompt(optimized);

      expect(formatted).toContain('Historical Data');
      expect(formatted).toContain('OLDER data');
      expect(formatted).toContain('Range:');
    });

    it('should handle empty data', () => {
      const optimized = optimizeCandles([]);
      const formatted = formatCandlesForPrompt(optimized);
      expect(formatted).toBe('');
    });
  });
});
