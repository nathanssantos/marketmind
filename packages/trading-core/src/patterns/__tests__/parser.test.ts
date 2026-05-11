import { describe, expect, it } from 'vitest';
import { PatternParseError, parsePatternExpression } from '../parser';

describe('parser', () => {
  it('parses numeric literals', () => {
    expect(parsePatternExpression('42')).toEqual({ type: 'number', value: 42 });
    expect(parsePatternExpression('3.14')).toEqual({ type: 'number', value: 3.14 });
  });

  it('parses bar references', () => {
    expect(parsePatternExpression('b0')).toEqual({ type: 'bar', index: 0 });
    expect(parsePatternExpression('b12')).toEqual({ type: 'bar', index: 12 });
  });

  it('parses primitive calls', () => {
    expect(parsePatternExpression('body(b0)')).toEqual({
      type: 'call',
      fn: 'body',
      args: [{ type: 'bar', index: 0 }],
    });
  });

  it('parses params.<key>', () => {
    expect(parsePatternExpression('params.wickRatio')).toEqual({ type: 'param', key: 'wickRatio' });
  });

  it('parses string direction literals', () => {
    expect(parsePatternExpression("'up'")).toEqual({ type: 'string', value: 'up' });
    expect(parsePatternExpression('up')).toEqual({ type: 'string', value: 'up' });
  });

  it('respects arithmetic precedence', () => {
    const ast = parsePatternExpression('1 + 2 * 3');
    expect(ast).toEqual({
      type: 'binary',
      op: '+',
      left: { type: 'number', value: 1 },
      right: {
        type: 'binary',
        op: '*',
        left: { type: 'number', value: 2 },
        right: { type: 'number', value: 3 },
      },
    });
  });

  it('respects parentheses', () => {
    const ast = parsePatternExpression('(1 + 2) * 3');
    expect(ast).toMatchObject({ type: 'binary', op: '*' });
  });

  it('parses comparison + and/or composition', () => {
    const ast = parsePatternExpression('body(b0) > 0 and direction(b0) = up');
    expect(ast.type).toBe('binary');
    expect((ast as { op: string }).op).toBe('and');
  });

  it('rejects unknown identifiers', () => {
    expect(() => parsePatternExpression('foo(b0)')).toThrow(PatternParseError);
    expect(() => parsePatternExpression('eval')).toThrow(PatternParseError);
  });

  it('rejects unterminated strings', () => {
    expect(() => parsePatternExpression("'unterminated")).toThrow(PatternParseError);
  });

  it('rejects empty input', () => {
    expect(() => parsePatternExpression('')).toThrow(PatternParseError);
  });

  it('rejects single-quote bang without =', () => {
    expect(() => parsePatternExpression('1 ! 2')).toThrow(PatternParseError);
  });

  it('parses != correctly', () => {
    const ast = parsePatternExpression('body(b0) != 0');
    expect((ast as { op: string }).op).toBe('!=');
  });

  it('rejects trailing garbage', () => {
    expect(() => parsePatternExpression('body(b0) > 0 garbage')).toThrow(PatternParseError);
  });

  it('parses negation', () => {
    expect(parsePatternExpression('-1')).toEqual({
      type: 'unary',
      op: 'neg',
      arg: { type: 'number', value: 1 },
    });
  });

  it('parses not <expr>', () => {
    const ast = parsePatternExpression('not (body(b0) > 0)');
    expect((ast as { type: string; op: string }).op).toBe('not');
  });
});
