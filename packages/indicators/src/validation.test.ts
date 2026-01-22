import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
  validateKlines,
  validatePeriod,
  validateStdDev,
  safeParseFloat,
  safeDivide,
  clamp,
  isValidNumber,
} from './validation';

const createMockKline = (close: number, index: number): Kline => ({
  openTime: new Date(2024, 0, index + 1).getTime(),
  open: String(close),
  high: String(close + 1),
  low: String(close - 1),
  close: String(close),
  volume: '1000',
  closeTime: new Date(2024, 0, index + 1, 23, 59, 59).getTime(),
  quoteVolume: '1000000',
  trades: 100,
  takerBuyBaseVolume: '500',
  takerBuyQuoteVolume: '500000',
});

describe('validateKlines', () => {
  it('should return valid for non-empty array', () => {
    const klines = [createMockKline(100, 0)];
    const result = validateKlines(klines);
    expect(result.isValid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should return invalid for empty array with default minLength', () => {
    const result = validateKlines([]);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least 1');
  });

  it('should return invalid when array length less than minLength', () => {
    const klines = [createMockKline(100, 0)];
    const result = validateKlines(klines, 5);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least 5');
  });

  it('should return invalid for non-array input', () => {
    const result = validateKlines(null as unknown as Kline[]);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('array');
  });
});

describe('validatePeriod', () => {
  it('should return valid for positive integer', () => {
    const result = validatePeriod(14);
    expect(result.isValid).toBe(true);
  });

  it('should return invalid for zero', () => {
    const result = validatePeriod(0);
    expect(result.isValid).toBe(false);
  });

  it('should return invalid for negative number', () => {
    const result = validatePeriod(-5);
    expect(result.isValid).toBe(false);
  });

  it('should return invalid for non-integer', () => {
    const result = validatePeriod(14.5);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('integer');
  });

  it('should return invalid for NaN', () => {
    const result = validatePeriod(NaN);
    expect(result.isValid).toBe(false);
  });

  it('should return invalid for Infinity', () => {
    const result = validatePeriod(Infinity);
    expect(result.isValid).toBe(false);
  });

  it('should support custom minPeriod', () => {
    const result = validatePeriod(2, 3);
    expect(result.isValid).toBe(false);
    expect(result.error).toContain('at least 3');
  });
});

describe('validateStdDev', () => {
  it('should return valid for positive number', () => {
    const result = validateStdDev(2);
    expect(result.isValid).toBe(true);
  });

  it('should return invalid for zero', () => {
    const result = validateStdDev(0);
    expect(result.isValid).toBe(false);
  });

  it('should return invalid for negative number', () => {
    const result = validateStdDev(-2);
    expect(result.isValid).toBe(false);
  });

  it('should return invalid for NaN', () => {
    const result = validateStdDev(NaN);
    expect(result.isValid).toBe(false);
  });
});

describe('safeParseFloat', () => {
  it('should parse string to number', () => {
    expect(safeParseFloat('100.50')).toBe(100.5);
  });

  it('should return number as-is', () => {
    expect(safeParseFloat(100.5)).toBe(100.5);
  });

  it('should return 0 for invalid string', () => {
    expect(safeParseFloat('invalid')).toBe(0);
  });

  it('should handle empty string', () => {
    expect(safeParseFloat('')).toBe(0);
  });
});

describe('safeDivide', () => {
  it('should divide normally', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('should return fallback for division by zero', () => {
    expect(safeDivide(10, 0)).toBe(0);
    expect(safeDivide(10, 0, 999)).toBe(999);
  });

  it('should return fallback for NaN denominator', () => {
    expect(safeDivide(10, NaN)).toBe(0);
  });

  it('should return fallback for Infinity result', () => {
    expect(safeDivide(Infinity, 1, 0)).toBe(0);
  });
});

describe('clamp', () => {
  it('should clamp value within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('should clamp to min when below', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('should clamp to max when above', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('should return min for NaN', () => {
    expect(clamp(NaN, 0, 10)).toBe(0);
  });
});

describe('isValidNumber', () => {
  it('should return true for valid numbers', () => {
    expect(isValidNumber(0)).toBe(true);
    expect(isValidNumber(100)).toBe(true);
    expect(isValidNumber(-50)).toBe(true);
    expect(isValidNumber(3.14)).toBe(true);
  });

  it('should return false for NaN', () => {
    expect(isValidNumber(NaN)).toBe(false);
  });

  it('should return false for Infinity', () => {
    expect(isValidNumber(Infinity)).toBe(false);
    expect(isValidNumber(-Infinity)).toBe(false);
  });

  it('should return false for non-numbers', () => {
    expect(isValidNumber('100')).toBe(false);
    expect(isValidNumber(null)).toBe(false);
    expect(isValidNumber(undefined)).toBe(false);
  });
});
