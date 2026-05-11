/**
 * High-level detection entry point — given a kline series and a list of
 * compiled patterns, returns every hit. Detection runs on closed bars only:
 * the in-flight bar (last index) is intentionally skipped to avoid flicker
 * from a wick that hasn't finished extending. See `docs/CANDLE_PATTERNS_PLAN.md`
 * decision 1.
 */

import type { Kline } from '@marketmind/types';
import { evaluatePatternExpression } from './evaluator';
import { parsePatternExpression, type Expr } from './parser';
import type { PatternDefinition, PatternHit, PatternParams } from './types';

export interface CompiledPattern {
  definition: PatternDefinition;
  /** Resolved params (defaults merged with user overrides). */
  params: PatternParams;
  /** Each constraint expression already parsed to AST. */
  constraints: Expr[];
}

/**
 * Compile a definition once at activation time so per-bar evaluation is just
 * tree walks. Throws `PatternParseError` on malformed expressions — callers
 * should catch and surface the message in the create-pattern dialog.
 */
export const compilePattern = (
  definition: PatternDefinition,
  paramOverrides?: PatternParams,
): CompiledPattern => {
  const params: PatternParams = {};
  for (const p of definition.params) params[p.key] = p.default;
  if (paramOverrides) for (const [k, v] of Object.entries(paramOverrides)) params[k] = v;
  const constraints = definition.constraints.map((c) => parsePatternExpression(c));
  return { definition, params, constraints };
};

/**
 * Run detection across every closed bar of `klines` for every compiled
 * pattern. Returns hits sorted by bar index (ascending) — convenient for
 * the renderer, which paints from oldest to newest so newer hits stack on
 * top of older ones at the same x.
 */
export const detectPatterns = (
  klines: readonly Kline[],
  compiled: readonly CompiledPattern[],
): PatternHit[] => {
  if (klines.length === 0 || compiled.length === 0) return [];
  const lastClosedIndex = klines.length - 2;
  if (lastClosedIndex < 0) return [];

  const hits: PatternHit[] = [];
  for (const cp of compiled) {
    const window = cp.definition.bars;
    for (let i = window - 1; i <= lastClosedIndex; i++) {
      const bars: Kline[] = [];
      // bars[0] = b0 = current bar at i, bars[1] = b1 = previous, etc.
      for (let b = 0; b < window; b++) bars.push(klines[i - b]!);

      let allMatch = true;
      for (const ast of cp.constraints) {
        if (!evaluatePatternExpression(ast, bars, cp.params)) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        hits.push({
          index: i,
          patternId: cp.definition.id,
          label: cp.definition.label,
          sentiment: cp.definition.sentiment,
        });
      }
    }
  }

  return hits.sort((a, b) => a.index - b.index || a.patternId.localeCompare(b.patternId));
};
