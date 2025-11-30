import { describe, it, expect } from 'vitest';
import { calculateSMA, calculateEMA } from './movingAverages';
import type { Kline } from '@marketmind/types';

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

describe('calculateSMA', () => {
  it('should calculate simple moving average correctly', () => {
    const klines = [100, 110, 120, 130, 140].map((close, i) => createMockKline(close, i));
    const result = calculateSMA(klines, 3);

    expect(result).toHaveLength(5);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(110); // (100 + 110 + 120) / 3
    expect(result[3]).toBe(120); // (110 + 120 + 130) / 3
    expect(result[4]).toBe(130); // (120 + 130 + 140) / 3
  });

  it('should return empty array for invalid period', () => {
    const klines = [100, 110, 120].map((close, i) => createMockKline(close, i));
    expect(calculateSMA(klines, 0)).toEqual([]);
    expect(calculateSMA(klines, -1)).toEqual([]);
  });

  it('should return empty array for empty klines', () => {
    expect(calculateSMA([], 5)).toEqual([]);
  });

  it('should handle period larger than data length', () => {
    const klines = [100, 110].map((close, i) => createMockKline(close, i));
    const result = calculateSMA(klines, 5);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
  });
});

describe('calculateEMA', () => {
  it('should calculate exponential moving average correctly', () => {
    const klines = [100, 110, 120, 130, 140].map((close, i) => createMockKline(close, i));
    const result = calculateEMA(klines, 3);

    expect(result).toHaveLength(5);
    expect(result[0]).toBeNull();
    expect(result[1]).toBeNull();
    expect(result[2]).toBe(110); // First EMA = SMA
    expect(result[3]).toBeCloseTo(120, 1); // EMA calculation
    expect(result[4]).toBeCloseTo(130, 1);
  });

  it('should return empty array for invalid period', () => {
    const klines = [100, 110, 120].map((close, i) => createMockKline(close, i));
    expect(calculateEMA(klines, 0)).toEqual([]);
    expect(calculateEMA(klines, -1)).toEqual([]);
  });

  it('should return empty array for empty klines', () => {
    expect(calculateEMA([], 5)).toEqual([]);
  });

  it('should handle period of 1', () => {
    const klines = [100, 110, 120].map((close, i) => createMockKline(close, i));
    const result = calculateEMA(klines, 1);

    expect(result).toHaveLength(3);
    expect(result[0]).toBe(100);
    expect(result[1]).toBe(110);
    expect(result[2]).toBe(120);
  });
});
