import { describe, it, expect, vi } from 'vitest';
import { ParameterGenerator, type ParameterGrid } from '../ParameterGenerator';

describe('ParameterGenerator', () => {
  describe('generateGrid', () => {
    it('should generate all combinations from parameter grid', () => {
      const grid: ParameterGrid = {
        stopLoss: [1, 2],
        takeProfit: [3, 4],
      };

      const combinations = ParameterGenerator.generateGrid(grid);

      expect(combinations).toHaveLength(4);
      expect(combinations).toContainEqual({ stopLoss: 1, takeProfit: 3 });
      expect(combinations).toContainEqual({ stopLoss: 1, takeProfit: 4 });
      expect(combinations).toContainEqual({ stopLoss: 2, takeProfit: 3 });
      expect(combinations).toContainEqual({ stopLoss: 2, takeProfit: 4 });
    });

    it('should handle 3 parameters', () => {
      const grid: ParameterGrid = {
        a: [1, 2],
        b: [3, 4],
        c: [5, 6],
      };

      const combinations = ParameterGenerator.generateGrid(grid);
      expect(combinations).toHaveLength(8);
    });

    it('should return empty array for empty grid', () => {
      const combinations = ParameterGenerator.generateGrid({});
      expect(combinations).toEqual([]);
    });

    it('should handle single parameter', () => {
      const grid: ParameterGrid = {
        param: [1, 2, 3],
      };

      const combinations = ParameterGenerator.generateGrid(grid);
      expect(combinations).toHaveLength(3);
      expect(combinations).toContainEqual({ param: 1 });
      expect(combinations).toContainEqual({ param: 2 });
      expect(combinations).toContainEqual({ param: 3 });
    });

    it('should handle single value per parameter', () => {
      const grid: ParameterGrid = {
        a: [1],
        b: [2],
      };

      const combinations = ParameterGenerator.generateGrid(grid);
      expect(combinations).toHaveLength(1);
      expect(combinations[0]).toEqual({ a: 1, b: 2 });
    });
  });

  describe('range', () => {
    it('should generate range with default step of 1', () => {
      const result = ParameterGenerator.range(1, 5);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should generate range with custom step', () => {
      const result = ParameterGenerator.range(0, 1, 0.25);
      expect(result).toEqual([0, 0.25, 0.5, 0.75, 1]);
    });

    it('should handle decimal values correctly', () => {
      const result = ParameterGenerator.range(0.1, 0.3, 0.1);
      expect(result).toEqual([0.1, 0.2, 0.3]);
    });

    it('should return single value when start equals end', () => {
      const result = ParameterGenerator.range(5, 5);
      expect(result).toEqual([5]);
    });

    it('should return empty array when start is greater than end', () => {
      const result = ParameterGenerator.range(5, 3);
      expect(result).toEqual([]);
    });
  });

  describe('parseArray', () => {
    it('should parse comma-separated numbers', () => {
      const result = ParameterGenerator.parseArray('1,2,3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle spaces around numbers', () => {
      const result = ParameterGenerator.parseArray('1 , 2 , 3');
      expect(result).toEqual([1, 2, 3]);
    });

    it('should parse decimal numbers', () => {
      const result = ParameterGenerator.parseArray('1.5,2.5,3.5');
      expect(result).toEqual([1.5, 2.5, 3.5]);
    });

    it('should filter out invalid values', () => {
      const result = ParameterGenerator.parseArray('1,invalid,3');
      expect(result).toEqual([1, 3]);
    });

    it('should return empty array for empty string', () => {
      const result = ParameterGenerator.parseArray('');
      expect(result).toEqual([]);
    });

    it('should handle negative numbers', () => {
      const result = ParameterGenerator.parseArray('-1,0,1');
      expect(result).toEqual([-1, 0, 1]);
    });
  });

  describe('countCombinations', () => {
    it('should count combinations correctly', () => {
      const grid: ParameterGrid = {
        a: [1, 2, 3],
        b: [4, 5, 6],
        c: [7, 8],
      };

      const count = ParameterGenerator.countCombinations(grid);
      expect(count).toBe(18);
    });

    it('should return 1 for empty grid', () => {
      const count = ParameterGenerator.countCombinations({});
      expect(count).toBe(1);
    });

    it('should handle single parameter', () => {
      const grid: ParameterGrid = {
        param: [1, 2, 3, 4, 5],
      };

      const count = ParameterGenerator.countCombinations(grid);
      expect(count).toBe(5);
    });
  });

  describe('chunk', () => {
    it('should split array into chunks', () => {
      const array = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const chunks = ParameterGenerator.chunk(array, 3);

      expect(chunks).toHaveLength(4);
      expect(chunks[0]).toEqual([1, 2, 3]);
      expect(chunks[1]).toEqual([4, 5, 6]);
      expect(chunks[2]).toEqual([7, 8, 9]);
      expect(chunks[3]).toEqual([10]);
    });

    it('should handle array smaller than chunk size', () => {
      const array = [1, 2];
      const chunks = ParameterGenerator.chunk(array, 5);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toEqual([1, 2]);
    });

    it('should handle empty array', () => {
      const chunks = ParameterGenerator.chunk([], 3);
      expect(chunks).toEqual([]);
    });

    it('should handle exact divisible array', () => {
      const array = [1, 2, 3, 4, 5, 6];
      const chunks = ParameterGenerator.chunk(array, 2);

      expect(chunks).toHaveLength(3);
      expect(chunks).toEqual([[1, 2], [3, 4], [5, 6]]);
    });
  });

  describe('validate', () => {
    it('should throw error for empty grid', () => {
      expect(() => ParameterGenerator.validate({})).toThrow('Parameter grid is empty');
    });

    it('should throw error for non-array values', () => {
      const grid = { param: 5 as unknown as number[] };
      expect(() => ParameterGenerator.validate(grid)).toThrow('must be an array');
    });

    it('should throw error for empty array', () => {
      const grid: ParameterGrid = { param: [] };
      expect(() => ParameterGenerator.validate(grid)).toThrow('has no values');
    });

    it('should throw error for invalid number values', () => {
      const grid = { param: [1, NaN, 3] };
      expect(() => ParameterGenerator.validate(grid)).toThrow('contains invalid value');
    });

    it('should pass for valid grid', () => {
      const grid: ParameterGrid = {
        a: [1, 2, 3],
        b: [4, 5],
      };

      expect(() => ParameterGenerator.validate(grid)).not.toThrow();
    });

    it('should warn for large grids', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const grid: ParameterGrid = {
        a: ParameterGenerator.range(1, 10),
        b: ParameterGenerator.range(1, 10),
        c: ParameterGenerator.range(1, 11),
      };

      ParameterGenerator.validate(grid);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('1100 combinations'));
      warnSpy.mockRestore();
    });
  });

  describe('integration', () => {
    it('should work with range to generate grid', () => {
      const grid: ParameterGrid = {
        stopLoss: ParameterGenerator.range(1, 3, 1),
        takeProfit: ParameterGenerator.range(2, 4, 1),
      };

      const combinations = ParameterGenerator.generateGrid(grid);
      expect(combinations).toHaveLength(9);
    });

    it('should work with parseArray to generate grid', () => {
      const grid: ParameterGrid = {
        param1: ParameterGenerator.parseArray('10,20,30'),
        param2: ParameterGenerator.parseArray('1.5,2.5'),
      };

      const combinations = ParameterGenerator.generateGrid(grid);
      expect(combinations).toHaveLength(6);
    });
  });
});
