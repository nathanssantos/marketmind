import type { Candle } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { calculateATR } from './atr';

const ATR_PERIOD = 14;

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

describe('calculateATR', () => {
  it('should calculate ATR correctly with Wilders smoothing', () => {
    const candles: Candle[] = [];
    let prevClose = 100;

    for (let i = 0; i < 20; i++) {
      const high = prevClose + 5;
      const low = prevClose - 5;
      const close = prevClose + (i % 2 === 0 ? 2 : -2);
      candles.push(createCandle(high, low, close));
      prevClose = close;
    }

    const result = calculateATR(candles, ATR_PERIOD);

    expect(result.length).toBe(candles.length);
    expect(isNaN(result[0] ?? NaN)).toBe(true);
    expect(result[13]).not.toBeNull();
    expect(result[13]).toBeGreaterThan(0);
    expect(result[19]).toBeGreaterThan(0);
  });

  it('should return empty array for empty input', () => {
    const result = calculateATR([]);
    expect(result).toEqual([]);
  });

  it('should return all nulls for insufficient data', () => {
    const candles: Candle[] = Array.from({ length: 5 }, (_, i) =>
      createCandle(105, 95, 100 + i, Date.now() + i),
    );

    const result = calculateATR(candles, ATR_PERIOD);

    expect(result).toHaveLength(5);
    expect(result.every((val) => isNaN(val ?? NaN))).toBe(true);
  });

  it('should use default period of 14', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) =>
      createCandle(105 + i, 95 + i, 100 + i, Date.now() + i),
    );

    const defaultResult = calculateATR(candles);
    const explicitResult = calculateATR(candles, ATR_PERIOD);

    expect(defaultResult).toEqual(explicitResult);
  });

  it('should handle single candle', () => {
    const candles: Candle[] = [createCandle(105, 95, 100)];
    const result = calculateATR(candles, ATR_PERIOD);

    expect(result).toHaveLength(1);
    expect(isNaN(result[0] ?? NaN)).toBe(true);
  });

  it('should calculate True Range correctly', () => {
    const candles: Candle[] = [
      createCandle(110, 90, 100),
      createCandle(115, 95, 105),
      createCandle(120, 100, 110),
    ];

    const result = calculateATR(candles, 2);

    expect(isNaN(result[0] ?? NaN)).toBe(true);
    expect(result[1]).toBeCloseTo(20, 0);
    expect(result[2]).toBeCloseTo(20, 0);
  });

  it('should apply Wilders smoothing correctly', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) => {
      const base = 100 + i;
      return createCandle(base + 10, base - 10, base, Date.now() + i);
    });

    const result = calculateATR(candles, ATR_PERIOD);

    expect(result[13]).toBeCloseTo(20, 0);
    
    for (let i = 14; i < result.length - 1; i++) {
      if (result[i] !== null && result[i + 1] !== null) {
        const ratio = Math.abs((result[i + 1]! - result[i]!) / result[i]!);
        expect(ratio).toBeLessThan(0.1);
      }
    }
  });

  it('should handle high volatility scenarios', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => {
      const volatility = i % 2 === 0 ? 50 : 10;
      return createCandle(100 + volatility, 100 - volatility, 100, Date.now() + i);
    });

    const result = calculateATR(candles, ATR_PERIOD);

    expect(result[13]).toBeGreaterThan(20);
  });

  it('should handle low volatility scenarios', () => {
    const candles: Candle[] = Array.from({ length: 20 }, (_, i) => {
      const base = 100;
      return createCandle(base + 1, base - 1, base, Date.now() + i);
    });

    const result = calculateATR(candles, ATR_PERIOD);

    expect(result[13]).toBeLessThan(5);
  });
});
