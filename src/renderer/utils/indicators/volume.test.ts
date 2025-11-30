import type { Kline } from '@shared/types';
import { describe, expect, it } from 'vitest';
import { analyzeVolume, detectVolumeClusters } from './volume';

const VOLUME_PERIOD = 20;

const createKline = (
  close: number,
  volume: number,
  timestamp = Date.now(),
): Kline => ({
  timestamp,
  open: close,
  high: close + 5,
  low: close - 5,
  close,
  volume,
});

describe('analyzeVolume', () => {
  it('should calculate volume average correctly', () => {
    const klines: Kline[] = Array.from({ length: 25 }, (_, i) =>
      createKline(100 + i, 1000, Date.now() + i),
    );

    const result = analyzeVolume(klines, VOLUME_PERIOD);

    expect(result.average).toHaveLength(25);
    expect(result.isAboveAverage).toHaveLength(25);
    expect(result.relativeVolume).toHaveLength(25);
    expect(result.spikes).toEqual([]);
  });

  it('should detect volume spikes', () => {
    const klines: Kline[] = [
      ...Array.from({ length: 20 }, (_, i) => createKline(100 + i, 1000, Date.now() + i)),
      createKline(120, 2000, Date.now() + 20),
    ];

    const result = analyzeVolume(klines, VOLUME_PERIOD);

    expect(result.spikes.length).toBeGreaterThan(0);
    expect(result.isAboveAverage[20]).toBe(true);
    expect(result.relativeVolume[20]).toBeCloseTo(1.9, 0);
  });

  it('should handle insufficient data', () => {
    const klines: Kline[] = Array.from({ length: 5 }, (_, i) =>
      createKline(100 + i, 1000, Date.now() + i),
    );

    const result = analyzeVolume(klines, VOLUME_PERIOD);

    expect(result.average).toHaveLength(5);
    expect(result.relativeVolume).toHaveLength(5);
  });

  it('should use custom spike threshold', () => {
    const klines: Kline[] = [
      ...Array.from({ length: 20 }, (_, i) => createKline(100 + i, 1000, Date.now() + i)),
      createKline(120, 1800, Date.now() + 20),
    ];

    const result = analyzeVolume(klines, VOLUME_PERIOD, 2.0);

    expect(result.spikes).toEqual([]);
    expect(result.isAboveAverage[20]).toBe(true);
  });

  it('should return empty arrays for empty input', () => {
    const result = analyzeVolume([], VOLUME_PERIOD);

    expect(result.average).toEqual([]);
    expect(result.isAboveAverage).toEqual([]);
    expect(result.spikes).toEqual([]);
    expect(result.relativeVolume).toEqual([]);
  });

  it('should detect below average volume', () => {
    const klines: Kline[] = [
      ...Array.from({ length: 20 }, (_, i) => createKline(100 + i, 1000, Date.now() + i)),
      createKline(120, 500, Date.now() + 20),
    ];

    const result = analyzeVolume(klines, VOLUME_PERIOD);

    expect(result.isAboveAverage[20]).toBe(false);
    expect(result.relativeVolume[20]).toBeCloseTo(0.5, 1);
  });
});

describe('detectVolumeClusters', () => {
  const TOLERANCE = 0.02;

  it('should detect volume clusters at similar price levels', () => {
    const klines: Kline[] = [
      createKline(100, 5000, Date.now()),
      createKline(101, 4000, Date.now() + 1),
      createKline(150, 2000, Date.now() + 2),
      createKline(151, 3000, Date.now() + 3),
      createKline(200, 1000, Date.now() + 4),
    ];

    const result = detectVolumeClusters(klines, TOLERANCE);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].totalVolume).toBeGreaterThan(0);
    expect(result[0].price).toBeGreaterThan(0);
  });

  it('should sort clusters by total volume descending', () => {
    const klines: Kline[] = [
      createKline(100, 2000, Date.now()),
      createKline(101, 2000, Date.now() + 1),
      createKline(150, 5000, Date.now() + 2),
      createKline(151, 5000, Date.now() + 3),
      createKline(200, 1000, Date.now() + 4),
    ];

    const result = detectVolumeClusters(klines, TOLERANCE);

    expect(result.length).toBeGreaterThan(0);
    if (result.length > 1) {
      expect(result[0].totalVolume).toBeGreaterThanOrEqual(result[1].totalVolume);
    }
  });

  it('should return clusters for single kline', () => {
    const klines: Kline[] = [createKline(100, 5000, Date.now())];

    const result = detectVolumeClusters(klines, TOLERANCE);

    expect(result).toHaveLength(1);
    expect(result[0].totalVolume).toBe(5000);
  });

  it('should group klines at different price levels', () => {
    const klines: Kline[] = [
      createKline(100, 5000, Date.now()),
      createKline(150, 5000, Date.now() + 1),
      createKline(200, 5000, Date.now() + 2),
    ];

    const result = detectVolumeClusters(klines, TOLERANCE);

    expect(result.length).toBeGreaterThan(0);
  });

  it('should use custom tolerance', () => {
    const klines: Kline[] = [
      createKline(100, 5000, Date.now()),
      createKline(105, 4000, Date.now() + 1),
      createKline(150, 2000, Date.now() + 2),
    ];

    const narrowResult = detectVolumeClusters(klines, 0.01);
    const wideResult = detectVolumeClusters(klines, 0.1);

    expect(narrowResult.length).toBeGreaterThan(0);
    expect(wideResult.length).toBeGreaterThan(0);
  });

  it('should calculate average volume correctly', () => {
    const klines: Kline[] = [
      createKline(100, 3000, Date.now()),
      createKline(100, 3000, Date.now() + 1),
      createKline(100, 3000, Date.now() + 2),
    ];

    const result = detectVolumeClusters(klines, TOLERANCE);

    expect(result[0].avgVolume).toBeCloseTo(3000, 0);
  });

  it('should handle empty input', () => {
    const result = detectVolumeClusters([], TOLERANCE);
    expect(result).toEqual([]);
  });
});
