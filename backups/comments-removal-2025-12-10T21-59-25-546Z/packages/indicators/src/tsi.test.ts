import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateTSI } from './tsi';

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

describe('calculateTSI', () => {
  it('should calculate TSI correctly for uptrend', () => {
    const klines = Array.from({ length: 60 }, (_, i) => createMockKline(100 + i * 2, i));
    const result = calculateTSI(klines);

    expect(result.tsi).toHaveLength(60);
    expect(result.signal).toHaveLength(60);

    const lastTSI = result.tsi[result.tsi.length - 1];
    expect(lastTSI).not.toBeNull();
    expect(lastTSI).toBeGreaterThan(0);
  });

  it('should calculate TSI correctly for downtrend', () => {
    const klines = Array.from({ length: 60 }, (_, i) => createMockKline(200 - i * 2, i));
    const result = calculateTSI(klines);

    const lastTSI = result.tsi[result.tsi.length - 1];
    expect(lastTSI).not.toBeNull();
    expect(lastTSI).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateTSI(klines);

    expect(result.tsi.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 25, 13, 13', () => {
    const klines = Array.from({ length: 60 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateTSI(klines);

    expect(result.tsi).toHaveLength(60);

    const firstTSIIndex = result.tsi.findIndex((v) => v !== null);
    expect(firstTSIIndex).toBeGreaterThanOrEqual(36);
  });

  it('should handle empty array', () => {
    const result = calculateTSI([]);
    expect(result.tsi).toEqual([]);
    expect(result.signal).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 60 }, (_, i) => createMockKline(100 + i, i));
    expect(calculateTSI(klines, 0, 13, 13).tsi).toEqual([]);
    expect(calculateTSI(klines, 25, 0, 13).tsi).toEqual([]);
    expect(calculateTSI(klines, 25, 13, 0).tsi).toEqual([]);
  });

  it('should return values between -100 and 100', () => {
    const klines = Array.from({ length: 80 }, (_, i) =>
      createMockKline(100 + Math.sin(i * 0.5) * 20, i),
    );
    const result = calculateTSI(klines);

    result.tsi.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(-100);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should work with custom periods', () => {
    const klines = Array.from({ length: 40 }, (_, i) => createMockKline(100 + i, i));
    const result = calculateTSI(klines, 10, 5, 5);

    const firstTSIIndex = result.tsi.findIndex((v) => v !== null);
    expect(firstTSIIndex).toBe(14);
  });
});
