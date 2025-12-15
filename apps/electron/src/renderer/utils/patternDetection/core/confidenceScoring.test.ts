import { describe, expect, it } from 'vitest';
import {
  calculateConfidence,
  calculateSymmetryScore,
  normalizeTimeInPattern,
  normalizeTouchPoints,
} from './confidenceScoring';

describe('confidenceScoring', () => {
  describe('calculateConfidence', () => {
    it('should return 0 when all factors are 0', () => {
      const result = calculateConfidence({
        touchPoints: 0,
        volumeConfirmation: 0,
        timeInPattern: 0,
        symmetry: 0,
      });
      expect(result).toBe(0);
    });

    it('should return 1 when all factors are 1', () => {
      const result = calculateConfidence({
        touchPoints: 1,
        volumeConfirmation: 1,
        timeInPattern: 1,
        symmetry: 1,
      });
      expect(result).toBe(1);
    });

    it('should weight factors correctly (30/30/20/20)', () => {
      const result = calculateConfidence({
        touchPoints: 1,
        volumeConfirmation: 0,
        timeInPattern: 0,
        symmetry: 0,
      });
      expect(result).toBe(0.3);
    });

    it('should weight volumeConfirmation at 30%', () => {
      const result = calculateConfidence({
        touchPoints: 0,
        volumeConfirmation: 1,
        timeInPattern: 0,
        symmetry: 0,
      });
      expect(result).toBe(0.3);
    });

    it('should weight timeInPattern at 20%', () => {
      const result = calculateConfidence({
        touchPoints: 0,
        volumeConfirmation: 0,
        timeInPattern: 1,
        symmetry: 0,
      });
      expect(result).toBe(0.2);
    });

    it('should weight symmetry at 20%', () => {
      const result = calculateConfidence({
        touchPoints: 0,
        volumeConfirmation: 0,
        timeInPattern: 0,
        symmetry: 1,
      });
      expect(result).toBe(0.2);
    });

    it('should calculate mixed factors correctly', () => {
      const result = calculateConfidence({
        touchPoints: 0.5,
        volumeConfirmation: 0.5,
        timeInPattern: 0.5,
        symmetry: 0.5,
      });
      expect(result).toBe(0.5);
    });

    it('should clamp result to max 1', () => {
      const result = calculateConfidence({
        touchPoints: 2,
        volumeConfirmation: 2,
        timeInPattern: 2,
        symmetry: 2,
      });
      expect(result).toBe(1);
    });

    it('should clamp result to min 0', () => {
      const result = calculateConfidence({
        touchPoints: -1,
        volumeConfirmation: -1,
        timeInPattern: -1,
        symmetry: -1,
      });
      expect(result).toBe(0);
    });

    it('should use default values for missing factors', () => {
      const result = calculateConfidence({});
      expect(result).toBe(0);
    });

    it('should handle partial factors', () => {
      const result = calculateConfidence({
        touchPoints: 1,
        symmetry: 1,
      });
      expect(result).toBe(0.5);
    });
  });

  describe('normalizeTouchPoints', () => {
    it('should return 0 for zero touches', () => {
      const result = normalizeTouchPoints(0);
      expect(result).toBe(0);
    });

    it('should return 0 for negative touches', () => {
      const result = normalizeTouchPoints(-1);
      expect(result).toBe(0);
    });

    it('should return 1 for touches >= idealTouches', () => {
      const result = normalizeTouchPoints(3, 3);
      expect(result).toBe(1);
    });

    it('should return 1 for touches > idealTouches', () => {
      const result = normalizeTouchPoints(5, 3);
      expect(result).toBe(1);
    });

    it('should return ratio for touches < idealTouches', () => {
      const result = normalizeTouchPoints(1, 3);
      expect(result).toBeCloseTo(0.333, 2);
    });

    it('should return 2/3 for 2 touches with ideal 3', () => {
      const result = normalizeTouchPoints(2, 3);
      expect(result).toBeCloseTo(0.667, 2);
    });

    it('should use default idealTouches of 3', () => {
      const result = normalizeTouchPoints(2);
      expect(result).toBeCloseTo(0.667, 2);
    });

    it('should handle custom idealTouches', () => {
      const result = normalizeTouchPoints(3, 6);
      expect(result).toBe(0.5);
    });

    it('should return 1 for 1 touch with ideal 1', () => {
      const result = normalizeTouchPoints(1, 1);
      expect(result).toBe(1);
    });
  });

  describe('normalizeTimeInPattern', () => {
    it('should return 0 when klineCount < minKlines', () => {
      const result = normalizeTimeInPattern(5, 10, 50);
      expect(result).toBe(0);
    });

    it('should return 0 when klineCount equals 0', () => {
      const result = normalizeTimeInPattern(0, 10, 50);
      expect(result).toBe(0);
    });

    it('should return 1 when klineCount >= idealKlines', () => {
      const result = normalizeTimeInPattern(50, 10, 50);
      expect(result).toBe(1);
    });

    it('should return 1 when klineCount > idealKlines', () => {
      const result = normalizeTimeInPattern(100, 10, 50);
      expect(result).toBe(1);
    });

    it('should return 0 when klineCount equals minKlines', () => {
      const result = normalizeTimeInPattern(10, 10, 50);
      expect(result).toBe(0);
    });

    it('should return linear ratio between min and ideal', () => {
      const result = normalizeTimeInPattern(30, 10, 50);
      expect(result).toBe(0.5);
    });

    it('should return 0.25 at 25% between min and ideal', () => {
      const result = normalizeTimeInPattern(20, 10, 50);
      expect(result).toBe(0.25);
    });

    it('should return 0.75 at 75% between min and ideal', () => {
      const result = normalizeTimeInPattern(40, 10, 50);
      expect(result).toBe(0.75);
    });

    it('should handle equal min and ideal', () => {
      const result = normalizeTimeInPattern(10, 10, 10);
      expect(result).toBe(1);
    });
  });

  describe('calculateSymmetryScore', () => {
    it('should return 1 for identical values', () => {
      const result = calculateSymmetryScore(100, 100);
      expect(result).toBe(1);
    });

    it('should return 1 when difference is within tolerance', () => {
      const result = calculateSymmetryScore(100, 105, 0.05);
      expect(result).toBe(1);
    });

    it('should return 0 for avg of 0', () => {
      const result = calculateSymmetryScore(0, 0);
      expect(result).toBe(0);
    });

    it('should return 0 when difference >= tolerance * 3', () => {
      const result = calculateSymmetryScore(100, 120, 0.05);
      expect(result).toBe(0);
    });

    it('should return interpolated value between tolerance and 3x tolerance', () => {
      const result = calculateSymmetryScore(100, 110, 0.05);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThan(1);
    });

    it('should handle reversed values symmetrically', () => {
      const result1 = calculateSymmetryScore(100, 110, 0.05);
      const result2 = calculateSymmetryScore(110, 100, 0.05);
      expect(result1).toBe(result2);
    });

    it('should use default tolerance of 0.05', () => {
      const result = calculateSymmetryScore(100, 105);
      expect(result).toBe(1);
    });

    it('should handle very small values', () => {
      const result = calculateSymmetryScore(0.001, 0.001);
      expect(result).toBe(1);
    });

    it('should handle large values', () => {
      const result = calculateSymmetryScore(100000, 100000);
      expect(result).toBe(1);
    });

    it('should return partial score for borderline difference', () => {
      const result = calculateSymmetryScore(100, 107.5, 0.05);
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(1);
    });
  });
});
