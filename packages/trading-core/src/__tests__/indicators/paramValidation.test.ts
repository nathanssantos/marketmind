import { describe, expect, it } from 'vitest';
import {
  buildIndicatorParamSchema,
  sanitizeIndicatorParams,
  validateIndicatorParams,
} from '../../indicators/paramValidation';

describe('sanitizeIndicatorParams', () => {
  it('fills missing keys with catalog defaults', () => {
    const { params, errors } = sanitizeIndicatorParams('stoch', {});
    expect(errors).toEqual([]);
    expect(params['period']).toBeDefined();
    expect(params['smoothK']).toBeDefined();
    expect(params['smoothD']).toBeDefined();
  });

  it('coerces numeric strings to numbers', () => {
    const { params, errors } = sanitizeIndicatorParams('rsi', { period: '21' });
    expect(errors).toEqual([]);
    expect(params['period']).toBe(21);
  });

  it('clamps numbers to spec min/max', () => {
    const { params, errors } = sanitizeIndicatorParams('rsi', { period: -5 });
    expect(errors).toEqual([]);
    expect(typeof params['period']).toBe('number');
    expect(params['period'] as number).toBeGreaterThanOrEqual(1);
  });

  it('rounds integer params', () => {
    const { params } = sanitizeIndicatorParams('rsi', { period: 14.7 });
    expect(params['period']).toBe(15);
  });

  it('reports unknown keys as errors but still returns sanitized params', () => {
    const { params, errors } = sanitizeIndicatorParams('rsi', { period: 14, kPeriod: 10 });
    expect(params['period']).toBe(14);
    expect(errors.find((e) => e.field === 'kPeriod')).toBeDefined();
  });

  it('returns error for unknown catalog type', () => {
    const { params, errors } = sanitizeIndicatorParams('does-not-exist', {});
    expect(params).toEqual({});
    expect(errors[0]?.field).toBe('catalogType');
  });

  it('handles null/undefined raw input', () => {
    const a = sanitizeIndicatorParams('rsi', null);
    const b = sanitizeIndicatorParams('rsi', undefined);
    expect(a.params['period']).toBeDefined();
    expect(b.params['period']).toBeDefined();
  });
});

describe('validateIndicatorParams', () => {
  it('returns sanitized params when valid', () => {
    const out = validateIndicatorParams('rsi', { period: 14 });
    expect(out['period']).toBe(14);
  });

  it('throws when unknown keys are present', () => {
    expect(() => validateIndicatorParams('rsi', { kPeriod: 10 })).toThrow(/Unknown param/);
  });

  it('throws when type cannot be coerced', () => {
    expect(() => validateIndicatorParams('rsi', { period: 'not-a-number' })).toThrow();
  });
});

describe('buildIndicatorParamSchema', () => {
  it('parses valid input', () => {
    const schema = buildIndicatorParamSchema('rsi');
    const result = schema.safeParse({ period: 14 });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data['period']).toBe(14);
  });

  it('reports unknown key issues via Zod', () => {
    const schema = buildIndicatorParamSchema('rsi');
    const result = schema.safeParse({ period: 14, kPeriod: 10 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'kPeriod')).toBe(true);
    }
  });
});
