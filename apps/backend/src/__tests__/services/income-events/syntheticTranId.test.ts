import { describe, expect, it } from 'vitest';
import { isSyntheticTranId, nextSyntheticTranId } from '../../../services/income-events/syntheticTranId';

describe('nextSyntheticTranId', () => {
  it('always returns a negative integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(nextSyntheticTranId()).toBeLessThan(0);
    }
  });

  it('is collision-free under tight loops', () => {
    const batch = Array.from({ length: 10_000 }, () => nextSyntheticTranId());
    expect(new Set(batch).size).toBe(batch.length);
  });

  it('monotonically decreases within the same millisecond', () => {
    const a = nextSyntheticTranId();
    const b = nextSyntheticTranId();
    const c = nextSyntheticTranId();
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(c);
  });
});

describe('isSyntheticTranId', () => {
  it('returns true for negative ids', () => {
    expect(isSyntheticTranId(-1)).toBe(true);
    expect(isSyntheticTranId(nextSyntheticTranId())).toBe(true);
  });

  it('returns false for zero and positive ids (real Binance tranIds)', () => {
    expect(isSyntheticTranId(0)).toBe(false);
    expect(isSyntheticTranId(1)).toBe(false);
    expect(isSyntheticTranId(9_876_543_210)).toBe(false);
  });
});
