import type { Kline } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { calculateIntradayVWAP, calculateVWAP } from './vwap';

const createKline = (
  high: number,
  low: number,
  close: number,
  volume: number,
  openTime: number,
): Kline => ({
  openTime,
  closeTime: openTime + 60000,
  open: close.toString(),
  high: high.toString(),
  low: low.toString(),
  close: close.toString(),
  volume: volume.toString(),
  quoteVolume: (volume * close).toString(),
  trades: 100,
  takerBuyBaseVolume: (volume * 0.5).toString(),
  takerBuyQuoteVolume: (volume * close * 0.5).toString(),
});

describe('calculateVWAP', () => {
  it('should calculate VWAP correctly', () => {
    const klines: Kline[] = [
      createKline(105, 95, 100, 1000, Date.now()),
      createKline(115, 105, 110, 1500, Date.now()),
      createKline(125, 115, 120, 2000, Date.now()),
    ];

    const result = calculateVWAP(klines);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(100, 2);
    expect(result[2]).toBeCloseTo(112.22, 1);
  });

  it('should return empty array for empty input', () => {
    const result = calculateVWAP([]);
    expect(result).toEqual([]);
  });

  it('should handle single kline', () => {
    const klines: Kline[] = [createKline(105, 95, 100, 1000, Date.now())];
    const result = calculateVWAP(klines);

    expect(result).toHaveLength(1);
    expect(result[0]).toBeCloseTo(100, 2);
  });

  it('should handle zero volume klines', () => {
    const klines: Kline[] = [
      createKline(105, 95, 100, 0, Date.now()),
      createKline(115, 105, 110, 1500, Date.now()),
    ];

    const result = calculateVWAP(klines);

    expect(result).toHaveLength(2);
    expect(result[1]).toBeCloseTo(110, 2);
  });
});

describe('calculateIntradayVWAP', () => {
  const HOUR_MS = 3600000;
  const DAY_MS = 86400000;

  it('should reset VWAP at start of each day', () => {
    const baseTime = new Date('2024-01-01T00:00:00Z').getTime();

    const klines: Kline[] = [
      createKline(105, 95, 100, 1000, baseTime),
      createKline(115, 105, 110, 1500, baseTime + HOUR_MS),
      createKline(125, 115, 120, 2000, baseTime + DAY_MS),
      createKline(135, 125, 130, 2500, baseTime + DAY_MS + HOUR_MS),
    ];

    const result = calculateIntradayVWAP(klines);

    expect(result).toHaveLength(4);
    expect(result[0]).toBeCloseTo(100, 2);
    expect(result[1]).toBeCloseTo(106, 1);
    expect(result[2]).toBeCloseTo(120, 2);
    expect(result[3]).toBeCloseTo(125.56, 1);
  });

  it('should return empty array for empty input', () => {
    const result = calculateIntradayVWAP([]);
    expect(result).toEqual([]);
  });

  it('should handle single day data', () => {
    const baseTime = new Date('2024-01-01T09:00:00Z').getTime();

    const klines: Kline[] = [
      createKline(105, 95, 100, 1000, baseTime),
      createKline(115, 105, 110, 1500, baseTime + HOUR_MS),
      createKline(125, 115, 120, 2000, baseTime + 2 * HOUR_MS),
    ];

    const result = calculateIntradayVWAP(klines);

    expect(result).toHaveLength(3);
    expect(result[0]).toBeCloseTo(100, 2);
    expect(result[2]).toBeCloseTo(112.22, 1);
  });

  it('should handle midnight boundary correctly', () => {
    const baseTime = new Date('2024-01-01T23:30:00Z').getTime();

    const klines: Kline[] = [
      createKline(105, 95, 100, 1000, baseTime),
      createKline(115, 105, 110, 1500, baseTime + HOUR_MS),
    ];

    const result = calculateIntradayVWAP(klines);

    expect(result).toHaveLength(2);
    expect(result[0]).toBeCloseTo(100, 2);
    expect(result[1]).toBeCloseTo(106, 1);
  });
});
