import { describe, it, expect } from 'vitest';
import type { Kline } from '@marketmind/types';
import {
  getBtcTrendInfo,
  getBtcTrendEmaInfo,
  getBtcTrendEmaInfoWithHistory,
  getEma21Direction,
  checkEma21Alignment,
  isBtcPair,
  BTC_CORRELATION_FILTER,
} from '../btc-correlation-filter';

const createKline = (close: number, index: number): Kline => ({
  openTime: 1700000000000 + index * 60000,
  open: String(close),
  high: String(close * 1.01),
  low: String(close * 0.99),
  close: String(close),
  volume: '1000',
  closeTime: 1700000000000 + (index + 1) * 60000 - 1,
  quoteVolume: '10000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '5000',
});

const createBullishKlines = (count: number, startPrice = 40000): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(startPrice + i * 100, i));

const createBearishKlines = (count: number, startPrice = 50000): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(Math.max(startPrice - i * 100, 30000), i));

const createFlatKlines = (count: number, price = 45000): Kline[] =>
  Array.from({ length: count }, (_, i) => createKline(price, i));

describe('btc-correlation-filter extended', () => {
  describe('isBtcPair', () => {
    it('should identify BTCUSDC as BTC pair', () => {
      expect(isBtcPair('BTCUSDC')).toBe(true);
    });

    it('should identify BTCFDUSD as BTC pair', () => {
      expect(isBtcPair('BTCFDUSD')).toBe(true);
    });

    it('should not identify BTCETH as BTC pair', () => {
      expect(isBtcPair('BTCETH')).toBe(false);
    });
  });

  describe('getBtcTrendInfo', () => {
    it('should return NEUTRAL with insufficient klines', async () => {
      const klines = createBullishKlines(10);
      const result = await getBtcTrendInfo(klines);

      expect(result.trend).toBe('NEUTRAL');
      expect(result.strength).toBe('WEAK');
      expect(result.score).toBe(50);
      expect(result.canLong).toBe(true);
      expect(result.canShort).toBe(true);
      expect(result.btcPrice).toBeNull();
      expect(result.btcEma21).toBeNull();
    });

    it('should detect BULLISH trend with rising prices', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendInfo(klines);

      expect(result.trend).toBe('BULLISH');
      expect(result.score).toBeGreaterThan(50);
      expect(result.btcPrice).toBeGreaterThan(0);
      expect(result.btcEma21).toBeGreaterThan(0);
    });

    it('should detect BEARISH trend with falling prices', async () => {
      const klines = createBearishKlines(50);
      const result = await getBtcTrendInfo(klines);

      expect(result.trend).toBe('BEARISH');
      expect(result.score).toBeLessThan(50);
    });

    it('should set canLong based on LONG_BLOCK_SCORE threshold', async () => {
      const klines = createBearishKlines(50);
      const result = await getBtcTrendInfo(klines);

      if (result.score < BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.LONG_BLOCK_SCORE) {
        expect(result.canLong).toBe(false);
      } else {
        expect(result.canLong).toBe(true);
      }
    });

    it('should set canShort based on SHORT_BLOCK_SCORE threshold', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendInfo(klines);

      if (result.score > BTC_CORRELATION_FILTER.ASYMMETRIC_THRESHOLDS.SHORT_BLOCK_SCORE) {
        expect(result.canShort).toBe(false);
      } else {
        expect(result.canShort).toBe(true);
      }
    });

    it('should return score bounded between 0 and 100', async () => {
      const bullish = await getBtcTrendInfo(createBullishKlines(50));
      const bearish = await getBtcTrendInfo(createBearishKlines(50));

      expect(bullish.score).toBeGreaterThanOrEqual(0);
      expect(bullish.score).toBeLessThanOrEqual(100);
      expect(bearish.score).toBeGreaterThanOrEqual(0);
      expect(bearish.score).toBeLessThanOrEqual(100);
    });
  });

  describe('getBtcTrendEmaInfo', () => {
    it('should return NEUTRAL with insufficient klines', async () => {
      const result = await getBtcTrendEmaInfo(createFlatKlines(5));

      expect(result.trend).toBe('NEUTRAL');
      expect(result.strength).toBe('WEAK');
      expect(result.btcPrice).toBeNull();
      expect(result.btcEma21).toBeNull();
    });

    it('should detect BULLISH when price above EMA21', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfo(klines);

      expect(result.trend).toBe('BULLISH');
      expect(result.canLong).toBe(true);
      expect(result.canShort).toBe(false);
    });

    it('should detect BEARISH when price below EMA21', async () => {
      const klines = createBearishKlines(50);
      const result = await getBtcTrendEmaInfo(klines);

      expect(result.trend).toBe('BEARISH');
      expect(result.canLong).toBe(false);
      expect(result.canShort).toBe(true);
    });

    it('should determine STRONG strength for large EMA distance', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfo(klines);

      if (result.btcPrice && result.btcEma21) {
        const diff = Math.abs(result.btcPrice - result.btcEma21) / result.btcEma21 * 100;
        if (diff >= 3) expect(result.strength).toBe('STRONG');
        else if (diff >= 1) expect(result.strength).toBe('MODERATE');
        else expect(result.strength).toBe('WEAK');
      }
    });

    it('should round score', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfo(klines);
      expect(result.score).toBe(Math.round(result.score));
    });
  });

  describe('getBtcTrendEmaInfoWithHistory', () => {
    it('should return empty history with insufficient klines', async () => {
      const result = await getBtcTrendEmaInfoWithHistory(createFlatKlines(5));

      expect(result.history).toEqual([]);
      expect(result.trend).toBe('NEUTRAL');
    });

    it('should return history points with sufficient klines', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfoWithHistory(klines);

      expect(result.history.length).toBeGreaterThan(0);
      expect(result.history.length).toBeLessThanOrEqual(31);
    });

    it('should include timestamp, price, and ema21 in history points', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfoWithHistory(klines);

      for (const point of result.history) {
        expect(point).toHaveProperty('timestamp');
        expect(point).toHaveProperty('price');
        expect(point).toHaveProperty('ema21');
        expect(typeof point.timestamp).toBe('number');
        expect(typeof point.price).toBe('number');
        expect(typeof point.ema21).toBe('number');
      }
    });

    it('should include base trend info alongside history', async () => {
      const klines = createBullishKlines(50);
      const result = await getBtcTrendEmaInfoWithHistory(klines);

      expect(result).toHaveProperty('trend');
      expect(result).toHaveProperty('strength');
      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('canLong');
      expect(result).toHaveProperty('canShort');
    });
  });

  describe('getEma21Direction', () => {
    it('should return NEUTRAL with insufficient klines', async () => {
      const result = await getEma21Direction(createFlatKlines(10));

      expect(result.direction).toBe('NEUTRAL');
      expect(result.price).toBeNull();
      expect(result.ema21).toBeNull();
    });

    it('should return BULLISH when price above EMA21', async () => {
      const klines = createBullishKlines(50);
      const result = await getEma21Direction(klines);

      expect(result.direction).toBe('BULLISH');
      expect(result.price).toBeGreaterThan(0);
      expect(result.ema21).toBeGreaterThan(0);
      expect(result.price!).toBeGreaterThan(result.ema21!);
    });

    it('should return BEARISH when price below EMA21', async () => {
      const klines = createBearishKlines(50);
      const result = await getEma21Direction(klines);

      expect(result.direction).toBe('BEARISH');
      expect(result.price!).toBeLessThan(result.ema21!);
    });
  });

  describe('checkEma21Alignment', () => {
    it('should return aligned when both are BULLISH', async () => {
      const btcKlines = createBullishKlines(50, 40000);
      const assetKlines = createBullishKlines(50, 100);
      const result = await checkEma21Alignment(btcKlines, assetKlines);

      expect(result.isAligned).toBe(true);
      expect(result.btcDirection).toBe('BULLISH');
      expect(result.assetDirection).toBe('BULLISH');
      expect(result.reason).toContain('Aligned');
    });

    it('should return aligned when both are BEARISH', async () => {
      const btcKlines = createBearishKlines(50, 50000);
      const assetKlines = createBearishKlines(50, 200);
      const result = await checkEma21Alignment(btcKlines, assetKlines);

      expect(result.isAligned).toBe(true);
      expect(result.btcDirection).toBe('BEARISH');
      expect(result.assetDirection).toBe('BEARISH');
      expect(result.reason).toContain('Aligned');
    });

    it('should return misaligned when directions differ', async () => {
      const btcKlines = createBullishKlines(50, 40000);
      const assetKlines = createBearishKlines(50, 200);
      const result = await checkEma21Alignment(btcKlines, assetKlines);

      expect(result.isAligned).toBe(false);
      expect(result.reason).toContain('Misaligned');
    });

    it('should allow when BTC data is insufficient', async () => {
      const btcKlines = createBullishKlines(5);
      const assetKlines = createBullishKlines(50, 100);
      const result = await checkEma21Alignment(btcKlines, assetKlines);

      expect(result.isAligned).toBe(true);
      expect(result.btcDirection).toBe('NEUTRAL');
      expect(result.reason).toContain('Insufficient data');
    });

    it('should allow when asset data is insufficient', async () => {
      const btcKlines = createBullishKlines(50, 40000);
      const assetKlines = createBullishKlines(5, 100);
      const result = await checkEma21Alignment(btcKlines, assetKlines);

      expect(result.isAligned).toBe(true);
      expect(result.assetDirection).toBe('NEUTRAL');
      expect(result.reason).toContain('Insufficient data');
    });
  });
});
