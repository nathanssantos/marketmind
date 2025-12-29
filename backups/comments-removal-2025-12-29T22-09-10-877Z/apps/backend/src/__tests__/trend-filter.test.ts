import { describe, it, expect } from 'vitest';
import { checkTrendCondition, TREND_FILTER } from '../utils/trend-filter';
import type { Kline } from '@marketmind/types';

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(close * 1.01),
  low: String(close * 0.99),
  close: String(close),
  volume: '1000',
  closeTime: Date.now() + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createKlinesWithTrend = (direction: 'up' | 'down' | 'sideways', count: number): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < count; i += 1) {
    let change: number;
    switch (direction) {
      case 'up':
        change = 0.5;
        break;
      case 'down':
        change = -0.5;
        break;
      case 'sideways':
      default:
        change = (Math.random() - 0.5) * 0.1;
        break;
    }

    price += change;
    klines.push(createKline(price, i));
  }

  return klines;
};

describe('checkTrendCondition', () => {
  describe('LONG direction', () => {
    it('should allow LONG when EMA100 is above EMA200 (bullish trend)', () => {
      const klines = createKlinesWithTrend('up', TREND_FILTER.MIN_KLINES_REQUIRED + 10);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isBullish).toBe(true);
      expect(result.isBearish).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('LONG allowed');
    });

    it('should block LONG when EMA100 is below EMA200 (bearish trend)', () => {
      const klines = createKlinesWithTrend('down', TREND_FILTER.MIN_KLINES_REQUIRED + 10);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isBullish).toBe(false);
      expect(result.isBearish).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('bearish trend');
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when EMA100 is below EMA200 (bearish trend)', () => {
      const klines = createKlinesWithTrend('down', TREND_FILTER.MIN_KLINES_REQUIRED + 10);
      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isBullish).toBe(false);
      expect(result.isBearish).toBe(true);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('SHORT allowed');
    });

    it('should block SHORT when EMA100 is above EMA200 (bullish trend)', () => {
      const klines = createKlinesWithTrend('up', TREND_FILTER.MIN_KLINES_REQUIRED + 10);
      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isBullish).toBe(true);
      expect(result.isBearish).toBe(false);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('bullish trend');
    });
  });

  describe('edge cases', () => {
    it('should block when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 50; i += 1) {
        klines.push(createKline(100, i));
      }

      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.ema100).toBeNull();
      expect(result.ema200).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should return all required fields in result', () => {
      const klines = createKlinesWithTrend('up', TREND_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('ema100');
      expect(result).toHaveProperty('ema200');
      expect(result).toHaveProperty('isBullish');
      expect(result).toHaveProperty('isBearish');
      expect(result).toHaveProperty('reason');
    });

    it('should return numeric values when calculation succeeds', () => {
      const klines = createKlinesWithTrend('up', TREND_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkTrendCondition(klines, 'LONG');

      expect(typeof result.ema100).toBe('number');
      expect(typeof result.ema200).toBe('number');
    });
  });

  describe('TREND_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(TREND_FILTER.FAST_PERIOD).toBe(100);
      expect(TREND_FILTER.SLOW_PERIOD).toBe(200);
      expect(TREND_FILTER.MIN_KLINES_REQUIRED).toBe(250);
    });
  });

  describe('real-world scenarios', () => {
    it('should correctly identify uptrend after sustained price increase', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 260; i += 1) {
        const price = 100 + i * 0.5;
        klines.push(createKline(price, i));
      }

      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.isBullish).toBe(true);
      if (result.ema100 && result.ema200) {
        expect(result.ema100).toBeGreaterThan(result.ema200);
      }
    });

    it('should correctly identify downtrend after sustained price decrease', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 260; i += 1) {
        const price = 200 - i * 0.5;
        klines.push(createKline(Math.max(price, 10), i));
      }

      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.isBearish).toBe(true);
      if (result.ema100 && result.ema200) {
        expect(result.ema100).toBeLessThan(result.ema200);
      }
    });

    it('should use confirmation candle index for EMA comparison', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 260; i += 1) {
        klines.push(createKline(100 + i * 0.5, i));
      }

      const result = checkTrendCondition(klines, 'LONG');

      expect(result.ema100).not.toBeNull();
      expect(result.ema200).not.toBeNull();
      expect(result.isAllowed).toBe(true);
    });
  });
});
