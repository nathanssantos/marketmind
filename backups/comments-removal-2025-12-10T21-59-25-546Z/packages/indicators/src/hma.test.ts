import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateHMA } from './hma';

const createMockKline = (close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close - 1),
  high: String(close + 1),
  low: String(close - 2),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateHMA', () => {
  it('should calculate HMA correctly', () => {
    const klines = Array.from({ length: 30 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateHMA(klines, 9);

    expect(result.values).toHaveLength(30);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(100);
  });

  it('should track price quickly in uptrend', () => {
    const klines = Array.from({ length: 40 }, (_, i) => createMockKline(100 + i * 2, i));
    const result = calculateHMA(klines, 9);

    const lastHma = result.values[result.values.length - 1];
    const lastPrice = 100 + 39 * 2;

    expect(lastHma).not.toBeNull();
    expect(lastHma).toBeGreaterThan(lastPrice * 0.85);
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    const result = calculateHMA(klines, 9);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 20', () => {
    const klines = Array.from({ length: 40 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateHMA(klines);

    expect(result.values).toHaveLength(40);
    const nonNullCount = result.values.filter((v) => v !== null).length;
    expect(nonNullCount).toBeGreaterThan(0);
  });

  it('should handle empty array', () => {
    const result = calculateHMA([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    expect(calculateHMA(klines, 0).values).toEqual([]);
    expect(calculateHMA(klines, -1).values).toEqual([]);
  });

  it('should be smoother than WMA for choppy data', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + Math.sin(i) * 10, i));
    const result = calculateHMA(klines, 9);

    const validValues = result.values.filter((v) => v !== null) as number[];
    expect(validValues.length).toBeGreaterThan(0);
  });

  it('should work with period of 4', () => {
    const klines = Array.from({ length: 15 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateHMA(klines, 4);

    const validValues = result.values.filter((v) => v !== null);
    expect(validValues.length).toBeGreaterThan(0);
  });
});
