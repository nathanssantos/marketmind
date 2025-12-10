import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateGaps, getUnfilledGaps } from './gapDetection';

const createMockKline = (high: number, low: number, close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String((high + low) / 2),
  high: String(high),
  low: String(low),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculateGaps', () => {
  it('should detect gap up', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(120, 110, 115, 1),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0]!.type).toBe('up');
    expect(result.gaps[0]!.gapLow).toBe(105);
    expect(result.gaps[0]!.gapHigh).toBe(110);
  });

  it('should detect gap down', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(95, 85, 90, 1),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0]!.type).toBe('down');
    expect(result.gaps[0]!.gapHigh).toBe(100);
    expect(result.gaps[0]!.gapLow).toBe(95);
  });

  it('should not detect gap when ranges overlap', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(106, 102, 104, 1),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps.length).toBe(0);
  });

  it('should filter by minimum gap percent', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(110, 106, 108, 1),
    ];
    const result = calculateGaps(klines, 1);

    expect(result.gaps.length).toBe(0);
  });

  it('should handle empty array', () => {
    const result = calculateGaps([]);
    expect(result.gaps).toEqual([]);
    expect(result.gapUp).toEqual([]);
    expect(result.gapDown).toEqual([]);
  });

  it('should handle single kline', () => {
    const klines = [createMockKline(105, 100, 103, 0)];
    const result = calculateGaps(klines);

    expect(result.gaps).toEqual([]);
  });

  it('should mark filled gaps', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(120, 110, 115, 1),
      createMockKline(122, 117, 120, 2),
      createMockKline(115, 102, 105, 3),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    const firstGap = result.gaps.find((g) => g.index === 1);
    expect(firstGap?.filled).toBe(true);
  });

  it('should keep unfilled gaps unmarked', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(120, 110, 115, 1),
      createMockKline(125, 118, 120, 2),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0]!.filled).toBe(false);
  });

  it('should calculate percent size correctly', () => {
    const klines = [
      createMockKline(105, 100, 100, 0),
      createMockKline(120, 110, 115, 1),
    ];
    const result = calculateGaps(klines, 0);

    expect(result.gaps[0]!.percentSize).toBeCloseTo(5, 1);
  });
});

describe('getUnfilledGaps', () => {
  it('should return only unfilled gaps', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(120, 110, 115, 1),
      createMockKline(125, 118, 120, 2),
    ];
    const result = getUnfilledGaps(klines, 0);

    expect(result.length).toBe(1);
    expect(result[0]!.filled).toBe(false);
  });

  it('should return empty array when all gaps filled', () => {
    const klines = [
      createMockKline(105, 100, 103, 0),
      createMockKline(120, 110, 115, 1),
      createMockKline(115, 98, 100, 2),
    ];
    const result = getUnfilledGaps(klines, 0);

    expect(result.length).toBe(0);
  });
});
