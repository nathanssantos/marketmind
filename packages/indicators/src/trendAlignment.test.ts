import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  analyzeTrend,
  checkTrendAlignment,
  getTrendDirection,
  isTrendingMarket,
  TREND_ALIGNMENT_DEFAULTS,
} from './trendAlignment';

const createMockKline = (open: number, high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(open),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

const createUptrendKlines = (count: number, basePrice: number = 100, increment: number = 2): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const base = basePrice + i * increment;
    klines.push(createMockKline(base, base + 3, base - 1, base + 2, i));
  }
  return klines;
};

const createDowntrendKlines = (count: number, basePrice: number = 200, decrement: number = 2): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const base = basePrice - i * decrement;
    klines.push(createMockKline(base, base + 1, base - 3, base - 2, i));
  }
  return klines;
};

const createRangingKlines = (count: number, basePrice: number = 100): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const offset = Math.sin(i * 0.5) * 2;
    const base = basePrice + offset;
    klines.push(createMockKline(base, base + 1, base - 1, base + offset * 0.1, i));
  }
  return klines;
};

describe('analyzeTrend', () => {
  it('should return NEUTRAL for insufficient data', () => {
    const klines = createUptrendKlines(10);
    const result = analyzeTrend(klines);

    expect(result.direction).toBe('NEUTRAL');
    expect(result.isClearTrend).toBe(false);
    expect(result.strength).toBe(0);
  });

  it('should return BULLISH when price > EMA and ADX > threshold', () => {
    const klines = createUptrendKlines(50, 100, 3);
    const result = analyzeTrend(klines);

    expect(result.direction).toBe('BULLISH');
    expect(result.isClearTrend).toBe(true);
    expect(result.priceVsEma).toBe('ABOVE');
    expect(result.adx).toBeGreaterThan(0);
  });

  it('should return BEARISH when price < EMA and ADX > threshold', () => {
    const klines = createDowntrendKlines(50, 200, 3);
    const result = analyzeTrend(klines);

    expect(result.direction).toBe('BEARISH');
    expect(result.isClearTrend).toBe(true);
    expect(result.priceVsEma).toBe('BELOW');
  });

  it('should return NEUTRAL when ADX < threshold (ranging market)', () => {
    const klines = createRangingKlines(50);
    const result = analyzeTrend(klines, { adxThreshold: 30 });

    expect(result.direction).toBe('NEUTRAL');
    expect(result.isClearTrend).toBe(false);
  });

  it('should calculate RSI correctly', () => {
    const klines = createUptrendKlines(50);
    const result = analyzeTrend(klines);

    expect(result.rsi).toBeGreaterThanOrEqual(0);
    expect(result.rsi).toBeLessThanOrEqual(100);
  });

  it('should calculate strength as combination of ADX and EMA distance', () => {
    const klines = createUptrendKlines(50, 100, 5);
    const result = analyzeTrend(klines);

    expect(result.strength).toBeGreaterThanOrEqual(0);
    expect(result.strength).toBeLessThanOrEqual(100);
  });

  it('should respect custom config values', () => {
    const klines = createUptrendKlines(60);
    const result = analyzeTrend(klines, {
      adxPeriod: 10,
      adxThreshold: 20,
      emaPeriod: 15,
      emaConfirmBars: 2,
    });

    expect(result.adx).toBeGreaterThan(0);
  });
});

