import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { IndicatorEngine, isTickerBasedIndicator, type ScreenerTickerData as TickerData, type ScreenerExtraData as ExtraData } from '../../services/indicator-engine';

const engine = new IndicatorEngine();
const evaluateIndicator: typeof engine.evaluateScreenerIndicator = engine.evaluateScreenerIndicator.bind(engine);
const evaluateIndicators: typeof engine.evaluateScreenerIndicators = engine.evaluateScreenerIndicators.bind(engine);
const getPreviousValue: typeof engine.getScreenerPreviousValue = engine.getScreenerPreviousValue.bind(engine);

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

    it('should compute MACD_SIGNAL', () => {
      const value = evaluateIndicator('MACD_SIGNAL', klines);
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute BOLLINGER_UPPER', () => {
      const value = evaluateIndicator('BOLLINGER_UPPER', klines, { period: 20, stdDev: 2 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute BOLLINGER_LOWER', () => {
      const value = evaluateIndicator('BOLLINGER_LOWER', klines, { period: 20, stdDev: 2 });
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThan(0);
    });

    it('should compute STOCHASTIC_D', () => {
      const value = evaluateIndicator('STOCHASTIC_D', klines);
      expect(value).not.toBeNull();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    it('should compute CMF', () => {
      const value = evaluateIndicator('CMF', klines, { period: 20 });
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute SUPERTREND', () => {
      const value = evaluateIndicator('SUPERTREND', klines, { period: 10, multiplier: 3 });
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute OBV', () => {
      const value = evaluateIndicator('OBV', klines);
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute VWAP', () => {
      const value = evaluateIndicator('VWAP', klines);
      expect(value).not.toBeNull();
      expect(typeof value).toBe('number');
    });

    it('should compute FUNDING_RATE from extra data', () => {
      const extra: ExtraData = { fundingRate: 0.0005 };
      expect(evaluateIndicator('FUNDING_RATE', [], {}, undefined, extra)).toBe(0.0005);
    });

    it('should return null for FUNDING_RATE when extra is undefined', () => {
      expect(evaluateIndicator('FUNDING_RATE', [], {}, undefined, undefined)).toBeNull();
    });

    it('should return null for FUNDING_RATE when fundingRate is null', () => {
      const extra: ExtraData = { fundingRate: null };
      expect(evaluateIndicator('FUNDING_RATE', [], {}, undefined, extra)).toBeNull();
    });

    it('should return null for ticker-based indicators when ticker is undefined', () => {
      expect(evaluateIndicator('PRICE_CHANGE_24H', [], {}, undefined)).toBeNull();
      expect(evaluateIndicator('PRICE_CHANGE_PERCENT_24H', [], {}, undefined)).toBeNull();
      expect(evaluateIndicator('VOLUME_24H', [], {}, undefined)).toBeNull();
    });

    it('should return null for MARKET_CAP_RANK when extra is undefined', () => {
      expect(evaluateIndicator('MARKET_CAP_RANK', [], {}, undefined, undefined)).toBeNull();
    });

    it('should return null for MARKET_CAP_RANK when marketCapRank is null', () => {
      const extra: ExtraData = { marketCapRank: null };
      expect(evaluateIndicator('MARKET_CAP_RANK', [], {}, undefined, extra)).toBeNull();
    });

    it('should return null for BTC_CORRELATION when extra is undefined', () => {
      expect(evaluateIndicator('BTC_CORRELATION', klines, { period: 30 }, undefined, undefined)).toBeNull();
    });

    it('should return null for BTC_CORRELATION when btcKlines is empty', () => {
      expect(evaluateIndicator('BTC_CORRELATION', klines, { period: 30 }, undefined, { btcKlines: [] })).toBeNull();
    });

    it('should return null for BTC_CORRELATION when not enough data for correlation (n < 5)', () => {
      const shortKlines = generateKlines(4);
      const shortBtcKlines = generateKlines(4, 40000, 500);
      const value = evaluateIndicator('BTC_CORRELATION', shortKlines, { period: 3 }, undefined, { btcKlines: shortBtcKlines });
      expect(value).toBeNull();
    });

    it('should return null for BTC_CORRELATION when all returns are identical (denom === 0)', () => {
      const flatKlines: Kline[] = [];
      const flatBtcKlines: Kline[] = [];
      for (let i = 0; i < 40; i++) {
        flatKlines.push(makeKline(100, 99, 101, 98, 1000, i));
        flatBtcKlines.push(makeKline(40000, 39900, 40100, 39800, 5000, i));
      }
      const value = evaluateIndicator('BTC_CORRELATION', flatKlines, { period: 30 }, undefined, { btcKlines: flatBtcKlines });
      expect(value).toBeNull();
    });

    it('should return null for OBV when klines are empty', () => {
      expect(evaluateIndicator('OBV', [])).toBeNull();
    });

    it('should return null for VWAP when klines are empty', () => {
      expect(evaluateIndicator('VWAP', [])).toBeNull();
    });

    it('should return null for VOLUME_RATIO when klines are empty', () => {
      expect(evaluateIndicator('VOLUME_RATIO', [])).toBeNull();
    });

    it('should return null for ATR_PERCENT when klines are empty', () => {
      expect(evaluateIndicator('ATR_PERCENT', [])).toBeNull();
    });

    it('should return null for ATR_PERCENT when close is zero', () => {
      const zeroCloseKlines: Kline[] = [];
      for (let i = 0; i < 20; i++) {
        zeroCloseKlines.push(makeKline(i === 19 ? 0 : 100, 99, 101, 98, 1000, i));
      }
      const value = evaluateIndicator('ATR_PERCENT', zeroCloseKlines, { period: 14 });
      expect(value).toBeNull();
    });

    it('should return null for BOLLINGER_WIDTH when klines are insufficient', () => {
      const shortKlines = generateKlines(2);
      expect(evaluateIndicator('BOLLINGER_WIDTH', shortKlines, { period: 20 })).toBeNull();
    });

    it('should return null for BOLLINGER_UPPER when klines are insufficient', () => {
      expect(evaluateIndicator('BOLLINGER_UPPER', [], { period: 20, stdDev: 2 })).toBeNull();
    });

    it('should return null for BOLLINGER_LOWER when klines are insufficient', () => {
      expect(evaluateIndicator('BOLLINGER_LOWER', [], { period: 20, stdDev: 2 })).toBeNull();
    });

    it('should use default params when none provided for RSI', () => {
      const value = evaluateIndicator('RSI', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for ADX', () => {
      const value = evaluateIndicator('ADX', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for EMA', () => {
      const value = evaluateIndicator('EMA', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for SMA', () => {
      const value = evaluateIndicator('SMA', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for ATR', () => {
      const value = evaluateIndicator('ATR', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for ATR_PERCENT', () => {
      const value = evaluateIndicator('ATR_PERCENT', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for STOCHASTIC_K', () => {
      const value = evaluateIndicator('STOCHASTIC_K', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for STOCHASTIC_D', () => {
      const value = evaluateIndicator('STOCHASTIC_D', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for CCI', () => {
      const value = evaluateIndicator('CCI', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for MFI', () => {
      const value = evaluateIndicator('MFI', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for CMF', () => {
      const value = evaluateIndicator('CMF', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for ROC', () => {
      const value = evaluateIndicator('ROC', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for WILLIAMS_R', () => {
      const value = evaluateIndicator('WILLIAMS_R', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for CHOPPINESS', () => {
      const value = evaluateIndicator('CHOPPINESS', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for SUPERTREND', () => {
      const value = evaluateIndicator('SUPERTREND', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for BOLLINGER_WIDTH', () => {
      const value = evaluateIndicator('BOLLINGER_WIDTH', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for VOLUME_RATIO', () => {
      const value = evaluateIndicator('VOLUME_RATIO', klines, {});
      expect(value).not.toBeNull();
    });

    it('should use default params when none provided for BTC_CORRELATION', () => {
      const btcKlines = generateKlines(200, 40000, 500);
      const value = evaluateIndicator('BTC_CORRELATION', klines, {}, undefined, { btcKlines });
      expect(value).not.toBeNull();
    });

    it('should return null for an unknown indicator id', () => {
      const value = evaluateIndicator('UNKNOWN_INDICATOR' as never, klines);
      expect(value).toBeNull();
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

    it('should use empty params when paramsMap entry is missing for an indicator', () => {
      const result = evaluateIndicators(
        ['RSI', 'PRICE_CLOSE'],
        klines,
        {},
      );
      expect(result['RSI']).not.toBeNull();
      expect(result['PRICE_CLOSE']).not.toBeNull();
    });

    it('should handle ticker-based indicators in evaluateIndicators', () => {
      const ticker: TickerData = { priceChange: 10, priceChangePercent: 5, lastPrice: 200, volume: 90000, quoteVolume: 18000000 };
      const extra: ExtraData = { fundingRate: 0.001, marketCapRank: 5 };
      const result = evaluateIndicators(
        ['PRICE_CHANGE_24H', 'FUNDING_RATE', 'MARKET_CAP_RANK', 'RSI'],
        klines,
        { RSI: { period: 14 } },
        ticker,
        extra,
      );
      expect(result['PRICE_CHANGE_24H']).toBe(10);
      expect(result['FUNDING_RATE']).toBe(0.001);
      expect(result['MARKET_CAP_RANK']).toBe(5);
      expect(result['RSI']).not.toBeNull();
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

    it('should return true for PRICE_CHANGE_PERCENT_24H', () => {
      expect(isTickerBasedIndicator('PRICE_CHANGE_PERCENT_24H')).toBe(true);
    });

    it('should return true for FUNDING_RATE', () => {
      expect(isTickerBasedIndicator('FUNDING_RATE')).toBe(true);
    });

    it('should return false for kline indicators', () => {
      expect(isTickerBasedIndicator('RSI')).toBe(false);
      expect(isTickerBasedIndicator('ADX')).toBe(false);
    });
  });

  describe('edge cases - getReturns with zero close', () => {
    it('should skip zero-close klines in BTC_CORRELATION calculation', () => {
      const klinesWithZero: Kline[] = [];
      const btcKlines: Kline[] = [];
      for (let i = 0; i < 40; i++) {
        const price = i === 10 ? 0 : 100 + i;
        klinesWithZero.push(makeKline(price, price * 0.99, price * 1.01, price * 0.98, 1000, i));
        btcKlines.push(makeKline(40000 + i * 10, 39900, 40100, 39800, 5000, i));
      }
      const value = evaluateIndicator('BTC_CORRELATION', klinesWithZero, { period: 30 }, undefined, { btcKlines });
      expect(value === null || (typeof value === 'number' && value >= -1 && value <= 1)).toBe(true);
    });
  });

  describe('edge cases - getLastNonNull and getLastValidNumber', () => {
    it('should return null for MACD_HISTOGRAM when klines produce no valid values', () => {
      const result = evaluateIndicator('MACD_HISTOGRAM', []);
      expect(result).toBeNull();
    });

    it('should return null for MACD_SIGNAL when klines produce no valid values', () => {
      const result = evaluateIndicator('MACD_SIGNAL', []);
      expect(result).toBeNull();
    });

    it('should return null for CHOPPINESS when klines are empty', () => {
      const result = evaluateIndicator('CHOPPINESS', []);
      expect(result).toBeNull();
    });

    it('should return null for TSI when klines are empty', () => {
      const result = evaluateIndicator('TSI', []);
      expect(result).toBeNull();
    });

    it('should return null for SUPERTREND when klines are empty', () => {
      const result = evaluateIndicator('SUPERTREND', []);
      expect(result).toBeNull();
    });

    it('should return null for CMF when klines are empty', () => {
      const result = evaluateIndicator('CMF', []);
      expect(result).toBeNull();
    });

    it('should return null for CCI when klines are empty', () => {
      const result = evaluateIndicator('CCI', []);
      expect(result).toBeNull();
    });

    it('should return null for MFI when klines are empty', () => {
      const result = evaluateIndicator('MFI', []);
      expect(result).toBeNull();
    });

    it('should return null for WILLIAMS_R when klines are empty', () => {
      const result = evaluateIndicator('WILLIAMS_R', []);
      expect(result).toBeNull();
    });

    it('should return null for ROC when klines are empty', () => {
      const result = evaluateIndicator('ROC', []);
      expect(result).toBeNull();
    });

    it('should return null for EMA when klines are empty', () => {
      const result = evaluateIndicator('EMA', []);
      expect(result).toBeNull();
    });

    it('should return null for SMA when klines are empty', () => {
      const result = evaluateIndicator('SMA', []);
      expect(result).toBeNull();
    });

    it('should return null for STOCHASTIC_K when klines are empty', () => {
      const result = evaluateIndicator('STOCHASTIC_K', []);
      expect(result).toBeNull();
    });

    it('should return null for STOCHASTIC_D when klines are empty', () => {
      const result = evaluateIndicator('STOCHASTIC_D', []);
      expect(result).toBeNull();
    });

    it('should return null for ATR when klines are empty', () => {
      const result = evaluateIndicator('ATR', []);
      expect(result).toBeNull();
    });
  });

  describe('getPreviousValue - additional edge cases', () => {
    it('should use default empty params when none provided', () => {
      const value = getPreviousValue('RSI', klines, 1);
      expect(value).not.toBeNull();
    });

    it('should return null when barsBack equals klines length', () => {
      const fiveKlines = generateKlines(5);
      expect(getPreviousValue('PRICE_CLOSE', fiveKlines, 5)).toBeNull();
    });
  });
});
