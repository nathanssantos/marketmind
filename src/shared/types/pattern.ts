export type PatternSource = 'algorithm' | 'ai';

export type PatternType =
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

export interface PatternPoint {
  timestamp: number;
  price: number;
}

export interface PatternLine {
  id: number;
  source: PatternSource;
  type: 'support' | 'resistance' | 'trendline-bullish' | 'trendline-bearish';
  points: [PatternPoint, PatternPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export interface PatternZone {
  id: number;
  source: PatternSource;
  type: 'liquidity-zone' | 'sell-zone' | 'buy-zone' | 'accumulation-zone';
  timestamp: number;
  startTimestamp?: number;
  endTimestamp?: number;
  topPrice: number;
  bottomPrice: number;
  label?: string;
  confidence?: number;
  visible?: boolean;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export interface PatternChannel {
  id: number;
  source: PatternSource;
  type: 'channel-ascending' | 'channel-descending' | 'channel-horizontal';
  upperLine: [PatternPoint, PatternPoint];
  lowerLine: [PatternPoint, PatternPoint];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export interface PatternFibonacci {
  id: number;
  source: PatternSource;
  type: 'fibonacci-retracement' | 'fibonacci-extension';
  startPoint: PatternPoint;
  endPoint: PatternPoint;
  levels: number[];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export interface PatternFormation {
  id: number;
  source: PatternSource;
  type:
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
    | 'cup-and-handle';
  points: PatternPoint[];
  label?: string;
  confidence?: number;
  visible?: boolean;
  timestamp?: number;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export interface PatternGap {
  id: number;
  source: PatternSource;
  type: 'gap-common' | 'gap-breakaway' | 'gap-runaway' | 'gap-exhaustion';
  timestamp: number;
  gapStart: number;
  gapEnd: number;
  direction: 'up' | 'down';
  label?: string;
  confidence?: number;
  visible?: boolean;
  importanceScore?: number;
  tier?: 'macro' | 'major' | 'intermediate' | 'minor' | 'micro';
}

export type Pattern =
  | PatternLine
  | PatternZone
  | PatternChannel
  | PatternFibonacci
  | PatternFormation
  | PatternGap;

export interface PatternStorage {
  symbol: string;
  patterns: Pattern[];
  updatedAt: number;
}

export const PATTERN_SOURCE_LABELS: Record<PatternSource, string> = {
  algorithm: 'Algorithm Detection',
  ai: 'AI Analysis',
};

export const PATTERN_SOURCE_ICONS: Record<PatternSource, string> = {
  algorithm: '🔍',
  ai: '🤖',
};
