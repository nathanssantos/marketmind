import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateWMA, calculateWMAFromValues } from './wma';

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

describe('calculateWMA', () => {
  it('should calculate WMA correctly', () => {
    const klines = [10, 11, 12, 13, 14].map((close, i) => createMockKline(close, i));
    const result = calculateWMA(klines, 5);

    expect(result.values).toHaveLength(5);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).toBeNull();
    expect(result.values[3]).toBeNull();
    const lastValue = result.values[4];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeCloseTo(12.67, 1);
  });

  it('should weight recent prices more heavily', () => {
    const klines = [100, 100, 100, 100, 200].map((close, i) => createMockKline(close, i));
    const result = calculateWMA(klines, 5);

    const wma = result.values[4];
    expect(wma).not.toBeNull();
    expect(wma).toBeGreaterThan(120);
    expect(wma).toBeLessThan(200);
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    const result = calculateWMA(klines, 5);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 20', () => {
    const klines = Array.from({ length: 25 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateWMA(klines);

    expect(result.values).toHaveLength(25);
    expect(result.values[18]).toBeNull();
    expect(result.values[19]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateWMA([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    expect(calculateWMA(klines, 0).values).toEqual([]);
    expect(calculateWMA(klines, -1).values).toEqual([]);
  });

  it('should calculate WMA for period of 3', () => {
    const klines = [1, 2, 3, 4, 5].map((close, i) => createMockKline(close, i));
    const result = calculateWMA(klines, 3);

    expect(result.values[2]).toBeCloseTo(2.33, 1);
    expect(result.values[3]).toBeCloseTo(3.33, 1);
    expect(result.values[4]).toBeCloseTo(4.33, 1);
  });
});

describe('calculateWMAFromValues', () => {
  it('should calculate WMA from numeric array', () => {
    const values = [10, 11, 12, 13, 14];
    const result = calculateWMAFromValues(values, 5);

    expect(result).toHaveLength(5);
    expect(result[4]).toBeCloseTo(12.67, 1);
  });

  it('should return empty array for empty input', () => {
    const result = calculateWMAFromValues([], 5);
    expect(result).toEqual([]);
  });

  it('should return empty array for period <= 0', () => {
    expect(calculateWMAFromValues([1, 2, 3], 0)).toEqual([]);
    expect(calculateWMAFromValues([1, 2, 3], -1)).toEqual([]);
  });
});
