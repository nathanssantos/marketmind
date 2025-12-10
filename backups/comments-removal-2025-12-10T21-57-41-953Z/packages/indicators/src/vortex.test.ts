import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateVortex } from './vortex';

const createMockKline = (
  close: number,
  high: number,
  low: number,
  index: number,
): Kline => ({
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

describe('calculateVortex', () => {
  it('should calculate Vortex correctly for uptrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i * 2, 102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateVortex(klines);

    expect(result.viPlus).toHaveLength(25);
    expect(result.viMinus).toHaveLength(25);

    const lastViPlus = result.viPlus[result.viPlus.length - 1];
    const lastViMinus = result.viMinus[result.viMinus.length - 1];
    expect(lastViPlus).not.toBeNull();
    expect(lastViMinus).not.toBeNull();
    expect(lastViPlus).toBeGreaterThan(lastViMinus as number);
  });

  it('should calculate Vortex correctly for downtrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(200 - i * 2, 202 - i * 2, 198 - i * 2, i),
    );
    const result = calculateVortex(klines);

    const lastViPlus = result.viPlus[result.viPlus.length - 1];
    const lastViMinus = result.viMinus[result.viMinus.length - 1];
    expect(lastViMinus).toBeGreaterThan(lastViPlus as number);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateVortex(klines);

    expect(result.viPlus.every((v) => v === null)).toBe(true);
    expect(result.viMinus.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 14', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateVortex(klines);

    expect(result.viPlus).toHaveLength(25);

    const firstValidIndex = result.viPlus.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(14);
  });

  it('should handle empty array', () => {
    const result = calculateVortex([]);
    expect(result.viPlus).toEqual([]);
    expect(result.viMinus).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    expect(calculateVortex(klines, 0).viPlus).toEqual([]);
    expect(calculateVortex(klines, -1).viPlus).toEqual([]);
  });

  it('should return positive values', () => {
    const klines = Array.from({ length: 30 }, (_, i) => {
      const basePrice = 100 + Math.sin(i * 0.3) * 10;
      return createMockKline(basePrice, basePrice + 2, basePrice - 2, i);
    });
    const result = calculateVortex(klines);

    result.viPlus.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });

    result.viMinus.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
