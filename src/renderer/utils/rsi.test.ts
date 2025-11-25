import { describe, expect, it } from 'vitest';
import type { Candle } from '../../shared/types';
import { calculateRSI } from './rsi';

const createCandle = (close: number, index: number): Candle => ({
  timestamp: Date.now() + index * 60000,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

describe('calculateRSI', () => {
  it('should return null values for insufficient data', () => {
    const candles = [createCandle(100, 0), createCandle(101, 1)];
    const result = calculateRSI(candles, 2);

    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
  });

  it('should calculate RSI correctly for trending up data', () => {
    const candles = [
      createCandle(100, 0),
      createCandle(102, 1),
      createCandle(104, 2),
      createCandle(106, 3),
    ];
    const result = calculateRSI(candles, 2);

    expect(result.values[2]).toBeGreaterThan(50);
    expect(result.values[3]).toBeGreaterThan(50);
  });

  it('should calculate RSI correctly for trending down data', () => {
    const candles = [
      createCandle(100, 0),
      createCandle(98, 1),
      createCandle(96, 2),
      createCandle(94, 3),
    ];
    const result = calculateRSI(candles, 2);

    expect(result.values[2]).toBeLessThan(50);
    expect(result.values[3]).toBeLessThan(50);
  });

  it('should return 100 when there are only gains', () => {
    const candles = [
      createCandle(100, 0),
      createCandle(110, 1),
      createCandle(120, 2),
    ];
    const result = calculateRSI(candles, 2);

    expect(result.values[2]).toBe(100);
  });

  it('should handle mixed gains and losses', () => {
    const candles = [
      createCandle(100, 0),
      createCandle(105, 1),
      createCandle(102, 2),
      createCandle(107, 3),
    ];
    const result = calculateRSI(candles, 2);

    expect(result.values[2]).toBeGreaterThan(0);
    expect(result.values[2]).toBeLessThan(100);
    expect(result.values[3]).toBeGreaterThan(0);
    expect(result.values[3]).toBeLessThan(100);
  });

  it('should use default period of 2', () => {
    const candles = [
      createCandle(100, 0),
      createCandle(102, 1),
      createCandle(104, 2),
    ];
    const result = calculateRSI(candles);

    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).toBeGreaterThan(50);
  });

  it('should return empty array for empty input', () => {
    const result = calculateRSI([], 2);

    expect(result.values).toEqual([]);
  });
});
