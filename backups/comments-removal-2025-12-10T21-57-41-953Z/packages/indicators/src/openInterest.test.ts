import { describe, it, expect } from 'vitest';
import {
  calculateOpenInterest,
  calculateOpenInterestSeries,
  calculateOpenInterestChange,
  detectOIDivergence,
  calculateOIRatio,
  type OpenInterestData,
} from './openInterest';

describe('Open Interest', () => {
  const mockData: OpenInterestData[] = [
    { timestamp: 1000, value: 1000000 },
    { timestamp: 2000, value: 1050000 },
    { timestamp: 3000, value: 1100000 },
    { timestamp: 4000, value: 1080000 },
    { timestamp: 5000, value: 1120000 },
  ];

  describe('calculateOpenInterest', () => {
    it('should return current value', () => {
      const result = calculateOpenInterest(mockData);
      expect(result.current).toBe(1120000);
    });

    it('should detect increasing trend', () => {
      const increasingData: OpenInterestData[] = [
        { timestamp: 1000, value: 1000000 },
        { timestamp: 2000, value: 1050000 },
        { timestamp: 3000, value: 1100000 },
        { timestamp: 4000, value: 1150000 },
        { timestamp: 5000, value: 1200000 },
      ];
      const result = calculateOpenInterest(increasingData, undefined, { trendPeriod: 3 });
      expect(result.trend).toBe('increasing');
    });

    it('should detect decreasing trend', () => {
      const decreasingData: OpenInterestData[] = [
        { timestamp: 1000, value: 1200000 },
        { timestamp: 2000, value: 1150000 },
        { timestamp: 3000, value: 1100000 },
        { timestamp: 4000, value: 1050000 },
        { timestamp: 5000, value: 1000000 },
      ];
      const result = calculateOpenInterest(decreasingData, undefined, { trendPeriod: 3 });
      expect(result.trend).toBe('decreasing');
    });

    it('should detect bullish divergence', () => {
      const oiData: OpenInterestData[] = [
        { timestamp: 1000, value: 1000000 },
        { timestamp: 2000, value: 1100000 },
      ];
      const priceChanges = [-5, -3];
      const result = calculateOpenInterest(oiData, priceChanges, {
        lookback: 1,
        changeThreshold: 5,
      });
      expect(result.divergence).toBe('bullish');
    });

    it('should handle empty data', () => {
      const result = calculateOpenInterest([]);
      expect(result.current).toBeNull();
      expect(result.trend).toBe('stable');
    });
  });

  describe('calculateOpenInterestSeries', () => {
    it('should return series sorted by timestamp', () => {
      const result = calculateOpenInterestSeries(mockData);
      expect(result).toEqual([1000000, 1050000, 1100000, 1080000, 1120000]);
    });
  });

  describe('calculateOpenInterestChange', () => {
    it('should calculate percentage change', () => {
      const result = calculateOpenInterestChange(mockData, 1);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeCloseTo(5, 1);
    });

    it('should handle different periods', () => {
      const result = calculateOpenInterestChange(mockData, 2);
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();
      expect(result[2]).toBeCloseTo(10, 1);
    });
  });

  describe('detectOIDivergence', () => {
    it('should detect bullish divergence', () => {
      const oiData: OpenInterestData[] = [];
      for (let i = 0; i < 15; i++) {
        oiData.push({ timestamp: i * 1000, value: 1000000 + i * 60000 });
      }
      const closes = Array(15)
        .fill(100)
        .map((v, i) => v - i * 0.5);

      const result = detectOIDivergence(oiData, closes, 10, 5);
      expect(result.divergence).toBe('bullish');
    });

    it('should detect bearish divergence', () => {
      const oiData: OpenInterestData[] = [];
      for (let i = 0; i < 15; i++) {
        oiData.push({ timestamp: i * 1000, value: 1000000 - i * 60000 });
      }
      const closes = Array(15)
        .fill(100)
        .map((v, i) => v + i * 0.5);

      const result = detectOIDivergence(oiData, closes, 10, 5);
      expect(result.divergence).toBe('bearish');
    });

    it('should return no divergence for insufficient data', () => {
      const result = detectOIDivergence(mockData.slice(0, 3), [100, 101, 102], 10);
      expect(result.divergence).toBe('none');
    });
  });

  describe('calculateOIRatio', () => {
    it('should calculate long/short ratio', () => {
      const result = calculateOIRatio(1500000, 1000000);
      expect(result.ratio).toBe(1.5);
      expect(result.sentiment).toBe('bullish');
    });

    it('should detect bearish sentiment', () => {
      const result = calculateOIRatio(800000, 1200000);
      expect(result.ratio).toBeCloseTo(0.67, 2);
      expect(result.sentiment).toBe('bearish');
    });

    it('should detect neutral sentiment', () => {
      const result = calculateOIRatio(1000000, 1000000);
      expect(result.ratio).toBe(1);
      expect(result.sentiment).toBe('neutral');
    });

    it('should handle zero short OI', () => {
      const result = calculateOIRatio(1000000, 0);
      expect(result.ratio).toBe(Infinity);
      expect(result.sentiment).toBe('bullish');
    });
  });
});
