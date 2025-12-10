import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateSwingHighLowLevels, calculateSwingPoints } from './swingPoints';

const createMockKline = (high: number, low: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String((high + low) / 2),
  high: String(high),
  low: String(low),
  close: String((high + low) / 2),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateSwingPoints', () => {
  it('should detect swing highs and lows', () => {
    const prices = [100, 105, 110, 108, 103, 100, 95, 98, 105, 110, 108, 103, 100];
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingPoints(klines, 2);

    expect(result.swingHighs).toHaveLength(13);
    expect(result.swingLows).toHaveLength(13);
    expect(result.swingPoints.length).toBeGreaterThan(0);
  });

  it('should detect peak as swing high', () => {
    const prices = [100, 102, 105, 103, 100];
    const klines = prices.map((p, i) => createMockKline(p + 1, p - 1, i));

    const result = calculateSwingPoints(klines, 2);

    const swingHigh = result.swingHighs.find((v) => v !== null);
    expect(swingHigh).toBeDefined();
    expect(swingHigh).toBeCloseTo(106, 0);
  });

  it('should detect trough as swing low', () => {
    const prices = [100, 98, 95, 97, 100];
    const klines = prices.map((p, i) => createMockKline(p + 1, p - 1, i));

    const result = calculateSwingPoints(klines, 2);

    const swingLow = result.swingLows.find((v) => v !== null);
    expect(swingLow).toBeDefined();
    expect(swingLow).toBeCloseTo(94, 0);
  });

  it('should handle empty array', () => {
    const result = calculateSwingPoints([]);
    expect(result.swingHighs).toEqual([]);
    expect(result.swingLows).toEqual([]);
    expect(result.swingPoints).toEqual([]);
  });

  it('should handle insufficient data', () => {
    const klines = [createMockKline(105, 95, 0), createMockKline(106, 96, 1)];
    const result = calculateSwingPoints(klines, 3);

    expect(result.swingPoints).toHaveLength(0);
  });

  it('should handle lookback <= 0', () => {
    const klines = [createMockKline(105, 95, 0)];
    expect(calculateSwingPoints(klines, 0).swingHighs).toEqual([]);
    expect(calculateSwingPoints(klines, -1).swingHighs).toEqual([]);
  });

  it('should return swing points sorted by index', () => {
    const prices = [100, 110, 105, 95, 100, 108, 103];
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingPoints(klines, 1);

    for (let i = 1; i < result.swingPoints.length; i++) {
      expect(result.swingPoints[i]!.index).toBeGreaterThan(result.swingPoints[i - 1]!.index);
    }
  });
});

describe('calculateSwingHighLowLevels', () => {
  it('should return resistance and support levels', () => {
    const prices = [100, 110, 105, 95, 100, 108, 103, 90, 95, 100];
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingHighLowLevels(klines, 1, 5);

    expect(result.resistanceLevels.length).toBeGreaterThanOrEqual(0);
    expect(result.supportLevels.length).toBeGreaterThanOrEqual(0);
  });

  it('should sort resistance levels descending', () => {
    const prices = [100, 110, 105, 115, 110, 120, 115, 110, 100];
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingHighLowLevels(klines, 1, 5);

    for (let i = 1; i < result.resistanceLevels.length; i++) {
      expect(result.resistanceLevels[i]!).toBeLessThanOrEqual(result.resistanceLevels[i - 1]!);
    }
  });

  it('should sort support levels ascending', () => {
    const prices = [100, 90, 95, 85, 90, 80, 85, 90, 100];
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingHighLowLevels(klines, 1, 5);

    for (let i = 1; i < result.supportLevels.length; i++) {
      expect(result.supportLevels[i]!).toBeGreaterThanOrEqual(result.supportLevels[i - 1]!);
    }
  });

  it('should limit number of levels', () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i * 0.5) * 20);
    const klines = prices.map((p, i) => createMockKline(p + 2, p - 2, i));

    const result = calculateSwingHighLowLevels(klines, 2, 3);

    expect(result.resistanceLevels.length).toBeLessThanOrEqual(3);
    expect(result.supportLevels.length).toBeLessThanOrEqual(3);
  });
});
