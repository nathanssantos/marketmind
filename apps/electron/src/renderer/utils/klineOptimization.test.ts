import { describe, expect, it } from 'vitest';
import type { Kline } from '../../shared/types';
import { detectTimeframe, optimizeKlines, simplifyKline } from './klineOptimization';

describe('klineOptimization', () => {
  const createKline = (openTime: number, price: number, volume: number): Kline => ({
    openTime,
    open: price.toString(),
    high: (price + 10).toString(),
    low: (price - 10).toString(),
    close: (price + 5).toString(),
    volume: volume.toString(),
    closeTime: openTime + 60000,
    quoteVolume: (volume * price).toString(),
    trades: 1000,
    takerBuyBaseVolume: (volume * 0.5).toString(),
    takerBuyQuoteVolume: (volume * price * 0.5).toString(),
  });

  describe('detectTimeframe', () => {
    it('should return unknown for empty array', () => {
      expect(detectTimeframe([])).toBe('unknown');
    });

    it('should return unknown for single kline', () => {
      const klines = [createKline(1000000, 100, 1000)];
      expect(detectTimeframe(klines)).toBe('unknown');
    });

    it('should detect 1m timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(1060000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('1m');
    });

    it('should detect 5m timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(1300000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('5m');
    });

    it('should detect 15m timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(1900000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('15m');
    });

    it('should detect 30m timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(2800000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('30m');
    });

    it('should detect 1h timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(4600000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('1h');
    });

    it('should detect 4h timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(15400000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('4h');
    });

    it('should detect 1d timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(87400000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('1d');
    });

    it('should detect 1w timeframe', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(605000000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('1w');
    });

    it('should return unknown for larger intervals', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(10000000000, 100, 1000),
      ];
      expect(detectTimeframe(klines)).toBe('unknown');
    });
  });

  describe('simplifyKline', () => {
    it('should round prices to 2 decimal places', () => {
      const kline: Kline = {
        openTime: 1000000,
        open: '100.123456',
        high: '105.987654',
        low: '95.456789',
        close: '102.345678',
        volume: '1234.567',
        closeTime: 1060000,
        quoteVolume: '123456',
        trades: 1000,
        takerBuyBaseVolume: '617',
        takerBuyQuoteVolume: '61728',
      };

      const result = simplifyKline(kline);

      expect(result.openTime).toBe(1000000);
      expect(result.open).toBe(100.12);
      expect(result.high).toBe(105.99);
      expect(result.low).toBe(95.46);
      expect(result.close).toBe(102.35);
      expect(result.volume).toBe(1235);
    });

    it('should preserve exact values when already rounded', () => {
      const kline: Kline = {
        openTime: 1000000,
        open: '100',
        high: '105',
        low: '95',
        close: '102',
        volume: '1000',
        closeTime: 1060000,
        quoteVolume: '102000',
        trades: 1000,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '51000',
      };

      const result = simplifyKline(kline);

      expect(result).toEqual({
        openTime: 1000000,
        open: 100,
        high: 105,
        low: 95,
        close: 102,
        volume: 1000,
      });
    });
  });

  describe('optimizeKlines', () => {
    it('should return empty result for empty array', () => {
      const result = optimizeKlines([]);

      expect(result.detailed).toEqual([]);
      expect(result.simplified).toEqual([]);
      expect(result.openTimeInfo).toEqual({
        first: 0,
        last: 0,
        total: 0,
        timeframe: 'unknown',
      });
    });

    it('should keep all klines detailed if less than detailedCount', () => {
      const klines = [
        createKline(1000000, 100, 1000),
        createKline(1060000, 101, 1100),
        createKline(1120000, 102, 1200),
      ];

      const result = optimizeKlines(klines, 32);

      expect(result.detailed).toHaveLength(3);
      expect(result.simplified).toEqual([]);
      expect(result.openTimeInfo.total).toBe(3);
      expect(result.openTimeInfo.timeframe).toBe('1m');
    });

    it('should split klines into detailed and simplified', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 100; i++) {
        klines.push(createKline(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeKlines(klines, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified).toHaveLength(68);
      expect(result.openTimeInfo.total).toBe(100);
      expect(result.openTimeInfo.first).toBe(1000000);
      expect(result.openTimeInfo.last).toBe(1000000 + 99 * 60000);
    });

    it('should downsample when simplified count exceeds MAX_SIMPLIFIED_KLINES', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 2000; i++) {
        klines.push(createKline(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeKlines(klines, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified.length).toBeLessThanOrEqual(1000);
      expect(result.openTimeInfo.total).toBe(2000);
    });

    it('should use custom detailedCount parameter', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 100; i++) {
        klines.push(createKline(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeKlines(klines, 50);

      expect(result.detailed).toHaveLength(50);
      expect(result.simplified).toHaveLength(50);
    });

    it('should correctly simplify klines with rounding', () => {
      const klines: Kline[] = [
        {
          openTime: 1000000,
          open: '100.123',
          high: '105.987',
          low: '95.456',
          close: '102.345',
          volume: '1234.567',
          closeTime: 1060000,
          quoteVolume: '126229.851',
          trades: 1000,
          takerBuyBaseVolume: '617.2835',
          takerBuyQuoteVolume: '63114.9255',
        },
        {
          openTime: 1060000,
          open: '102.345',
          high: '108.123',
          low: '98.789',
          close: '105.678',
          volume: '2345.678',
          closeTime: 1120000,
          quoteVolume: '247866.358',
          trades: 1100,
          takerBuyBaseVolume: '1172.839',
          takerBuyQuoteVolume: '123933.179',
        },
      ];

      const result = optimizeKlines(klines, 1);

      expect(result.simplified).toHaveLength(1);
      expect(result.simplified[0]).toEqual({
        openTime: 1000000,
        open: 100.12,
        high: 105.99,
        low: 95.46,
        close: 102.35,
        volume: 1235,
      });
    });

    it('should handle edge case with exactly MAX_SIMPLIFIED_KLINES remaining', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 1032; i++) {
        klines.push(createKline(1000000 + i * 60000, 100 + i, 1000 + i));
      }

      const result = optimizeKlines(klines, 32);

      expect(result.detailed).toHaveLength(32);
      expect(result.simplified).toHaveLength(1000);
    });
  });
});
