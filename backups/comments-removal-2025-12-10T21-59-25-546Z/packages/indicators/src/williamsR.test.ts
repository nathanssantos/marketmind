import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateWilliamsR } from './williamsR';

const createMockKline = (high: number, low: number, close: number, index: number): Kline => ({
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

describe('calculateWilliamsR', () => {
  it('should return null values for insufficient data', () => {
    const klines = [
      createMockKline(105, 95, 100, 0),
      createMockKline(107, 97, 102, 1),
    ];

    const result = calculateWilliamsR(klines, 14);

    expect(result).toHaveLength(2);
    expect(result.every((v) => v === null)).toBe(true);
  });

  it('should return -100 when close is at lowest low', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKline(110, 90, 90, i));
    }

    const result = calculateWilliamsR(klines, 14);

    expect(result[result.length - 1]).toBe(-100);
  });

  it('should return close to 0 when close is at highest high', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKline(110, 90, 110, i));
    }

    const result = calculateWilliamsR(klines, 14);

    expect(result[result.length - 1]).toBeCloseTo(0, 5);
  });

  it('should return -50 when close is at midpoint', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKline(110, 90, 100, i));
    }

    const result = calculateWilliamsR(klines, 14);

    expect(result[result.length - 1]).toBe(-50);
  });

  it('should return values between -100 and 0', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 100 + Math.sin(i) * 10;
      klines.push(createMockKline(base + 5, base - 5, base, i));
    }

    const result = calculateWilliamsR(klines, 14);

    result.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(0);
      }
    });
  });

  it('should handle default period of 14', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 20; i++) {
      klines.push(createMockKline(110, 90, 100, i));
    }

    const result = calculateWilliamsR(klines);

    expect(result).toHaveLength(20);
    expect(result[12]).toBeNull();
    expect(result[13]).not.toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateWilliamsR([]);

    expect(result).toHaveLength(0);
  });

  it('should handle zero range (high equals low)', () => {
    const klines: Kline[] = [];
    for (let i = 0; i < 14; i++) {
      klines.push(createMockKline(100, 100, 100, i));
    }

    const result = calculateWilliamsR(klines, 14);

    expect(result[result.length - 1]).toBe(0);
  });
});
