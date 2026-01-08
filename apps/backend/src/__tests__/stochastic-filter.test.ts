import { describe, it, expect } from 'vitest';
import {
  checkStochasticCondition,
  STOCHASTIC_FILTER,
} from '../utils/stochastic-filter';
import type { Kline } from '@marketmind/types';

const createKline = (open: number, high: number, low: number, close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: String(open),
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

const MIN_KLINES = STOCHASTIC_FILTER.K_PERIOD + STOCHASTIC_FILTER.K_SMOOTHING + STOCHASTIC_FILTER.D_PERIOD + 20;

const createKlinesForSlowStoch = (targetK: 'oversold' | 'overbought' | 'neutral'): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    let change: number;

    switch (targetK) {
      case 'oversold':
        if (i < MIN_KLINES / 2) {
          change = (i % 2 === 0) ? 1.2 : -0.3;
        } else {
          change = -1.8;
        }
        break;
      case 'overbought':
        if (i < MIN_KLINES / 2) {
          change = (i % 2 === 0) ? -1.2 : 0.3;
        } else {
          change = 1.8;
        }
        break;
      case 'neutral':
      default:
        change = (i % 2 === 0) ? 0.8 : -0.8;
        break;
    }

    const open = price;
    price = Math.max(price + change, 10);
    const close = price;
    const high = Math.max(open, close) + 0.3;
    const low = Math.min(open, close) - 0.3;

    klines.push(createKline(open, high, low, close, i));
  }

  return klines;
};

describe('checkStochasticCondition (Slow Stochastic)', () => {
  describe('LONG direction - blocked when overbought', () => {
    it('should allow LONG when K is oversold (not overbought)', () => {
      const klines = createKlinesForSlowStoch('oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.isOversold).toBe(true);
      expect(result.isOverbought).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('LONG allowed');
      expect(result.reason).toContain('not overbought');
    });

    it('should allow LONG when K is neutral (not overbought)', () => {
      const klines = createKlinesForSlowStoch('neutral');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.isOverbought).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('LONG allowed');
      expect(result.reason).toContain('not overbought');
    });

    it('should block LONG when K is overbought', () => {
      const klines = createKlinesForSlowStoch('overbought');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.isOverbought).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('LONG blocked');
      expect(result.reason).toContain('overbought');
    });
  });

  describe('SHORT direction - blocked when oversold', () => {
    it('should allow SHORT when K is overbought (not oversold)', () => {
      const klines = createKlinesForSlowStoch('overbought');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.currentK).not.toBeNull();
      expect(result.isOverbought).toBe(true);
      expect(result.isOversold).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('SHORT allowed');
      expect(result.reason).toContain('not oversold');
    });

    it('should allow SHORT when K is neutral (not oversold)', () => {
      const klines = createKlinesForSlowStoch('neutral');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.currentK).not.toBeNull();
      expect(result.isOversold).toBe(false);
      expect(result.isAllowed).toBe(true);
      expect(result.reason).toContain('SHORT allowed');
      expect(result.reason).toContain('not oversold');
    });

    it('should block SHORT when K is oversold', () => {
      const klines = createKlinesForSlowStoch('oversold');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.currentK).not.toBeNull();
      expect(result.isOversold).toBe(true);
      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('SHORT blocked');
      expect(result.reason).toContain('oversold');
    });
  });

  describe('edge cases', () => {
    it('should return isAllowed=true (soft pass) when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 10; i += 1) {
        klines.push(createKline(100, 105, 95, 100, i));
      }

      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.currentK).toBeNull();
      expect(result.reason).toContain('Insufficient');
      expect(result.reason).toContain('soft pass');
    });

    it('should return currentK and currentD values when calculation succeeds', () => {
      const klines = createKlinesForSlowStoch('neutral');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.currentD).not.toBeNull();
      expect(typeof result.currentK).toBe('number');
      expect(typeof result.currentD).toBe('number');
    });

    it('should return K value between 0 and 100', () => {
      const klines = createKlinesForSlowStoch('neutral');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.currentK).toBeGreaterThanOrEqual(0);
      expect(result.currentK).toBeLessThanOrEqual(100);
    });
  });

  describe('STOCHASTIC_FILTER constants', () => {
    it('should have correct default values for Slow Stochastic', () => {
      expect(STOCHASTIC_FILTER.K_PERIOD).toBe(14);
      expect(STOCHASTIC_FILTER.K_SMOOTHING).toBe(3);
      expect(STOCHASTIC_FILTER.D_PERIOD).toBe(3);
      expect(STOCHASTIC_FILTER.OVERSOLD_THRESHOLD).toBe(20);
      expect(STOCHASTIC_FILTER.OVERBOUGHT_THRESHOLD).toBe(80);
    });
  });

  describe('result structure', () => {
    it('should return all required fields in StochasticFilterResult', () => {
      const klines = createKlinesForSlowStoch('neutral');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('currentK');
      expect(result).toHaveProperty('currentD');
      expect(result).toHaveProperty('isOversold');
      expect(result).toHaveProperty('isOverbought');
      expect(result).toHaveProperty('reason');
    });

    it('should correctly identify oversold state (K < 20) after price drop', () => {
      const klines = createKlinesForSlowStoch('oversold');
      const result = checkStochasticCondition(klines, 'LONG');

      expect(result.isOversold).toBe(true);
      expect(result.currentK).not.toBeNull();
      expect(result.currentK!).toBeLessThan(STOCHASTIC_FILTER.OVERSOLD_THRESHOLD);
    });

    it('should correctly identify overbought state (K > 80) after price rise', () => {
      const klines = createKlinesForSlowStoch('overbought');
      const result = checkStochasticCondition(klines, 'SHORT');

      expect(result.isOverbought).toBe(true);
      expect(result.currentK).not.toBeNull();
      expect(result.currentK!).toBeGreaterThan(STOCHASTIC_FILTER.OVERBOUGHT_THRESHOLD);
    });
  });
});
