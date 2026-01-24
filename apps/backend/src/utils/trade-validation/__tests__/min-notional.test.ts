import { describe, expect, it } from 'vitest';
import { validateMinNotional } from '../min-notional';

describe('validateMinNotional', () => {
  it('should pass when position value meets minimum', () => {
    const result = validateMinNotional({
      positionValue: 100,
    });

    expect(result.isValid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should fail when position value is below minimum', () => {
    const result = validateMinNotional({
      positionValue: 0.5,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('below minimum');
    expect(result.reason).toContain('0.50');
  });

  it('should respect custom minimum', () => {
    const result = validateMinNotional({
      positionValue: 5,
      minTradeValueUsd: 10,
    });

    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('10');
  });

  it('should pass exactly at minimum', () => {
    const result = validateMinNotional({
      positionValue: 1,
      minTradeValueUsd: 1,
    });

    expect(result.isValid).toBe(true);
  });
});
