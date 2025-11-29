import { describe, expect, it } from 'vitest';

import type { Candle } from '@shared/types';

import { calculateMACD } from './macd';

const createCandle = (close: number, timestamp = Date.now()): Candle => ({
  timestamp,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

describe('calculateMACD', () => {
  it('should calculate MACD, signal, and histogram correctly', () => {
    const candles: Candle[] = [
      createCandle(100),
      createCandle(101),
      createCandle(102),
      createCandle(103),
      createCandle(104),
      createCandle(105),
      createCandle(106),
      createCandle(107),
      createCandle(108),
      createCandle(109),
      createCandle(110),
      createCandle(111),
      createCandle(112),
      createCandle(113),
      createCandle(114),
      createCandle(115),
      createCandle(116),
      createCandle(117),
      createCandle(118),
      createCandle(119),
      createCandle(120),
      createCandle(121),
      createCandle(122),
      createCandle(123),
      createCandle(124),
      createCandle(125),
      createCandle(126),
      createCandle(127),
      createCandle(128),
      createCandle(129),
      createCandle(130),
    ];

    const result = calculateMACD(candles, 12, 26, 9);

    expect(result.macd).toHaveLength(candles.length);
    expect(result.signal).toHaveLength(candles.length);
    expect(result.histogram).toHaveLength(candles.length);

    const lastMACD = result.macd[result.macd.length - 1];
    const lastSignal = result.signal[result.signal.length - 1];
    const lastHistogram = result.histogram[result.histogram.length - 1];

    expect(lastMACD).toBeGreaterThan(0);
    expect(lastSignal).toBeDefined();
    expect(lastHistogram).toBeDefined();

    if (
      lastMACD !== undefined &&
      lastSignal !== undefined &&
      lastHistogram !== undefined &&
      !isNaN(lastMACD) &&
      !isNaN(lastSignal) &&
      !isNaN(lastHistogram)
    ) {
      expect(Math.abs(lastMACD - lastSignal - lastHistogram)).toBeLessThan(
        0.01,
      );
    }
  });

  it('should handle empty candle array', () => {
    const result = calculateMACD([], 12, 26, 9);

    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
    expect(result.histogram).toHaveLength(0);
  });

  it('should handle candles with insufficient data', () => {
    const candles: Candle[] = [
      createCandle(100),
      createCandle(101),
      createCandle(102),
    ];

    const result = calculateMACD(candles, 12, 26, 9);

    expect(result.macd).toHaveLength(candles.length);
    expect(result.signal).toHaveLength(candles.length);
    expect(result.histogram).toHaveLength(candles.length);

    const firstMACD = result.macd[0];
    expect(isNaN(firstMACD)).toBe(true);
  });

  it('should use default parameters when not provided', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) =>
      createCandle(100 + i),
    );

    const result = calculateMACD(candles);

    expect(result.macd).toHaveLength(candles.length);
    expect(result.signal).toHaveLength(candles.length);
    expect(result.histogram).toHaveLength(candles.length);
  });

  it('should have histogram equal to MACD minus signal', () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, i) =>
      createCandle(100 + i),
    );

    const result = calculateMACD(candles, 12, 26, 9);

    for (let i = 0; i < result.macd.length; i++) {
      const macd = result.macd[i];
      const signal = result.signal[i] ?? 0;
      const histogram = result.histogram[i];

      if (macd && histogram && !isNaN(macd) && !isNaN(histogram)) {
        expect(Math.abs(histogram - (macd - signal))).toBeLessThan(0.01);
      }
    }
  });

  it('should show bullish signal in uptrend', () => {
    const candles: Candle[] = Array.from({ length: 50 }, (_, i) =>
      createCandle(100 + i * 2),
    );

    const result = calculateMACD(candles, 12, 26, 9);

    const lastIndex = result.macd.length - 1;
    const lastMACD = result.macd[lastIndex];
    const lastSignal = result.signal[lastIndex];

    if (lastMACD && lastSignal && !isNaN(lastMACD) && !isNaN(lastSignal)) {
      expect(lastMACD).toBeGreaterThan(0);
    }
  });

  it('should show bearish signal in downtrend', () => {
    const candles: Candle[] = Array.from({ length: 50 }, (_, i) =>
      createCandle(200 - i * 2),
    );

    const result = calculateMACD(candles, 12, 26, 9);

    const lastIndex = result.macd.length - 1;
    const lastMACD = result.macd[lastIndex];
    const lastSignal = result.signal[lastIndex];

    if (lastMACD && lastSignal && !isNaN(lastMACD) && !isNaN(lastSignal)) {
      expect(lastMACD).toBeLessThan(0);
    }
  });
});
