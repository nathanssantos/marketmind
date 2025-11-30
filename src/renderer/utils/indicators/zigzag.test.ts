import type { Kline } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { calculateZigZag } from './zigzag';

const DEVIATION = 0.05;

const createCandle = (
  high: number,
  low: number,
  close: number,
  timestamp = Date.now(),
): Candle => ({
  timestamp,
  open: close,
  high,
  low,
  close,
  volume: 1000,
});

describe('calculateZigZag', () => {
  it('should detect pivot highs and lows', () => {
    const candles: Kline[] = [
      createCandle(100, 90, 95),
      createCandle(110, 100, 105),
      createCandle(115, 105, 110),
      createCandle(110, 100, 105),
      createCandle(105, 95, 100),
      createCandle(110, 100, 105),
      createCandle(115, 105, 110),
    ];

    const result = calculateZigZag(candles, DEVIATION);

    expect(result.highs.length + result.lows.length).toBeGreaterThan(0);
    expect(result.trend).toBeDefined();
  });

  it('should filter pivots by deviation threshold', () => {
    const candles: Kline[] = [
      createCandle(100, 90, 95),
      createCandle(200, 190, 195),
      createCandle(100, 90, 95),
      createCandle(200, 190, 195),
    ];

    const lowDeviation = calculateZigZag(candles, 0.01);
    const highDeviation = calculateZigZag(candles, 0.5);

    const lowTotal = lowDeviation.highs.length + lowDeviation.lows.length;
    const highTotal = highDeviation.highs.length + highDeviation.lows.length;
    expect(lowTotal).toBeGreaterThanOrEqual(highTotal);
  });

  it('should return empty result for empty input', () => {
    const result = calculateZigZag([]);

    expect(result.highs).toEqual([]);
    expect(result.lows).toEqual([]);
    expect(result.trend).toBe('neutral');
  });

  it('should return empty result for insufficient data', () => {
    const candles: Kline[] = [createCandle(100, 90, 95), createCandle(110, 100, 105)];

    const result = calculateZigZag(candles, DEVIATION);

    expect(result.highs).toEqual([]);
    expect(result.lows).toEqual([]);
    expect(result.trend).toBe('neutral');
  });

  it('should use default deviation of 5%', () => {
    const candles: Kline[] = Array.from({ length: 20 }, (_, i) => {
      const base = 100 + i * 10 * (i % 2 === 0 ? 1 : -1);
      return createCandle(base + 5, base - 5, base, Date.now() + i);
    });

    const defaultResult = calculateZigZag(candles);
    const explicitResult = calculateZigZag(candles, DEVIATION);

    expect(defaultResult.highs.length).toBe(explicitResult.highs.length);
    expect(defaultResult.lows.length).toBe(explicitResult.lows.length);
  });

  it('should detect uptrend correctly', () => {
    const candles: Kline[] = [
      createCandle(100, 90, 95),
      createCandle(110, 100, 105),
      createCandle(105, 95, 100),
      createCandle(120, 110, 115),
      createCandle(115, 105, 110),
      createCandle(130, 120, 125),
    ];

    const result = calculateZigZag(candles, 0.03);

    expect(result.trend).toBe('up');
  });

  it('should detect downtrend correctly', () => {
    const candles: Kline[] = [
      createCandle(130, 120, 125),
      createCandle(120, 110, 115),
      createCandle(125, 115, 120),
      createCandle(110, 100, 105),
      createCandle(115, 105, 110),
      createCandle(100, 90, 95),
    ];

    const result = calculateZigZag(candles, 0.03);

    expect(result.trend).toBe('down');
  });

  it('should include price and index in pivot points', () => {
    const candles: Kline[] = [
      createCandle(100, 90, 95),
      createCandle(110, 100, 105),
      createCandle(115, 105, 110),
      createCandle(110, 100, 105),
      createCandle(105, 95, 100),
    ];

    const result = calculateZigZag(candles, 0.03);

    const allPivots = [...result.highs, ...result.lows];
    if (allPivots.length > 0) {
      expect(allPivots[0].price).toBeGreaterThan(0);
      expect(allPivots[0].index).toBeGreaterThanOrEqual(0);
      expect(allPivots[0].index).toBeLessThan(candles.length);
    }
  });
});
