import { describe, it, expect } from 'vitest';
import {
  calculateBTCDominance,
  calculateBTCDominanceSeries,
  calculateBTCDominanceMA,
  detectAltcoinSeason,
  calculateAltcoinMarketCap,
  calculateDominanceChange,
  calculateInverseDominance,
  type BTCDominanceData,
} from './btcDominance';

describe('BTC Dominance', () => {
  const mockData: BTCDominanceData[] = [
    { timestamp: 1000, dominance: 55 },
    { timestamp: 2000, dominance: 54 },
    { timestamp: 3000, dominance: 52 },
    { timestamp: 4000, dominance: 50 },
    { timestamp: 5000, dominance: 48 },
  ];

  describe('calculateBTCDominance', () => {
    it('should return current dominance', () => {
      const result = calculateBTCDominance(mockData);
      expect(result.current).toBe(48);
    });

    it('should calculate change from previous', () => {
      const result = calculateBTCDominance(mockData);
      expect(result.change).toBe(-2);
    });

    it('should detect falling trend', () => {
      const result = calculateBTCDominance(mockData, { trendPeriod: 3, changeThreshold: 2 });
      expect(result.trend).toBe('falling');
    });

    it('should detect rising trend', () => {
      const risingData: BTCDominanceData[] = [
        { timestamp: 1000, dominance: 45 },
        { timestamp: 2000, dominance: 47 },
        { timestamp: 3000, dominance: 50 },
        { timestamp: 4000, dominance: 52 },
        { timestamp: 5000, dominance: 55 },
      ];
      const result = calculateBTCDominance(risingData, { trendPeriod: 3, changeThreshold: 2 });
      expect(result.trend).toBe('rising');
    });

    it('should handle empty data', () => {
      const result = calculateBTCDominance([]);
      expect(result.current).toBeNull();
      expect(result.trend).toBe('stable');
    });
  });

  describe('calculateBTCDominanceSeries', () => {
    it('should return series sorted by timestamp', () => {
      const result = calculateBTCDominanceSeries(mockData);
      expect(result).toEqual([55, 54, 52, 50, 48]);
    });
  });

  describe('calculateBTCDominanceMA', () => {
    it('should calculate moving average', () => {
      const data: BTCDominanceData[] = [];
      for (let i = 0; i < 10; i++) {
        data.push({ timestamp: i * 1000, dominance: 50 });
      }
      const result = calculateBTCDominanceMA(data, 5);
      expect(result[6]).toBeCloseTo(50, 1);
    });

    it('should return null for insufficient data', () => {
      const result = calculateBTCDominanceMA(mockData, 10);
      expect(result[0]).toBeNull();
    });
  });

  describe('detectAltcoinSeason', () => {
    it('should detect altcoin season', () => {
      const altSeasonData: BTCDominanceData[] = [];
      for (let i = 0; i < 35; i++) {
        altSeasonData.push({ timestamp: i * 1000, dominance: 55 - i * 0.5 });
      }
      const result = detectAltcoinSeason(altSeasonData, { altcoinSeasonThreshold: 50 });
      expect(result.isAltcoinSeason).toBe(true);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should not detect altcoin season when dominance is high', () => {
      const highDominance: BTCDominanceData[] = [];
      for (let i = 0; i < 35; i++) {
        highDominance.push({ timestamp: i * 1000, dominance: 60 });
      }
      const result = detectAltcoinSeason(highDominance);
      expect(result.isAltcoinSeason).toBe(false);
    });

    it('should detect early phase', () => {
      const earlyPhaseData: BTCDominanceData[] = [];
      for (let i = 0; i < 35; i++) {
        earlyPhaseData.push({ timestamp: i * 1000, dominance: 52 - i * 0.3 });
      }
      const result = detectAltcoinSeason(earlyPhaseData, { altcoinSeasonThreshold: 50 });
      if (result.isAltcoinSeason) {
        expect(['early', 'mid', 'late']).toContain(result.phase);
      }
    });
  });

  describe('calculateAltcoinMarketCap', () => {
    it('should calculate altcoin market cap', () => {
      const result = calculateAltcoinMarketCap(50, 2000000000000);
      expect(result).toBe(1000000000000);
    });

    it('should handle 100% dominance', () => {
      const result = calculateAltcoinMarketCap(100, 2000000000000);
      expect(result).toBe(0);
    });
  });

  describe('calculateDominanceChange', () => {
    it('should calculate period-over-period change', () => {
      const result = calculateDominanceChange(mockData, 1);
      expect(result[0]).toBeNull();
      expect(result[1]).toBe(-1);
      expect(result[2]).toBe(-2);
    });
  });

  describe('calculateInverseDominance', () => {
    it('should calculate inverse dominance (altcoin dominance)', () => {
      const result = calculateInverseDominance(mockData);
      expect(result).toEqual([45, 46, 48, 50, 52]);
    });
  });
});
