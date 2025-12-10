import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculateDeltaVolume, calculateDeltaVolumeEstimate } from './deltaVolume';

const createMockKline = (
  open: number,
  close: number,
  volume: number,
  takerBuyVolume: number,
  index: number,
): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(open),
  high: String(Math.max(open, close) + 1),
  low: String(Math.min(open, close) - 1),
  close: String(close),
  volume: String(volume),
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: String(volume * close),
  trades: 100,
  takerBuyBaseVolume: String(takerBuyVolume),
  takerBuyQuoteVolume: String(takerBuyVolume * close),
});

describe('calculateDeltaVolume', () => {
  it('should calculate delta volume correctly', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100, 102, 1000, 600, i),
    );
    const result = calculateDeltaVolume(klines);

    expect(result.delta).toHaveLength(10);
    expect(result.cumulativeDelta).toHaveLength(10);
    expect(result.buyVolume).toHaveLength(10);
    expect(result.sellVolume).toHaveLength(10);

    expect(result.delta[0]).toBe(200);
    expect(result.buyVolume[0]).toBe(600);
    expect(result.sellVolume[0]).toBe(400);
  });

  it('should calculate cumulative delta correctly', () => {
    const klines = [
      createMockKline(100, 102, 1000, 600, 0),
      createMockKline(102, 104, 1000, 700, 1),
      createMockKline(104, 103, 1000, 400, 2),
    ];
    const result = calculateDeltaVolume(klines);

    expect(result.cumulativeDelta[0]).toBe(200);
    expect(result.cumulativeDelta[1]).toBe(600);
    expect(result.cumulativeDelta[2]).toBe(400);
  });

  it('should handle empty array', () => {
    const result = calculateDeltaVolume([]);
    expect(result.delta).toEqual([]);
    expect(result.cumulativeDelta).toEqual([]);
    expect(result.buyVolume).toEqual([]);
    expect(result.sellVolume).toEqual([]);
  });

  it('should detect buying pressure', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100, 102, 1000, 800, i),
    );
    const result = calculateDeltaVolume(klines);

    result.delta.forEach((d) => {
      expect(d).toBeGreaterThan(0);
    });

    expect(result.cumulativeDelta[9]!).toBeGreaterThan(result.cumulativeDelta[0]!);
  });

  it('should detect selling pressure', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(102, 100, 1000, 200, i),
    );
    const result = calculateDeltaVolume(klines);

    result.delta.forEach((d) => {
      expect(d).toBeLessThan(0);
    });
  });
});

describe('calculateDeltaVolumeEstimate', () => {
  it('should estimate delta volume for bullish candles', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(100, 105, 1000, 500, i),
    );
    const result = calculateDeltaVolumeEstimate(klines);

    expect(result.delta).toHaveLength(10);

    result.delta.forEach((d) => {
      expect(d).toBeGreaterThan(0);
    });
  });

  it('should estimate delta volume for bearish candles', () => {
    const klines = Array.from({ length: 10 }, (_, i) =>
      createMockKline(105, 100, 1000, 500, i),
    );
    const result = calculateDeltaVolumeEstimate(klines);

    result.delta.forEach((d) => {
      expect(d).toBeLessThan(0);
    });
  });

  it('should handle empty array', () => {
    const result = calculateDeltaVolumeEstimate([]);
    expect(result.delta).toEqual([]);
  });

  it('should calculate cumulative delta correctly', () => {
    const klines = [
      createMockKline(100, 105, 1000, 500, 0),
      createMockKline(105, 110, 1000, 500, 1),
    ];
    const result = calculateDeltaVolumeEstimate(klines);

    expect(result.cumulativeDelta[1]!).toBeGreaterThan(result.cumulativeDelta[0]!);
  });
});
