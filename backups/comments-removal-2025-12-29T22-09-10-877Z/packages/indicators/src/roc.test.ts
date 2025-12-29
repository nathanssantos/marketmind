import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateMomentum, calculateROC } from './roc';

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

describe('calculateROC', () => {
  it('should calculate ROC correctly for upward trend', () => {
    const klines = [100, 105, 110, 115, 120, 125].map((close, i) => createMockKline(close, i));
    const result = calculateROC(klines, 3);

    expect(result.values).toHaveLength(6);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).toBeNull();
    expect(result.values[3]).toBeCloseTo(15, 1);
    expect(result.values[4]).toBeCloseTo(14.29, 1);
    expect(result.values[5]).toBeCloseTo(13.64, 1);
  });

  it('should calculate ROC correctly for downward trend', () => {
    const klines = [120, 115, 110, 105, 100].map((close, i) => createMockKline(close, i));
    const result = calculateROC(klines, 2);

    expect(result.values).toHaveLength(5);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    const thirdValue = result.values[2];
    expect(thirdValue).not.toBeNull();
    expect(thirdValue).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105].map((close, i) => createMockKline(close, i));
    const result = calculateROC(klines, 3);

    expect(result.values).toEqual([null, null]);
  });

  it('should handle default period of 12', () => {
    const klines = Array.from({ length: 15 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateROC(klines);

    expect(result.values).toHaveLength(15);
    for (let i = 0; i < 12; i++) {
      expect(result.values[i]).toBeNull();
    }
    expect(result.values[12]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateROC([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    expect(calculateROC(klines, 0).values).toEqual([]);
    expect(calculateROC(klines, -1).values).toEqual([]);
  });

  it('should return 0 for unchanged prices', () => {
    const klines = [100, 100, 100, 100, 100].map((close, i) => createMockKline(close, i));
    const result = calculateROC(klines, 2);

    const nonNullValues = result.values.filter((v) => v !== null);
    nonNullValues.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });

  it('should calculate 100% gain correctly', () => {
    const klines = [50, 60, 70, 80, 100].map((close, i) => createMockKline(close, i));
    const result = calculateROC(klines, 4);

    expect(result.values[4]).toBeCloseTo(100, 1);
  });
});

describe('calculateMomentum', () => {
  it('should calculate momentum (price difference) correctly', () => {
    const klines = [100, 105, 110, 115, 120].map((close, i) => createMockKline(close, i));
    const result = calculateMomentum(klines, 2);

    expect(result).toHaveLength(5);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(10);
    expect(result[3]).toBe(10);
    expect(result[4]).toBe(10);
  });

  it('should handle downward trend', () => {
    const klines = [120, 115, 110, 105, 100].map((close, i) => createMockKline(close, i));
    const result = calculateMomentum(klines, 2);

    expect(result[2]).toBe(-10);
    expect(result[3]).toBe(-10);
    expect(result[4]).toBe(-10);
  });

  it('should return empty array for empty input', () => {
    const result = calculateMomentum([]);
    expect(result).toEqual([]);
  });
});
