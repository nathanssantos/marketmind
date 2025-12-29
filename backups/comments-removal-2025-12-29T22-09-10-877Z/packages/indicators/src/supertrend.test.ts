import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateSupertrend } from './supertrend';

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

describe('calculateSupertrend', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(99, 105, 95, 102, 0),
      createMockKline(102, 107, 97, 105, 1),
    ];

    const result = calculateSupertrend(klines, 10, 3);

    expect(result.trend).toHaveLength(2);
    expect(result.value).toHaveLength(2);
  });

  it('should detect uptrend in rising prices', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i * 3;
      klines.push(createMockKline(base, base + 5, base - 2, base + 3, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const lastTrend = result.trend[result.trend.length - 1];
    expect(lastTrend).toBe('up');
  });

  it('should detect downtrend in falling prices', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 200 - i * 3;
      klines.push(createMockKline(base, base + 2, base - 5, base - 3, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const lastTrend = result.trend[result.trend.length - 1];
    expect(lastTrend).toBe('down');
  });

  it('should return consistent trend values', () => {
    const klines: Kline[] = [];

    for (let i = 0; i < 25; i++) {
      const base = 100 + i * 2;
      klines.push(createMockKline(base, base + 3, base - 2, base + 1, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const validTrends = result.trend.filter((t) => t !== null);
    expect(validTrends.length).toBeGreaterThan(0);

    validTrends.forEach((trend) => {
      expect(['up', 'down']).toContain(trend);
    });
  });

  it('should return supertrend value', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base, base + 5, base - 3, base + 2, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const lastValue = result.value[result.value.length - 1];
    expect(lastValue).not.toBeNull();
    expect(typeof lastValue).toBe('number');
  });

  it('should handle default parameters', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 15; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base, base + 5, base - 3, base + 2, i));
    }

    const result = calculateSupertrend(klines);

    expect(result.trend).toHaveLength(15);
    expect(result.value).toHaveLength(15);
  });

  it('should handle empty array', () => {
    const result = calculateSupertrend([]);

    expect(result.trend).toHaveLength(0);
    expect(result.value).toHaveLength(0);
  });

  it('should have value below price in uptrend', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 100 + i * 3;
      klines.push(createMockKline(base, base + 5, base - 2, base + 3, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const uptrendIndices = result.trend
      .map((t, i) => ({ trend: t, index: i }))
      .filter((x) => x.trend === 'up' && result.value[x.index] !== null && !isNaN(result.value[x.index]!));

    if (uptrendIndices.length > 0) {
      const checkIndex = uptrendIndices[uptrendIndices.length - 1]!.index;
      const value = result.value[checkIndex]!;
      const close = parseFloat(klines[checkIndex]!.close);
      expect(value).toBeLessThan(close);
    }
  });

  it('should have value above price in downtrend', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 25; i++) {
      const base = 300 - i * 3;
      klines.push(createMockKline(base, base + 2, base - 5, base - 3, i));
    }

    const result = calculateSupertrend(klines, 10, 3);

    const downtrendIndices = result.trend
      .map((t, i) => ({ trend: t, index: i }))
      .filter((x) => x.trend === 'down' && result.value[x.index] !== null && !isNaN(result.value[x.index]!));

    if (downtrendIndices.length > 0) {
      const checkIndex = downtrendIndices[downtrendIndices.length - 1]!.index;
      const value = result.value[checkIndex]!;
      const close = parseFloat(klines[checkIndex]!.close);
      expect(value).toBeGreaterThan(close);
    }
  });
});
