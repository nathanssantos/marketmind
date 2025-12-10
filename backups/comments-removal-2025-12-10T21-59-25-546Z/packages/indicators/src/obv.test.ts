import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateOBV } from './obv';

const createMockKline = (close: number, volume: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close - 1),
  high: String(close + 1),
  low: String(close - 2),
  close: String(close),
  volume: String(volume),
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateOBV', () => {
  it('should calculate OBV correctly for price increases', () => {
    const klines = [
      createMockKline(100, 1000, 0),
      createMockKline(105, 1500, 1),
      createMockKline(110, 2000, 2),
    ];

    const result = calculateOBV(klines);

    expect(result.values).toHaveLength(3);
    expect(result.values[0]).toBe(1000);
    expect(result.values[1]).toBe(2500);
    expect(result.values[2]).toBe(4500);
  });

  it('should calculate OBV correctly for price decreases', () => {
    const klines = [
      createMockKline(110, 1000, 0),
      createMockKline(105, 1500, 1),
      createMockKline(100, 2000, 2),
    ];

    const result = calculateOBV(klines);

    expect(result.values).toHaveLength(3);
    expect(result.values[0]).toBe(1000);
    expect(result.values[1]).toBe(-500);
    expect(result.values[2]).toBe(-2500);
  });

  it('should not change OBV when price is unchanged', () => {
    const klines = [
      createMockKline(100, 1000, 0),
      createMockKline(100, 2000, 1),
      createMockKline(100, 3000, 2),
    ];

    const result = calculateOBV(klines);

    expect(result.values).toHaveLength(3);
    expect(result.values[0]).toBe(1000);
    expect(result.values[1]).toBe(1000);
    expect(result.values[2]).toBe(1000);
  });

  it('should calculate SMA of OBV when period is provided', () => {
    const klines = [
      createMockKline(100, 1000, 0),
      createMockKline(105, 1000, 1),
      createMockKline(110, 1000, 2),
      createMockKline(115, 1000, 3),
    ];

    const result = calculateOBV(klines, 3);

    expect(result.sma).toHaveLength(4);
    expect(result.sma[0]).toBeNull();
    expect(result.sma[1]).toBeNull();
    expect(result.sma[2]).not.toBeNull();
    expect(result.sma[3]).not.toBeNull();
  });

  it('should return empty arrays for empty input', () => {
    const result = calculateOBV([]);

    expect(result.values).toHaveLength(0);
    expect(result.sma).toHaveLength(0);
  });

  it('should return empty SMA array when no period provided', () => {
    const klines = [
      createMockKline(100, 1000, 0),
      createMockKline(105, 1500, 1),
    ];

    const result = calculateOBV(klines);

    expect(result.sma).toHaveLength(0);
  });

  it('should handle mixed price movements', () => {
    const klines = [
      createMockKline(100, 1000, 0),
      createMockKline(110, 2000, 1),
      createMockKline(105, 1500, 2),
      createMockKline(108, 1000, 3),
    ];

    const result = calculateOBV(klines);

    expect(result.values).toHaveLength(4);
    expect(result.values[0]).toBe(1000);
    expect(result.values[1]).toBe(3000);
    expect(result.values[2]).toBe(1500);
    expect(result.values[3]).toBe(2500);
  });
});
