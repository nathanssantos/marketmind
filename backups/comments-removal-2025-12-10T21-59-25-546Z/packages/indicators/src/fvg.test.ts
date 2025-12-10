import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateFVG, getUnfilledFVGs } from './fvg';

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

describe('calculateFVG', () => {
  it('should detect bullish FVG', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0]!.type).toBe('bullish');
    expect(result.gaps[0]!.low).toBe(105);
    expect(result.gaps[0]!.high).toBe(108);
  });

  it('should detect bearish FVG', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(98, 94, 1),
      createMockKline(97, 90, 2),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBe(1);
    expect(result.gaps[0]!.type).toBe('bearish');
    expect(result.gaps[0]!.high).toBe(100);
    expect(result.gaps[0]!.low).toBe(97);
  });

  it('should not detect FVG when no gap exists', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(106, 101, 1),
      createMockKline(107, 102, 2),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBe(0);
  });

  it('should handle empty array', () => {
    const result = calculateFVG([]);
    expect(result.gaps).toEqual([]);
    expect(result.bullishFVG).toEqual([]);
    expect(result.bearishFVG).toEqual([]);
  });

  it('should handle insufficient data', () => {
    const klines = [createMockKline(105, 100, 0), createMockKline(106, 101, 1)];
    const result = calculateFVG(klines);

    expect(result.gaps).toEqual([]);
  });

  it('should mark filled FVGs', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
      createMockKline(122, 117, 3),
      createMockKline(115, 103, 4),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    const firstGap = result.gaps.find((g) => g.index === 1);
    expect(firstGap?.filled).toBe(true);
  });

  it('should keep unfilled FVGs unmarked', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
      createMockKline(122, 117, 3),
      createMockKline(124, 119, 4),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBeGreaterThanOrEqual(1);
    const firstGap = result.gaps.find((g) => g.index === 1);
    expect(firstGap?.filled).toBe(false);
  });

  it('should detect multiple FVGs', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
      createMockKline(135, 125, 3),
      createMockKline(150, 138, 4),
    ];
    const result = calculateFVG(klines);

    expect(result.gaps.length).toBeGreaterThanOrEqual(2);
  });
});

describe('getUnfilledFVGs', () => {
  it('should return only unfilled FVGs', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
      createMockKline(122, 117, 3),
    ];
    const result = getUnfilledFVGs(klines);

    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.every((g) => !g.filled)).toBe(true);
  });

  it('should return empty array when all FVGs filled', () => {
    const klines = [
      createMockKline(105, 100, 0),
      createMockKline(112, 106, 1),
      createMockKline(120, 108, 2),
      createMockKline(115, 100, 3),
    ];
    const result = getUnfilledFVGs(klines);

    expect(result.length).toBe(0);
  });
});
