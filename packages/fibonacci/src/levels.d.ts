export declare const FIBONACCI_RETRACEMENT_LEVELS: readonly [0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1];
export declare const FIBONACCI_EXTENSION_LEVELS: readonly [1, 1.272, 1.618, 2, 2.618];
export declare const FIBONACCI_ALL_LEVELS: readonly [0, 0.236, 0.382, 0.5, 0.618, 0.786, 0.886, 1, 1.272, 1.618, 2, 2.618];
export declare const FIBONACCI_TARGET_LEVELS: readonly ["auto", "1", "1.272", "1.618", "2", "2.618"];
export declare const FIBONACCI_PYRAMID_LEVELS: readonly ["1", "1.272", "1.618", "2", "2.618"];
export type FibonacciRetracementLevel = (typeof FIBONACCI_RETRACEMENT_LEVELS)[number];
export type FibonacciExtensionLevel = (typeof FIBONACCI_EXTENSION_LEVELS)[number];
export type FibonacciLevel = (typeof FIBONACCI_ALL_LEVELS)[number];
export type FibonacciTargetLevel = (typeof FIBONACCI_TARGET_LEVELS)[number];
export type FibonacciPyramidLevel = (typeof FIBONACCI_PYRAMID_LEVELS)[number];
export declare const FIBONACCI_LEVEL_TO_NAME: Record<number, string>;
export declare const FIBONACCI_PYRAMID_VALUES: Record<FibonacciPyramidLevel, number>;
export declare const formatFibonacciLabel: (level: number) => string;
export declare const getLevelName: (level: number) => string | undefined;
//# sourceMappingURL=levels.d.ts.map