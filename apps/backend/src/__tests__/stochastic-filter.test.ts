import { describe, it, expect } from 'vitest';
import {
  checkStochasticCondition,
  STOCHASTIC_FILTER,
} from '../utils/stochastic-filter';
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

const createKlinesWithStochasticPattern = (pattern: 'oversold' | 'overbought' | 'oversold_then_overbought' | 'overbought_then_oversold' | 'neutral'): Kline[] => {
  const klines: Kline[] = [];
  const basePrice = 100;

  for (let i = 0; i < 30; i += 1) {
    let high: number;
    let low: number;
    let close: number;

    switch (pattern) {
      case 'oversold':
        high = basePrice + 2;
        low = basePrice - 20;
        close = basePrice - 18;
        break;
      case 'overbought':
        high = basePrice + 20;
        low = basePrice - 2;
        close = basePrice + 18;
        break;
      case 'oversold_then_overbought':
        if (i < 15) {
          high = basePrice + 2;
          low = basePrice - 20;
          close = basePrice - 18;
        } else {
          high = basePrice + 20;
          low = basePrice - 2;
          close = basePrice + 18;
        }
        break;
      case 'overbought_then_oversold':
        if (i < 15) {
          high = basePrice + 20;
          low = basePrice - 2;
          close = basePrice + 18;
        } else {
          high = basePrice + 2;
          low = basePrice - 20;
          close = basePrice - 18;
        }
        break;
      case 'neutral':
      default:
        high = basePrice + 5;
        low = basePrice - 5;
        close = basePrice;
        break;
    }

    klines.push(createKline(high, low, close, i));
  }

  return klines;
};

describe('checkStochasticCondition', () => {
  describe('LONG direction', () => {
    it('should allow LONG when K was oversold and has not crossed to overbought', () => {
      const klines = createKlinesWithStochasticPattern('oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.hadOversold).toBe(true);
      expect(result.hadOverbought).toBe(false);
      expect(result.reason).toContain('oversold');
      expect(result.reason).toContain('overbought');
    });

    it('should block LONG when K crossed to overbought after being oversold', () => {
      const klines = createKlinesWithStochasticPattern('oversold_then_overbought');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.hadOversold).toBe(true);
      expect(result.hadOverbought).toBe(true);
      expect(result.overboughtMoreRecent).toBe(true);
      expect(result.reason).toContain('crossed to overbought');
    });

    it('should block LONG when K never reached oversold zone', () => {
      const klines = createKlinesWithStochasticPattern('neutral');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(false);
      expect(result.hadOversold).toBe(false);
      expect(result.reason).toContain('never reached oversold');
    });

    it('should allow LONG when K was oversold more recently than overbought', () => {
      const klines = createKlinesWithStochasticPattern('overbought_then_oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.hadOversold).toBe(true);
      expect(result.hadOverbought).toBe(true);
      expect(result.oversoldMoreRecent).toBe(true);
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when K was overbought and has not crossed to oversold', () => {
      const klines = createKlinesWithStochasticPattern('overbought');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.hadOverbought).toBe(true);
      expect(result.hadOversold).toBe(false);
      expect(result.reason).toContain('overbought');
      expect(result.reason).toContain('oversold');
    });

    it('should block SHORT when K crossed to oversold after being overbought', () => {
      const klines = createKlinesWithStochasticPattern('overbought_then_oversold');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(false);
      expect(result.hadOverbought).toBe(true);
      expect(result.hadOversold).toBe(true);
      expect(result.oversoldMoreRecent).toBe(true);
      expect(result.reason).toContain('crossed to oversold');
    });

    it('should block SHORT when K never reached overbought zone', () => {
      const klines = createKlinesWithStochasticPattern('neutral');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(false);
      expect(result.hadOverbought).toBe(false);
      expect(result.reason).toContain('never reached overbought');
    });

    it('should allow SHORT when K was overbought more recently than oversold', () => {
      const klines = createKlinesWithStochasticPattern('oversold_then_overbought');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.isAllowed).toBe(true);
      expect(result.hadOverbought).toBe(true);
      expect(result.hadOversold).toBe(true);
      expect(result.overboughtMoreRecent).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should return isAllowed=true when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 5; i += 1) {
        klines.push(createKline(105, 95, 100, i));
      }

      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.currentK).toBeNull();
      expect(result.reason).toContain('Insufficient');
    });

    it('should return currentK value when calculation succeeds', () => {
      const klines = createKlinesWithStochasticPattern('oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(typeof result.currentK).toBe('number');
    });
  });

  describe('STOCHASTIC_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(STOCHASTIC_FILTER.PERIOD).toBe(14);
      expect(STOCHASTIC_FILTER.SMOOTHING).toBe(3);
      expect(STOCHASTIC_FILTER.OVERSOLD_THRESHOLD).toBe(20);
      expect(STOCHASTIC_FILTER.OVERBOUGHT_THRESHOLD).toBe(80);
      expect(STOCHASTIC_FILTER.LOOKBACK_BUFFER).toBe(10);
    });
  });

  describe('result structure', () => {
    it('should return all required fields in StochasticFilterResult', () => {
      const klines = createKlinesWithStochasticPattern('oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('currentK');
      expect(result).toHaveProperty('hadOversold');
      expect(result).toHaveProperty('hadOverbought');
      expect(result).toHaveProperty('oversoldMoreRecent');
      expect(result).toHaveProperty('overboughtMoreRecent');
      expect(result).toHaveProperty('reason');
    });
  });
});
