import { describe, expect, it } from 'vitest';
import type { AIStudy } from '../../../../shared/types';
import {
    applyCategoryLimits,
    applyTierLimits,
    filterAndPrioritizePatterns,
    resolveNestedPatterns,
    resolveOverlappingPatterns
} from './patternFilter';
import type { PatternRelationship } from './patternRelationships';

describe('patternFilter', () => {
  describe('resolveNestedPatterns', () => {
    it('should remove smaller nested pattern (KEEP LARGEST strategy)', () => {
      const largePattern: AIStudy = {
        id: 1,
        type: 'triangle-ascending',
        upperTrendline: [
          { timestamp: 1000, price: 100 },
          { timestamp: 5000, price: 105 },
        ],
        lowerTrendline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 95 },
        ],
        apex: { timestamp: 6000, price: 105 },
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const smallPattern: AIStudy = {
        id: 2,
        type: 'support',
        points: [
          { timestamp: 2000, price: 92 },
          { timestamp: 4000, price: 93 },
        ],
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
      };

      const patterns = [largePattern, smallPattern];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: largePattern,
          childPattern: smallPattern,
          relationshipType: 'nested',
          overlapPercentage: 95,
          timeOverlap: 90,
          priceOverlap: 85,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should keep multiple patterns when no nesting exists', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 6000, price: 110 },
        secondPeak: { timestamp: 10000, price: 110 },
        neckline: { timestamp: 8000, price: 95 },
        confidence: 0.7,
        visible: true,
        timestamp: 6000,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle multiple nested patterns (chain)', () => {
      const macro: AIStudy = {
        id: 1,
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1000, price: 100 },
        head: { timestamp: 3000, price: 110 },
        rightShoulder: { timestamp: 5000, price: 100 },
        neckline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 6000, price: 90 },
        ],
        confidence: 0.9,
        visible: true,
        timestamp: 1000,
      };

      const major: AIStudy = {
        id: 2,
        type: 'triangle-descending',
        upperTrendline: [
          { timestamp: 1500, price: 105 },
          { timestamp: 4500, price: 95 },
        ],
        lowerTrendline: [
          { timestamp: 1500, price: 90 },
          { timestamp: 4500, price: 90 },
        ],
        apex: { timestamp: 5000, price: 90 },
        confidence: 0.8,
        visible: true,
        timestamp: 1500,
      };

      const minor: AIStudy = {
        id: 3,
        type: 'support',
        points: [
          { timestamp: 2000, price: 92 },
          { timestamp: 4000, price: 93 },
        ],
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
      };

      const patterns = [macro, major, minor];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: macro,
          childPattern: major,
          relationshipType: 'nested',
          overlapPercentage: 90,
          timeOverlap: 85,
          priceOverlap: 80,
        },
        {
          parentPattern: major,
          childPattern: minor,
          relationshipType: 'nested',
          overlapPercentage: 95,
          timeOverlap: 92,
          priceOverlap: 88,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use confidence as tiebreaker when durations are equal', () => {
      const highConfidence: AIStudy = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.9,
        visible: true,
        timestamp: 1000,
      };

      const lowConfidence: AIStudy = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 1000, price: 110 },
        secondPeak: { timestamp: 5000, price: 110 },
        neckline: { timestamp: 3000, price: 95 },
        confidence: 0.5,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [highConfidence, lowConfidence];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: highConfidence,
          childPattern: lowConfidence,
          relationshipType: 'nested',
          overlapPercentage: 100,
          timeOverlap: 100,
          priceOverlap: 70,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use ID as final tiebreaker (keep lower ID)', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'resistance',
        points: [
          { timestamp: 1000, price: 100 },
          { timestamp: 5000, price: 100 },
        ],
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'nested',
          overlapPercentage: 100,
          timeOverlap: 100,
          priceOverlap: 50,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should ignore non-nested relationships', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 1500, price: 110 },
        secondPeak: { timestamp: 4500, price: 110 },
        neckline: { timestamp: 3000, price: 95 },
        confidence: 0.7,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'overlapping',
          overlapPercentage: 60,
          timeOverlap: 75,
          priceOverlap: 50,
        },
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'conflicting',
          overlapPercentage: 60,
          timeOverlap: 75,
          priceOverlap: 50,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle patterns without IDs gracefully', () => {
      const patternWithId: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const patternWithoutId: AIStudy = {
        type: 'resistance',
        points: [
          { timestamp: 2000, price: 100 },
          { timestamp: 4000, price: 100 },
        ],
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
      };

      const patterns = [patternWithId, patternWithoutId];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: patternWithId,
          childPattern: patternWithoutId,
          relationshipType: 'nested',
          overlapPercentage: 90,
          timeOverlap: 85,
          priceOverlap: 80,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle empty patterns list', () => {
      const result = resolveNestedPatterns([], []);
      expect(result).toEqual([]);
    });

    it('should handle empty relationships list', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [pattern1];
      const result = resolveNestedPatterns(patterns, []);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should handle reverse nested relationship (smaller parent, larger child)', () => {
      const smallPattern: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 2000, price: 92 },
          { timestamp: 4000, price: 93 },
        ],
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
      };

      const largePattern: AIStudy = {
        id: 2,
        type: 'triangle-ascending',
        upperTrendline: [
          { timestamp: 1000, price: 100 },
          { timestamp: 5000, price: 105 },
        ],
        lowerTrendline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 95 },
        ],
        apex: { timestamp: 6000, price: 105 },
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [smallPattern, largePattern];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: smallPattern,
          childPattern: largePattern,
          relationshipType: 'nested',
          overlapPercentage: 95,
          timeOverlap: 90,
          priceOverlap: 85,
        },
      ];

      const result = resolveNestedPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(2);
    });
  });

  describe('resolveOverlappingPatterns', () => {
    it('should remove pattern with lower importance score (KEEP HIGHEST IMPORTANCE)', () => {
      const highImportance: AIStudy = {
        id: 1,
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1000, price: 100 },
        head: { timestamp: 3000, price: 110 },
        rightShoulder: { timestamp: 5000, price: 100 },
        neckline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 6000, price: 90 },
        ],
        confidence: 0.9,
        importanceScore: 0.85,
        visible: true,
        timestamp: 1000,
      };

      const lowImportance: AIStudy = {
        id: 2,
        type: 'double-bottom',
        firstPeak: { timestamp: 2000, price: 92 },
        secondPeak: { timestamp: 4000, price: 92 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.7,
        importanceScore: 0.45,
        visible: true,
        timestamp: 2000,
      };

      const patterns = [highImportance, lowImportance];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: highImportance,
          childPattern: lowImportance,
          relationshipType: 'overlapping',
          overlapPercentage: 60,
          timeOverlap: 65,
          priceOverlap: 55,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should keep both patterns when no overlapping exists', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 3000, price: 90 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'resistance',
        points: [
          { timestamp: 5000, price: 110 },
          { timestamp: 7000, price: 110 },
        ],
        confidence: 0.7,
        importanceScore: 0.65,
        visible: true,
        timestamp: 5000,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle multiple overlapping patterns', () => {
      const highest: AIStudy = {
        id: 1,
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1000, price: 100 },
        head: { timestamp: 5000, price: 110 },
        rightShoulder: { timestamp: 9000, price: 100 },
        neckline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 10000, price: 90 },
        ],
        confidence: 0.9,
        importanceScore: 0.88,
        visible: true,
        timestamp: 1000,
      };

      const medium: AIStudy = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 2000, price: 108 },
        secondPeak: { timestamp: 6000, price: 108 },
        neckline: { timestamp: 4000, price: 95 },
        confidence: 0.8,
        importanceScore: 0.65,
        visible: true,
        timestamp: 2000,
      };

      const lowest: AIStudy = {
        id: 3,
        type: 'resistance',
        points: [
          { timestamp: 3000, price: 105 },
          { timestamp: 7000, price: 105 },
        ],
        confidence: 0.7,
        importanceScore: 0.42,
        visible: true,
        timestamp: 3000,
      };

      const patterns = [highest, medium, lowest];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: highest,
          childPattern: medium,
          relationshipType: 'overlapping',
          overlapPercentage: 70,
          timeOverlap: 75,
          priceOverlap: 65,
        },
        {
          parentPattern: medium,
          childPattern: lowest,
          relationshipType: 'overlapping',
          overlapPercentage: 80,
          timeOverlap: 85,
          priceOverlap: 75,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use confidence as tiebreaker when importance scores are equal', () => {
      const highConfidence: AIStudy = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.9,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const lowConfidence: AIStudy = {
        id: 2,
        type: 'support',
        points: [
          { timestamp: 1500, price: 92 },
          { timestamp: 4500, price: 92 },
        ],
        confidence: 0.6,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [highConfidence, lowConfidence];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: highConfidence,
          childPattern: lowConfidence,
          relationshipType: 'overlapping',
          overlapPercentage: 70,
          timeOverlap: 75,
          priceOverlap: 80,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should use ID as final tiebreaker (keep lower ID)', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'resistance',
        points: [
          { timestamp: 1500, price: 100 },
          { timestamp: 4500, price: 100 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'overlapping',
          overlapPercentage: 60,
          timeOverlap: 65,
          priceOverlap: 40,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should ignore non-overlapping relationships', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'double-bottom',
        firstPeak: { timestamp: 1000, price: 90 },
        secondPeak: { timestamp: 5000, price: 90 },
        neckline: { timestamp: 3000, price: 100 },
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const pattern2: AIStudy = {
        id: 2,
        type: 'double-top',
        firstPeak: { timestamp: 1500, price: 110 },
        secondPeak: { timestamp: 4500, price: 110 },
        neckline: { timestamp: 3000, price: 95 },
        confidence: 0.7,
        importanceScore: 0.65,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [pattern1, pattern2];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'nested',
          overlapPercentage: 90,
          timeOverlap: 85,
          priceOverlap: 70,
        },
        {
          parentPattern: pattern1,
          childPattern: pattern2,
          relationshipType: 'conflicting',
          overlapPercentage: 75,
          timeOverlap: 70,
          priceOverlap: 60,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle patterns without importance scores (default to 0)', () => {
      const withScore: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const withoutScore: AIStudy = {
        id: 2,
        type: 'resistance',
        points: [
          { timestamp: 1500, price: 100 },
          { timestamp: 4500, price: 100 },
        ],
        confidence: 0.7,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [withScore, withoutScore];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: withScore,
          childPattern: withoutScore,
          relationshipType: 'overlapping',
          overlapPercentage: 70,
          timeOverlap: 75,
          priceOverlap: 50,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should handle patterns without IDs gracefully', () => {
      const patternWithId: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const patternWithoutId: AIStudy = {
        type: 'resistance',
        points: [
          { timestamp: 1500, price: 100 },
          { timestamp: 4500, price: 100 },
        ],
        confidence: 0.7,
        importanceScore: 0.65,
        visible: true,
        timestamp: 1500,
      };

      const patterns = [patternWithId, patternWithoutId];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: patternWithId,
          childPattern: patternWithoutId,
          relationshipType: 'overlapping',
          overlapPercentage: 70,
          timeOverlap: 75,
          priceOverlap: 50,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(2);
    });

    it('should handle empty patterns list', () => {
      const result = resolveOverlappingPatterns([], []);
      expect(result).toEqual([]);
    });

    it('should handle empty relationships list', () => {
      const pattern1: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.8,
        importanceScore: 0.75,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [pattern1];
      const result = resolveOverlappingPatterns(patterns, []);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should handle reverse overlapping relationship (lower importance parent)', () => {
      const lowImportance: AIStudy = {
        id: 1,
        type: 'support',
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
        confidence: 0.7,
        importanceScore: 0.45,
        visible: true,
        timestamp: 1000,
      };

      const highImportance: AIStudy = {
        id: 2,
        type: 'head-and-shoulders',
        leftShoulder: { timestamp: 1000, price: 100 },
        head: { timestamp: 3000, price: 110 },
        rightShoulder: { timestamp: 5000, price: 100 },
        neckline: [
          { timestamp: 1000, price: 90 },
          { timestamp: 6000, price: 90 },
        ],
        confidence: 0.9,
        importanceScore: 0.85,
        visible: true,
        timestamp: 1000,
      };

      const patterns = [lowImportance, highImportance];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: lowImportance,
          childPattern: highImportance,
          relationshipType: 'overlapping',
          overlapPercentage: 60,
          timeOverlap: 65,
          priceOverlap: 55,
        },
      ];

      const result = resolveOverlappingPatterns(patterns, relationships);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(2);
    });
  });

  describe('applyTierLimits', () => {
    it('should limit patterns per tier keeping highest importance', () => {
      const patterns: AIStudy[] = [
        { id: 1, type: 'support', tier: 'macro', importanceScore: 0.9, confidence: 0.8, visible: true, timestamp: 1000 } as AIStudy,
        { id: 2, type: 'support', tier: 'macro', importanceScore: 0.7, confidence: 0.7, visible: true, timestamp: 2000 } as AIStudy,
        { id: 3, type: 'resistance', tier: 'major', importanceScore: 0.85, confidence: 0.8, visible: true, timestamp: 3000 } as AIStudy,
        { id: 4, type: 'resistance', tier: 'major', importanceScore: 0.6, confidence: 0.7, visible: true, timestamp: 4000 } as AIStudy,
      ];

      const maxPatternsPerTier = { macro: 1, major: 1, intermediate: 5, minor: 5 };
      const result = applyTierLimits(patterns, maxPatternsPerTier);

      expect(result.length).toBe(2);
      expect(result.find((p) => p.id === 1)).toBeDefined();
      expect(result.find((p) => p.id === 3)).toBeDefined();
    });

    it('should handle empty patterns array', () => {
      const result = applyTierLimits([], { macro: 5, major: 5, intermediate: 5, minor: 5 });
      expect(result.length).toBe(0);
    });
  });

  describe('applyCategoryLimits', () => {
    it('should limit patterns per category keeping highest importance', () => {
      const patterns: AIStudy[] = [
        { id: 1, type: 'support', importanceScore: 0.9, confidence: 0.8, visible: true, timestamp: 1000 } as AIStudy,
        { id: 2, type: 'resistance', importanceScore: 0.7, confidence: 0.7, visible: true, timestamp: 2000 } as AIStudy,
        { id: 3, type: 'double-top', importanceScore: 0.85, confidence: 0.8, visible: true, timestamp: 3000 } as AIStudy,
        { id: 4, type: 'double-bottom', importanceScore: 0.8, confidence: 0.8, visible: true, timestamp: 4000 } as AIStudy,
      ];

      const result = applyCategoryLimits(patterns, 1);

      expect(result.length).toBe(2);
      expect(result.find((p) => p.id === 1)).toBeDefined();
      expect(result.find((p) => p.id === 3)).toBeDefined();
    });

    it('should handle empty patterns array', () => {
      const result = applyCategoryLimits([], 5);
      expect(result.length).toBe(0);
    });
  });

  describe('filterAndPrioritizePatterns', () => {
    it('should apply all filtering phases in order', () => {
      const patterns: AIStudy[] = [
        { id: 1, type: 'support', tier: 'macro', importanceScore: 0.9, confidence: 0.8, visible: true, timestamp: 1000 } as AIStudy,
        { id: 2, type: 'resistance', tier: 'major', importanceScore: 0.85, confidence: 0.8, visible: true, timestamp: 2000 } as AIStudy,
        { id: 3, type: 'double-top', tier: 'major', importanceScore: 0.8, confidence: 0.7, visible: true, timestamp: 3000 } as AIStudy,
        { id: 4, type: 'double-bottom', tier: 'intermediate', importanceScore: 0.75, confidence: 0.7, visible: true, timestamp: 4000 } as AIStudy,
        { id: 5, type: 'support', tier: 'minor', importanceScore: 0.7, confidence: 0.6, visible: true, timestamp: 5000 } as AIStudy,
      ];

      const relationships: PatternRelationship[] = [];

      const config = {
        enableNestedFiltering: true,
        enableOverlapFiltering: true,
        maxPatternsPerTier: { macro: 10, major: 10, intermediate: 10, minor: 10 },
        maxPatternsPerCategory: 10,
        maxPatternsTotal: 3,
      };

      const result = filterAndPrioritizePatterns(patterns, relationships, config);

      expect(result.length).toBe(3);
      expect(result[0]?.id).toBe(1);
      expect(result[1]?.id).toBe(2);
      expect(result[2]?.id).toBe(3);
    });

    it('should respect global limit even with high tier limits', () => {
      const patterns: AIStudy[] = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        type: 'support',
        tier: 'macro',
        importanceScore: 1 - i * 0.01,
        confidence: 0.8,
        visible: true,
        timestamp: 1000 + i * 1000,
      } as AIStudy));

      const relationships: PatternRelationship[] = [];

      const config = {
        enableNestedFiltering: false,
        enableOverlapFiltering: false,
        maxPatternsPerTier: { macro: 100, major: 100, intermediate: 100, minor: 100 },
        maxPatternsPerCategory: 100,
        maxPatternsTotal: 20,
      };

      const result = filterAndPrioritizePatterns(patterns, relationships, config);

      expect(result.length).toBe(20);
      expect(result[0]?.importanceScore).toBeGreaterThan(result[19]!.importanceScore!);
    });

    it('should handle empty patterns array', () => {
      const config = {
        enableNestedFiltering: true,
        enableOverlapFiltering: true,
        maxPatternsPerTier: { macro: 10, major: 10, intermediate: 10, minor: 10 },
        maxPatternsPerCategory: 10,
        maxPatternsTotal: 20,
      };

      const result = filterAndPrioritizePatterns([], [], config);
      expect(result.length).toBe(0);
    });

    it('should apply nested filtering when enabled', () => {
      const largePattern: AIStudy = {
        id: 1,
        type: 'support',
        tier: 'macro',
        importanceScore: 0.9,
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
      };

      const smallPattern: AIStudy = {
        id: 2,
        type: 'support',
        tier: 'minor',
        importanceScore: 0.7,
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
        points: [
          { timestamp: 2000, price: 91 },
          { timestamp: 4000, price: 91 },
        ],
      };

      const patterns = [largePattern, smallPattern];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: largePattern,
          childPattern: smallPattern,
          relationshipType: 'nested',
          overlapPercentage: 95,
          timeOverlap: 90,
          priceOverlap: 85,
        },
      ];

      const config = {
        enableNestedFiltering: true,
        enableOverlapFiltering: false,
        maxPatternsPerTier: { macro: 10, major: 10, intermediate: 10, minor: 10 },
        maxPatternsPerCategory: 10,
        maxPatternsTotal: 20,
      };

      const result = filterAndPrioritizePatterns(patterns, relationships, config);

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe(1);
    });

    it('should skip nested filtering when disabled', () => {
      const largePattern: AIStudy = {
        id: 1,
        type: 'support',
        tier: 'macro',
        importanceScore: 0.9,
        confidence: 0.8,
        visible: true,
        timestamp: 1000,
        points: [
          { timestamp: 1000, price: 90 },
          { timestamp: 5000, price: 90 },
        ],
      };

      const smallPattern: AIStudy = {
        id: 2,
        type: 'support',
        tier: 'minor',
        importanceScore: 0.7,
        confidence: 0.7,
        visible: true,
        timestamp: 2000,
        points: [
          { timestamp: 2000, price: 91 },
          { timestamp: 4000, price: 91 },
        ],
      };

      const patterns = [largePattern, smallPattern];
      const relationships: PatternRelationship[] = [
        {
          parentPattern: largePattern,
          childPattern: smallPattern,
          relationshipType: 'nested',
          overlapPercentage: 95,
          timeOverlap: 90,
          priceOverlap: 85,
        },
      ];

      const config = {
        enableNestedFiltering: false,
        enableOverlapFiltering: false,
        maxPatternsPerTier: { macro: 10, major: 10, intermediate: 10, minor: 10 },
        maxPatternsPerCategory: 10,
        maxPatternsTotal: 20,
      };

      const result = filterAndPrioritizePatterns(patterns, relationships, config);

      expect(result.length).toBe(2);
    });
  });
});
