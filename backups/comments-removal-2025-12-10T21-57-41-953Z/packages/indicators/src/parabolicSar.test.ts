import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateParabolicSAR } from './parabolicSar';

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

describe('calculateParabolicSAR', () => {
  it('should calculate Parabolic SAR correctly for uptrend', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateParabolicSAR(klines);

    expect(result.sar).toHaveLength(20);
    expect(result.trend).toHaveLength(20);

    const lastTrend = result.trend[result.trend.length - 1];
    expect(lastTrend).toBe('up');

    const lastSar = result.sar[result.sar.length - 1];
    const lastLow = 98 + 19 * 2;
    expect(lastSar).not.toBeNull();
    expect(lastSar).toBeLessThan(lastLow);
  });

  it('should calculate Parabolic SAR correctly for downtrend', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(202 - i * 2, 198 - i * 2, i),
    );
    const result = calculateParabolicSAR(klines);

    const lastTrend = result.trend[result.trend.length - 1];
    expect(lastTrend).toBe('down');

    const lastSar = result.sar[result.sar.length - 1];
    const lastHigh = 202 - 19 * 2;
    expect(lastSar).not.toBeNull();
    expect(lastSar).toBeGreaterThan(lastHigh);
  });

  it('should return null for first value', () => {
    const klines = Array.from({ length: 10 }, (_, i) => createMockKline(105, 95, i));
    const result = calculateParabolicSAR(klines);

    expect(result.sar[0]).toBeNull();
    expect(result.trend[0]).toBeNull();
  });

  it('should handle empty array', () => {
    const result = calculateParabolicSAR([]);
    expect(result.sar).toEqual([]);
    expect(result.trend).toEqual([]);
  });

  it('should handle single kline', () => {
    const klines = [createMockKline(105, 95, 0)];
    const result = calculateParabolicSAR(klines);
    expect(result.sar).toEqual([null]);
    expect(result.trend).toEqual([null]);
  });

  it('should handle invalid parameters', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(105, 95, i));
    expect(calculateParabolicSAR(klines, 0, 0.02, 0.2).sar).toEqual([]);
    expect(calculateParabolicSAR(klines, 0.02, 0, 0.2).sar).toEqual([]);
    expect(calculateParabolicSAR(klines, 0.02, 0.02, 0).sar).toEqual([]);
  });

  it('should detect trend reversals', () => {
    const klines: Kline[] = [];

    for (let i = 0; i < 10; i++) {
      klines.push(createMockKline(100 + i * 3, 98 + i * 3, i));
    }
    for (let i = 0; i < 10; i++) {
      klines.push(createMockKline(130 - i * 3, 128 - i * 3, 10 + i));
    }

    const result = calculateParabolicSAR(klines);

    const upTrends = result.trend.filter((t) => t === 'up').length;
    const downTrends = result.trend.filter((t) => t === 'down').length;

    expect(upTrends).toBeGreaterThan(0);
    expect(downTrends).toBeGreaterThan(0);
  });

  it('should work with custom parameters', () => {
    const klines = Array.from({ length: 20 }, (_, i) =>
      createMockKline(102 + i * 2, 98 + i * 2, i),
    );
    const result = calculateParabolicSAR(klines, 0.01, 0.01, 0.1);

    expect(result.sar).toHaveLength(20);
    expect(result.trend).toHaveLength(20);
  });
});
