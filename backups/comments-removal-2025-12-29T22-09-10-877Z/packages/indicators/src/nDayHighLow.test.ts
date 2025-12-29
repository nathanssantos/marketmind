import { describe, it, expect } from 'vitest';
import {
  calculateNDayHighLow,
  calculateConsecutiveLowerHighsLows,
  calculateMultipleDaysDown,
} from './nDayHighLow';
import type { Kline } from '@marketmind/types';

const createKline = (
  open: number,
  high: number,
  low: number,
  close: number
): Kline => ({
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

describe('calculateNDayHighLow', () => {
  it('should detect 7-day high', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 101),
      createKline(100, 105, 95, 102),
      createKline(100, 105, 95, 103),
      createKline(100, 105, 95, 104),
      createKline(100, 105, 95, 105),
      createKline(100, 110, 95, 110), // 7-day high
    ];

    const result = calculateNDayHighLow(klines, 7);
    expect(result.isNDayHigh[6]).toBe(true);
    expect(result.isNDayLow[6]).toBe(false);
  });

  it('should detect 7-day low', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 99),
      createKline(100, 105, 95, 98),
      createKline(100, 105, 95, 97),
      createKline(100, 105, 95, 96),
      createKline(100, 105, 95, 95),
      createKline(100, 105, 90, 90), // 7-day low
    ];

    const result = calculateNDayHighLow(klines, 7);
    expect(result.isNDayHigh[6]).toBe(false);
    expect(result.isNDayLow[6]).toBe(true);
  });

  it('should return null for insufficient data', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 101),
      createKline(100, 105, 95, 102),
    ];

    const result = calculateNDayHighLow(klines, 7);
    expect(result.highestClose[0]).toBeNull();
    expect(result.highestClose[2]).toBeNull();
  });

  it('should calculate correct highest/lowest values', () => {
    const klines = [
      createKline(100, 110, 90, 100),
      createKline(100, 115, 92, 105),
      createKline(100, 108, 88, 95),
    ];

    const result = calculateNDayHighLow(klines, 3);
    expect(result.highestClose[2]).toBe(105);
    expect(result.lowestClose[2]).toBe(95);
    expect(result.highestHigh[2]).toBe(115);
    expect(result.lowestLow[2]).toBe(88);
  });

  it('should handle Double Seven pattern (period=7)', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createKline(100, 105, 95, 100 - i)
    );

    const result = calculateNDayHighLow(klines, 7);
    expect(result.isNDayLow[6]).toBe(true);
    expect(result.isNDayLow[9]).toBe(true);
  });
});

describe('calculateConsecutiveLowerHighsLows', () => {
  it('should detect 3 consecutive lower highs and lows', () => {
    const klines = [
      createKline(100, 110, 90, 100),
      createKline(100, 108, 88, 98), // Lower H/L
      createKline(100, 106, 86, 96), // Lower H/L
      createKline(100, 104, 84, 94), // Lower H/L - pattern complete
    ];

    const result = calculateConsecutiveLowerHighsLows(klines, 3);
    expect(result[3]).toBe(true);
  });

  it('should not detect pattern when broken', () => {
    const klines = [
      createKline(100, 110, 90, 100),
      createKline(100, 108, 88, 98), // Lower H/L
      createKline(100, 112, 86, 96), // Higher high - breaks pattern
      createKline(100, 104, 84, 94),
    ];

    const result = calculateConsecutiveLowerHighsLows(klines, 3);
    expect(result[3]).toBe(false);
  });

  it('should return false for insufficient data', () => {
    const klines = [
      createKline(100, 110, 90, 100),
      createKline(100, 108, 88, 98),
    ];

    const result = calculateConsecutiveLowerHighsLows(klines, 3);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
  });
});

describe('calculateMultipleDaysDown', () => {
  it('should detect 4 out of 5 down days', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 99), // Down
      createKline(100, 105, 95, 100), // Up
      createKline(100, 105, 95, 98), // Down
      createKline(100, 105, 95, 96), // Down
      createKline(100, 105, 95, 94), // Down - 4 of 5 down
    ];

    const result = calculateMultipleDaysDown(klines, 5, 4);
    expect(result[5]).toBe(true);
  });

  it('should not detect when less than 4 down days', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 99), // Down
      createKline(100, 105, 95, 100), // Up
      createKline(100, 105, 95, 101), // Up
      createKline(100, 105, 95, 100), // Down
      createKline(100, 105, 95, 99), // Down - only 3 of 5 down
    ];

    const result = calculateMultipleDaysDown(klines, 5, 4);
    expect(result[5]).toBe(false);
  });

  it('should detect 5 consecutive down days', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 99),
      createKline(100, 105, 95, 98),
      createKline(100, 105, 95, 97),
      createKline(100, 105, 95, 96),
      createKline(100, 105, 95, 95), // 5 consecutive down
    ];

    const result = calculateMultipleDaysDown(klines, 5, 4);
    expect(result[5]).toBe(true);
  });

  it('should return false for insufficient data', () => {
    const klines = [
      createKline(100, 105, 95, 100),
      createKline(100, 105, 95, 99),
    ];

    const result = calculateMultipleDaysDown(klines, 5, 4);
    expect(result[0]).toBe(false);
    expect(result[1]).toBe(false);
  });
});
