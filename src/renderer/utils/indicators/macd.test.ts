import { describe, expect, it } from 'vitest';

import type { Kline } from '@shared/types';

import { calculateMACD } from './macd';

const createKline = (close: number, timestamp = Date.now()): Kline => ({
  timestamp,
  open: close,
  high: close,
  low: close,
  close,
  volume: 1000,
});

describe('calculateMACD', () => {
  it('should calculate MACD, signal, and histogram correctly', () => {
    const klines: Kline[] = [
      createKline(100),
      createKline(101),
      createKline(102),
      createKline(103),
      createKline(104),
      createKline(105),
      createKline(106),
      createKline(107),
      createKline(108),
      createKline(109),
      createKline(110),
      createKline(111),
      createKline(112),
      createKline(113),
      createKline(114),
      createKline(115),
      createKline(116),
      createKline(117),
      createKline(118),
      createKline(119),
      createKline(120),
      createKline(121),
      createKline(122),
      createKline(123),
      createKline(124),
      createKline(125),
      createKline(126),
      createKline(127),
      createKline(128),
      createKline(129),
      createKline(130),
    ];

    const result = calculateMACD(klines, 12, 26, 9);

    expect(result.macd).toHaveLength(klines.length);
    expect(result.signal).toHaveLength(klines.length);
    expect(result.histogram).toHaveLength(klines.length);

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

  it('should handle empty kline array', () => {
    const result = calculateMACD([], 12, 26, 9);

    expect(result.macd).toHaveLength(0);
    expect(result.signal).toHaveLength(0);
    expect(result.histogram).toHaveLength(0);
  });

  it('should handle klines with insufficient data', () => {
    const klines: Kline[] = [
      createKline(100),
      createKline(101),
      createKline(102),
    ];

    const result = calculateMACD(klines, 12, 26, 9);

    expect(result.macd).toHaveLength(klines.length);
    expect(result.signal).toHaveLength(klines.length);
    expect(result.histogram).toHaveLength(klines.length);

    const firstMACD = result.macd[0];
    expect(isNaN(firstMACD)).toBe(true);
  });

  it('should use default parameters when not provided', () => {
    const klines: Kline[] = Array.from({ length: 30 }, (_, i) =>
      createKline(100 + i),
    );

    const result = calculateMACD(klines);

    expect(result.macd).toHaveLength(klines.length);
    expect(result.signal).toHaveLength(klines.length);
    expect(result.histogram).toHaveLength(klines.length);
  });

  it('should have histogram equal to MACD minus signal', () => {
    const klines: Kline[] = Array.from({ length: 30 }, (_, i) =>
      createKline(100 + i),
    );

    const result = calculateMACD(klines, 12, 26, 9);

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
    const klines: Kline[] = Array.from({ length: 50 }, (_, i) =>
      createKline(100 + i * 2),
    );

    const result = calculateMACD(klines, 12, 26, 9);

    const lastIndex = result.macd.length - 1;
    const lastMACD = result.macd[lastIndex];
    const lastSignal = result.signal[lastIndex];

    if (lastMACD && lastSignal && !isNaN(lastMACD) && !isNaN(lastSignal)) {
      expect(lastMACD).toBeGreaterThan(0);
    }
  });

  it('should show bearish signal in downtrend', () => {
    const klines: Kline[] = Array.from({ length: 50 }, (_, i) =>
      createKline(200 - i * 2),
    );

    const result = calculateMACD(klines, 12, 26, 9);

    const lastIndex = result.macd.length - 1;
    const lastMACD = result.macd[lastIndex];
    const lastSignal = result.signal[lastIndex];

    if (lastMACD && lastSignal && !isNaN(lastMACD) && !isNaN(lastSignal)) {
      expect(lastMACD).toBeLessThan(0);
    }
  });
});
