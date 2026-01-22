import type { Kline } from '@marketmind/types';

export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

export const validateKlines = (klines: Kline[], minLength = 1): ValidationResult => {
  if (!Array.isArray(klines)) return { isValid: false, error: 'Input must be an array' };
  if (klines.length < minLength) return { isValid: false, error: `Requires at least ${minLength} klines` };
  return { isValid: true };
};

export const validatePeriod = (period: number, minPeriod = 1): ValidationResult => {
  if (typeof period !== 'number' || !Number.isFinite(period)) {
    return { isValid: false, error: 'Period must be a finite number' };
  }
  if (period < minPeriod) return { isValid: false, error: `Period must be at least ${minPeriod}` };
  if (!Number.isInteger(period)) return { isValid: false, error: 'Period must be an integer' };
  return { isValid: true };
};

export const validateStdDev = (stdDev: number): ValidationResult => {
  if (typeof stdDev !== 'number' || !Number.isFinite(stdDev)) {
    return { isValid: false, error: 'Standard deviation multiplier must be a finite number' };
  }
  if (stdDev <= 0) return { isValid: false, error: 'Standard deviation multiplier must be positive' };
  return { isValid: true };
};

export const safeParseFloat = (value: string | number): number => {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const safeDivide = (numerator: number, denominator: number, fallback = 0): number => {
  if (denominator === 0 || !Number.isFinite(denominator)) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
};

export const clamp = (value: number, min: number, max: number): number => {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
};

export const isValidNumber = (value: unknown): value is number => {
  return typeof value === 'number' && Number.isFinite(value);
};
