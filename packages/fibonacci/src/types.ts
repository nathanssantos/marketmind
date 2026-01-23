export interface FibonacciLevelData {
  level: number;
  price: number;
  label: string;
}

export interface FibonacciResult {
  levels: FibonacciLevelData[];
  swingHigh: number;
  swingLow: number;
  direction: 'up' | 'down';
}

export interface SwingPointWithIndex {
  price: number;
  index: number;
  timestamp: number;
}

export interface FibonacciProjectionResult {
  levels: FibonacciLevelData[];
  swingLow: SwingPointWithIndex;
  swingHigh: SwingPointWithIndex;
  direction: 'up' | 'down';
  range: number;
}

export interface FibonacciProjectionData {
  swingLow: SwingPointWithIndex;
  swingHigh: SwingPointWithIndex;
  levels: FibonacciLevelData[];
  range: number;
  primaryLevel: number;
}

export interface FiboPyramidConfig {
  enabledLevels: string[];
  leverage: number;
  leverageAware: boolean;
  baseScaleFactor: number;
}

export interface FibonacciLevelSelectionContext {
  adx: number;
  atrPercent: number;
  volumeRatio?: number;
}

export interface FibonacciLevelSelectionResult {
  level: 1.272 | 1.618 | 2 | 2.618;
  reason: string;
}
