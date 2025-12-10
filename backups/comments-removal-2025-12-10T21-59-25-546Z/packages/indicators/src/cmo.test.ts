import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateCMO } from './cmo';

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

describe('calculateCMO', () => {
  it('should calculate CMO correctly for upward trend', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(100 + i * 2, i));
    const result = calculateCMO(klines, 14);

    expect(result.values).toHaveLength(20);
    expect(result.values[13]).toBeNull();

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBe(100);
  });

  it('should calculate CMO correctly for downward trend', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(200 - i * 2, i));
    const result = calculateCMO(klines, 14);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBe(-100);
  });

  it('should return values between -100 and 100', () => {
    const klines = Array.from({ length: 30 }, (_, i) => createMockKline(100 + Math.sin(i) * 10, i));
    const result = calculateCMO(klines, 9);

    result.values.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    const result = calculateCMO(klines, 5);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 14', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateCMO(klines);

    expect(result.values).toHaveLength(20);
    expect(result.values[14]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateCMO([]);
    expect(result.values).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = [100, 105, 110].map((close, i) => createMockKline(close, i));
    expect(calculateCMO(klines, 0).values).toEqual([]);
    expect(calculateCMO(klines, -1).values).toEqual([]);
  });

  it('should return 0 for unchanged prices', () => {
    const klines = Array.from({ length: 10 }, (_, i) => createMockKline(100, i));
    const result = calculateCMO(klines, 5);

    const nonNullValues = result.values.filter((v) => v !== null);
    nonNullValues.forEach((value) => {
      expect(value).toBe(0);
    });
  });

  it('should handle mixed price movements', () => {
    const klines = [100, 105, 103, 108, 106, 110, 108, 112].map((close, i) =>
      createMockKline(close, i),
    );
    const result = calculateCMO(klines, 5);

    const nonNullValues = result.values.filter((v) => v !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
    nonNullValues.forEach((value) => {
      expect(Math.abs(value as number)).toBeLessThanOrEqual(100);
    });
  });
});
