import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateMassIndex } from './massIndex';

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

describe('calculateMassIndex', () => {
  it('should calculate Mass Index correctly', () => {
    const klines = Array.from({ length: 50 }, (_, i) =>
      createMockKline(105 + Math.sin(i * 0.2) * 5, 95 + Math.sin(i * 0.2) * 5, i),
    );
    const result = calculateMassIndex(klines);

    expect(result.values).toHaveLength(50);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 25 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateMassIndex(klines);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 25 and 9', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105 + i, 95 + i, i));
    const result = calculateMassIndex(klines);

    expect(result.values).toHaveLength(50);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBeGreaterThanOrEqual(32);
  });

  it('should handle empty array', () => {
    const result = calculateMassIndex([]);
    expect(result.values).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105, 95, i));
    expect(calculateMassIndex(klines, 0, 9).values).toEqual([]);
    expect(calculateMassIndex(klines, 25, 0).values).toEqual([]);
  });

  it('should return values near 25 for normal market', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateMassIndex(klines);

    const nonNullValues = result.values.filter((v) => v !== null) as number[];
    nonNullValues.forEach((value) => {
      expect(value).toBeGreaterThan(20);
      expect(value).toBeLessThan(30);
    });
  });

  it('should work with custom periods', () => {
    const klines = Array.from({ length: 30 }, (_, i) => createMockKline(105 + i, 95 + i, i));
    const result = calculateMassIndex(klines, 10, 5);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBeGreaterThanOrEqual(13);
  });

  it('should detect volatility expansion', () => {
    const klines: Kline[] = [];

    for (let i = 0; i < 35; i++) {
      klines.push(createMockKline(102, 98, i));
    }

    for (let i = 0; i < 15; i++) {
      const expansion = Math.min(i * 2, 10);
      klines.push(createMockKline(105 + expansion, 95 - expansion, 35 + i));
    }

    const result = calculateMassIndex(klines);

    const earlyValues = result.values.slice(33, 40).filter((v) => v !== null) as number[];
    const laterValues = result.values.slice(40).filter((v) => v !== null) as number[];

    if (earlyValues.length > 0 && laterValues.length > 0) {
      const earlyAvg = earlyValues.reduce((a, b) => a + b, 0) / earlyValues.length;
      const laterAvg = laterValues.reduce((a, b) => a + b, 0) / laterValues.length;

      expect(laterAvg).toBeGreaterThan(earlyAvg);
    }
  });
});
