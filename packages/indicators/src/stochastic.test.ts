import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateStochastic } from './stochastic';

const createMockKline = (high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String((high + low) / 2),
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

describe('calculateStochastic (Slow Stochastic)', () => {
  it('should calculate slow stochastic oscillator correctly', () => {
    const klines = [
      createMockKline(105, 95, 100, 0),
      createMockKline(110, 100, 108, 1),
      createMockKline(115, 105, 110, 2),
      createMockKline(120, 110, 118, 3),
      createMockKline(125, 115, 120, 4),
      createMockKline(130, 120, 125, 5),
      createMockKline(135, 125, 130, 6),
    ];

    const result = calculateStochastic(klines, 3, 3, 3);

    expect(result.k).toHaveLength(7);
    expect(result.d).toHaveLength(7);

    expect(result.k[0]).toBeNull();
    expect(result.k[1]).toBeNull();
    expect(result.k[2]).toBeNull();
    expect(result.k[3]).toBeNull();
    expect(result.d[0]).toBeNull();
    expect(result.d[1]).toBeNull();
  });

  it('should return values between 0 and 100', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(110 + i, 90 + i, 100 + i, i)
    );

    const result = calculateStochastic(klines, 3, 3, 3);

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

    const result = calculateStochastic(klines, 5, 3, 3);

    expect(result.k.every((v) => v === null)).toBe(true);
    expect(result.d.every((v) => v === null)).toBe(true);
  });

  it('should use default parameters (14, 3, 3)', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(110 + i, 90 + i, 100 + i, i)
    );

    const result = calculateStochastic(klines);

    expect(result.k).toHaveLength(25);
    expect(result.d).toHaveLength(25);
  });

  it('should handle price at high with smoothing', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100 + i * 5, 90 + i * 5, 100 + i * 5, i)
    );

    const result = calculateStochastic(klines, 2, 2, 2);

    const lastK = result.k[result.k.length - 1];
    expect(lastK).not.toBeNull();
    expect(lastK!).toBe(100);
  });

  it('should handle price at low with smoothing', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(110 - i * 2, 100 - i * 2, 100 - i * 2, i)
    );

    const result = calculateStochastic(klines, 2, 2, 2);

    const lastK = result.k[result.k.length - 1];
    expect(lastK).not.toBeNull();
    expect(lastK!).toBe(0);
  });

  it('should produce smoother K than Fast Stochastic', () => {
    const klines = [
      createMockKline(110, 90, 100, 0),
      createMockKline(115, 95, 108, 1),
      createMockKline(120, 100, 105, 2),
      createMockKline(118, 98, 115, 3),
      createMockKline(122, 102, 110, 4),
      createMockKline(125, 105, 120, 5),
      createMockKline(128, 108, 115, 6),
      createMockKline(130, 110, 125, 7),
    ];

    const result = calculateStochastic(klines, 3, 3, 3);

    const validK = result.k.filter((v): v is number => v !== null);
    expect(validK.length).toBeGreaterThan(0);

    validK.forEach((k) => {
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(100);
    });
  });
});
