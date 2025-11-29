import { describe, it, expect } from 'vitest';
import type { Candle } from '@shared/types';
import { calculateEMA, calculateSMA } from './ema';

const createCandle = (close: number, timestamp = Date.now()): Candle => ({
  timestamp,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

describe('calculateEMA', () => {
  it('should return empty array for empty input', () => {
    expect(calculateEMA([])).toEqual([]);
  });

  it('should return NaN values for initial period', () => {
    const candles = [
      createCandle(100),
      createCandle(101),
      createCandle(102),
    ];

    const ema = calculateEMA(candles, 9);
    expect(ema.length).toBe(3);
    expect(isNaN(ema[0]!)).toBe(true);
    expect(isNaN(ema[1]!)).toBe(true);
  });

  it('should calculate EMA correctly for valid period', () => {
    const candles = Array.from({ length: 20 }, (_, i) =>
      createCandle(100 + i),
    );

    const ema = calculateEMA(candles, 9);
    expect(ema.length).toBe(20);

    for (let i = 9; i < ema.length; i++) {
      expect(ema[i]).toBeGreaterThan(0);
      expect(isNaN(ema[i]!)).toBe(false);
    }
  });

  it('should show uptrend when prices are rising', () => {
    const candles = Array.from({ length: 15 }, (_, i) =>
      createCandle(100 + i * 2),
    );

    const ema = calculateEMA(candles, 9);

    for (let i = 10; i < ema.length; i++) {
      expect(ema[i]!).toBeGreaterThan(ema[i - 1]!);
    }
  });

  it('should handle period of 1', () => {
    const candles = [createCandle(100), createCandle(110), createCandle(105)];

    const ema = calculateEMA(candles, 1);
    expect(ema).toEqual([100, 110, 105]);
  });
});

describe('calculateSMA', () => {
  it('should return empty array for empty input', () => {
    expect(calculateSMA([], 20)).toEqual([]);
  });

  it('should return NaN for insufficient data', () => {
    const candles = [createCandle(100), createCandle(101)];
    const sma = calculateSMA(candles, 5);

    expect(sma.length).toBe(2);
    expect(isNaN(sma[0]!)).toBe(true);
    expect(isNaN(sma[1]!)).toBe(true);
  });

  it('should calculate SMA correctly', () => {
    const candles = [
      createCandle(100),
      createCandle(110),
      createCandle(120),
      createCandle(130),
      createCandle(140),
    ];

    const sma = calculateSMA(candles, 3);
    expect(sma.length).toBe(5);
    expect(isNaN(sma[0]!)).toBe(true);
    expect(isNaN(sma[1]!)).toBe(true);
    expect(sma[2]).toBeCloseTo(110);
    expect(sma[3]).toBeCloseTo(120);
    expect(sma[4]).toBeCloseTo(130);
  });

  it('should handle period equal to array length', () => {
    const candles = [
      createCandle(100),
      createCandle(110),
      createCandle(120),
    ];

    const sma = calculateSMA(candles, 3);
    expect(sma[2]).toBeCloseTo(110);
  });
});
