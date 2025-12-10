import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateRSI } from './rsi';

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

describe('calculateRSI', () => {
  it('should calculate RSI correctly for upward trend', () => {
    const klines = [100, 105, 110, 115, 120].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines, 2);

    expect(result.values).toHaveLength(5);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    
    // After period, should have high RSI values (upward trend)
    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).toBeGreaterThan(50);
  });

  it('should calculate RSI correctly for downward trend', () => {
    const klines = [120, 115, 110, 105, 100].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines, 2);

    expect(result.values).toHaveLength(5);
    
    // Downward trend should have low RSI values
    const lastValue = result.values[result.values.length - 1];
    expect(lastValue).toBeLessThan(50);
  });

  it('should return null values for insufficient data', () => {
    const klines = [100, 105].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines, 2);

    expect(result.values).toEqual([null, null]);
  });

  it('should handle default period of 2', () => {
    const klines = [100, 105, 110, 115].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines);

    expect(result.values).toHaveLength(4);
    expect(result.values[0]).toBeNull();
    expect(result.values[1]).toBeNull();
    expect(result.values[2]).not.toBeNull();
  });

  it('should return values between 0 and 100', () => {
    const klines = [100, 105, 110, 95, 120, 90, 115].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines, 2);

    result.values.forEach((value) => {
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });

  it('should handle mixed price movements', () => {
    const klines = [100, 102, 101, 103, 102, 104].map((close, i) => createMockKline(close, i));
    const result = calculateRSI(klines, 2);

    expect(result.values).toHaveLength(6);
    
    // Should have RSI values around 50 for mixed movements
    const nonNullValues = result.values.filter((v) => v !== null);
    expect(nonNullValues.length).toBeGreaterThan(0);
  });
});
