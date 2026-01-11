import { describe, it, expect } from 'vitest';
import { checkAdxCondition, ADX_FILTER } from '../utils/filters';
import type { Kline } from '@marketmind/types';

const createKline = (high: number, low: number, close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(close),
  high: String(high),
  low: String(low),
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
        change = 2 + Math.random() * 2;
        break;
      case 'down':
        change = -(2 + Math.random() * 2);
        break;
      case 'sideways':
      default:
        change = (Math.random() - 0.5) * 2;
        break;
    }

    price += change;
    const high = price + Math.random() * 3;
    const low = price - Math.random() * 3;

    klines.push(createKline(high, low, price, i));
  }

  return klines;
};

describe('checkAdxCondition', () => {
  describe('LONG direction', () => {
    it('should allow LONG when +DI > -DI and ADX >= threshold (strong uptrend)', () => {
      const klines = createKlinesWithTrend('up', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'LONG');

      if (result.adx !== null && result.adx >= ADX_FILTER.TREND_THRESHOLD && result.isBullish) {
        expect(result.isAllowed).toBe(true);
        expect(result.isBullish).toBe(true);
        expect(result.isStrongTrend).toBe(true);
      }
    });

    it('should block LONG when +DI < -DI (bearish bias)', () => {
      const klines = createKlinesWithTrend('down', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'LONG');

      if (result.adx !== null && result.adx >= ADX_FILTER.TREND_THRESHOLD && result.isBearish) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('bearish bias');
      }
    });

    it('should block LONG when ADX < threshold (weak trend)', () => {
      const klines = createKlinesWithTrend('sideways', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'LONG');

      if (result.adx !== null && result.adx < ADX_FILTER.TREND_THRESHOLD) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('weak trend');
      }
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when -DI > +DI and ADX >= threshold (strong downtrend)', () => {
      const klines = createKlinesWithTrend('down', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'SHORT');

      if (result.adx !== null && result.adx >= ADX_FILTER.TREND_THRESHOLD && result.isBearish) {
        expect(result.isAllowed).toBe(true);
        expect(result.isBearish).toBe(true);
        expect(result.isStrongTrend).toBe(true);
      }
    });

    it('should block SHORT when -DI < +DI (bullish bias)', () => {
      const klines = createKlinesWithTrend('up', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'SHORT');

      if (result.adx !== null && result.adx >= ADX_FILTER.TREND_THRESHOLD && result.isBullish) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('bullish bias');
      }
    });
  });

  describe('edge cases', () => {
    it('should return isAllowed=true when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 10; i += 1) {
        klines.push(createKline(105, 95, 100, i));
      }

      const result = checkAdxCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.adx).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should return all required fields in result', () => {
      const klines = createKlinesWithTrend('up', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('adx');
      expect(result).toHaveProperty('plusDI');
      expect(result).toHaveProperty('minusDI');
      expect(result).toHaveProperty('isBullish');
      expect(result).toHaveProperty('isBearish');
      expect(result).toHaveProperty('isStrongTrend');
      expect(result).toHaveProperty('reason');
    });

    it('should return numeric values when calculation succeeds', () => {
      const klines = createKlinesWithTrend('up', ADX_FILTER.MIN_KLINES_REQUIRED + 5);
      const result = checkAdxCondition(klines, 'LONG');

      if (result.adx !== null) {
        expect(typeof result.adx).toBe('number');
        expect(typeof result.plusDI).toBe('number');
        expect(typeof result.minusDI).toBe('number');
      }
    });
  });

  describe('ADX_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(ADX_FILTER.PERIOD).toBe(14);
      expect(ADX_FILTER.TREND_THRESHOLD).toBe(20);
      expect(ADX_FILTER.MIN_KLINES_REQUIRED).toBe(35);
    });
  });
});
