import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateAO } from './ao';

const createMockKline = (high: number, low: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String((high + low) / 2),
  high: String(high),
  low: String(low),
  close: String((high + low) / 2),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateAO', () => {
  it('should calculate AO correctly for uptrend', () => {
    const klines = Array.from({ length: 50 }, (_, i) =>
      createMockKline(100 + i * 2 + 5, 100 + i * 2 - 5, i),
    );
    const result = calculateAO(klines);

    expect(result.values).toHaveLength(50);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(33);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(0);
  });

  it('should calculate AO correctly for downtrend', () => {
    const klines = Array.from({ length: 50 }, (_, i) =>
      createMockKline(200 - i * 2 + 5, 200 - i * 2 - 5, i),
    );
    const result = calculateAO(klines);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateAO(klines);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 5 and 34', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105 + i, 95 + i, i));
    const result = calculateAO(klines);

    expect(result.values).toHaveLength(50);
    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(33);
  });

  it('should handle empty array', () => {
    const result = calculateAO([]);
    expect(result.values).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105, 95, i));
    expect(calculateAO(klines, 0, 34).values).toEqual([]);
    expect(calculateAO(klines, 5, 0).values).toEqual([]);
    expect(calculateAO(klines, 34, 5).values).toEqual([]);
    expect(calculateAO(klines, 10, 10).values).toEqual([]);
  });

  it('should return 0 for unchanged prices', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateAO(klines);

    const nonNullValues = result.values.filter((v) => v !== null);
    nonNullValues.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });

  it('should work with custom periods', () => {
    const klines = Array.from({ length: 30 }, (_, i) => createMockKline(105 + i, 95 + i, i));
    const result = calculateAO(klines, 3, 10);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(9);
  });
});
