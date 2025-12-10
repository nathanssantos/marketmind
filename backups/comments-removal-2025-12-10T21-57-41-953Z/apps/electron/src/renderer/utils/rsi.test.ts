import { describe, expect, it } from 'vitest';
import { calculateRSI } from './rsi';

const createKline = (close: number, index: number): Kline => ({
  openTime: Date.now() + index * 60000,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

describe('calculateRSI', () => {
  it('should return null values for insufficient data', () => {
    const klines = [createKline(100, 0), createKline(101, 1)];
    const result = calculateRSI(klines, 2);

    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
  });

  it('should calculate RSI correctly for trending up data', () => {
    const klines = [
      createKline(100, 0),
      createKline(102, 1),
      createKline(104, 2),
      createKline(106, 3),
    ];
    const result = calculateRSI(klines, 2);

    expect(result.values[2]).toBeGreaterThan(50);
    expect(result.values[3]).toBeGreaterThan(50);
  });

  it('should calculate RSI correctly for trending down data', () => {
    const klines = [
      createKline(100, 0),
      createKline(98, 1),
      createKline(96, 2),
      createKline(94, 3),
    ];
    const result = calculateRSI(klines, 2);

    expect(result.values[2]).toBeLessThan(50);
    expect(result.values[3]).toBeLessThan(50);
  });

  it('should return 100 when there are only gains', () => {
    const klines = [
      createKline(100, 0),
      createKline(110, 1),
      createKline(120, 2),
    ];
    const result = calculateRSI(klines, 2);

    expect(result.values[2]).toBe(100);
  });

  it('should handle mixed gains and losses', () => {
    const klines = [
      createKline(100, 0),
      createKline(105, 1),
      createKline(102, 2),
      createKline(107, 3),
    ];
    const result = calculateRSI(klines, 2);

    expect(result.values[2]).toBeGreaterThan(0);
    expect(result.values[2]).toBeLessThan(100);
    expect(result.values[3]).toBeGreaterThan(0);
    expect(result.values[3]).toBeLessThan(100);
  });

  it('should use default period of 2', () => {
    const klines = [
      createKline(100, 0),
      createKline(102, 1),
      createKline(104, 2),
    ];
    const result = calculateRSI(klines);

    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).toBeGreaterThan(50);
  });

  it('should return empty array for empty input', () => {
    const result = calculateRSI([], 2);

    expect(result.values).toEqual([]);
  });
});
