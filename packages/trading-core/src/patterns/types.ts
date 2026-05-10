/**
 * Candle-pattern DSL — pattern definitions are stored as data (JSON) so users
 * can register custom patterns from the UI without shipping a release. The
 * evaluator walks an AST built from a small, total expression language over
 * OHLC primitives. Every leaf is a known primitive or numeric/string literal,
 * so injection is impossible by construction (no `eval`, no sandbox needed).
 *
 * See `docs/CANDLE_PATTERNS_PLAN.md` for the architecture and design decisions.
 */

import type { Kline } from '@marketmind/types';

export type PatternCategory =
  | 'reversal-single'
  | 'reversal-multi'
  | 'continuation'
  | 'indecision';

export type PatternSentiment = 'bullish' | 'bearish' | 'neutral';

export interface PatternParamDef {
  /** Identifier referenced in constraint expressions as `params.<key>`. */
  key: string;
  label: string;
  type: 'number';
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface PatternDefinition {
  /** Stable id, kebab-case (`hammer`, `bullish-engulfing`). */
  id: string;
  label: string;
  category: PatternCategory;
  sentiment: PatternSentiment;
  /** Window size — `b0` is the most recent bar, `b{N-1}` the oldest in scope. */
  bars: 1 | 2 | 3 | 4 | 5;
  /** Tunable knobs surfaced in the create/edit dialog. */
  params: PatternParamDef[];
  /** All constraints AND-ed together. Each is a boolean expression. */
  constraints: string[];
  description?: string;
}

export type PatternParams = Record<string, number>;

export interface PatternHit {
  /** Index in the kline series this hit lands on. */
  index: number;
  patternId: string;
  label: string;
  sentiment: PatternSentiment;
}

/**
 * Bag of bars referenced by index in expressions. `b0` is the most recent in
 * the window, `b1` the previous, etc. Length equals the pattern's `bars`.
 */
export type PatternBarWindow = readonly Kline[];
