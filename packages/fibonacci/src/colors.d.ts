export declare const FIBONACCI_DEFAULT_COLOR = "rgba(128, 128, 128, 0.35)";
export declare const FIBONACCI_LEVEL_COLORS: Record<string, string>;
export type FibonacciColors = typeof FIBONACCI_LEVEL_COLORS;
export declare const getLevelColor: (level: number, customColors?: Partial<FibonacciColors>, defaultColor?: string) => string;
export declare const FIBONACCI_COLOR_NAMES: (keyof FibonacciColors)[];
//# sourceMappingURL=colors.d.ts.map