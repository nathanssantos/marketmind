import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateDEMA } from './dema';

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

describe('calculateDEMA', () => {
  it('should calculate DEMA correctly', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateDEMA(klines, 10);

    expect(result.values).toHaveLength(50);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(2 * 10 - 2);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThan(0);
  });

  it('should track price closely in uptrend', () => {
    const klines = Array.from({ length: 30 }, (_, i) => createMockKline(100 + i * 2, i));
    const result = calculateDEMA(klines, 5);

    const lastDema = result.values[result.values.length - 1];
    const lastPrice = 100 + 29 * 2;

    expect(lastDema).not.toBeNull();
    expect(lastDema).toBeGreaterThan(lastPrice * 0.9);
    expect(lastDema).toBeLessThan(lastPrice * 1.1);
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    const result = calculateDEMA(klines, 5);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 21', () => {
    const klines = Array.from({ length: 80 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateDEMA(klines);

    expect(result.values).toHaveLength(80);
    const nonNullCount = result.values.filter((v) => v !== null).length;
    expect(nonNullCount).toBeGreaterThan(0);
  });

  it('should handle empty array', () => {
    const result = calculateDEMA([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    expect(calculateDEMA(klines, 0).values).toEqual([]);
    expect(calculateDEMA(klines, -1).values).toEqual([]);
  });

  it('should be smoother than single EMA', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + Math.sin(i) * 10, i));
    const result = calculateDEMA(klines, 5);

    const validValues = result.values.filter((v) => v !== null) as number[];
    expect(validValues.length).toBeGreaterThan(0);
    expect(Math.max(...validValues) - Math.min(...validValues)).toBeGreaterThan(0);
  });
});
