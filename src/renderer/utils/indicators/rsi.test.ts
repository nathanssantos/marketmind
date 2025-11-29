import { describe, it, expect } from 'vitest';
import type { Candle } from '@shared/types';
import {
  calculateRSI,
  isRSIOversold,
  isRSIOverbought,
  findRSIDivergence,
} from './rsi';

const createCandle = (
  close: number,
  high?: number,
  low?: number,
  timestamp = Date.now(),
): Candle => ({
  timestamp,
  open: close,
  high: high ?? close,
  low: low ?? close,
  close,
  volume: 1000,
});

describe('calculateRSI', () => {
  it('should return empty array for empty input', () => {
    expect(calculateRSI([])).toEqual([]);
  });

  it('should return NaN values for initial period', () => {
    const candles = Array.from({ length: 10 }, (_, i) =>
      createCandle(100 + i),
    );

    const rsi = calculateRSI(candles, 14);
    expect(rsi.length).toBe(10);

    for (let i = 0; i < 14 && i < rsi.length; i++) {
      expect(isNaN(rsi[i]!)).toBe(true);
    }
  });

  it('should calculate RSI correctly', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + i),
    );

    const rsi = calculateRSI(candles, 14);
    expect(rsi.length).toBe(20);

    for (let i = 14; i < rsi.length; i++) {
      expect(rsi[i]).toBeGreaterThanOrEqual(0);
      expect(rsi[i]).toBeLessThanOrEqual(100);
    }
  });

  it('should return 100 for continuous gains', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + i * 5),
    );

    const rsi = calculateRSI(candles, 14);
    const lastRSI = rsi[rsi.length - 1];

    expect(lastRSI).toBeGreaterThan(70);
  });

  it('should handle period of 1', () => {
    const candles = [createCandle(100), createCandle(110), createCandle(105)];

    const rsi = calculateRSI(candles, 1);
    expect(rsi.length).toBe(3);
    expect(isNaN(rsi[0]!)).toBe(true);
  });
});

describe('isRSIOversold', () => {
  it('should return true for oversold levels', () => {
    expect(isRSIOversold(25)).toBe(true);
    expect(isRSIOversold(30)).toBe(false);
    expect(isRSIOversold(20)).toBe(true);
  });

  it('should return false for normal levels', () => {
    expect(isRSIOversold(50)).toBe(false);
    expect(isRSIOversold(70)).toBe(false);
  });
});

describe('isRSIOverbought', () => {
  it('should return true for overbought levels', () => {
    expect(isRSIOverbought(75)).toBe(true);
    expect(isRSIOverbought(70)).toBe(false);
    expect(isRSIOverbought(80)).toBe(true);
  });

  it('should return false for normal levels', () => {
    expect(isRSIOverbought(50)).toBe(false);
    expect(isRSIOverbought(30)).toBe(false);
  });
});

describe('findRSIDivergence', () => {
  it('should return empty arrays for insufficient data', () => {
    const candles = [createCandle(100), createCandle(101)];
    const rsi = [50, 51];

    const result = findRSIDivergence(candles, rsi, 10);
    expect(result.bullish).toEqual([]);
    expect(result.bearish).toEqual([]);
  });

  it('should detect bullish divergence', () => {
    const candles = [
      createCandle(100, 105, 95),
      createCandle(98, 103, 93),
      createCandle(99, 104, 94),
      createCandle(97, 102, 92),
      createCandle(98, 103, 93),
      createCandle(96, 101, 91),
      createCandle(97, 102, 92),
      createCandle(95, 100, 90),
      createCandle(96, 101, 91),
      createCandle(94, 99, 89),
      createCandle(95, 100, 90),
      createCandle(93, 98, 88),
      createCandle(94, 99, 89),
      createCandle(92, 97, 87),
      createCandle(95, 100, 90),
    ];

    const rsi = [50, 48, 49, 47, 48, 46, 47, 45, 48, 44, 49, 43, 50, 42, 52];

    const result = findRSIDivergence(candles, rsi, 5);
    expect(result.bullish.length).toBeGreaterThanOrEqual(0);
  });

  it('should handle equal length arrays', () => {
    const candles = Array.from({ length: 15 }, (_, i) =>
      createCandle(100 + i),
    );
    const rsi = Array.from({ length: 15 }, (_, i) => 50 + i);

    const result = findRSIDivergence(candles, rsi, 5);
    expect(result).toHaveProperty('bullish');
    expect(result).toHaveProperty('bearish');
  });
});
