import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import { calculatePPO } from './ppo';

const createMockKline = (close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close - 1),
  high: String(close + 1),
  low: String(close - 2),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('calculatePPO', () => {
  it('should calculate PPO correctly for uptrend', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + i * 2, i));
    const result = calculatePPO(klines);

    expect(result.ppo).toHaveLength(50);
    expect(result.signal).toHaveLength(50);
    expect(result.histogram).toHaveLength(50);

    const lastPPO = result.ppo[result.ppo.length - 1];
    expect(lastPPO).not.toBeNull();
    expect(lastPPO).toBeGreaterThan(0);
  });

  it('should calculate PPO correctly for downtrend', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(200 - i * 2, i));
    const result = calculatePPO(klines);

    const lastPPO = result.ppo[result.ppo.length - 1];
    expect(lastPPO).not.toBeNull();
    expect(lastPPO).toBeLessThan(0);
  });

  it('should return null values for insufficient data', () => {
    const klines = Array.from({ length: 20 }, (_, i) => createMockKline(100 + i, i));
    const result = calculatePPO(klines);

    expect(result.ppo.every((v) => v === null)).toBe(true);
  });

  it('should handle default periods of 12, 26, 9', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + i, i));
    const result = calculatePPO(klines);

    expect(result.ppo).toHaveLength(50);

    const firstPPOIndex = result.ppo.findIndex((v) => v !== null);
    expect(firstPPOIndex).toBe(25);
  });

  it('should handle empty array', () => {
    const result = calculatePPO([]);
    expect(result.ppo).toEqual([]);
    expect(result.signal).toEqual([]);
    expect(result.histogram).toEqual([]);
  });

  it('should handle invalid periods', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + i, i));
    expect(calculatePPO(klines, 0, 26, 9).ppo).toEqual([]);
    expect(calculatePPO(klines, 12, 0, 9).ppo).toEqual([]);
    expect(calculatePPO(klines, 12, 26, 0).ppo).toEqual([]);
    expect(calculatePPO(klines, 26, 12, 9).ppo).toEqual([]);
  });

  it('should calculate histogram as PPO - Signal', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100 + i, i));
    const result = calculatePPO(klines);

    for (let i = 0; i < result.ppo.length; i++) {
      const ppo = result.ppo[i];
      const sig = result.signal[i];
      const hist = result.histogram[i];

      if (ppo !== null && ppo !== undefined && sig !== null && sig !== undefined) {
        expect(hist).toBeCloseTo(ppo - sig, 10);
      }
    }
  });

  it('should return values as percentages', () => {
    const klines = Array.from({ length: 50 }, (_, i) => createMockKline(100, i));
    const result = calculatePPO(klines);

    const nonNullPPO = result.ppo.filter((v) => v !== null);
    nonNullPPO.forEach((value) => {
      expect(value).toBeCloseTo(0, 5);
    });
  });
});
