import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateUltimateOscillator } from './ultimateOscillator';

const createMockKline = (close: number, high: number, low: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
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

describe('calculateUltimateOscillator', () => {
  it('should calculate Ultimate Oscillator correctly for uptrend (close near high)', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const basePrice = 100 + i * 2;
      return createMockKline(basePrice + 1.5, basePrice + 2, basePrice - 2, i);
    });
    const result = calculateUltimateOscillator(klines);

    expect(result.values).toHaveLength(40);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeGreaterThanOrEqual(50);
  });

  it('should calculate Ultimate Oscillator correctly for downtrend (close near low)', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const basePrice = 200 - i * 2;
      return createMockKline(basePrice - 1.5, basePrice + 2, basePrice - 2, i);
    });
    const result = calculateUltimateOscillator(klines);

    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).not.toBeNull();
    expect(lastValue).toBeLessThanOrEqual(50);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateUltimateOscillator(klines);

    expect(result.values.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 7, 14, 28', () => {
    const klines = Array.from({ length: 40 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateUltimateOscillator(klines);

    expect(result.values).toHaveLength(40);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(28);
  });

  it('should handle empty array', () => {
    const result = calculateUltimateOscillator([]);
    expect(result.values).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 40 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    expect(calculateUltimateOscillator(klines, 0, 14, 28).values).toEqual([]);
    expect(calculateUltimateOscillator(klines, 7, 0, 28).values).toEqual([]);
    expect(calculateUltimateOscillator(klines, 7, 14, 0).values).toEqual([]);
  });

  it('should return values between 0 and 100', () => {
    const klines = Array.from({ length: 60 }, (_, i) => {
      const price = 100 + Math.sin(i * 0.3) * 20;
      return createMockKline(price, price + 2, price - 2, i);
    });
    const result = calculateUltimateOscillator(klines);

    result.values.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should work with custom periods and weights', () => {
    const klines = Array.from({ length: 30 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateUltimateOscillator(klines, 5, 10, 15, 3, 2, 1);

    const firstValidIndex = result.values.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(15);
  });
});
