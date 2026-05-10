import { describe, expect, it } from 'vitest';
import type { Kline } from '@marketmind/types';
import { evaluatePatternExpression } from '../evaluator';
import { parsePatternExpression } from '../parser';
import { PRIMITIVE_FNS } from '../primitives';

const k = (open: number, high: number, low: number, close: number, volume = 100): Kline => ({
  openTime: 0,
  open,
  high,
  low,
  close,
  volume,
  closeTime: 0,
  quoteVolume: 0,
  trades: 0,
  buyVolume: 0,
  buyQuoteVolume: 0,
});

const evalExpr = (src: string, bars: Kline[], params: Record<string, number> = {}): boolean => {
  const ast = parsePatternExpression(src);
  return evaluatePatternExpression(ast, bars, params);
};

describe('primitives', () => {
  const bar = k(100, 110, 95, 105); // up bar, body=5, range=15, upperWick=5, lowerWick=5
  it('open/high/low/close', () => {
    expect(PRIMITIVE_FNS.open(bar)).toBe(100);
    expect(PRIMITIVE_FNS.high(bar)).toBe(110);
    expect(PRIMITIVE_FNS.low(bar)).toBe(95);
    expect(PRIMITIVE_FNS.close(bar)).toBe(105);
  });
  it('body / range / wicks', () => {
    expect(PRIMITIVE_FNS.body(bar)).toBe(5);
    expect(PRIMITIVE_FNS.range(bar)).toBe(15);
    expect(PRIMITIVE_FNS.upperWick(bar)).toBe(5);
    expect(PRIMITIVE_FNS.lowerWick(bar)).toBe(5);
  });
  it('topBody / bottomBody / midBody', () => {
    expect(PRIMITIVE_FNS.topBody(bar)).toBe(105);
    expect(PRIMITIVE_FNS.bottomBody(bar)).toBe(100);
    expect(PRIMITIVE_FNS.midBody(bar)).toBe(102.5);
  });
  it('direction', () => {
    expect(PRIMITIVE_FNS.direction(k(100, 110, 90, 105))).toBe('up');
    expect(PRIMITIVE_FNS.direction(k(105, 110, 90, 100))).toBe('down');
    expect(PRIMITIVE_FNS.direction(k(100, 110, 90, 100))).toBe('flat');
  });
});

describe('evaluator', () => {
  it('compares numbers correctly', () => {
    const bars = [k(100, 110, 95, 105)];
    expect(evalExpr('body(b0) > 0', bars)).toBe(true);
    expect(evalExpr('body(b0) > 100', bars)).toBe(false);
    expect(evalExpr('body(b0) >= 5', bars)).toBe(true);
    expect(evalExpr('body(b0) <= 5', bars)).toBe(true);
    expect(evalExpr('body(b0) = 5', bars)).toBe(true);
    expect(evalExpr('body(b0) != 5', bars)).toBe(false);
  });

  it('compares directions via string equality', () => {
    expect(evalExpr("direction(b0) = 'up'", [k(100, 110, 90, 105)])).toBe(true);
    expect(evalExpr("direction(b0) = 'down'", [k(100, 110, 90, 105)])).toBe(false);
    expect(evalExpr('direction(b0) = up', [k(100, 110, 90, 105)])).toBe(true);
  });

  it('AND / OR composition', () => {
    const bars = [k(100, 110, 95, 105)];
    expect(evalExpr('body(b0) > 0 and upperWick(b0) > 0', bars)).toBe(true);
    expect(evalExpr('body(b0) > 0 and upperWick(b0) > 100', bars)).toBe(false);
    expect(evalExpr('body(b0) > 100 or upperWick(b0) > 0', bars)).toBe(true);
  });

  it('reads params.<key>', () => {
    const bars = [k(100, 110, 95, 105)];
    expect(evalExpr('body(b0) > params.threshold', bars, { threshold: 3 })).toBe(true);
    expect(evalExpr('body(b0) > params.threshold', bars, { threshold: 100 })).toBe(false);
  });

  it('arithmetic with primitives', () => {
    const bars = [k(100, 130, 70, 110)]; // body=10, range=60
    expect(evalExpr('range(b0) > 5 * body(b0)', bars)).toBe(true);
    expect(evalExpr('range(b0) < 5 * body(b0)', bars)).toBe(false);
  });

  it('multi-bar window: b0 vs b1', () => {
    // b0 (most recent) is up, b1 (prev) is down
    const bars = [k(100, 110, 95, 108), k(105, 108, 95, 100)];
    expect(evalExpr("direction(b0) = 'up' and direction(b1) = 'down'", bars)).toBe(true);
    expect(evalExpr('open(b0) <= close(b1)', bars)).toBe(true);
    expect(evalExpr('close(b0) >= open(b1)', bars)).toBe(true);
  });

  it('division by zero returns false on comparison', () => {
    const bars = [k(100, 100, 100, 100)]; // body = 0
    // body(b0) is 0, so any ratio dividing by it should fail comparisons.
    expect(evalExpr('range(b0) / body(b0) > 2', bars)).toBe(false);
  });

  it('mismatched types collapse to false', () => {
    const bars = [k(100, 110, 90, 105)];
    expect(evalExpr("body(b0) > 'up'", bars)).toBe(false);
  });

  it('bar-out-of-window collapses to false', () => {
    const bars = [k(100, 110, 90, 105)];
    expect(evalExpr('body(b5) > 0', bars)).toBe(false);
  });

  it('not negates correctly', () => {
    const bars = [k(100, 110, 90, 105)];
    expect(evalExpr('not (body(b0) > 100)', bars)).toBe(true);
    expect(evalExpr('not (body(b0) > 0)', bars)).toBe(false);
  });
});