describe('checkTrendAlignment', () => {
  it('should return TRADE or CAUTION when both asset and BTC are aligned bullish', () => {
    const assetKlines = createUptrendKlines(50, 100, 3);
    const btcKlines = createUptrendKlines(50, 40000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(['TRADE', 'CAUTION']).toContain(result.recommendation);
    expect(result.isAligned).toBe(true);
    expect(result.asset.direction).toBe('BULLISH');
    expect(result.btc.direction).toBe('BULLISH');
  });

  it('should return TRADE or CAUTION when both asset and BTC are aligned bearish', () => {
    const assetKlines = createDowntrendKlines(50, 200, 3);
    const btcKlines = createDowntrendKlines(50, 50000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(['TRADE', 'CAUTION']).toContain(result.recommendation);
    expect(result.isAligned).toBe(true);
    expect(result.asset.direction).toBe('BEARISH');
    expect(result.btc.direction).toBe('BEARISH');
  });

  it('should return SKIP when trends are opposite', () => {
    const assetKlines = createUptrendKlines(50, 100, 3);
    const btcKlines = createDowntrendKlines(50, 50000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(result.recommendation).toBe('SKIP');
    expect(result.isAligned).toBe(false);
    expect(result.reason).toContain('Opposite trend');
  });

  it('should return SKIP when asset has no clear trend', () => {
    const assetKlines = createRangingKlines(50);
    const btcKlines = createUptrendKlines(50, 40000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(result.recommendation).toBe('SKIP');
    expect(result.asset.isClearTrend).toBe(false);
    expect(result.reason).toContain('Asset no clear trend');
  });

  it('should return CAUTION when BTC has no clear trend', () => {
    const assetKlines = createUptrendKlines(50, 100, 3);
    const btcKlines = createRangingKlines(50);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(result.recommendation).toBe('CAUTION');
    expect(result.btc.isClearTrend).toBe(false);
    expect(result.reason).toContain('BTC no clear trend');
  });

  it('should calculate alignment score correctly', () => {
    const assetKlines = createUptrendKlines(50, 100, 3);
    const btcKlines = createUptrendKlines(50, 40000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines);

    expect(result.alignmentScore).toBeGreaterThanOrEqual(50);
    expect(result.alignmentScore).toBeLessThanOrEqual(100);
  });

  it('should return CAUTION when RSI is at extreme', () => {
    const assetKlines = createUptrendKlines(50, 100, 5);
    const btcKlines = createUptrendKlines(50, 40000, 500);
    const result = checkTrendAlignment(assetKlines, btcKlines, {
      rsiUpperBound: 50,
    });

    if (result.asset.rsi > 50) {
      expect(result.recommendation).toBe('CAUTION');
      expect(result.reason).toContain('RSI at extreme');
    }
  });
});

describe('isTrendingMarket', () => {
  it('should return true for strong uptrend', () => {
    const klines = createUptrendKlines(50, 100, 4);
    const result = isTrendingMarket(klines);

    expect(result).toBe(true);
  });

  it('should return true for strong downtrend', () => {
    const klines = createDowntrendKlines(50, 200, 4);
    const result = isTrendingMarket(klines);

    expect(result).toBe(true);
  });

  it('should return false for ranging market', () => {
    const klines = createRangingKlines(50);
    const result = isTrendingMarket(klines, 30);

    expect(result).toBe(false);
  });

  it('should accept custom ADX threshold parameter', () => {
    const klines = createUptrendKlines(50, 100, 4);

    const result1 = isTrendingMarket(klines, 10);
    const result2 = isTrendingMarket(klines, 25);
    const result3 = isTrendingMarket(klines, 50);

    expect(typeof result1).toBe('boolean');
    expect(typeof result2).toBe('boolean');
    expect(typeof result3).toBe('boolean');
  });
});

describe('getTrendDirection', () => {
  it('should return BULLISH for uptrend', () => {
    const klines = createUptrendKlines(50, 100, 3);
    const result = getTrendDirection(klines);

    expect(result).toBe('BULLISH');
  });

  it('should return BEARISH for downtrend', () => {
    const klines = createDowntrendKlines(50, 200, 3);
    const result = getTrendDirection(klines);

    expect(result).toBe('BEARISH');
  });

  it('should return NEUTRAL for ranging market', () => {
    const klines = createRangingKlines(50);
    const result = getTrendDirection(klines);

    expect(result).toBe('NEUTRAL');
  });
});

describe('TREND_ALIGNMENT_DEFAULTS', () => {
  it('should have correct default values', () => {
    expect(TREND_ALIGNMENT_DEFAULTS.ADX_PERIOD).toBe(14);
    expect(TREND_ALIGNMENT_DEFAULTS.ADX_THRESHOLD).toBe(25);
    expect(TREND_ALIGNMENT_DEFAULTS.EMA_PERIOD).toBe(21);
    expect(TREND_ALIGNMENT_DEFAULTS.EMA_CONFIRM_BARS).toBe(3);
    expect(TREND_ALIGNMENT_DEFAULTS.RSI_PERIOD).toBe(14);
    expect(TREND_ALIGNMENT_DEFAULTS.RSI_LOWER_BOUND).toBe(30);
    expect(TREND_ALIGNMENT_DEFAULTS.RSI_UPPER_BOUND).toBe(70);
    expect(TREND_ALIGNMENT_DEFAULTS.MIN_KLINES).toBe(50);
  });
});
