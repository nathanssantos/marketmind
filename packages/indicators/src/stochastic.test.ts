import { describe, it, expect } from 'vitest';
import { calculateStochastic } from './stochastic';
import type { Kline } from '@marketmind/types';

const createMockKline = (high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1),
  open: (high + low) / 2,
  high,
  low,
  close,
  volume: 1000,
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59),
  quoteVolume: 1000000,
  trades: 100,
  takerBuyBaseVolume: 500,
  takerBuyQuoteVolume: 500000,
});

describe('calculateStochastic', () => {
  it('should calculate stochastic oscillator correctly', () => {
    const klines = [
      createMockKline(105, 95, 100, 0),
      createMockKline(110, 100, 108, 1),
      createMockKline(115, 105, 110, 2),
      createMockKline(120, 110, 118, 3),
      createMockKline(125, 115, 120, 4),
    ];

    const result = calculateStochastic(klines, 3, 3);

    expect(result.k).toHaveLength(5);
    expect(result.d).toHaveLength(5);
    
    // First values should be null (not enough data)
    expect(result.k[0]).toBeNull();
    expect(result.k[1]).toBeNull();
    expect(result.d[0]).toBeNull();
    expect(result.d[1]).toBeNull();
  });

  it('should return values between 0 and 100', () => {
    const klines = [
      createMockKline(110, 90, 100, 0),
      createMockKline(115, 95, 105, 1),
      createMockKline(120, 100, 110, 2),
      createMockKline(125, 105, 115, 3),
      createMockKline(130, 110, 120, 4),
    ];

    const result = calculateStochastic(klines, 3, 3);

    result.k.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    result.d.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should return null for insufficient data', () => {
    const klines = [
      createMockKline(105, 95, 100, 0),
      createMockKline(110, 100, 105, 1),
    ];

    const result = calculateStochastic(klines, 5, 3);

    expect(result.k.every((v) => v === null)).toBe(true);
    expect(result.d.every((v) => v === null)).toBe(true);
  });

  it('should use default parameters', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(110 + i, 90 + i, 100 + i, i)
    );

    const result = calculateStochastic(klines);

    expect(result.k).toHaveLength(20);
    expect(result.d).toHaveLength(20);
  });

  it('should handle price at high', () => {
    const klines = [
      createMockKline(100, 90, 100, 0),
      createMockKline(105, 95, 105, 1),
      createMockKline(110, 100, 110, 2),
    ];

    const result = calculateStochastic(klines, 2, 2);
    
    // When close equals high, %K should be 100
    const lastK = result.k[result.k.length - 1];
    expect(lastK).toBe(100);
  });

  it('should handle price at low', () => {
    // Create klines where close is at the lowest point of the range
    const klines = [
      createMockKline(105, 100, 100, 0), // close at low
      createMockKline(110, 100, 100, 1), // close at low of period
    ];

    const result = calculateStochastic(klines, 2, 2);
    
    // When close is consistently at low, %K should be 0
    const lastK = result.k[result.k.length - 1];
    expect(lastK).toBe(0);
  });
});
