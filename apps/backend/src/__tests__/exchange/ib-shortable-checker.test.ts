import { describe, it, expect } from 'vitest';

const SHORTABILITY_THRESHOLDS = {
  UNAVAILABLE: 1.5,
  HARD_TO_BORROW: 2.5,
} as const;

type ShortDifficulty = 'easy' | 'hard' | 'unavailable';

const classifyShortability = (shortableValue: number): ShortDifficulty => {
  if (shortableValue <= SHORTABILITY_THRESHOLDS.UNAVAILABLE) {
    return 'unavailable';
  }
  if (shortableValue <= SHORTABILITY_THRESHOLDS.HARD_TO_BORROW) {
    return 'hard';
  }
  return 'easy';
};

const estimateSharesAvailable = (shortableValue: number): number => {
  if (shortableValue <= SHORTABILITY_THRESHOLDS.UNAVAILABLE) {
    return 0;
  }
  if (shortableValue <= SHORTABILITY_THRESHOLDS.HARD_TO_BORROW) {
    return Math.floor((shortableValue - 1.5) * 1000);
  }
  return 1000 + Math.floor((shortableValue - 2.5) * 10000);
};

describe('ShortableChecker', () => {
  describe('classifyShortability', () => {
    it('should classify values <= 1.5 as unavailable', () => {
      expect(classifyShortability(0)).toBe('unavailable');
      expect(classifyShortability(1.0)).toBe('unavailable');
      expect(classifyShortability(1.5)).toBe('unavailable');
    });

    it('should classify values > 1.5 and <= 2.5 as hard to borrow', () => {
      expect(classifyShortability(1.6)).toBe('hard');
      expect(classifyShortability(2.0)).toBe('hard');
      expect(classifyShortability(2.5)).toBe('hard');
    });

    it('should classify values > 2.5 as easy to borrow', () => {
      expect(classifyShortability(2.6)).toBe('easy');
      expect(classifyShortability(3.0)).toBe('easy');
      expect(classifyShortability(10.0)).toBe('easy');
    });
  });

  describe('estimateSharesAvailable', () => {
    it('should return 0 for unavailable stocks', () => {
      expect(estimateSharesAvailable(0)).toBe(0);
      expect(estimateSharesAvailable(1.0)).toBe(0);
      expect(estimateSharesAvailable(1.5)).toBe(0);
    });

    it('should estimate shares for hard to borrow stocks', () => {
      expect(estimateSharesAvailable(1.6)).toBe(100);
      expect(estimateSharesAvailable(2.0)).toBe(500);
      expect(estimateSharesAvailable(2.5)).toBe(1000);
    });

    it('should estimate shares for easy to borrow stocks', () => {
      expect(estimateSharesAvailable(2.6)).toBe(2000);
      expect(estimateSharesAvailable(3.0)).toBe(6000);
      expect(estimateSharesAvailable(3.5)).toBe(11000);
    });
  });

  describe('ShortabilityInfo structure', () => {
    it('should have correct structure for unavailable stock', () => {
      const shortableValue = 1.0;
      const difficulty = classifyShortability(shortableValue);
      const sharesAvailable = estimateSharesAvailable(shortableValue);

      const info = {
        symbol: 'TEST',
        available: difficulty !== 'unavailable',
        difficulty,
        sharesAvailable,
      };

      expect(info.symbol).toBe('TEST');
      expect(info.available).toBe(false);
      expect(info.difficulty).toBe('unavailable');
      expect(info.sharesAvailable).toBe(0);
    });

    it('should have correct structure for hard to borrow stock', () => {
      const shortableValue = 2.0;
      const difficulty = classifyShortability(shortableValue);
      const sharesAvailable = estimateSharesAvailable(shortableValue);

      const info = {
        symbol: 'TEST',
        available: difficulty !== 'unavailable',
        difficulty,
        sharesAvailable,
      };

      expect(info.available).toBe(true);
      expect(info.difficulty).toBe('hard');
      expect(info.sharesAvailable).toBe(500);
    });

    it('should have correct structure for easy to borrow stock', () => {
      const shortableValue = 3.0;
      const difficulty = classifyShortability(shortableValue);
      const sharesAvailable = estimateSharesAvailable(shortableValue);

      const info = {
        symbol: 'TEST',
        available: difficulty !== 'unavailable',
        difficulty,
        sharesAvailable,
      };

      expect(info.available).toBe(true);
      expect(info.difficulty).toBe('easy');
      expect(info.sharesAvailable).toBe(6000);
    });
  });

  describe('Edge cases', () => {
    it('should handle boundary values correctly', () => {
      expect(classifyShortability(1.5)).toBe('unavailable');
      expect(classifyShortability(1.51)).toBe('hard');

      expect(classifyShortability(2.5)).toBe('hard');
      expect(classifyShortability(2.51)).toBe('easy');
    });

    it('should handle negative values', () => {
      expect(classifyShortability(-1)).toBe('unavailable');
      expect(estimateSharesAvailable(-1)).toBe(0);
    });

    it('should handle very large values', () => {
      expect(classifyShortability(100)).toBe('easy');
      expect(estimateSharesAvailable(100)).toBe(976000);
    });
  });
});
