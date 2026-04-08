import { describe, it, expect } from 'vitest';
import { checkMtfCondition, getHigherTimeframe, MTF_FILTER } from '../utils/filters';
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

const createBullishKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 100 + i * 0.5;
    klines.push(createKline(price, i));
  }
  return klines;
};

const createBearishKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 300 - i * 0.5;
    klines.push(createKline(Math.max(price, 10), i));
  }
  return klines;
};

describe('MTF Filter', () => {
  describe('getHigherTimeframe', () => {
    it('should return 4h for 1h timeframe', () => {
      expect(getHigherTimeframe('1h')).toBe('4h');
    });

    it('should return 1d for 4h timeframe', () => {
      expect(getHigherTimeframe('4h')).toBe('1d');
    });

    it('should return 1w for 1d timeframe', () => {
      expect(getHigherTimeframe('1d')).toBe('1w');
    });

    it('should return null for unknown timeframe', () => {
      expect(getHigherTimeframe('unknown')).toBeNull();
    });
  });

  describe('checkMtfCondition', () => {
    describe('LONG direction', () => {
      it('should allow LONG when HTF is bullish (golden cross)', async () => {
        const klines = createBullishKlines(300);
        const result = await checkMtfCondition(klines, 'LONG', '4h');

        expect(result.isAllowed).toBe(true);
        expect(result.htfTrend).toBe('BULLISH');
        expect(result.goldenCross).toBe(true);
        expect(result.reason).toContain('LONG allowed');
      });

      it('should block LONG when HTF is bearish (death cross)', async () => {
        const klines = createBearishKlines(300);
        const result = await checkMtfCondition(klines, 'LONG', '4h');

        expect(result.isAllowed).toBe(false);
        expect(result.htfTrend).toBe('BEARISH');
        expect(result.deathCross).toBe(true);
        expect(result.reason).toContain('LONG blocked');
      });
    });

    describe('SHORT direction', () => {
      it('should allow SHORT when HTF is bearish', async () => {
        const klines = createBearishKlines(300);
        const result = await checkMtfCondition(klines, 'SHORT', '4h');

        expect(result.isAllowed).toBe(true);
        expect(result.htfTrend).toBe('BEARISH');
        expect(result.reason).toContain('SHORT allowed');
      });

      it('should block SHORT when HTF is bullish', async () => {
        const klines = createBullishKlines(300);
        const result = await checkMtfCondition(klines, 'SHORT', '4h');

        expect(result.isAllowed).toBe(false);
        expect(result.htfTrend).toBe('BULLISH');
        expect(result.reason).toContain('SHORT blocked');
      });
    });

    describe('edge cases', () => {
      it('should soft pass when insufficient klines for EMA200', async () => {
        const klines = createBullishKlines(100);
        const result = await checkMtfCondition(klines, 'LONG', '4h');

        expect(result.isAllowed).toBe(true);
        expect(result.htfTrend).toBe('NEUTRAL');
        expect(result.reason).toContain('soft pass');
      });

      it('should return all required fields', async () => {
        const klines = createBullishKlines(300);
        const result = await checkMtfCondition(klines, 'LONG', '4h');

        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('htfTrend');
        expect(result).toHaveProperty('htfInterval');
        expect(result).toHaveProperty('ema50');
        expect(result).toHaveProperty('ema200');
        expect(result).toHaveProperty('price');
        expect(result).toHaveProperty('goldenCross');
        expect(result).toHaveProperty('deathCross');
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('MTF_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(MTF_FILTER.EMA_SHORT_PERIOD).toBe(50);
      expect(MTF_FILTER.EMA_LONG_PERIOD).toBe(200);
      expect(MTF_FILTER.MIN_KLINES_FOR_EMA200).toBe(250);
    });
  });
});
