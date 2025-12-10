import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateMFI } from './mfi';

const createMockKline = (high: number, low: number, close: number, volume: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: String(volume),
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateMFI', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(105, 95, 100, 1000, 0),
      createMockKline(107, 97, 102, 1500, 1),
    ];

    const result = calculateMFI(klines, 14);

    expect(result).toHaveLength(2);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('should return 100 when all price movements are positive', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 16; i++) {
      const base = 100 + i * 2;
      klines.push(createMockKline(base + 3, base - 3, base, 1000, i));
    }

    const result = calculateMFI(klines, 14);

    expect(result[result.length - 1]).toBe(100);
  });

  it('should return 0 when all price movements are negative', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 16; i++) {
      const base = 200 - i * 2;
      klines.push(createMockKline(base + 3, base - 3, base, 1000, i));
    }

    const result = calculateMFI(klines, 14);

    expect(result[result.length - 1]).toBe(0);
  });

  it('should return values between 0 and 100', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + Math.sin(i) * 10;
      klines.push(createMockKline(base + 3, base - 3, base, 1000, i));
    }

    const result = calculateMFI(klines, 14);

    result.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should handle default period of 14', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + i;
      klines.push(createMockKline(base + 3, base - 3, base, 1000, i));
    }

    const result = calculateMFI(klines);

    expect(result).toHaveLength(20);
    expect(result[13]).toBeNull();
    expect(result[14]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateMFI([]);

    expect(result).toHaveLength(0);
  });

  it('should consider volume in calculation', () => {
    const klines1: Kline[] = [];
    const klines2: Kline[] = [];

    for (let i = 0; i < 16; i++) {
      const base = 100 + (i % 2 === 0 ? 2 : -2);
      klines1.push(createMockKline(base + 3, base - 3, base, 1000, i));
      klines2.push(createMockKline(base + 3, base - 3, base, i % 2 === 0 ? 5000 : 1000, i));
    }

    const result1 = calculateMFI(klines1, 14);
    const result2 = calculateMFI(klines2, 14);

    expect(result1[result1.length - 1]).not.toEqual(result2[result2.length - 1]);
  });

  it('should handle mixed price movements', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + (i % 3 === 0 ? 5 : i % 3 === 1 ? -3 : 0);
      klines.push(createMockKline(base + 3, base - 3, base, 1000 + i * 100, i));
    }

    const result = calculateMFI(klines, 14);

    const validValues = result.filter((v) => v !== null);
    expect(validValues.length).toBeGreaterThan(0);
    validValues.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
