import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateCMF } from './cmf';

const createMockKline = (
  close: number,
  high: number,
  low: number,
  volume: number,
  index: number,
): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: String(volume),
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: String(volume * close),
  trades: 100,
  takerBuyBaseVolume: String(volume / 2),
  takerBuyQuoteVolume: String((volume / 2) * close),
});

describe('calculateCMF', () => {
  it('should calculate CMF correctly for bullish accumulation', () => {
    const klines = Array.from({ length: 30 }, (_, i) =>
      createMockKline(102, 105, 98, 1000, i),
    );
    const result = calculateCMF(klines);

    expect(result.values).toHaveLength(30);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(0);
  });

  it('should calculate CMF correctly for bearish distribution', () => {
    const klines = Array.from({ length: 30 }, (_, i) =>
      createMockKline(99, 105, 98, 1000, i),
    );
    const result = calculateCMF(klines);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 15 }, (_, i) =>
      createMockKline(100, 105, 95, 1000, i),
    );
    const result = calculateCMF(klines);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 20', () => {
    const klines = Array.from({ length: 30 }, (_, i) =>
      createMockKline(100, 105, 95, 1000, i),
    );
    const result = calculateCMF(klines);

    expect(result.values).toHaveLength(30);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(19);
  });

  it('should handle empty array', () => {
    const result = calculateCMF([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = Array.from({ length: 30 }, (_, i) =>
      createMockKline(100, 105, 95, 1000, i),
    );
    expect(calculateCMF(klines, 0).values).toEqual([]);
    expect(calculateCMF(klines, -1).values).toEqual([]);
  });

  it('should return values between -1 and 1', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const close = 100 + Math.sin(i * 0.3) * 3;
      return createMockKline(close, close + 5, close - 5, 1000, i);
    });
    const result = calculateCMF(klines);

    result.values.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(-1);
        expect(value).toBeLessThanOrEqual(1);
      }
    });
  });

  it('should return 0 for close at midpoint', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100, 105, 95, 1000, i),
    );
    const result = calculateCMF(klines);

    const nonNullValues = result.values.filter((v) => v !== null);
    nonNullValues.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });
});
