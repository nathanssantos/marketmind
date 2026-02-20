import { describe, expect, it, beforeEach } from 'vitest';
import {
  FullSystemOptimizer,
  OPTIMIZATION_PRESETS,
  type FullSystemPreset,
} from '../FullSystemOptimizer';

describe('FullSystemOptimizer', () => {
  let optimizer: FullSystemOptimizer;

  beforeEach(() => {
    optimizer = new FullSystemOptimizer();
  });

  describe('OPTIMIZATION_PRESETS', () => {
    it('should have three presets: quick, balanced, thorough', () => {
      expect(OPTIMIZATION_PRESETS).toHaveProperty('quick');
      expect(OPTIMIZATION_PRESETS).toHaveProperty('balanced');
      expect(OPTIMIZATION_PRESETS).toHaveProperty('thorough');
    });

    it('quick preset should have correct configuration', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      expect(preset.name).toBe('quick');
      expect(preset.walkForward).toBe(false);
      expect(preset.topResultsForValidation).toBe(0);
      expect(preset.mlThresholds.length).toBe(2);
    });

    it('balanced preset should have walk-forward enabled', () => {
      const preset = OPTIMIZATION_PRESETS['balanced']!;
      expect(preset.name).toBe('balanced');
      expect(preset.walkForward).toBe(true);
      expect(preset.topResultsForValidation).toBe(10);
      expect(preset.mlThresholds.length).toBe(4);
    });

    it('thorough preset should have most combinations', () => {
      const preset = OPTIMIZATION_PRESETS['thorough']!;
      expect(preset.name).toBe('thorough');
      expect(preset.walkForward).toBe(true);
      expect(preset.topResultsForValidation).toBe(20);
      expect(preset.mlThresholds.length).toBeGreaterThan(4);
    });

    it('all presets should have valid ml thresholds between 0 and 1', () => {
      for (const preset of Object.values(OPTIMIZATION_PRESETS)) {
        for (const threshold of preset.mlThresholds) {
          expect(threshold).toBeGreaterThan(0);
          expect(threshold).toBeLessThanOrEqual(1);
        }
      }
    });

    it('all presets should have valid pyramiding configs', () => {
      for (const preset of Object.values(OPTIMIZATION_PRESETS)) {
        expect(preset.pyramiding.profitThreshold.length).toBeGreaterThan(0);
        expect(preset.pyramiding.scaleFactor.length).toBeGreaterThan(0);
        expect(preset.pyramiding.maxEntries.length).toBeGreaterThan(0);
        for (const pf of preset.pyramiding.profitThreshold) {
          expect(pf).toBeGreaterThan(0);
          expect(pf).toBeLessThan(1);
        }
        for (const sf of preset.pyramiding.scaleFactor) {
          expect(sf).toBeGreaterThan(0);
          expect(sf).toBeLessThanOrEqual(1);
        }
      }
    });

    it('all presets should have valid trailing stop configs', () => {
      for (const preset of Object.values(OPTIMIZATION_PRESETS)) {
        expect(preset.trailingStop.minTrailingDistancePercent.length).toBeGreaterThan(0);
        for (const md of preset.trailingStop.minTrailingDistancePercent) {
          expect(md).toBeGreaterThan(0);
          expect(md).toBeLessThan(1);
        }
      }
    });
  });

  describe('generateCombinations', () => {
    it('should generate correct number of combinations for quick preset', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const combinations = optimizer.generateCombinations(preset);
      const expectedCount = optimizer.countCombinations(preset);
      expect(combinations.length).toBe(expectedCount);
      expect(combinations.length).toBe(4);
    });

    it('should generate correct number of combinations for balanced preset', () => {
      const preset = OPTIMIZATION_PRESETS['balanced']!;
      const combinations = optimizer.generateCombinations(preset);
      const expectedCount = optimizer.countCombinations(preset);
      expect(combinations.length).toBe(expectedCount);
      expect(combinations.length).toBe(144);
    });

    it('should generate all unique combinations', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const combinations = optimizer.generateCombinations(preset);
      const stringified = combinations.map(c => JSON.stringify(c));
      const unique = new Set(stringified);
      expect(unique.size).toBe(combinations.length);
    });

    it('should include mlThreshold in each combination', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const combinations = optimizer.generateCombinations(preset);
      for (const combination of combinations) {
        expect(combination).toHaveProperty('mlThreshold');
        expect(preset.mlThresholds).toContain(combination.mlThreshold);
      }
    });

    it('should include pyramiding params in each combination', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const combinations = optimizer.generateCombinations(preset);
      for (const combination of combinations) {
        expect(combination).toHaveProperty('pyramiding');
        expect(combination.pyramiding).toHaveProperty('profitThreshold');
        expect(combination.pyramiding).toHaveProperty('scaleFactor');
        expect(combination.pyramiding).toHaveProperty('maxEntries');
      }
    });

    it('should include trailing stop params in each combination', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const combinations = optimizer.generateCombinations(preset);
      for (const combination of combinations) {
        expect(combination).toHaveProperty('trailingStop');
        expect(combination.trailingStop).toHaveProperty('minTrailingDistancePercent');
      }
    });
  });

  describe('countCombinations', () => {
    it('should correctly calculate combinations for quick preset', () => {
      const preset = OPTIMIZATION_PRESETS['quick']!;
      const count = optimizer.countCombinations(preset);
      expect(count).toBe(2 * 1 * 1 * 2 * 1);
    });

    it('should correctly calculate combinations for balanced preset', () => {
      const preset = OPTIMIZATION_PRESETS['balanced']!;
      const count = optimizer.countCombinations(preset);
      expect(count).toBe(4 * 3 * 3 * 2 * 2);
    });

    it('should return larger count for thorough vs balanced', () => {
      const balancedCount = optimizer.countCombinations(OPTIMIZATION_PRESETS['balanced']!);
      const thoroughCount = optimizer.countCombinations(OPTIMIZATION_PRESETS['thorough']!);
      expect(thoroughCount).toBeGreaterThan(balancedCount);
    });
  });

  describe('getPreset', () => {
    it('should return preset for valid name', () => {
      const preset = optimizer.getPreset('balanced');
      expect(preset).toBeDefined();
      expect(preset?.name).toBe('balanced');
    });

    it('should return undefined for invalid name', () => {
      const preset = optimizer.getPreset('nonexistent');
      expect(preset).toBeUndefined();
    });
  });

  describe('listPresets', () => {
    it('should return all preset names', () => {
      const presets = optimizer.listPresets();
      expect(presets).toContain('quick');
      expect(presets).toContain('balanced');
      expect(presets).toContain('thorough');
      expect(presets.length).toBe(3);
    });
  });

  describe('combination structure', () => {
    it('should create valid combination structure', () => {
      const preset: FullSystemPreset = {
        name: 'quick',
        mlThresholds: [0.05],
        pyramiding: {
          profitThreshold: [0.01],
          scaleFactor: [0.8],
          maxEntries: [3],
        },
        trailingStop: {
          minTrailingDistancePercent: [0.002],
        },
        walkForward: false,
        topResultsForValidation: 0,
      };

      const combinations = optimizer.generateCombinations(preset);
      expect(combinations.length).toBe(1);

      const [combination] = combinations;
      expect(combination).toEqual({
        mlThreshold: 0.05,
        pyramiding: {
          profitThreshold: 0.01,
          scaleFactor: 0.8,
          maxEntries: 3,
        },
        trailingStop: {
          minTrailingDistancePercent: 0.002,
        },
      });
    });

    it('should iterate through all combinations correctly', () => {
      const preset: FullSystemPreset = {
        name: 'quick',
        mlThresholds: [0.03, 0.05],
        pyramiding: {
          profitThreshold: [0.01],
          scaleFactor: [0.8],
          maxEntries: [3],
        },
        trailingStop: {
          minTrailingDistancePercent: [0.002],
        },
        walkForward: false,
        topResultsForValidation: 0,
      };

      const combinations = optimizer.generateCombinations(preset);
      expect(combinations.length).toBe(2);

      const thresholds = combinations.map(c => c.mlThreshold);
      expect(thresholds).toContain(0.03);
      expect(thresholds).toContain(0.05);
    });
  });
});
