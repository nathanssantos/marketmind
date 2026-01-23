import type { FibonacciLevelData, SwingPointWithIndex } from './types';
export declare const calculateFibonacciRetracement: (swingHigh: number, swingLow: number, direction?: "up" | "down") => FibonacciLevelData[];
export declare const calculateFibonacciExtension: (point1: number, point2: number, point3: number) => FibonacciLevelData[];
export declare const calculateProjectionLevels: (swingLow: SwingPointWithIndex, swingHigh: SwingPointWithIndex, direction: "LONG" | "SHORT") => FibonacciLevelData[];
//# sourceMappingURL=calculations.d.ts.map