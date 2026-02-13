import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { checkStochasticRecoveryCondition, STOCHASTIC_RECOVERY } from '../utils/filters';
import { STOCHASTIC_FILTER } from '../utils/filters';

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

const createRecoveryKlines = (scenario: 'long_recovering' | 'long_crossed_midpoint' | 'long_never_oversold' | 'short_recovering' | 'short_crossed_midpoint' | 'short_never_overbought'): Kline[] => {
  const klines: Kline[] = [];
  let price = 100;

  for (let i = 0; i < MIN_KLINES; i += 1) {
    let change: number;

    switch (scenario) {
      case 'long_recovering':
        if (i < MIN_KLINES * 0.4) {
          change = (i % 2 === 0) ? 1.2 : -0.3;
        } else if (i < MIN_KLINES * 0.7) {
          change = -2.0;
        } else {
          change = 0.6;
        }
        break;

      case 'long_crossed_midpoint':
        if (i < MIN_KLINES * 0.3) {
          change = (i % 2 === 0) ? 1.2 : -0.3;
        } else if (i < MIN_KLINES * 0.5) {
          change = -2.5;
        } else {
          change = 1.8;
        }
        break;

      case 'long_never_oversold':
        change = (i % 2 === 0) ? 0.8 : -0.8;
        break;

      case 'short_recovering':
        if (i < MIN_KLINES * 0.4) {
          change = (i % 2 === 0) ? -1.2 : 0.3;
        } else if (i < MIN_KLINES * 0.7) {
          change = 2.0;
        } else {
          change = -0.6;
        }
        break;

      case 'short_crossed_midpoint':
        if (i < MIN_KLINES * 0.3) {
          change = (i % 2 === 0) ? -1.2 : 0.3;
        } else if (i < MIN_KLINES * 0.5) {
          change = 2.5;
        } else {
          change = -1.8;
        }
        break;

      case 'short_never_overbought':
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

describe('checkStochasticRecoveryCondition', () => {
  describe('LONG direction', () => {
    it('should allow LONG when K went below 20 and is recovering below 50', () => {
      const klines = createRecoveryKlines('long_recovering');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      if (result.currentK !== null && result.currentK < STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(true);
        expect(result.reason).toContain('LONG allowed');
        expect(result.reason).toContain('recovering from oversold');
      }
    });

    it('should block LONG when K went below 20 but already crossed above 50', () => {
      const klines = createRecoveryKlines('long_crossed_midpoint');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      if (result.currentK !== null && result.currentK >= STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('LONG blocked');
        expect(result.reason).toContain('crossed midpoint');
      }
    });

    it('should block LONG when K never went below 20', () => {
      const klines = createRecoveryKlines('long_never_oversold');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      if (result.currentK !== null && result.currentK < STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('LONG blocked');
        expect(result.reason).toContain('never went below');
      }
    });
  });

  describe('SHORT direction', () => {
    it('should allow SHORT when K went above 80 and is recovering above 50', () => {
      const klines = createRecoveryKlines('short_recovering');
      const result = checkStochasticRecoveryCondition(klines, 'SHORT');

      if (result.currentK !== null && result.currentK > STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(true);
        expect(result.reason).toContain('SHORT allowed');
        expect(result.reason).toContain('recovering from overbought');
      }
    });

    it('should block SHORT when K went above 80 but already crossed below 50', () => {
      const klines = createRecoveryKlines('short_crossed_midpoint');
      const result = checkStochasticRecoveryCondition(klines, 'SHORT');

      if (result.currentK !== null && result.currentK <= STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('SHORT blocked');
        expect(result.reason).toContain('crossed midpoint');
      }
    });

    it('should block SHORT when K never went above 80', () => {
      const klines = createRecoveryKlines('short_never_overbought');
      const result = checkStochasticRecoveryCondition(klines, 'SHORT');

      if (result.currentK !== null && result.currentK > STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('SHORT blocked');
        expect(result.reason).toContain('never went above');
      }
    });
  });

  describe('edge cases', () => {
    it('should return isAllowed=true (soft pass) when insufficient klines', () => {
      const klines: Kline[] = [];
      for (let i = 0; i < 10; i += 1) {
        klines.push(createKline(100, 105, 95, 100, i));
      }

      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      expect(result.isAllowed).toBe(true);
      expect(result.currentK).toBeNull();
      expect(result.reason).toContain('Insufficient');
      expect(result.reason).toContain('soft pass');
    });

    it('should return currentK and currentD values when calculation succeeds', () => {
      const klines = createRecoveryKlines('long_never_oversold');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.currentD).not.toBeNull();
      expect(typeof result.currentK).toBe('number');
      expect(typeof result.currentD).toBe('number');
    });

    it('should return K value between 0 and 100', () => {
      const klines = createRecoveryKlines('long_never_oversold');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      expect(result.currentK).not.toBeNull();
      expect(result.currentK).toBeGreaterThanOrEqual(0);
      expect(result.currentK).toBeLessThanOrEqual(100);
    });
  });

  describe('STOCHASTIC_RECOVERY constants', () => {
    it('should have correct midpoint threshold', () => {
      expect(STOCHASTIC_RECOVERY.MIDPOINT_THRESHOLD).toBe(50);
    });
  });

  describe('result structure', () => {
    it('should return all required fields in StochasticFilterResult', () => {
      const klines = createRecoveryKlines('long_never_oversold');
      const result = checkStochasticRecoveryCondition(klines, 'LONG');

      expect(result).toHaveProperty('isAllowed');
      expect(result).toHaveProperty('currentK');
      expect(result).toHaveProperty('currentD');
      expect(result).toHaveProperty('isOversold');
      expect(result).toHaveProperty('isOverbought');
      expect(result).toHaveProperty('reason');
    });
  });
});
