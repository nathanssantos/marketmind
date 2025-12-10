import { describe, it, expect } from 'vitest';
import { calculateIBS } from './ibs';
import type { Kline } from '@marketmind/types';

const createKline = (open: number, high: number, low: number, close: number): Kline => ({
  openTime: Date.now(),
  open: String(open),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: Date.now(),
  quoteVolume: '100000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '50000',
});

describe('calculateIBS', () => {
  it('should return IBS = 1 when close equals high', () => {
    const klines = [createKline(100, 110, 90, 110)];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBe(1);
  });

  it('should return IBS = 0 when close equals low', () => {
    const klines = [createKline(100, 110, 90, 90)];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBe(0);
  });

  it('should return IBS = 0.5 when close is at midpoint', () => {
    const klines = [createKline(100, 110, 90, 100)];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBe(0.5);
  });

  it('should return IBS = 0.5 when range is zero (doji)', () => {
    const klines = [createKline(100, 100, 100, 100)];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBe(0.5);
  });

  it('should calculate IBS correctly for multiple klines', () => {
    const klines = [
      createKline(100, 110, 90, 110), // IBS = 1
      createKline(100, 110, 90, 90),  // IBS = 0
      createKline(100, 110, 90, 95),  // IBS = 0.25
      createKline(100, 110, 90, 105), // IBS = 0.75
    ];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBe(1);
    expect(result.values[1]).toBe(0);
    expect(result.values[2]).toBe(0.25);
    expect(result.values[3]).toBe(0.75);
  });

  it('should identify oversold conditions (IBS < 0.2)', () => {
    const klines = [createKline(100, 110, 90, 92)]; // IBS = 0.1
    const result = calculateIBS(klines);
    expect(result.values[0]).toBeLessThan(0.2);
  });

  it('should identify overbought conditions (IBS > 0.8)', () => {
    const klines = [createKline(100, 110, 90, 108)]; // IBS = 0.9
    const result = calculateIBS(klines);
    expect(result.values[0]).toBeGreaterThan(0.8);
  });

  it('should return empty array for empty input', () => {
    const result = calculateIBS([]);
    expect(result.values).toHaveLength(0);
  });

  it('should handle real-world crypto data', () => {
    const klines = [
      createKline(42000, 42500, 41800, 42100), // Mid-range close
      createKline(42100, 42300, 41900, 41950), // Low close (bearish)
      createKline(41950, 42400, 41700, 42350), // High close (bullish)
    ];
    const result = calculateIBS(klines);
    expect(result.values[0]).toBeCloseTo(0.4286, 2);
    expect(result.values[1]).toBeCloseTo(0.125, 2);
    expect(result.values[2]).toBeCloseTo(0.9286, 2);
  });
});
