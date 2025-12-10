import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateDMI } from './dmi';

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

describe('calculateDMI', () => {
  it('should calculate DMI correctly for uptrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i * 2, 102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateDMI(klines);

    expect(result.plusDI).toHaveLength(25);
    expect(result.minusDI).toHaveLength(25);
    expect(result.dx).toHaveLength(25);

    const lastPlusDI = result.plusDI[result.plusDI.length - 1];
    const lastMinusDI = result.minusDI[result.minusDI.length - 1];
    expect(lastPlusDI).not.toBeNull();
    expect(lastMinusDI).not.toBeNull();
    expect(lastPlusDI).toBeGreaterThan(lastMinusDI as number);
  });

  it('should calculate DMI correctly for downtrend', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(200 - i * 2, 202 - i * 2, 198 - i * 2, i),
    );
    const result = calculateDMI(klines);

    const lastPlusDI = result.plusDI[result.plusDI.length - 1];
    const lastMinusDI = result.minusDI[result.minusDI.length - 1];
    expect(lastMinusDI).toBeGreaterThan(lastPlusDI as number);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateDMI(klines);

    expect(result.plusDI.every((v) => v === null)).toBe(true);
    expect(result.minusDI.every((v) => v === null)).toBe(true);
    expect(result.dx.every((v) => v === null)).toBe(true);
  });

  it('should handle default period of 14', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    const result = calculateDMI(klines);

    expect(result.plusDI).toHaveLength(25);

    const firstValidIndex = result.plusDI.findIndex((v) => v !== null);
    expect(firstValidIndex).toBe(14);
  });

  it('should handle empty array', () => {
    const result = calculateDMI([]);
    expect(result.plusDI).toEqual([]);
    expect(result.minusDI).toEqual([]);
    expect(result.dx).toEqual([]);
  });

  it('should handle period <= 0', () => {
    const klines = Array.from({ length: 25 }, (_, i) =>
      createMockKline(100 + i, 102 + i, 98 + i, i),
    );
    expect(calculateDMI(klines, 0).plusDI).toEqual([]);
    expect(calculateDMI(klines, -1).plusDI).toEqual([]);
  });

  it('should return values between 0 and 100', () => {
    const klines = Array.from({ length: 40 }, (_, i) => {
      const basePrice = 100 + Math.sin(i * 0.3) * 10;
      return createMockKline(basePrice, basePrice + 2, basePrice - 2, i);
    });
    const result = calculateDMI(klines);

    result.plusDI.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    result.minusDI.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    result.dx.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });
});
