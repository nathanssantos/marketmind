import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateCandlePatterns } from './candlePatterns';

const createMockKline = (
  open: number,
  high: number,
  low: number,
  close: number,
  index: number,
): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(open),
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

describe('calculateCandlePatterns', () => {
  it('should detect doji', () => {
    const klines = [createMockKline(100, 105, 95, 100.5, 0)];
    const result = calculateCandlePatterns(klines);

    expect(result.doji[0]).toBe(true);
    expect(result.patterns.some((p) => p.pattern === 'doji')).toBe(true);
  });

  it('should detect hammer', () => {
    const klines = [createMockKline(100, 100.3, 90, 100.2, 0)];
    const result = calculateCandlePatterns(klines);

    expect(result.hammer[0]).toBe(true);
    expect(result.patterns.some((p) => p.pattern === 'hammer')).toBe(true);
  });

  it('should detect bullish engulfing', () => {
    const klines = [
      createMockKline(100, 101, 95, 96, 0),
      createMockKline(95, 105, 94, 103, 1),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.engulfing[1]).toBe('bullish');
    expect(result.patterns.some((p) => p.pattern === 'bullish_engulfing')).toBe(true);
  });

  it('should detect bearish engulfing', () => {
    const klines = [
      createMockKline(96, 105, 95, 100, 0),
      createMockKline(102, 103, 92, 93, 1),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.engulfing[1]).toBe('bearish');
    expect(result.patterns.some((p) => p.pattern === 'bearish_engulfing')).toBe(true);
  });

  it('should handle empty array', () => {
    const result = calculateCandlePatterns([]);
    expect(result.patterns).toEqual([]);
    expect(result.doji).toEqual([]);
    expect(result.hammer).toEqual([]);
    expect(result.engulfing).toEqual([]);
  });

  it('should detect inverted hammer', () => {
    const klines = [createMockKline(100, 110, 99.95, 100.1, 0)];
    const result = calculateCandlePatterns(klines);

    expect(result.patterns.some((p) => p.pattern === 'inverted_hammer')).toBe(true);
  });

  it('should detect morning star', () => {
    const klines = [
      createMockKline(100, 101, 92, 93, 0),
      createMockKline(93, 95, 91, 93.2, 1),
      createMockKline(93, 102, 92, 100, 2),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.patterns.some((p) => p.pattern === 'morning_star')).toBe(true);
  });

  it('should detect evening star', () => {
    const klines = [
      createMockKline(90, 100, 89, 98, 0),
      createMockKline(98, 100, 96, 98.2, 1),
      createMockKline(97, 98, 88, 90, 2),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.patterns.some((p) => p.pattern === 'evening_star')).toBe(true);
  });

  it('should detect three white soldiers', () => {
    const klines = [
      createMockKline(90, 95, 89, 94, 0),
      createMockKline(92, 100, 91, 99, 1),
      createMockKline(97, 105, 96, 104, 2),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.patterns.some((p) => p.pattern === 'three_white_soldiers')).toBe(true);
  });

  it('should detect three black crows', () => {
    const klines = [
      createMockKline(100, 101, 92, 93, 0),
      createMockKline(94, 95, 86, 87, 1),
      createMockKline(88, 89, 80, 81, 2),
    ];
    const result = calculateCandlePatterns(klines);

    expect(result.patterns.some((p) => p.pattern === 'three_black_crows')).toBe(true);
  });

  it('should return patterns sorted by index', () => {
    const klines = [
      createMockKline(100, 105, 95, 100.5, 0),
      createMockKline(100, 105, 95, 100.5, 1),
      createMockKline(100, 105, 95, 100.5, 2),
    ];
    const result = calculateCandlePatterns(klines);

    for (let i = 1; i < result.patterns.length; i++) {
      expect(result.patterns[i]!.index).toBeGreaterThanOrEqual(result.patterns[i - 1]!.index);
    }
  });
});
