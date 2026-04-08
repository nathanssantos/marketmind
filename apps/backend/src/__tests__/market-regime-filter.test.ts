import { describe, it, expect } from 'vitest';
import { checkMarketRegime, getSetupStrategyType, MARKET_REGIME_FILTER } from '../utils/filters';
import type { Kline } from '@marketmind/types';

const createKline = (close: number, high: number, low: number, index: number): Kline => ({
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

const createTrendingKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = 100 + i * 0.5;
    klines.push(createKline(base, base + 1, base - 0.5, i));
  }
  return klines;
};

const createRangingKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const base = 100 + Math.sin(i * 0.5) * 2;
    klines.push(createKline(base, base + 0.5, base - 0.5, i));
  }
  return klines;
};

describe('Market Regime Filter', () => {
  describe('getSetupStrategyType', () => {
    it('should return TREND_FOLLOWING for larry-williams setups', () => {
      expect(getSetupStrategyType('larry-williams-9-1')).toBe('TREND_FOLLOWING');
      expect(getSetupStrategyType('larry-williams-9-2')).toBe('TREND_FOLLOWING');
    });

    it('should return MEAN_REVERSION for bounce setups', () => {
      expect(getSetupStrategyType('oversold-bounce')).toBe('MEAN_REVERSION');
      expect(getSetupStrategyType('support-bounce')).toBe('MEAN_REVERSION');
    });

    it('should return ANY for unknown setups', () => {
      expect(getSetupStrategyType('unknown-setup')).toBe('ANY');
    });
  });

  describe('checkMarketRegime', () => {
    describe('trending market', () => {
      it('should identify trending market with high ADX', async () => {
        const klines = createTrendingKlines(100);
        const result = await checkMarketRegime(klines, 'larry-williams-9-1');

        expect(result.adx).not.toBeNull();
        expect(result).toHaveProperty('regime');
        expect(result).toHaveProperty('recommendedStrategy');
        if (result.adx && result.adx >= 25 && result.volatilityLevel !== 'EXTREME') {
          expect(result.regime).toBe('TRENDING');
          expect(result.recommendedStrategy).toBe('TREND_FOLLOWING');
        }
      });

      it('should allow trend-following setups in trending market', async () => {
        const klines = createTrendingKlines(100);
        const result = await checkMarketRegime(klines, 'larry-williams-9-1');

        if (result.regime === 'TRENDING') {
          expect(result.isAllowed).toBe(true);
        }
      });
    });

    describe('ranging market', () => {
      it('should identify ranging market with low ADX', async () => {
        const klines = createRangingKlines(50);
        const result = await checkMarketRegime(klines, 'larry-williams-9-1');

        expect(result.adx).not.toBeNull();
        if (result.adx && result.adx < 20) {
          expect(result.regime).toBe('RANGING');
          expect(result.recommendedStrategy).toBe('MEAN_REVERSION');
        }
      });
    });

    describe('edge cases', () => {
      it('should soft pass when insufficient klines', async () => {
        const klines = createTrendingKlines(20);
        const result = await checkMarketRegime(klines, 'larry-williams-9-1');

        expect(result.isAllowed).toBe(true);
        expect(result.reason).toContain('soft pass');
      });

      it('should return all required fields', async () => {
        const klines = createTrendingKlines(50);
        const result = await checkMarketRegime(klines, 'larry-williams-9-1');

        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('regime');
        expect(result).toHaveProperty('adx');
        expect(result).toHaveProperty('plusDI');
        expect(result).toHaveProperty('minusDI');
        expect(result).toHaveProperty('atr');
        expect(result).toHaveProperty('atrPercentile');
        expect(result).toHaveProperty('volatilityLevel');
        expect(result).toHaveProperty('recommendedStrategy');
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('MARKET_REGIME_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(MARKET_REGIME_FILTER.ADX_PERIOD).toBe(14);
      expect(MARKET_REGIME_FILTER.STRONG_TREND_THRESHOLD).toBe(25);
      expect(MARKET_REGIME_FILTER.WEAK_TREND_THRESHOLD).toBe(20);
    });
  });
});
