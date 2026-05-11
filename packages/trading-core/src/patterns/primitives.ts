/**
 * Whitelisted primitive functions exposed to pattern-DSL expressions.
 *
 * Every function takes a single bar (a `Kline`) and returns a number or, for
 * `direction`, a string literal `'up' | 'down' | 'flat'`. Volume is the only
 * primitive that may be `null` in degenerate inputs; the evaluator coerces a
 * `null` operand to a comparison failure rather than NaN-poisoning the
 * expression.
 *
 * Adding a primitive: append to `PRIMITIVE_FNS`. Anything not listed here is
 * rejected at parse time.
 */

import type { Kline } from '@marketmind/types';

/**
 * Coerce a Kline OHLC field to a finite number. Binance ships these as
 * decimal-strings; mid-pipeline they may already be numbers (after a
 * previous coercion or in synthetic test fixtures). Returns NaN on
 * malformed input — the evaluator collapses NaN comparisons to false.
 */
const num = (v: number | string | undefined): number => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : Number.NaN;
  if (typeof v === 'string' && v !== '') {
    const parsed = Number(v);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

const oc = (k: Kline): { o: number; h: number; l: number; c: number } => ({
  o: num(k.open),
  h: num(k.high),
  l: num(k.low),
  c: num(k.close),
});

const body = (k: Kline): number => { const { o, c } = oc(k); return Math.abs(c - o); };
const range = (k: Kline): number => { const { h, l } = oc(k); return h - l; };
const upperWick = (k: Kline): number => { const { o, h, c } = oc(k); return h - Math.max(o, c); };
const lowerWick = (k: Kline): number => { const { o, l, c } = oc(k); return Math.min(o, c) - l; };
const topBody = (k: Kline): number => { const { o, c } = oc(k); return Math.max(o, c); };
const bottomBody = (k: Kline): number => { const { o, c } = oc(k); return Math.min(o, c); };
const midBody = (k: Kline): number => { const { o, c } = oc(k); return (o + c) / 2; };
const direction = (k: Kline): 'up' | 'down' | 'flat' => {
  const { o, c } = oc(k);
  return c > o ? 'up' : c < o ? 'down' : 'flat';
};

export const PRIMITIVE_FNS = {
  open: (k: Kline) => num(k.open),
  high: (k: Kline) => num(k.high),
  low: (k: Kline) => num(k.low),
  close: (k: Kline) => num(k.close),
  volume: (k: Kline) => num(k.volume),
  body,
  range,
  upperWick,
  lowerWick,
  topBody,
  bottomBody,
  midBody,
  direction,
} as const;

export type PrimitiveFnName = keyof typeof PRIMITIVE_FNS;
