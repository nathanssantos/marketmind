import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateKeltner } from './keltner';

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

describe('calculateKeltner', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(99, 105, 95, 102, 0),
      createMockKline(102, 107, 97, 105, 1),
    ];

    const result = calculateKeltner(klines, 20, 10, 2);

    expect(result.upper).toHaveLength(2);
    expect(result.middle).toHaveLength(2);
    expect(result.lower).toHaveLength(2);
    expect(result.upper.every((v) => v === null)).toBe(true);
  });

  it('should calculate Keltner channels correctly', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100;
      klines.push(createMockKline(base, base + 5, base - 5, base, i));
    }

    const result = calculateKeltner(klines, 20, 10, 2);

    const lastIndex = result.upper.length - 1;
    expect(result.middle[lastIndex]).not.toBeNull();
    expect(result.upper[lastIndex]).not.toBeNull();
    expect(result.lower[lastIndex]).not.toBeNull();

    expect(result.upper[lastIndex]!).toBeGreaterThan(result.middle[lastIndex]!);
    expect(result.lower[lastIndex]!).toBeLessThan(result.middle[lastIndex]!);
  });

  it('should have symmetric bands around middle', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100;
      klines.push(createMockKline(base, base + 5, base - 5, base, i));
    }

    const result = calculateKeltner(klines, 20, 10, 2);

    const lastIndex = result.upper.length - 1;
    const middle = result.middle[lastIndex]!;
    const upperDiff = result.upper[lastIndex]! - middle;
    const lowerDiff = middle - result.lower[lastIndex]!;

    expect(Math.abs(upperDiff - lowerDiff)).toBeLessThan(0.0001);
  });

  it('should handle default parameters', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100 + i * 0.5;
      klines.push(createMockKline(base, base + 5, base - 5, base, i));
    }

    const result = calculateKeltner(klines);

    expect(result.upper).toHaveLength(25);
    expect(result.middle).toHaveLength(25);
    expect(result.lower).toHaveLength(25);
  });

  it('should handle empty array', () => {
    const result = calculateKeltner([]);

    expect(result.upper).toHaveLength(0);
    expect(result.middle).toHaveLength(0);
    expect(result.lower).toHaveLength(0);
  });

  it('should widen bands with higher multiplier', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100;
      klines.push(createMockKline(base, base + 5, base - 5, base, i));
    }

    const result1 = calculateKeltner(klines, 20, 10, 1);
    const result2 = calculateKeltner(klines, 20, 10, 3);

    const lastIndex = result1.upper.length - 1;
    const width1 = result1.upper[lastIndex]! - result1.lower[lastIndex]!;
    const width2 = result2.upper[lastIndex]! - result2.lower[lastIndex]!;

    expect(width2).toBeGreaterThan(width1);
  });

  it('should use EMA as middle band', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base, base + 5, base - 5, base, i));
    }

    const result = calculateKeltner(klines, 20, 10, 2);

    const validMiddles = result.middle.filter((v) => v !== null);
    expect(validMiddles.length).toBeGreaterThan(0);

    validMiddles.forEach((v) => {
      expect(v).toBeGreaterThan(100);
    });
  });
});
