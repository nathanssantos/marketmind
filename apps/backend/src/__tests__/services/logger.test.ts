import { describe, expect, it } from 'vitest';
import { serializeError } from '../../services/logger';

describe('serializeError', () => {
  it('formats a plain Error', () => {
    expect(serializeError(new Error('boom'))).toBe('boom');
  });

  it('leads with the cause when present so truncation drops the less useful query text', () => {
    const cause = new Error('terminating connection due to administrator command');
    const top = new Error('Failed query: select * from very_long_table');
    (top as Error & { cause: unknown }).cause = cause;
    const serialized = serializeError(top);
    expect(serialized.startsWith(cause.message)).toBe(true);
    expect(serialized).toContain(' | ');
    expect(serialized).toContain(top.message);
  });

  it('truncates very long messages and keeps the cause readable', () => {
    const cause = new Error('57P01 connection reset');
    const top = new Error('Failed query: ' + 'x'.repeat(2000));
    (top as Error & { cause: unknown }).cause = cause;
    const serialized = serializeError(top);
    expect(serialized.startsWith(cause.message)).toBe(true);
    expect(serialized.length).toBeLessThanOrEqual(550);
  });

  it('handles string causes', () => {
    const e = new Error('outer');
    (e as Error & { cause: unknown }).cause = 'string-cause';
    expect(serializeError(e)).toBe('string-cause | outer');
  });

  it('handles JSON causes', () => {
    const e = new Error('outer');
    (e as Error & { cause: unknown }).cause = { code: 42 };
    expect(serializeError(e)).toContain('"code":42');
  });

  it('falls back to message-only when cause is missing', () => {
    const e = new Error('lonely');
    expect(serializeError(e)).toBe('lonely');
  });

  it('serializes plain objects with a message field', () => {
    expect(serializeError({ message: 'object-with-message' })).toBe('object-with-message');
  });

  it('coerces primitives to string', () => {
    expect(serializeError(123)).toBe('123');
    expect(serializeError(null)).toBe('null');
  });
});
