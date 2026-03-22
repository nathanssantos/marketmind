import { describe, expect, it } from 'vitest';
import {
  parseNumeric,
  calculatePriceMovementPercent,
  calculateProfitPercent,
} from '../../services/opportunity-cost-types';

describe('parseNumeric', () => {
  it('parses a valid numeric string', () => {
    expect(parseNumeric('42.5')).toBe(42.5);
  });

  it('returns 0 for null', () => {
    expect(parseNumeric(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseNumeric(undefined)).toBe(0);
  });

  it('returns NaN for non-numeric string', () => {
    expect(parseNumeric('abc')).toBeNaN();
  });

  it('parses negative values', () => {
    expect(parseNumeric('-10.5')).toBe(-10.5);
  });

  it('parses zero string', () => {
    expect(parseNumeric('0')).toBe(0);
  });

  it('parses empty string as NaN', () => {
    expect(parseNumeric('')).toBeNaN();
  });
});

describe('calculatePriceMovementPercent', () => {
  it('returns 0 when entry price is 0', () => {
    expect(calculatePriceMovementPercent(0, 110, 90, 'LONG')).toBe(0);
    expect(calculatePriceMovementPercent(0, 110, 90, 'SHORT')).toBe(0);
  });

  it('calculates max movement for LONG (up move larger)', () => {
    const result = calculatePriceMovementPercent(100, 120, 95, 'LONG');
    const upMove = ((120 - 100) / 100) * 100;
    const downMove = ((100 - 95) / 100) * 100;
    expect(result).toBe(Math.max(upMove, downMove));
    expect(result).toBe(20);
  });

  it('calculates max movement for LONG (down move larger)', () => {
    const result = calculatePriceMovementPercent(100, 102, 80, 'LONG');
    const upMove = ((102 - 100) / 100) * 100;
    const downMove = ((100 - 80) / 100) * 100;
    expect(result).toBe(Math.max(upMove, downMove));
    expect(result).toBe(20);
  });

  it('calculates max movement for SHORT (down move larger)', () => {
    const result = calculatePriceMovementPercent(100, 105, 80, 'SHORT');
    const downMove = ((100 - 80) / 100) * 100;
    const upMove = ((105 - 100) / 100) * 100;
    expect(result).toBe(Math.max(downMove, upMove));
    expect(result).toBe(20);
  });

  it('calculates max movement for SHORT (up move larger)', () => {
    const result = calculatePriceMovementPercent(100, 130, 98, 'SHORT');
    const downMove = ((100 - 98) / 100) * 100;
    const upMove = ((130 - 100) / 100) * 100;
    expect(result).toBe(Math.max(downMove, upMove));
    expect(result).toBe(30);
  });

  it('handles equal prices (no movement)', () => {
    const result = calculatePriceMovementPercent(100, 100, 100, 'LONG');
    expect(result).toBe(0);
  });

  it('LONG and SHORT return same value for symmetric movement', () => {
    const longResult = calculatePriceMovementPercent(100, 110, 90, 'LONG');
    const shortResult = calculatePriceMovementPercent(100, 110, 90, 'SHORT');
    expect(longResult).toBe(shortResult);
  });
});

describe('calculateProfitPercent', () => {
  it('returns 0 when entry price is 0', () => {
    expect(calculateProfitPercent(0, 100, 'LONG')).toBe(0);
    expect(calculateProfitPercent(0, 100, 'SHORT')).toBe(0);
  });

  it('calculates positive profit for LONG when price goes up', () => {
    const result = calculateProfitPercent(100, 110, 'LONG');
    expect(result).toBe(10);
  });

  it('calculates negative profit for LONG when price goes down', () => {
    const result = calculateProfitPercent(100, 90, 'LONG');
    expect(result).toBe(-10);
  });

  it('calculates positive profit for SHORT when price goes down', () => {
    const result = calculateProfitPercent(100, 90, 'SHORT');
    expect(result).toBe(10);
  });

  it('calculates negative profit for SHORT when price goes up', () => {
    const result = calculateProfitPercent(100, 110, 'SHORT');
    expect(result).toBe(-10);
  });

  it('returns 0 when current price equals entry price', () => {
    expect(calculateProfitPercent(100, 100, 'LONG')).toBe(0);
    expect(calculateProfitPercent(100, 100, 'SHORT')).toBe(0);
  });

  it('handles large price movements', () => {
    const result = calculateProfitPercent(100, 200, 'LONG');
    expect(result).toBe(100);
  });

  it('LONG and SHORT are symmetric for same price change', () => {
    const longProfit = calculateProfitPercent(100, 110, 'LONG');
    const shortProfit = calculateProfitPercent(100, 90, 'SHORT');
    expect(longProfit).toBe(shortProfit);
  });
});
