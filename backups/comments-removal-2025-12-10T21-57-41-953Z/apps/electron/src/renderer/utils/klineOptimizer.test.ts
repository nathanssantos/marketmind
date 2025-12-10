import { describe, expect, it } from 'vitest';
import type { Kline } from '../../shared/types';
import {
    detectTimeframe,
    formatKlinesForPrompt,
    optimizeKlines,
    simplifyKline,
} from './klineOptimizer';

describe('klineOptimizer', () => {
  const createKline = (openTime: number, price: number): Kline => ({
    openTime,
    open: price.toString(),
    high: (price + 10).toString(),
    low: (price - 10).toString(),
    close: (price + 5).toString(),
    volume: '1000000',
    closeTime: openTime + 60000,
    quoteVolume: '50000000000',
    trades: 1000,
    takerBuyBaseVolume: '500000',
    takerBuyQuoteVolume: '25000000000',
  });

  describe('detectTimeframe', () => {
    it('should detect 1m timeframe', () => {
      const klines: Kline[] = [
        createKline(1000, 100),
        createKline(1000 + 60 * 1000, 110),
      ];
      expect(detectTimeframe(klines)).toBe('1m');
    });

    it('should detect 1h timeframe', () => {
      const klines: Kline[] = [
        createKline(1000, 100),
        createKline(1000 + 60 * 60 * 1000, 110),
      ];
      expect(detectTimeframe(klines)).toBe('1h');
    });

    it('should detect 1d timeframe', () => {
      const klines: Kline[] = [
        createKline(1000, 100),
        createKline(1000 + 24 * 60 * 60 * 1000, 110),
      ];
      expect(detectTimeframe(klines)).toBe('1d');
    });

    it('should return unknown for empty array', () => {
      expect(detectTimeframe([])).toBe('unknown');
    });

    it('should return unknown for single kline', () => {
      const klines: Kline[] = [createKline(1000, 100)];
      expect(detectTimeframe(klines)).toBe('unknown');
    });
  });

  describe('simplifyKline', () => {
    it('should round values to 2 decimal places', () => {
      const kline: Kline = {
        openTime: 1000,
        open: 100.12345,
        high: 105.98765,
        low: 95.11111,
        close: 102.99999,
        volume: 1234567.89,
      };

      const simplified = simplifyKline(kline);
      expect(simplified.open).toBe(100.12);
      expect(simplified.high).toBe(105.99);
      expect(simplified.low).toBe(95.11);
      expect(simplified.close).toBe(103);
      expect(simplified.volume).toBe(1234568);
    });

    it('should preserve timestamp', () => {
      const kline = createKline(123456789, 100);
      const simplified = simplifyKline(kline);
      expect(simplified.openTime).toBe(123456789);
    });
  });

  describe('optimizeKlines', () => {
    it('should return empty data for empty array', () => {
      const result = optimizeKlines([]);
      expect(result.detailed).toHaveLength(0);
      expect(result.simplified).toHaveLength(0);
      expect(result.openTimeInfo.total).toBe(0);
    });

    it('should keep last 32 klines detailed', () => {
      const klines: Kline[] = Array.from({ length: 100 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const result = optimizeKlines(klines);
      expect(result.detailed).toHaveLength(32);
      expect(result.detailed[0]?.close).toBe('173');
    });

    it('should simplify remaining klines', () => {
      const klines: Kline[] = Array.from({ length: 100 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const result = optimizeKlines(klines);
      expect(result.simplified).toHaveLength(68);
    });

    it('should downsample if too many klines', () => {
      const klines: Kline[] = Array.from({ length: 2000 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const result = optimizeKlines(klines);
      expect(result.simplified.length).toBeLessThanOrEqual(1000);
    });

    it('should set correct timestamp info', () => {
      const klines: Kline[] = [
        createKline(1000, 100),
        createKline(61000, 110),
        createKline(121000, 120),
      ];

      const result = optimizeKlines(klines);
      expect(result.openTimeInfo.first).toBe(1000);
      expect(result.openTimeInfo.last).toBe(121000);
      expect(result.openTimeInfo.total).toBe(3);
      expect(result.openTimeInfo.timeframe).toBe('1m');
    });
  });

  describe('formatKlinesForPrompt', () => {
    it('should format detailed klines', () => {
      const klines: Kline[] = Array.from({ length: 25 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const optimized = optimizeKlines(klines);
      const formatted = formatKlinesForPrompt(optimized);

      expect(formatted).toContain('Recent Klines');
      expect(formatted).toContain('MOST CURRENT');
      expect(formatted).toContain('CURRENT/LATEST');
      expect(formatted).toContain('O:$');
      expect(formatted).toContain('H:$');
      expect(formatted).toContain('L:$');
      expect(formatted).toContain('C:$');
    });

    it('should format simplified klines with range', () => {
      const klines: Kline[] = Array.from({ length: 100 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const optimized = optimizeKlines(klines);
      const formatted = formatKlinesForPrompt(optimized);

      expect(formatted).toContain('Historical Data');
      expect(formatted).toContain('OLDER data');
      expect(formatted).toContain('Range:');
    });

    it('should handle empty data', () => {
      const optimized = optimizeKlines([]);
      const formatted = formatKlinesForPrompt(optimized);
      expect(formatted).toBe('');
    });

    it('should show samples from simplified data', () => {
      const klines: Kline[] = Array.from({ length: 100 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const optimized = optimizeKlines(klines, 10);
      const formatted = formatKlinesForPrompt(optimized);

      expect(formatted).toContain('simplified');
      expect(formatted).toMatch(/\$\d+\.\d{2}/);
    });

    it('should handle data with only detailed klines', () => {
      const klines: Kline[] = Array.from({ length: 5 }, (_, i) =>
        createKline(i * 60000, 100 + i)
      );

      const optimized = optimizeKlines(klines, 50);
      const formatted = formatKlinesForPrompt(optimized);

      expect(formatted).toContain('Recent Klines');
      expect(formatted).not.toContain('Historical Data');
    });

    it('should format timestamps in ISO format', () => {
      const klines: Kline[] = [
        createKline(1609459200000, 100),
        createKline(1609545600000, 110),
      ];

      const optimized = optimizeKlines(klines);
      const formatted = formatKlinesForPrompt(optimized);

      expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
