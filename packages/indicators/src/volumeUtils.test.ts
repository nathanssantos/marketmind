import { describe, it, expect } from 'vitest';
import type { Kline } from '@marketmind/types';
import {
  calculateAverageVolume,
  calculateVolumeRatio,
  isVolumeSpike,
  isVolumeConfirmed,
  analyzeVolume,
} from './volumeUtils';

const createKline = (volume: number, close: number = 100): Kline => ({
  openTime: Date.now(),
  open: '100',
  high: '105',
  low: '95',
  close: String(close),
  volume: String(volume),
  closeTime: Date.now() + 60000,
  quoteVolume: '0',
  trades: 0,
  takerBuyBaseVolume: '0',
  takerBuyQuoteVolume: '0',
});

describe('volumeUtils', () => {
  describe('calculateAverageVolume', () => {
    it('should calculate average volume for a period', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(200),
        createKline(300),
        createKline(400),
        createKline(500),
      ];

      const avg = calculateAverageVolume(klines, 4, 5);
      expect(avg).toBe(300);
    });

    it('should handle partial period at start', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(200),
        createKline(300),
      ];

      const avg = calculateAverageVolume(klines, 1, 5);
      expect(avg).toBe(150);
    });

    it('should return 0 for empty array', () => {
      const avg = calculateAverageVolume([], 0, 5);
      expect(avg).toBe(0);
    });

    it('should return 0 for invalid period', () => {
      const klines: Kline[] = [createKline(100)];
      const avg = calculateAverageVolume(klines, 0, 0);
      expect(avg).toBe(0);
    });
  });

  describe('calculateVolumeRatio', () => {
    it('should calculate ratio of current volume to average', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(200),
      ];

      const ratio = calculateVolumeRatio(klines, 4, 4);
      expect(ratio).toBe(2);
    });

    it('should return 0 for out of bounds index', () => {
      const klines: Kline[] = [createKline(100)];
      expect(calculateVolumeRatio(klines, -1, 5)).toBe(0);
      expect(calculateVolumeRatio(klines, 5, 5)).toBe(0);
    });
  });

  describe('isVolumeSpike', () => {
    it('should detect volume spike above threshold', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(200),
      ];

      expect(isVolumeSpike(klines, 4, 4, 1.5)).toBe(true);
    });

    it('should return false when below threshold', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(120),
      ];

      expect(isVolumeSpike(klines, 4, 4, 1.5)).toBe(false);
    });
  });

  describe('isVolumeConfirmed', () => {
    it('should confirm volume above multiplier', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(150),
      ];

      expect(isVolumeConfirmed(klines, 4, 5, 1.2)).toBe(true);
    });

    it('should return false when below multiplier', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
      ];

      expect(isVolumeConfirmed(klines, 4, 5, 1.2)).toBe(false);
    });
  });

  describe('analyzeVolume', () => {
    it('should return complete volume analysis', () => {
      const klines: Kline[] = [
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(100),
        createKline(200),
      ];

      const analysis = analyzeVolume(klines, 4, 4, 1.5);

      expect(analysis.average).toBe(100);
      expect(analysis.current).toBe(200);
      expect(analysis.ratio).toBe(2);
      expect(analysis.isSpike).toBe(true);
    });

    it('should handle edge cases', () => {
      const analysis = analyzeVolume([], 0, 5);

      expect(analysis.average).toBe(0);
      expect(analysis.current).toBe(0);
      expect(analysis.ratio).toBe(0);
      expect(analysis.isSpike).toBe(false);
    });
  });
});
