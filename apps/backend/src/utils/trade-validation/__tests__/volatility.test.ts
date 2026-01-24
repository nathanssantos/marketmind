import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { calculateVolatilityAdjustment, VOLATILITY_DEFAULTS } from '../volatility';

const createKline = (high: number, low: number, close: number, openTime: number): Kline => ({
  openTime,
  closeTime: openTime + 3600000,
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
});

const createNormalVolatilityKlines = (count: number, basePrice: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const variation = basePrice * 0.01;
    klines.push(createKline(
      basePrice + variation,
      basePrice - variation,
      basePrice,
      Date.now() + i * 3600000
    ));
  }
  return klines;
};

const createHighVolatilityKlines = (count: number, basePrice: number): Kline[] => {
  const klines: Kline[] = [];
  for (let i = 0; i < count; i++) {
    const variation = basePrice * 0.05;
    klines.push(createKline(
      basePrice + variation,
      basePrice - variation,
      basePrice,
      Date.now() + i * 3600000
    ));
  }
  return klines;
};

describe('calculateVolatilityAdjustment', () => {
  it('should return factor 1.0 for normal volatility', () => {
    const klines = createNormalVolatilityKlines(20, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
    });

    expect(result.factor).toBe(1.0);
    expect(result.isHighVolatility).toBe(false);
    expect(result.atrPercent).toBeDefined();
    expect(result.atrPercent).toBeLessThan(VOLATILITY_DEFAULTS.HIGH_VOLATILITY_THRESHOLD);
  });

  it('should return reduced factor for high volatility', () => {
    const klines = createHighVolatilityKlines(20, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
    });

    expect(result.factor).toBe(VOLATILITY_DEFAULTS.REDUCTION_FACTOR);
    expect(result.isHighVolatility).toBe(true);
    expect(result.atrPercent).toBeGreaterThan(VOLATILITY_DEFAULTS.HIGH_VOLATILITY_THRESHOLD);
    expect(result.rationale).toContain('High volatility');
  });

  it('should return 1.0 when insufficient klines', () => {
    const klines = createNormalVolatilityKlines(5, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
    });

    expect(result.factor).toBe(1.0);
    expect(result.atrPercent).toBeNull();
    expect(result.rationale).toContain('Insufficient');
  });

  it('should use klineIndex when provided', () => {
    const klines = createNormalVolatilityKlines(30, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
      klineIndex: 20,
    });

    expect(result.factor).toBe(1.0);
    expect(result.atrPercent).toBeDefined();
  });

  it('should respect custom thresholds', () => {
    const klines = createNormalVolatilityKlines(20, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
      highVolatilityThreshold: 0.5,
    });

    expect(result.isHighVolatility).toBe(true);
    expect(result.factor).toBe(VOLATILITY_DEFAULTS.REDUCTION_FACTOR);
  });

  it('should respect custom reduction factor', () => {
    const klines = createHighVolatilityKlines(20, 100);

    const result = calculateVolatilityAdjustment({
      klines,
      entryPrice: 100,
      reductionFactor: 0.5,
    });

    expect(result.factor).toBe(0.5);
  });
});
