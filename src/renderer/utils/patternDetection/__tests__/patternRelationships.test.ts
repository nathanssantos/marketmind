import { describe, expect, it } from 'vitest';
import type { Candle } from '../../../../shared/types';
import type { AIPattern } from '../../../../shared/types/aiPattern';
import {
    buildPatternRelationships,
    calculateFormationPeriod,
    classifyPatternTier,
    detectPriceOverlap,
    detectTimeOverlap,
    isNested,
    PatternTier,
} from '../core/patternRelationships';

const createTestCandles = (count: number, basePrice: number, intervalMs: number = 60000): Candle[] => {
  const candles: Candle[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    candles.push({
      timestamp: now + i * intervalMs,
      open: basePrice,
      high: basePrice + 10,
      low: basePrice - 10,
      close: basePrice,
      volume: 1000,
    });
  }

  return candles;
};

const createTestSupportPattern = (
  startTime: number,
  endTime: number,
  price: number,
  id: number = 1
): AIPattern => ({
  id,
  type: 'support',
  points: [
    { timestamp: startTime, price },
    { timestamp: endTime, price },
  ],
  confidence: 0.8,
  visible: true,
  timestamp: startTime,
});

const createTestTrianglePattern = (
  startTime: number,
  endTime: number,
  minPrice: number,
  maxPrice: number,
  id: number = 2
): AIPattern => ({
  id,
  type: 'triangle-ascending',
  upperTrendline: [
    { timestamp: startTime, price: maxPrice },
    { timestamp: endTime, price: maxPrice },
  ],
  lowerTrendline: [
    { timestamp: startTime, price: minPrice },
    { timestamp: endTime, price: minPrice + 20 },
  ],
  confidence: 0.7,
  visible: true,
  timestamp: startTime,
});

const createTestHeadAndShouldersPattern = (
  baseTime: number,
  basePrice: number
): AIPattern => ({
  id: 3,
  type: 'head-and-shoulders',
  leftShoulder: { timestamp: baseTime, price: basePrice + 10 },
  head: { timestamp: baseTime + 20000, price: basePrice + 20 },
  rightShoulder: { timestamp: baseTime + 40000, price: basePrice + 10 },
  neckline: [
    { timestamp: baseTime, price: basePrice },
    { timestamp: baseTime + 40000, price: basePrice },
  ],
  confidence: 0.9,
  visible: true,
  timestamp: baseTime,
});

