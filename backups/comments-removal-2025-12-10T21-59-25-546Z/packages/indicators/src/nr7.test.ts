import { describe, it, expect } from 'vitest';
import {
  calculateNR7,
  calculateInsideBar,
  calculateNR7InsideBar,
  calculateNR4,
  calculateNR7BreakoutLevels,
} from './nr7';
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

describe('calculateNR7', () => {
  it('should detect NR7 when current bar has narrowest range', () => {
    const klines = [
      createKline(100, 120, 80, 100), // Range: 40
      createKline(100, 118, 82, 100), // Range: 36
      createKline(100, 116, 84, 100), // Range: 32
      createKline(100, 114, 86, 100), // Range: 28
      createKline(100, 112, 88, 100), // Range: 24
      createKline(100, 110, 90, 100), // Range: 20
      createKline(100, 105, 95, 100), // Range: 10 - NR7
    ];

    const result = calculateNR7(klines, 7);
    expect(result.isNR7[6]).toBe(true);
    expect(result.ranges[6]).toBe(10);
  });

  it('should not detect NR7 when not narrowest range', () => {
    const klines = [
      createKline(100, 105, 95, 100), // Range: 10
      createKline(100, 118, 82, 100), // Range: 36
      createKline(100, 116, 84, 100), // Range: 32
      createKline(100, 114, 86, 100), // Range: 28
      createKline(100, 112, 88, 100), // Range: 24
      createKline(100, 110, 90, 100), // Range: 20
      createKline(100, 108, 92, 100), // Range: 16 - NOT NR7 (10 was narrower)
    ];

    const result = calculateNR7(klines, 7);
    expect(result.isNR7[6]).toBe(false);
  });

  it('should return false for insufficient data', () => {
    const klines = [
      createKline(100, 110, 90, 100),
      createKline(100, 108, 92, 100),
      createKline(100, 106, 94, 100),
    ];

    const result = calculateNR7(klines, 7);
    expect(result.isNR7[0]).toBe(false);
    expect(result.isNR7[2]).toBe(false);
    expect(result.minRange[2]).toBeNull();
  });

  it('should calculate correct range values', () => {
    const klines = [
      createKline(100, 110, 90, 100), // Range: 20
      createKline(100, 115, 85, 100), // Range: 30
    ];

    const result = calculateNR7(klines, 2);
    expect(result.ranges[0]).toBe(20);
    expect(result.ranges[1]).toBe(30);
  });

  it('should handle empty input', () => {
    const result = calculateNR7([]);
    expect(result.isNR7).toHaveLength(0);
    expect(result.ranges).toHaveLength(0);
  });
});

describe('calculateInsideBar', () => {
  it('should detect inside bar', () => {
    const klines = [
      createKline(100, 120, 80, 100), // Previous bar
      createKline(100, 115, 85, 100), // Inside bar (H < prev H, L > prev L)
    ];

    const result = calculateInsideBar(klines);
    expect(result[1]).toBe(true);
  });

  it('should not detect when high is higher', () => {
    const klines = [
      createKline(100, 120, 80, 100),
      createKline(100, 125, 85, 100), // High is higher
    ];

    const result = calculateInsideBar(klines);
    expect(result[1]).toBe(false);
  });

  it('should not detect when low is lower', () => {
    const klines = [
      createKline(100, 120, 80, 100),
      createKline(100, 115, 75, 100), // Low is lower
    ];

    const result = calculateInsideBar(klines);
    expect(result[1]).toBe(false);
  });

  it('should return false for first bar', () => {
    const klines = [createKline(100, 110, 90, 100)];
    const result = calculateInsideBar(klines);
    expect(result[0]).toBe(false);
  });

  it('should handle empty input', () => {
    const result = calculateInsideBar([]);
    expect(result).toHaveLength(0);
  });
});

describe('calculateNR7InsideBar', () => {
  it('should detect NR7 + Inside Bar combination', () => {
    const klines = [
      createKline(100, 140, 60, 100), // Range: 80
      createKline(100, 135, 65, 100), // Range: 70
      createKline(100, 130, 70, 100), // Range: 60
      createKline(100, 125, 75, 100), // Range: 50
      createKline(100, 120, 80, 100), // Range: 40
      createKline(100, 115, 85, 100), // Range: 30
      createKline(100, 112, 88, 100), // Range: 24, NR7 + Inside Bar
    ];

    const result = calculateNR7InsideBar(klines, 7);
    expect(result[6]).toBe(true);
  });

  it('should not detect when only NR7 but not inside bar', () => {
    const klines = [
      createKline(100, 140, 60, 100),
      createKline(100, 135, 65, 100),
      createKline(100, 130, 70, 100),
      createKline(100, 125, 75, 100),
      createKline(100, 120, 80, 100),
      createKline(100, 115, 85, 100),
      createKline(100, 110, 84, 100), // NR7 but low is lower (not inside)
    ];

    const result = calculateNR7InsideBar(klines, 7);
    expect(result[6]).toBe(false);
  });
});

describe('calculateNR4', () => {
  it('should detect NR4 with 4-bar lookback', () => {
    const klines = [
      createKline(100, 120, 80, 100), // Range: 40
      createKline(100, 118, 82, 100), // Range: 36
      createKline(100, 116, 84, 100), // Range: 32
      createKline(100, 105, 95, 100), // Range: 10 - NR4
    ];

    const result = calculateNR4(klines);
    expect(result.isNR7[3]).toBe(true);
  });
});

describe('calculateNR7BreakoutLevels', () => {
  it('should calculate breakout levels for NR7 bar', () => {
    const klines = [
      createKline(100, 120, 80, 100),
      createKline(100, 118, 82, 100),
      createKline(100, 116, 84, 100),
      createKline(100, 114, 86, 100),
      createKline(100, 112, 88, 100),
      createKline(100, 110, 90, 100),
      createKline(100, 105, 95, 100), // NR7
    ];

    const result = calculateNR7BreakoutLevels(klines, 7);
    expect(result.longEntry[6]).toBe(105);
    expect(result.shortEntry[6]).toBe(95);
    expect(result.longStop[6]).toBe(95);
    expect(result.shortStop[6]).toBe(105);
  });

  it('should return null for non-NR7 bars', () => {
    const klines = [
      createKline(100, 105, 95, 100), // Range: 10
      createKline(100, 120, 80, 100), // Range: 40 - Not NR7
    ];

    const result = calculateNR7BreakoutLevels(klines, 2);
    expect(result.longEntry[1]).toBeNull();
    expect(result.shortEntry[1]).toBeNull();
  });
});
