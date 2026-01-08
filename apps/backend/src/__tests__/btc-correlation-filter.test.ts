import { describe, it, expect } from 'vitest';
import { checkBtcCorrelation, isBtcPair, BTC_CORRELATION_FILTER } from '../utils/btc-correlation-filter';
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
  });
});