describe('Pattern Relationships', () => {
  describe('detectTimeOverlap', () => {
    it('should detect 100% time overlap for identical time ranges', () => {
      const pattern1 = createTestSupportPattern(1000, 5000, 100);
      const pattern2 = createTestSupportPattern(1000, 5000, 105);

      const overlap = detectTimeOverlap(pattern1, pattern2);

      expect(overlap).toBe(100);
    });

    it('should detect 50% time overlap for half-overlapping patterns', () => {
      const pattern1 = createTestSupportPattern(1000, 5000, 100);
      const pattern2 = createTestSupportPattern(3000, 7000, 105);

      const overlap = detectTimeOverlap(pattern1, pattern2);

      expect(overlap).toBe(50);
    });

    it('should detect 0% time overlap for non-overlapping patterns', () => {
      const pattern1 = createTestSupportPattern(1000, 5000, 100);
      const pattern2 = createTestSupportPattern(6000, 10000, 105);

      const overlap = detectTimeOverlap(pattern1, pattern2);

      expect(overlap).toBe(0);
    });

    it('should detect partial overlap when one pattern is much larger', () => {
      const pattern1 = createTestSupportPattern(1000, 10000, 100);
      const pattern2 = createTestSupportPattern(3000, 4000, 105);

      const overlap = detectTimeOverlap(pattern1, pattern2);

      expect(overlap).toBe(100);
    });
  });

  describe('detectPriceOverlap', () => {
    it('should detect 100% price overlap for identical price ranges', () => {
      const pattern1 = createTestTrianglePattern(1000, 5000, 90, 110);
      const pattern2 = createTestTrianglePattern(2000, 6000, 90, 110);

      const overlap = detectPriceOverlap(pattern1, pattern2);

      expect(overlap).toBe(100);
    });

    it('should detect 50% price overlap for half-overlapping price ranges', () => {
      const pattern1 = createTestTrianglePattern(1000, 5000, 90, 110);
      const pattern2 = createTestTrianglePattern(2000, 6000, 100, 120);

      const overlap = detectPriceOverlap(pattern1, pattern2);

      expect(overlap).toBe(50);
    });

    it('should detect 0% price overlap for non-overlapping price ranges', () => {
      const pattern1 = createTestTrianglePattern(1000, 5000, 90, 110);
      const pattern2 = createTestTrianglePattern(2000, 6000, 120, 140);

      const overlap = detectPriceOverlap(pattern1, pattern2);

      expect(overlap).toBe(0);
    });

    it('should detect full containment when one pattern is inside another', () => {
      const pattern1 = createTestTrianglePattern(1000, 5000, 80, 120);
      const pattern2 = createTestTrianglePattern(2000, 4000, 90, 110);

      const overlap = detectPriceOverlap(pattern1, pattern2);

      expect(overlap).toBe(100);
    });
  });

  describe('isNested', () => {
    it('should detect nested pattern with >90% time and >80% price overlap', () => {
      const parent = createTestTrianglePattern(1000, 10000, 80, 120);
      const child = createTestSupportPattern(2000, 9000, 95);

      const nested = isNested(child, parent);

      expect(nested).toBe(true);
    });

    it('should not detect nested when time overlap is insufficient', () => {
      const parent = createTestTrianglePattern(1000, 10000, 80, 120);
      const child = createTestSupportPattern(500, 5000, 95);

      const nested = isNested(child, parent);

      expect(nested).toBe(false);
    });

    it('should not detect nested when price overlap is insufficient', () => {
      const parent = createTestTrianglePattern(1000, 10000, 80, 100);
      const child = createTestSupportPattern(2000, 9000, 110);

      const nested = isNested(child, parent);

      expect(nested).toBe(false);
    });

    it('should not detect nested for patterns with minimal overlap', () => {
      const pattern1 = createTestSupportPattern(1000, 5000, 100);
      const pattern2 = createTestSupportPattern(6000, 10000, 105);

      const nested = isNested(pattern1, pattern2);

      expect(nested).toBe(false);
    });
  });

  describe('buildPatternRelationships', () => {
    it('should build relationships for overlapping patterns', () => {
      const pattern1 = createTestTrianglePattern(1000, 10000, 80, 120);
      const pattern2 = createTestSupportPattern(2000, 9000, 95);
      const pattern3 = createTestSupportPattern(15000, 20000, 100);

      const relationships = buildPatternRelationships([pattern1, pattern2, pattern3]);

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.some(r =>
        (r.parentPattern.id === 1 && r.childPattern.id === 2) ||
        (r.parentPattern.id === 2 && r.childPattern.id === 1)
      )).toBe(true);
    });

    it('should identify nested relationship correctly', () => {
      const parent = createTestTrianglePattern(1000, 10000, 80, 120, 1);
      const child = createTestSupportPattern(2000, 9000, 95, 2);

      const relationships = buildPatternRelationships([parent, child]);

      expect(relationships.length).toBe(1);
      expect(relationships[0]?.relationshipType).toBe('nested');
      expect(relationships[0]?.parentPattern.id).toBe(1);
      expect(relationships[0]?.childPattern.id).toBe(2);
    });

    it('should identify conflicting patterns (bullish vs bearish)', () => {
      const bullishPattern: AIPattern = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 105 },
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const bearishPattern: AIPattern = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 1500, price: 110 },
        secondPeak: { timestamp: 4500, price: 110 },
        neckline: { timestamp: 3000, price: 95 },
        confidence: 0.7,
        visible: true,
        timestamp: 1500,
      };

      const relationships = buildPatternRelationships([bullishPattern, bearishPattern]);

      expect(relationships.length).toBe(1);
      expect(relationships[0]?.relationshipType).toBe('conflicting');
    });

    it('should not create relationships for patterns with <30% overlap', () => {
      const pattern1 = createTestSupportPattern(1000, 5000, 100);
      const pattern2 = createTestSupportPattern(6000, 10000, 105);

      const relationships = buildPatternRelationships([pattern1, pattern2]);

      expect(relationships.length).toBe(0);
    });
  });

  describe('calculateFormationPeriod', () => {
    it('should calculate formation period in number of candles', () => {
      const candles = createTestCandles(100, 100, 60000); // 1-minute candles
      const pattern = createTestSupportPattern(
        candles[10].timestamp,
        candles[60].timestamp,
        100
      );

      const formationPeriod = calculateFormationPeriod(pattern, candles);

      expect(formationPeriod).toBeGreaterThanOrEqual(48);
      expect(formationPeriod).toBeLessThanOrEqual(52);
    });

    it('should return 1 for patterns shorter than one candle interval', () => {
      const candles = createTestCandles(100, 100, 60000);
      const pattern = createTestSupportPattern(1000, 1100, 100);

      const formationPeriod = calculateFormationPeriod(pattern, candles);

      expect(formationPeriod).toBe(1);
    });

    it('should handle empty candle array', () => {
      const pattern = createTestSupportPattern(1000, 5000, 100);

      const formationPeriod = calculateFormationPeriod(pattern, []);

      expect(formationPeriod).toBe(0);
    });
  });

  describe('classifyPatternTier', () => {
    it('should classify pattern with 100+ candles as MACRO', () => {
      const candles = createTestCandles(200, 100, 60000);
      const pattern = createTestSupportPattern(
        candles[0].timestamp,
        candles[150].timestamp,
        100
      );

      const tier = classifyPatternTier(pattern, candles);

      expect(tier).toBe(PatternTier.MACRO);
    });

    it('should classify pattern with 50-100 candles as MAJOR', () => {
      const candles = createTestCandles(200, 100, 60000);
      const pattern = createTestSupportPattern(
        candles[0].timestamp,
        candles[75].timestamp,
        100
      );

      const tier = classifyPatternTier(pattern, candles);

      expect(tier).toBe(PatternTier.MAJOR);
    });

    it('should classify pattern with 20-50 candles as INTERMEDIATE', () => {
      const candles = createTestCandles(200, 100, 60000);
      const pattern = createTestSupportPattern(
        candles[0].timestamp,
        candles[35].timestamp,
        100
      );

      const tier = classifyPatternTier(pattern, candles);

      expect(tier).toBe(PatternTier.INTERMEDIATE);
    });

    it('should classify pattern with 10-20 candles as MINOR', () => {
      const candles = createTestCandles(200, 100, 60000);
      const pattern = createTestSupportPattern(
        candles[0].timestamp,
        candles[15].timestamp,
        100
      );

      const tier = classifyPatternTier(pattern, candles);

      expect(tier).toBe(PatternTier.MINOR);
    });

    it('should classify pattern with <10 candles as MICRO', () => {
      const candles = createTestCandles(200, 100, 60000);
      const pattern = createTestSupportPattern(
        candles[0].timestamp,
        candles[5].timestamp,
        100
      );

      const tier = classifyPatternTier(pattern, candles);

      expect(tier).toBe(PatternTier.MICRO);
    });
  });

  describe('Edge Cases', () => {
    it('should handle patterns with same timestamps', () => {
      const pattern1 = createTestSupportPattern(1000, 1000, 100);
      const pattern2 = createTestSupportPattern(1000, 1000, 105);

      const timeOverlap = detectTimeOverlap(pattern1, pattern2);
      const priceOverlap = detectPriceOverlap(pattern1, pattern2);

      expect(timeOverlap).toBe(0);
      expect(priceOverlap).toBe(0);
    });

    it('should handle Head and Shoulders pattern correctly', () => {
      const candles = createTestCandles(100, 100, 60000);
      const pattern = createTestHeadAndShouldersPattern(candles[10].timestamp, 100);

      const formationPeriod = calculateFormationPeriod(pattern, candles);
      const tier = classifyPatternTier(pattern, candles);

      expect(formationPeriod).toBeGreaterThan(0);
      expect(tier).toBeDefined();
    });

    it('should handle complex multi-pattern scenario', () => {
      const longTermTriangle = createTestTrianglePattern(1000, 100000, 80, 120);
      const mediumTermSupport = createTestSupportPattern(10000, 50000, 90);
      const shortTermResistance: AIPattern = {
        id: 3,
        type: 'resistance',
        points: [
          { timestamp: 20000, price: 110 },
          { timestamp: 30000, price: 110 },
        ],
        confidence: 0.6,
        visible: true,
        timestamp: 20000,
      };

      const relationships = buildPatternRelationships([
        longTermTriangle,
        mediumTermSupport,
        shortTermResistance,
      ]);

      expect(relationships.length).toBeGreaterThan(0);
      expect(relationships.every(r =>
        r.relationshipType === 'nested' || r.relationshipType === 'overlapping'
      )).toBe(true);
    });
  });
});
