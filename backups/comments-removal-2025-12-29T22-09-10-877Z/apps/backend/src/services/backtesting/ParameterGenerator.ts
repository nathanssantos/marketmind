
export interface ParameterGrid {
  [key: string]: number[];
}

export interface ParameterCombination {
  [key: string]: number;
}

export class ParameterGenerator {
  static generateGrid(grid: ParameterGrid): ParameterCombination[] {
    const keys = Object.keys(grid);
    const values = Object.values(grid);

    if (keys.length === 0) {
      return [];
    }

    const combinations = this.cartesianProduct(values);

    return combinations.map((combo) => {
      const obj: ParameterCombination = {};
      keys.forEach((key, index) => {
        obj[key] = combo[index]!;
      });
      return obj;
    });
  }

  static range(start: number, end: number, step: number = 1): number[] {
    const result: number[] = [];
    const epsilon = step * 1e-9;
    for (let i = start; i <= end + epsilon; i += step) {
      result.push(Math.round(i * 1000) / 1000);
    }
    return result;
  }

  static parseArray(str: string): number[] {
    return str.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n));
  }

  static countCombinations(grid: ParameterGrid): number {
    return Object.values(grid).reduce((total, values) => total * values.length, 1);
  }

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

  static chunk<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

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

    const totalCombinations = this.countCombinations(grid);
    if (totalCombinations > 1000) {
      console.warn(
        `[Warning] Grid search will generate ${totalCombinations} combinations. This may take a long time.`
      );
    }
  }
}
