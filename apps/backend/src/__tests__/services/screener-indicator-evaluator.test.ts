import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { evaluateIndicator, evaluateIndicators, getPreviousValue, isTickerBasedIndicator } from '../../services/screener/indicator-evaluator';

const makeKline = (close: number, open?: number, high?: number, low?: number, volume?: number, index?: number): Kline => ({
  openTime: 1700000000000 + (index ?? 0) * 3600000,
  closeTime: 1700000000000 + ((index ?? 0) + 1) * 3600000 - 1,
  open: String(open ?? close * 0.99),
  high: String(high ?? close * 1.01),
  low: String(low ?? close * 0.98),
  close: String(close),
  volume: String(volume ?? 1000),
  quoteVolume: String((volume ?? 1000) * close),
  trades: 100,
  takerBuyBaseVolume: String((volume ?? 1000) * 0.5),
  takerBuyQuoteVolume: String((volume ?? 1000) * 0.5 * close),
});

const generateKlines = (count: number, basePrice = 100, volatility = 2): Kline[] => {
  const klines: Kline[] = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    price += (Math.sin(i * 0.3) * volatility) + (Math.random() - 0.5) * volatility * 0.5;
    if (price < 1) price = 1;
    klines.push(makeKline(price, price * 0.99, price * 1.02, price * 0.97, 1000 + i * 10, i));
  }
  return klines;
};

describe('IndicatorEvaluator', () => {
  const klines = generateKlines(200);

  describe('evaluateIndicator', () => {
    it('should compute RSI', () => {
      const value = evaluateIndicator('RSI', klines, { period: 14 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    it('should compute ADX', () => {
      const value = evaluateIndicator('ADX', klines, { period: 14 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
    });

    it('should compute EMA', () => {
      const value = evaluateIndicator('EMA', klines, { period: 21 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute SMA', () => {
      const value = evaluateIndicator('SMA', klines, { period: 20 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute MACD_HISTOGRAM', () => {
      const value = evaluateIndicator('MACD_HISTOGRAM', klines);
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute BOLLINGER_WIDTH', () => {
      const value = evaluateIndicator('BOLLINGER_WIDTH', klines, { period: 20 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
    });

    it('should compute ATR', () => {
      const value = evaluateIndicator('ATR', klines, { period: 14 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute ATR_PERCENT', () => {
      const value = evaluateIndicator('ATR_PERCENT', klines, { period: 14 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute STOCHASTIC_K', () => {
      const value = evaluateIndicator('STOCHASTIC_K', klines);
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    it('should compute CCI', () => {
      const value = evaluateIndicator('CCI', klines, { period: 20 });
      expect(value).not.toBeNull();
    });

    it('should compute MFI', () => {
      const value = evaluateIndicator('MFI', klines, { period: 14 });
      expect(value).not.toBeNull();
    });

    it('should compute ROC', () => {
      const value = evaluateIndicator('ROC', klines, { period: 12 });
      expect(value).not.toBeNull();
    });

    it('should compute WILLIAMS_R', () => {
      const value = evaluateIndicator('WILLIAMS_R', klines, { period: 14 });
      expect(value).not.toBeNull();
      expect(value).toBeLessThanOrEqual(0);
      expect(value).toBeGreaterThanOrEqual(-100);
    });

    it('should compute CHOPPINESS', () => {
      const value = evaluateIndicator('CHOPPINESS', klines, { period: 14 });
      expect(value).not.toBeNull();
    });

    it('should compute TSI', () => {
      const value = evaluateIndicator('TSI', klines);
      expect(value).not.toBeNull();
    });

    it('should compute PRICE_CLOSE', () => {
      const value = evaluateIndicator('PRICE_CLOSE', klines);
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute VOLUME_RATIO', () => {
      const value = evaluateIndicator('VOLUME_RATIO', klines, { period: 20 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should return null for empty klines', () => {
      expect(evaluateIndicator('RSI', [])).toBeNull();
      expect(evaluateIndicator('ADX', [])).toBeNull();
      expect(evaluateIndicator('PRICE_CLOSE', [])).toBeNull();
    });

    it('should return null for insufficient klines', () => {
      const short = generateKlines(3);
      expect(evaluateIndicator('RSI', short, { period: 14 })).toBeNull();
    });

    it('should compute ticker-based indicators', () => {
      const ticker = { priceChange: 5.5, priceChangePercent: 2.3, lastPrice: 100, volume: 50000, quoteVolume: 5000000 };
      expect(evaluateIndicator('PRICE_CHANGE_24H', [], {}, ticker)).toBe(5.5);
      expect(evaluateIndicator('PRICE_CHANGE_PERCENT_24H', [], {}, ticker)).toBe(2.3);
      expect(evaluateIndicator('VOLUME_24H', [], {}, ticker)).toBe(50000);
    });

    it('should compute MARKET_CAP_RANK from extra data', () => {
      const extra = { marketCapRank: 15 };
      expect(evaluateIndicator('MARKET_CAP_RANK', [], {}, undefined, extra)).toBe(15);
    });

    it('should compute BTC_CORRELATION', () => {
      const btcKlines = generateKlines(200, 40000, 500);
      const value = evaluateIndicator('BTC_CORRELATION', klines, { period: 30 }, undefined, { btcKlines });
      expect(value).not.toBeNull();
      expect(value!).toBeGreaterThanOrEqual(-1);
      expect(value!).toBeLessThanOrEqual(1);
    });
  });

  describe('evaluateIndicators', () => {
    it('should evaluate multiple indicators at once', () => {
      const result = evaluateIndicators(
        ['RSI', 'ADX', 'EMA', 'PRICE_CLOSE'],
        klines,
        { RSI: { period: 14 }, ADX: { period: 14 }, EMA: { period: 21 } },
      );
      expect(result['RSI']).not.toBeNull();
      expect(result['ADX']).not.toBeNull();
      expect(result['EMA']).not.toBeNull();
      expect(result['PRICE_CLOSE']).not.toBeNull();
    });
  });

  describe('getPreviousValue', () => {
    it('should return value from N bars back', () => {
      const current = evaluateIndicator('RSI', klines, { period: 14 });
      const previous = getPreviousValue('RSI', klines, 2, { period: 14 });
      expect(previous).not.toBeNull();
      expect(previous).not.toBe(current);
    });

    it('should return null if not enough klines', () => {
      const short = generateKlines(5);
      expect(getPreviousValue('RSI', short, 10, { period: 14 })).toBeNull();
    });
  });

  describe('isTickerBasedIndicator', () => {
    it('should return true for ticker indicators', () => {
      expect(isTickerBasedIndicator('PRICE_CHANGE_24H')).toBe(true);
      expect(isTickerBasedIndicator('VOLUME_24H')).toBe(true);
      expect(isTickerBasedIndicator('MARKET_CAP_RANK')).toBe(true);
    });

    it('should return false for kline indicators', () => {
      expect(isTickerBasedIndicator('RSI')).toBe(false);
      expect(isTickerBasedIndicator('ADX')).toBe(false);
    });
  });
});
