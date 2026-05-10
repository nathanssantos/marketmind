/**
 * Pattern-DSL evaluator. Walks an AST produced by `parser.ts` against a bar
 * window and a params bag. The evaluator is total over the AST shape (every
 * node type is exhaustively handled) and is pure — no side effects, no I/O.
 *
 * Numeric/string mismatch (e.g. `body(b0) > 'up'`) collapses the constraint
 * to `false` instead of throwing, so a single noisy expression never poisons
 * the whole detection pass. The parser already rejects anything that isn't
 * a known primitive / bar reference / param, so the evaluator never sees an
 * unbound identifier.
 */

import type { Kline } from '@marketmind/types';
import type { Expr } from './parser';
import { PRIMITIVE_FNS } from './primitives';
import type { PatternBarWindow, PatternParams } from './types';

type Value = number | string | boolean;

const evalNode = (node: Expr, bars: PatternBarWindow, params: PatternParams): Value => {
  switch (node.type) {
    case 'number': return node.value;
    case 'string': return node.value;
    case 'bar': {
      // `bar` references resolve to the entire kline, but they're only valid
      // inside a primitive call: `body(b0)`, `direction(b1)`, etc. A bare `b0`
      // in an arithmetic / comparison context is a user error. Returning NaN
      // makes any comparison with it return false, which falls under the
      // "noisy expression collapses to false" rule.
      return Number.NaN;
    }
    case 'param': {
      const v = params[node.key];
      return typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN;
    }
    case 'call': {
      const fn = PRIMITIVE_FNS[node.fn];
      // Each primitive takes one bar — the only argument must be a `bar` node.
      if (node.args.length !== 1 || node.args[0]!.type !== 'bar') return Number.NaN;
      const idx = node.args[0]!.index;
      const bar: Kline | undefined = bars[idx];
      if (!bar) return Number.NaN;
      return fn(bar);
    }
    case 'unary': {
      const v = evalNode(node.arg, bars, params);
      if (node.op === 'neg') return typeof v === 'number' ? -v : Number.NaN;
      return !truthy(v);
    }
    case 'binary': {
      const l = evalNode(node.left, bars, params);
      const r = evalNode(node.right, bars, params);
      switch (node.op) {
        case '+': return numOr(l) + numOr(r);
        case '-': return numOr(l) - numOr(r);
        case '*': return numOr(l) * numOr(r);
        case '/': {
          const rn = numOr(r);
          return rn === 0 ? Number.NaN : numOr(l) / rn;
        }
        case '=': return looseEq(l, r);
        case '!=': return !looseEq(l, r);
        case '<': return numCompare(l, r, (a, b) => a < b);
        case '<=': return numCompare(l, r, (a, b) => a <= b);
        case '>': return numCompare(l, r, (a, b) => a > b);
        case '>=': return numCompare(l, r, (a, b) => a >= b);
        case 'and': return truthy(l) && truthy(r);
        case 'or':  return truthy(l) || truthy(r);
      }
    }
  }
};

const numOr = (v: Value): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number.NaN);
const truthy = (v: Value): boolean => v === true || (typeof v === 'number' && v !== 0 && Number.isFinite(v));
const looseEq = (a: Value, b: Value): boolean => {
  if (typeof a === 'string' && typeof b === 'string') return a === b;
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  return false;
};
const numCompare = (a: Value, b: Value, fn: (x: number, y: number) => boolean): boolean => {
  if (typeof a !== 'number' || typeof b !== 'number') return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return fn(a, b);
};

export const evaluatePatternExpression = (
  ast: Expr,
  bars: PatternBarWindow,
  params: PatternParams,
): boolean => truthy(evalNode(ast, bars, params));
