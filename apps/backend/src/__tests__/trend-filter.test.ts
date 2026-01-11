import { describe, it, expect } from 'vitest';
import { checkTrendCondition, TREND_FILTER } from '../utils/filters';
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

const SAMPLE_KLINE_COUNT = 50;

const createKlinesWithPriceAboveEMA = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 100 + i * 0.5;
    klines.push(createKline(price, i));
  }
  return klines;
};

const createKlinesWithPriceBelowEMA = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 200 - i * 0.5;
    klines.push(createKline(Math.max(price, 10), i));
  }
  return klines;
};

describe('checkTrendCondition', () => {
  describe('LONG direction', () => {
    it('should allow LONG when price is above EMA21 (bullish trend)', () => {
      const klines = createKlinesWithPriceAboveEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isBullish).toBe(true);
      expect(result.isBearish).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('LONG allowed');
    });

    it('should block LONG when price is below EMA21 (bearish trend)', () => {
      const klines = createKlinesWithPriceBelowEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isBullish).toBe(false);
      expect(result.isBearish).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('bearish trend');
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when price is below EMA21 (bearish trend)', () => {
      const klines = createKlinesWithPriceBelowEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isBullish).toBe(false);
      expect(result.isBearish).toBe(true);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('SHORT allowed');
    });

    it('should block SHORT when price is above EMA21 (bullish trend)', () => {
      const klines = createKlinesWithPriceAboveEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isBullish).toBe(true);
      expect(result.isBearish).toBe(false);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('bullish trend');
    });
  });

  describe('edge cases', () => {
    it('should block when only 1 kline', () => {
      const klines = [createKline(100, 0)];
      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.ema21).toBeNull();
      expect(result.price).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should return all required fields in result', () => {
      const klines = createKlinesWithPriceAboveEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('ema21');
      expect(result).toHaveProperty('price');
      expect(result).toHaveProperty('isBullish');
      expect(result).toHaveProperty('isBearish');
      expect(result).toHaveProperty('reason');
    });

    it('should return numeric values when calculation succeeds', () => {
      const klines = createKlinesWithPriceAboveEMA(SAMPLE_KLINE_COUNT);
      const result = checkTrendCondition(klines, 'LONG');

      expect(typeof result.ema21).toBe('number');
      expect(typeof result.price).toBe('number');
    });
  });

  describe('TREND_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(TREND_FILTER.EMA_PERIOD).toBe(21);
    });
  });

  describe('real-world scenarios', () => {
    it('should correctly identify uptrend when price is above EMA21', () => {
      const klines: Kline[] = [];
      const count = SAMPLE_KLINE_COUNT;
      for (let i = 0; i < count; i += 1) {
        const price = 100 + i * 0.5;
        klines.push(createKline(price, i));
      }

      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.isBullish).toBe(true);
      if (result.ema21 && result.price) {
        expect(result.price).toBeGreaterThan(result.ema21);
      }
    });

    it('should correctly identify downtrend when price is below EMA21', () => {
      const klines: Kline[] = [];
      const count = SAMPLE_KLINE_COUNT;
      for (let i = 0; i < count; i += 1) {
        const price = 200 - i * 0.5;
        klines.push(createKline(Math.max(price, 10), i));
      }

      const result = checkTrendCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.isBearish).toBe(true);
      if (result.ema21 && result.price) {
        expect(result.price).toBeLessThan(result.ema21);
      }
    });

    it('should use confirmation candle for price comparison', () => {
      const klines: Kline[] = [];
      const count = SAMPLE_KLINE_COUNT;
      for (let i = 0; i < count; i += 1) {
        klines.push(createKline(100 + i * 0.5, i));
      }

      const result = checkTrendCondition(klines, 'LONG');
      const confirmationIndex = klines.length - 2;
      const expectedPrice = parseFloat(String(klines[confirmationIndex]?.close));

      expect(result.price).toBe(expectedPrice);
      expect(result.ema21).not.toBeNull();
      expect(result.isAllowed).toBe(true);
    });

    it('should work with large kline datasets (40k+)', () => {
      const klines: Kline[] = [];
      const count = 1000;
      for (let i = 0; i < count; i += 1) {
        const price = 100 + i * 0.1;
        klines.push(createKline(price, i));
      }

      const result = checkTrendCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.isBullish).toBe(true);
      expect(result.ema21).not.toBeNull();
      expect(result.price).not.toBeNull();
    });
  });
});
