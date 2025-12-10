import { describe, it, expect } from 'vitest';
import {
  calculateFundingRate,
  calculateFundingRateSeries,
  calculateFundingRateMA,
  detectFundingRateSignal,
  annualizeFundingRate,
  calculateFundingCost,
  type FundingRateData,
} from './fundingRate';

describe('Funding Rate', () => {
  const mockData: FundingRateData[] = [
    { timestamp: 1000, rate: 0.01 },
    { timestamp: 2000, rate: 0.02 },
    { timestamp: 3000, rate: 0.015 },
    { timestamp: 4000, rate: -0.005 },
    { timestamp: 5000, rate: 0.008 },
  ];

  describe('calculateFundingRate', () => {
    it('should calculate current funding rate', () => {
      const result = calculateFundingRate(mockData);
      expect(result.current).toBe(0.008);
    });

    it('should calculate average funding rate', () => {
      const result = calculateFundingRate(mockData);
      expect(result.average).toBeCloseTo(0.0096, 4);
    });

    it('should calculate cumulative funding rate', () => {
      const result = calculateFundingRate(mockData);
      expect(result.cumulative).toBeCloseTo(0.048, 4);
    });

    it('should detect positive direction', () => {
      const positiveData: FundingRateData[] = [{ timestamp: 1000, rate: 0.05 }];
      const result = calculateFundingRate(positiveData);
      expect(result.direction).toBe('positive');
    });

    it('should detect negative direction', () => {
      const negativeData: FundingRateData[] = [{ timestamp: 1000, rate: -0.05 }];
      const result = calculateFundingRate(negativeData);
      expect(result.direction).toBe('negative');
    });

    it('should detect neutral direction', () => {
      const neutralData: FundingRateData[] = [{ timestamp: 1000, rate: 0.005 }];
      const result = calculateFundingRate(neutralData);
      expect(result.direction).toBe('neutral');
    });

    it('should detect extreme funding rate', () => {
      const extremeData: FundingRateData[] = [{ timestamp: 1000, rate: 0.15 }];
      const result = calculateFundingRate(extremeData, { extremeThreshold: 0.1 });
      expect(result.isExtreme).toBe(true);
    });

    it('should handle empty data', () => {
      const result = calculateFundingRate([]);
      expect(result.current).toBeNull();
      expect(result.average).toBeNull();
    });
  });

  describe('calculateFundingRateSeries', () => {
    it('should return series of rates sorted by timestamp', () => {
      const result = calculateFundingRateSeries(mockData);
      expect(result).toEqual([0.01, 0.02, 0.015, -0.005, 0.008]);
    });

    it('should handle empty data', () => {
      const result = calculateFundingRateSeries([]);
      expect(result).toEqual([]);
    });
  });

  describe('calculateFundingRateMA', () => {
    it('should calculate moving average', () => {
      const data: FundingRateData[] = [];
      for (let i = 0; i < 30; i++) {
        data.push({ timestamp: i * 1000, rate: 0.01 });
      }
      const result = calculateFundingRateMA(data, 7);
      expect(result.length).toBe(30);
      expect(result[20]).toBeCloseTo(0.01, 4);
    });

    it('should return null for insufficient data', () => {
      const result = calculateFundingRateMA(mockData, 7);
      expect(result[0]).toBeNull();
    });
  });

  describe('detectFundingRateSignal', () => {
    it('should detect long signal on extreme negative funding', () => {
      const negativeData: FundingRateData[] = [{ timestamp: 1000, rate: -0.15 }];
      const result = detectFundingRateSignal(negativeData, { extremeThreshold: 0.1 });
      expect(result.signal).toBe('long');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should detect short signal on extreme positive funding', () => {
      const positiveData: FundingRateData[] = [{ timestamp: 1000, rate: 0.15 }];
      const result = detectFundingRateSignal(positiveData, { extremeThreshold: 0.1 });
      expect(result.signal).toBe('short');
      expect(result.strength).toBeGreaterThan(0);
    });

    it('should return no signal for normal funding', () => {
      const result = detectFundingRateSignal(mockData);
      expect(result.signal).toBe('none');
      expect(result.strength).toBe(0);
    });
  });

  describe('annualizeFundingRate', () => {
    it('should annualize funding rate correctly', () => {
      const result = annualizeFundingRate(0.01, 3);
      expect(result).toBeCloseTo(10.95, 2);
    });
  });

  describe('calculateFundingCost', () => {
    it('should calculate funding cost correctly', () => {
      const result = calculateFundingCost(0.01, 10000, 3);
      expect(result).toBe(300);
    });
  });
});
