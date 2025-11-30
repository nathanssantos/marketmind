import { describe, expect, it } from 'vitest';
import type { Kline } from '../../../../shared/types';
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

const createTestKlines = (count: number, basePrice: number, intervalMs: number = 60000): Kline[] => {
  const klines: Kline[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    klines.push({
      openTime: now + i * intervalMs,
      open: basePrice,
      high: basePrice + 10,
      low: basePrice - 10,
      close: basePrice,
      volume: 1000,
    });
  }

  return klines;
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
    { openTime: startTime, price },
    { openTime: endTime, price },
  ],
  confidence: 0.8,
  visible: true,
  openTime: startTime,
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
    { openTime: startTime, price: maxPrice },
    { openTime: endTime, price: maxPrice },
  ],
  lowerTrendline: [
    { openTime: startTime, price: minPrice },
    { openTime: endTime, price: minPrice + 20 },
  ],
  confidence: 0.7,
  visible: true,
  openTime: startTime,
});

const createTestHeadAndShouldersPattern = (
  baseTime: number,
  basePrice: number
): AIPattern => ({
  id: 3,
  type: 'head-and-shoulders',
  leftShoulder: { openTime: baseTime, price: basePrice + 10 },
  head: { openTime: baseTime + 20000, price: basePrice + 20 },
  rightShoulder: { openTime: baseTime + 40000, price: basePrice + 10 },
  neckline: [
    { openTime: baseTime, price: basePrice },
    { openTime: baseTime + 40000, price: basePrice },
  ],
  confidence: 0.9,
  visible: true,
  openTime: baseTime,
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
        firstPeak: { openTime: 1000, price: 90 },
        secondPeak: { openTime: 5000, price: 90 },
        neckline: { openTime: 3000, price: 105 },
        confidence: 0.8,
        visible: true,
        openTime: 1000,
      };

      const bearishPattern: AIPattern = {
        id: 2,
        type: 'double-top',
        firstPeak: { openTime: 1500, price: 110 },
        secondPeak: { openTime: 4500, price: 110 },
        neckline: { openTime: 3000, price: 95 },
        confidence: 0.7,
        visible: true,
        openTime: 1500,
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
    it('should calculate formation period in number of klines', () => {
      const klines = createTestKlines(100, 100, 60000); // 1-minute klines
      const pattern = createTestSupportPattern(
        klines[10].openTime,
        klines[60].openTime,
        100
      );

      const formationPeriod = calculateFormationPeriod(pattern, klines);

      expect(formationPeriod).toBeGreaterThanOrEqual(48);
      expect(formationPeriod).toBeLessThanOrEqual(52);
    });

    it('should return 1 for patterns shorter than one kline interval', () => {
      const klines = createTestKlines(100, 100, 60000);
      const pattern = createTestSupportPattern(1000, 1100, 100);

      const formationPeriod = calculateFormationPeriod(pattern, klines);

      expect(formationPeriod).toBe(1);
    });

    it('should handle empty kline array', () => {
      const pattern = createTestSupportPattern(1000, 5000, 100);

      const formationPeriod = calculateFormationPeriod(pattern, []);

      expect(formationPeriod).toBe(0);
    });
  });

  describe('classifyPatternTier', () => {
    it('should classify pattern with 100+ klines as MACRO', () => {
      const klines = createTestKlines(200, 100, 60000);
      const pattern = createTestSupportPattern(
        klines[0].openTime,
        klines[150].openTime,
        100
      );

      const tier = classifyPatternTier(pattern, klines);

      expect(tier).toBe(PatternTier.MACRO);
    });

    it('should classify pattern with 50-100 klines as MAJOR', () => {
      const klines = createTestKlines(200, 100, 60000);
      const pattern = createTestSupportPattern(
        klines[0].openTime,
        klines[75].openTime,
        100
      );

      const tier = classifyPatternTier(pattern, klines);

      expect(tier).toBe(PatternTier.MAJOR);
    });

    it('should classify pattern with 20-50 klines as INTERMEDIATE', () => {
      const klines = createTestKlines(200, 100, 60000);
      const pattern = createTestSupportPattern(
        klines[0].openTime,
        klines[35].openTime,
        100
      );

      const tier = classifyPatternTier(pattern, klines);

      expect(tier).toBe(PatternTier.INTERMEDIATE);
    });

    it('should classify pattern with 10-20 klines as MINOR', () => {
      const klines = createTestKlines(200, 100, 60000);
      const pattern = createTestSupportPattern(
        klines[0].openTime,
        klines[15].openTime,
        100
      );

      const tier = classifyPatternTier(pattern, klines);

      expect(tier).toBe(PatternTier.MINOR);
    });

    it('should classify pattern with <10 klines as MICRO', () => {
      const klines = createTestKlines(200, 100, 60000);
      const pattern = createTestSupportPattern(
        klines[0].openTime,
        klines[5].openTime,
        100
      );

      const tier = classifyPatternTier(pattern, klines);

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
      const klines = createTestKlines(100, 100, 60000);
      const pattern = createTestHeadAndShouldersPattern(klines[10].openTime, 100);

      const formationPeriod = calculateFormationPeriod(pattern, klines);
      const tier = classifyPatternTier(pattern, klines);

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
          { openTime: 20000, price: 110 },
          { openTime: 30000, price: 110 },
        ],
        confidence: 0.6,
        visible: true,
        openTime: 20000,
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
