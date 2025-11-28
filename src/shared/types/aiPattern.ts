export type AIPatternType =
  | 'support'
  | 'resistance'
  | 'trendline-bullish'
  | 'trendline-bearish'
  | 'channel-ascending'
  | 'channel-descending'
  | 'channel-horizontal'
  | 'fibonacci-retracement'
  | 'fibonacci-extension'
  | 'head-and-shoulders'
  | 'inverse-head-and-shoulders'
  | 'double-top'
  | 'double-bottom'
  | 'triple-top'
  | 'triple-bottom'
  | 'rounding-bottom'
  | 'triangle-ascending'
  | 'triangle-descending'
  | 'triangle-symmetrical'
  | 'wedge-rising'
  | 'wedge-falling'
  | 'flag-bullish'
  | 'flag-bearish'
  | 'pennant'
  | 'cup-and-handle'
  | 'gap-common'
  | 'gap-breakaway'
  | 'gap-runaway'
  | 'gap-exhaustion'
  | 'liquidity-zone'
  | 'sell-zone'
  | 'buy-zone'
  | 'accumulation-zone';

export interface AIPatternPoint {
  timestamp: number;
  price: number;
}

export interface AIPatternLine {
  id?: number;
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [AIPatternPoint, AIPatternPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternChannel {
  id?: number;
  type: 'channel-ascending' | 'channel-descending' | 'channel-horizontal';
  upperLine: [AIPatternPoint, AIPatternPoint];
  lowerLine: [AIPatternPoint, AIPatternPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternFibonacci {
  id?: number;
  type: 'fibonacci-retracement' | 'fibonacci-extension';
  startPoint: AIPatternPoint;
  endPoint: AIPatternPoint;
  levels: Array<{
    ratio: number;
    price: number;
  }>;
  direction: 'uptrend' | 'downtrend';
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternHeadAndShoulders {
  id?: number;
  type: 'head-and-shoulders' | 'inverse-head-and-shoulders';
  leftShoulder: AIPatternPoint;
  head: AIPatternPoint;
  rightShoulder: AIPatternPoint;
  neckline: [AIPatternPoint, AIPatternPoint];
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternDoublePattern {
  id?: number;
  type: 'double-top' | 'double-bottom';
  firstPeak: AIPatternPoint;
  secondPeak: AIPatternPoint;
  neckline: AIPatternPoint;
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternTriplePattern {
  id?: number;
  type: 'triple-top' | 'triple-bottom';
  peak1: AIPatternPoint;
  peak2: AIPatternPoint;
  peak3: AIPatternPoint;
  neckline: [AIPatternPoint, AIPatternPoint];
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternTriangle {
  id?: number;
  type: 'triangle-ascending' | 'triangle-descending' | 'triangle-symmetrical';
  upperTrendline: [AIPatternPoint, AIPatternPoint];
  lowerTrendline: [AIPatternPoint, AIPatternPoint];
  apex?: AIPatternPoint;
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternWedge {
  id?: number;
  type: 'wedge-rising' | 'wedge-falling';
  upperTrendline: [AIPatternPoint, AIPatternPoint];
  lowerTrendline: [AIPatternPoint, AIPatternPoint];
  convergencePoint?: AIPatternPoint;
  breakoutPoint?: AIPatternPoint;
  context?: 'uptrend' | 'downtrend';
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternFlag {
  id?: number;
  type: 'flag-bullish' | 'flag-bearish';
  flagpole: {
    start: AIPatternPoint;
    end: AIPatternPoint;
  };
  flag: {
    upperTrendline: [AIPatternPoint, AIPatternPoint];
    lowerTrendline: [AIPatternPoint, AIPatternPoint];
  };
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternPennant {
  id?: number;
  type: 'pennant';
  flagpole: {
    start: AIPatternPoint;
    end: AIPatternPoint;
  };
  pennant: {
    upperTrendline: [AIPatternPoint, AIPatternPoint];
    lowerTrendline: [AIPatternPoint, AIPatternPoint];
    apex?: AIPatternPoint;
  };
  breakoutPoint?: AIPatternPoint;
  direction: 'bullish' | 'bearish';
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternCupAndHandle {
  id?: number;
  type: 'cup-and-handle';
  cupStart: AIPatternPoint;
  cupBottom: AIPatternPoint;
  cupEnd: AIPatternPoint;
  handleStart: AIPatternPoint;
  handleLow: AIPatternPoint;
  handleEnd: AIPatternPoint;
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternRoundingBottom {
  id?: number;
  type: 'rounding-bottom';
  start: AIPatternPoint;
  bottom: AIPatternPoint;
  end: AIPatternPoint;
  breakoutPoint?: AIPatternPoint;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternGap {
  id?: number;
  type: 'gap-common' | 'gap-breakaway' | 'gap-runaway' | 'gap-exhaustion';
  gapStart: AIPatternPoint;
  gapEnd: AIPatternPoint;
  filled?: boolean;
  fillDate?: number;
  direction?: 'bullish' | 'bearish';
  priorPattern?: string;
  trendDirection?: 'up' | 'down';
  priorTrend?: 'uptrend' | 'downtrend';
  reversalConfirmed?: boolean;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export interface AIPatternZone {
  id?: number;
  type: 'liquidity-zone' | 'sell-zone' | 'buy-zone' | 'accumulation-zone';
  topPrice: number;
  bottomPrice: number;
  startTimestamp: number;
  endTimestamp: number;
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
  hasConflict?: boolean;
  conflictingPatterns?: number[];
  nestedPatterns?: number[];
}

export type AIPattern =
  | AIPatternLine
  | AIPatternChannel
  | AIPatternFibonacci
  | AIPatternHeadAndShoulders
  | AIPatternDoublePattern
  | AIPatternTriplePattern
  | AIPatternTriangle
  | AIPatternWedge
  | AIPatternFlag
  | AIPatternPennant
  | AIPatternCupAndHandle
  | AIPatternRoundingBottom
  | AIPatternGap
  | AIPatternZone;

export interface AIPatternData {
  id: string;
  symbol: string;
  createdAt: number;
  patterns: AIPattern[];
}

export interface AIAnalysisWithPatterns {
  analysis: string;
  patterns?: AIPattern[] | undefined;
}
