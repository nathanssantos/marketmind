export type AIStudyType =
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

export interface AIStudyPoint {
  timestamp: number;
  price: number;
}

export interface AIStudyLine {
  id?: number;
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [AIStudyPoint, AIStudyPoint];
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

export interface AIStudyChannel {
  id?: number;
  type: 'channel-ascending' | 'channel-descending' | 'channel-horizontal';
  upperLine: [AIStudyPoint, AIStudyPoint];
  lowerLine: [AIStudyPoint, AIStudyPoint];
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

export interface AIStudyFibonacci {
  id?: number;
  type: 'fibonacci-retracement' | 'fibonacci-extension';
  startPoint: AIStudyPoint;
  endPoint: AIStudyPoint;
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

export interface AIStudyHeadAndShoulders {
  id?: number;
  type: 'head-and-shoulders' | 'inverse-head-and-shoulders';
  leftShoulder: AIStudyPoint;
  head: AIStudyPoint;
  rightShoulder: AIStudyPoint;
  neckline: [AIStudyPoint, AIStudyPoint];
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyDoublePattern {
  id?: number;
  type: 'double-top' | 'double-bottom';
  firstPeak: AIStudyPoint;
  secondPeak: AIStudyPoint;
  neckline: AIStudyPoint;
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyTriplePattern {
  id?: number;
  type: 'triple-top' | 'triple-bottom';
  peak1: AIStudyPoint;
  peak2: AIStudyPoint;
  peak3: AIStudyPoint;
  neckline: [AIStudyPoint, AIStudyPoint];
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyTriangle {
  id?: number;
  type: 'triangle-ascending' | 'triangle-descending' | 'triangle-symmetrical';
  upperTrendline: [AIStudyPoint, AIStudyPoint];
  lowerTrendline: [AIStudyPoint, AIStudyPoint];
  apex?: AIStudyPoint;
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyWedge {
  id?: number;
  type: 'wedge-rising' | 'wedge-falling';
  upperTrendline: [AIStudyPoint, AIStudyPoint];
  lowerTrendline: [AIStudyPoint, AIStudyPoint];
  convergencePoint?: AIStudyPoint;
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyFlag {
  id?: number;
  type: 'flag-bullish' | 'flag-bearish';
  flagpole: {
    start: AIStudyPoint;
    end: AIStudyPoint;
  };
  flag: {
    upperTrendline: [AIStudyPoint, AIStudyPoint];
    lowerTrendline: [AIStudyPoint, AIStudyPoint];
  };
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyPennant {
  id?: number;
  type: 'pennant';
  flagpole: {
    start: AIStudyPoint;
    end: AIStudyPoint;
  };
  pennant: {
    upperTrendline: [AIStudyPoint, AIStudyPoint];
    lowerTrendline: [AIStudyPoint, AIStudyPoint];
    apex?: AIStudyPoint;
  };
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyCupAndHandle {
  id?: number;
  type: 'cup-and-handle';
  cupStart: AIStudyPoint;
  cupBottom: AIStudyPoint;
  cupEnd: AIStudyPoint;
  handleStart: AIStudyPoint;
  handleLow: AIStudyPoint;
  handleEnd: AIStudyPoint;
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyRoundingBottom {
  id?: number;
  type: 'rounding-bottom';
  start: AIStudyPoint;
  bottom: AIStudyPoint;
  end: AIStudyPoint;
  breakoutPoint?: AIStudyPoint;
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

export interface AIStudyGap {
  id?: number;
  type: 'gap-common' | 'gap-breakaway' | 'gap-runaway' | 'gap-exhaustion';
  gapStart: AIStudyPoint;
  gapEnd: AIStudyPoint;
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

export interface AIStudyZone {
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

export type AIStudy =
  | AIStudyLine
  | AIStudyChannel
  | AIStudyFibonacci
  | AIStudyHeadAndShoulders
  | AIStudyDoublePattern
  | AIStudyTriplePattern
  | AIStudyTriangle
  | AIStudyWedge
  | AIStudyFlag
  | AIStudyPennant
  | AIStudyCupAndHandle
  | AIStudyRoundingBottom
  | AIStudyGap
  | AIStudyZone;

export interface AIStudyData {
  id: string;
  symbol: string;
  createdAt: number;
  studies: AIStudy[];
}

export interface AIAnalysisWithStudies {
  analysis: string;
  studies?: AIStudy[] | undefined;
}
