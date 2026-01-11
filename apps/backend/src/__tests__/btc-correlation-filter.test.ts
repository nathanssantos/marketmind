import { describe, it, expect } from 'vitest';
import { checkBtcCorrelation, isBtcPair, BTC_CORRELATION_FILTER } from '../utils/filters';
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

const createBullishBtcKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 40000 + i * 100;
    klines.push(createKline(price, i));
  }
  return klines;
};

const createBearishBtcKlines = (count: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i += 1) {
    const price = 50000 - i * 100;
    klines.push(createKline(Math.max(price, 30000), i));
  }
  return klines;
};

describe('BTC Correlation Filter', () => {
  describe('isBtcPair', () => {
    it('should return true for BTCUSDT', () => {
      expect(isBtcPair('BTCUSDT')).toBe(true);
    });

    it('should return true for BTCBUSD', () => {
      expect(isBtcPair('BTCBUSD')).toBe(true);
    });

    it('should return false for ETHUSDT', () => {
      expect(isBtcPair('ETHUSDT')).toBe(false);
    });

    it('should return false for SOLUSDT', () => {
      expect(isBtcPair('SOLUSDT')).toBe(false);
    });
  });

  describe('checkBtcCorrelation', () => {
    describe('BTC pairs', () => {
      it('should skip correlation check for BTCUSDT', () => {
        const btcKlines = createBearishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'LONG', 'BTCUSDT');

        expect(result.isAllowed).toBe(true);
        expect(result.isAltcoin).toBe(false);
        expect(result.reason).toContain('not applicable');
      });
    });

    describe('altcoins - LONG direction', () => {
      it('should allow LONG when BTC is bullish', () => {
        const btcKlines = createBullishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

        expect(result.isAllowed).toBe(true);
        expect(result.btcTrend).toBe('BULLISH');
        expect(result.isAltcoin).toBe(true);
      });

      it('should block LONG when BTC is bearish', () => {
        const btcKlines = createBearishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

        expect(result.isAllowed).toBe(false);
        expect(result.btcTrend).toBe('BEARISH');
        expect(result.reason).toContain('LONG blocked');
      });
    });

    describe('altcoins - SHORT direction', () => {
      it('should allow SHORT when BTC is bearish', () => {
        const btcKlines = createBearishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'SHORT', 'ETHUSDT');

        expect(result.isAllowed).toBe(true);
        expect(result.btcTrend).toBe('BEARISH');
      });

      it('should block SHORT when BTC is bullish', () => {
        const btcKlines = createBullishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'SHORT', 'ETHUSDT');

        expect(result.isAllowed).toBe(false);
        expect(result.btcTrend).toBe('BULLISH');
        expect(result.reason).toContain('SHORT blocked');
      });
    });

    describe('edge cases', () => {
      it('should soft pass when insufficient BTC klines', () => {
        const btcKlines = createBullishBtcKlines(10);
        const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

        expect(result.isAllowed).toBe(true);
        expect(result.reason).toContain('soft pass');
      });

      it('should return all required fields', () => {
        const btcKlines = createBullishBtcKlines(50);
        const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

        expect(result).toHaveProperty('isAllowed');
        expect(result).toHaveProperty('btcTrend');
        expect(result).toHaveProperty('btcEma21');
        expect(result).toHaveProperty('btcPrice');
        expect(result).toHaveProperty('btcMacdHistogram');
        expect(result).toHaveProperty('isAltcoin');
        expect(result).toHaveProperty('reason');
      });
    });
  });

  describe('BTC_CORRELATION_FILTER constants', () => {
    it('should have correct default values', () => {
      expect(BTC_CORRELATION_FILTER.EMA_PERIOD).toBe(21);
      expect(BTC_CORRELATION_FILTER.MIN_KLINES_REQUIRED).toBe(30);
      expect(BTC_CORRELATION_FILTER.BTC_PAIRS).toContain('BTCUSDT');
    });

    it('should have RSI period configured', () => {
      expect(BTC_CORRELATION_FILTER.RSI_PERIOD).toBe(14);
    });

    it('should have score weights configured', () => {
      const { SCORE_WEIGHTS } = BTC_CORRELATION_FILTER;
      expect(SCORE_WEIGHTS.emaPosition).toBe(40);
      expect(SCORE_WEIGHTS.macdMomentum).toBe(30);
      expect(SCORE_WEIGHTS.rsiMomentum).toBe(20);
      expect(SCORE_WEIGHTS.rsiLevel).toBe(10);
    });

    it('should have asymmetric thresholds configured', () => {
      const { ASYMMETRIC_THRESHOLDS } = BTC_CORRELATION_FILTER;
      expect(ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE).toBe(35);
      expect(ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE).toBe(65);
    });
  });

  describe('enhanced result fields', () => {
    it('should include correlationScore in result', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result).toHaveProperty('correlationScore');
      expect(typeof result.correlationScore).toBe('number');
      expect(result.correlationScore).toBeGreaterThanOrEqual(0);
      expect(result.correlationScore).toBeLessThanOrEqual(100);
    });

    it('should include btcRsi in result', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result).toHaveProperty('btcRsi');
      if (result.btcRsi !== null) {
        expect(result.btcRsi).toBeGreaterThanOrEqual(0);
        expect(result.btcRsi).toBeLessThanOrEqual(100);
      }
    });

    it('should include btcRsiMomentum in result', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result).toHaveProperty('btcRsiMomentum');
      expect(['RISING', 'FALLING', 'NEUTRAL']).toContain(result.btcRsiMomentum);
    });

    it('should include btcStrength in result', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result).toHaveProperty('btcStrength');
      expect(['STRONG', 'MODERATE', 'WEAK']).toContain(result.btcStrength);
    });
  });

  describe('correlation score calculation', () => {
    it('should return high score for bullish conditions', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result.correlationScore).toBeGreaterThan(50);
    });

    it('should return low score for bearish conditions', () => {
      const btcKlines = createBearishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(result.correlationScore).toBeLessThan(50);
    });

    it('should have score bounded between 0 and 100', () => {
      const bullishKlines = createBullishBtcKlines(50);
      const bearishKlines = createBearishBtcKlines(50);

      const bullishResult = checkBtcCorrelation(bullishKlines, 'LONG', 'ETHUSDT');
      const bearishResult = checkBtcCorrelation(bearishKlines, 'LONG', 'ETHUSDT');

      expect(bullishResult.correlationScore).toBeGreaterThanOrEqual(0);
      expect(bullishResult.correlationScore).toBeLessThanOrEqual(100);
      expect(bearishResult.correlationScore).toBeGreaterThanOrEqual(0);
      expect(bearishResult.correlationScore).toBeLessThanOrEqual(100);
    });
  });

  describe('asymmetric threshold behavior', () => {
    it('should block LONG when score is below LONG_BLOCK_SCORE threshold', () => {
      const btcKlines = createBearishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      if (result.correlationScore < BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('LONG blocked');
      }
    });

    it('should block SHORT when score is above SHORT_BLOCK_SCORE threshold', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'SHORT', 'ETHUSDT');

      if (result.correlationScore > BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE) {
        expect(result.isAllowed).toBe(false);
        expect(result.reason).toContain('SHORT blocked');
      }
    });

    it('should allow LONG even with neutral score above LONG_BLOCK_SCORE', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      if (result.correlationScore >= BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE) {
        expect(result.isAllowed).toBe(true);
      }
    });

    it('should allow SHORT even with neutral score below SHORT_BLOCK_SCORE', () => {
      const btcKlines = createBearishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'SHORT', 'ETHUSDT');

      if (result.correlationScore <= BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE) {
        expect(result.isAllowed).toBe(true);
      }
    });
  });

  describe('btcStrength calculation', () => {
    it('should return STRONG when score is >= 70 or <= 30', () => {
      const strongBullish = createBullishBtcKlines(50);
      const strongBearish = createBearishBtcKlines(50);

      const bullishResult = checkBtcCorrelation(strongBullish, 'LONG', 'ETHUSDT');
      const bearishResult = checkBtcCorrelation(strongBearish, 'LONG', 'ETHUSDT');

      if (bullishResult.correlationScore >= 70) {
        expect(bullishResult.btcStrength).toBe('STRONG');
      }
      if (bearishResult.correlationScore <= 30) {
        expect(bearishResult.btcStrength).toBe('STRONG');
      }
    });

    it('should determine strength based on correlation score', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      const score = result.correlationScore;
      if (score >= 70 || score <= 30) {
        expect(result.btcStrength).toBe('STRONG');
      } else if (score >= 60 || score <= 40) {
        expect(result.btcStrength).toBe('MODERATE');
      } else {
        expect(result.btcStrength).toBe('WEAK');
      }
    });
  });

  describe('RSI momentum detection', () => {
    it('should detect RISING RSI momentum in uptrend', () => {
      const btcKlines = createBullishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(['RISING', 'NEUTRAL']).toContain(result.btcRsiMomentum);
    });

    it('should detect FALLING RSI momentum in downtrend', () => {
      const btcKlines = createBearishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      expect(['FALLING', 'NEUTRAL']).toContain(result.btcRsiMomentum);
    });

    it('should include RSI value in reason message when blocking', () => {
      const btcKlines = createBearishBtcKlines(50);
      const result = checkBtcCorrelation(btcKlines, 'LONG', 'ETHUSDT');

      if (!result.isAllowed) {
        expect(result.reason).toMatch(/RSI (rising|falling|neutral)/i);
      }
    });
  });
});
