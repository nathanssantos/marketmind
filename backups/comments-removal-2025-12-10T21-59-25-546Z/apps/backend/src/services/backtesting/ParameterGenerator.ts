/**
 * ParameterGenerator
 * Generates all possible parameter combinations for grid search optimization
 */

export interface ParameterGrid {
  [key: string]: number[];
}

export interface ParameterCombination {
  [key: string]: number;
}

export class ParameterGenerator {
  /**
   * Generate all possible combinations from a parameter grid
   * @param grid - Object with parameter names as keys and arrays of values
   * @returns Array of all possible parameter combinations
   *
   * @example
   * ```typescript
   * const grid = {
   *   stopLossPercent: [1, 2, 3],
   *   takeProfitPercent: [4, 6, 8],
   *   minConfidence: [60, 70, 80]
   * };
   * const combinations = ParameterGenerator.generateGrid(grid);
   * // Returns 27 combinations (3 × 3 × 3)
   * ```
   */
  static generateGrid(grid: ParameterGrid): ParameterCombination[] {
    const keys = Object.keys(grid);
    const values = Object.values(grid);

    if (keys.length === 0) {
      return [];
    }

    // Generate cartesian product
    const combinations = this.cartesianProduct(values);

    // Map back to objects with parameter names
    return combinations.map((combo) => {
      const obj: ParameterCombination = {};
      keys.forEach((key, index) => {
        obj[key] = combo[index]!;
      });
      return obj;
    });
  }

  /**
   * Generate a range of values with a step
   * @param start - Starting value
   * @param end - Ending value (inclusive)
   * @param step - Step size
   * @returns Array of values
   *
   * @example
   * ```typescript
   * ParameterGenerator.range(1, 3, 0.5);
   * // Returns [1, 1.5, 2, 2.5, 3]
   * ```
   */
  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];
    for (let i = start; i <= end; i += step) {
      // Round to avoid floating point precision issues
      result.push(Math.round(i * 1000) / 1000);
    }
    return result;
  }

  /**
   * Parse a comma-separated string into an array of numbers
   * @param str - Comma-separated string (e.g., "1,2,3")
   * @returns Array of numbers
   *
   * @example
   * ```typescript
   * ParameterGenerator.parseArray("1,2,3");
   * // Returns [1, 2, 3]
   * ```
   */
  static parseArray(str: string): number[] {
    return str.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  }

  /**
   * Calculate the total number of combinations for a grid
   * @param grid - Parameter grid
   * @returns Total number of combinations
   */
  static countCombinations(grid: ParameterGrid): number {
    return Object.values(grid).reduce((total, values) => total * values.length, 1);
  }

  /**
   * Generate cartesian product of arrays
   * @private
   */
  private static cartesianProduct(arrays: number[][]): number[][] {
    if (arrays.length === 0) {
      return [];
    }

    if (arrays.length === 1) {
      return arrays[0]!.map((x) => [x]);
    }

    const [first, ...rest] = arrays;
    const restProduct = this.cartesianProduct(rest);

    return first!.flatMap((x) => restProduct.map((combo) => [x, ...combo]));
  }

  /**
   * Split an array into chunks for parallel processing
   * @param array - Array to split
   * @param chunkSize - Size of each chunk
   * @returns Array of chunks
   */
  static chunk<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Validate that a parameter grid is valid
   * @param grid - Parameter grid to validate
   * @throws Error if grid is invalid
   */
  static validate(grid: ParameterGrid): void {
    const keys = Object.keys(grid);

    if (keys.length === 0) {
      throw new Error('Parameter grid is empty');
    }

    for (const [key, values] of Object.entries(grid)) {
      if (!Array.isArray(values)) {
        throw new Error(`Parameter "${key}" must be an array`);
      }

      if (values.length === 0) {
        throw new Error(`Parameter "${key}" has no values`);
      }

      for (const value of values) {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Parameter "${key}" contains invalid value: ${value}`);
        }
      }
    }

    // Warn if too many combinations
    const totalCombinations = this.countCombinations(grid);
    if (totalCombinations > 1000) {
      console.warn(
        `[Warning] Grid search will generate ${totalCombinations} combinations. This may take a long time.`
      );
    }
  }
}
