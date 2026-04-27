import { describe, expect, it } from 'vitest';
import {
  clampStopToTighten,
  findRelatedOrdersForSlTp,
  isTighterStop,
  isValidTakeProfit,
  type RelatableOrder,
} from './orderDragValidators';

describe('isValidTakeProfit', () => {
  it('LONG: tp must be ABOVE entry', () => {
    expect(isValidTakeProfit(110, 100, 'LONG')).toBe(true);
    expect(isValidTakeProfit(100.01, 100, 'LONG')).toBe(true);
  });

  it('LONG: tp at or below entry is invalid (no profit)', () => {
    expect(isValidTakeProfit(100, 100, 'LONG')).toBe(false);
    expect(isValidTakeProfit(99, 100, 'LONG')).toBe(false);
  });

  it('SHORT: tp must be BELOW entry', () => {
    expect(isValidTakeProfit(90, 100, 'SHORT')).toBe(true);
    expect(isValidTakeProfit(99.99, 100, 'SHORT')).toBe(true);
  });

  it('SHORT: tp at or above entry is invalid', () => {
    expect(isValidTakeProfit(100, 100, 'SHORT')).toBe(false);
    expect(isValidTakeProfit(101, 100, 'SHORT')).toBe(false);
  });
});

describe('isTighterStop (slTightenOnly mode)', () => {
  describe('LONG', () => {
    it('moving stop UP (closer to entry from below) is tighter', () => {
      expect(isTighterStop(95, 90, 'LONG')).toBe(true);
    });

    it('keeping stop at the initial value is allowed (no-move release)', () => {
      expect(isTighterStop(90, 90, 'LONG')).toBe(true);
    });

    it('moving stop DOWN (further from entry) is NOT tighter — rejected', () => {
      expect(isTighterStop(85, 90, 'LONG')).toBe(false);
    });
  });

  describe('SHORT', () => {
    it('moving stop DOWN (closer to entry from above) is tighter', () => {
      expect(isTighterStop(105, 110, 'SHORT')).toBe(true);
    });

    it('keeping stop at the initial value is allowed', () => {
      expect(isTighterStop(110, 110, 'SHORT')).toBe(true);
    });

    it('moving stop UP (further from entry) is NOT tighter — rejected', () => {
      expect(isTighterStop(115, 110, 'SHORT')).toBe(false);
    });
  });
});

describe('clampStopToTighten (drag preview)', () => {
  describe('LONG', () => {
    it('preview ABOVE the initial stop passes through', () => {
      expect(clampStopToTighten(95, 90, 'LONG')).toBe(95);
    });

    it('preview BELOW the initial stop is clamped to the initial', () => {
      expect(clampStopToTighten(85, 90, 'LONG')).toBe(90);
    });

    it('preview equal to the initial stop returns the initial', () => {
      expect(clampStopToTighten(90, 90, 'LONG')).toBe(90);
    });
  });

  describe('SHORT', () => {
    it('preview BELOW the initial stop passes through', () => {
      expect(clampStopToTighten(105, 110, 'SHORT')).toBe(105);
    });

    it('preview ABOVE the initial stop is clamped to the initial', () => {
      expect(clampStopToTighten(115, 110, 'SHORT')).toBe(110);
    });
  });
});

describe('findRelatedOrdersForSlTp (multi-entry SL/TP fan-out)', () => {
  const o = (overrides: Partial<RelatableOrder> = {}): RelatableOrder => ({
    id: overrides.id ?? `o-${Math.random().toString(36).slice(2, 6)}`,
    symbol: 'BTCUSDT',
    isLong: true,
    isActive: true,
    ...overrides,
  });

  it('returns all same-symbol same-side active orders (the dragged order itself is included)', () => {
    const dragged = o({ id: 'a', isLong: true });
    const out = findRelatedOrdersForSlTp(
      [dragged, o({ id: 'b', isLong: true }), o({ id: 'c', isLong: true })],
      dragged,
    );
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
  });

  it('excludes opposite-side orders (LONG vs SHORT on same symbol)', () => {
    const dragged = o({ id: 'long-1', isLong: true });
    const out = findRelatedOrdersForSlTp(
      [dragged, o({ id: 'short-1', isLong: false })],
      dragged,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('long-1');
  });

  it('excludes different-symbol orders', () => {
    const dragged = o({ id: 'btc-1', symbol: 'BTCUSDT' });
    const out = findRelatedOrdersForSlTp(
      [dragged, o({ id: 'eth-1', symbol: 'ETHUSDT' })],
      dragged,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('btc-1');
  });

  it('excludes inactive orders (closed/cancelled)', () => {
    const dragged = o({ id: 'a', isActive: true });
    const out = findRelatedOrdersForSlTp(
      [dragged, o({ id: 'b', isActive: false })],
      dragged,
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('a');
  });

  it('returns empty when no order matches (excluding the dragged itself if it is inactive)', () => {
    const dragged = o({ id: 'a', isActive: false });
    const out = findRelatedOrdersForSlTp([dragged], dragged);
    expect(out).toEqual([]);
  });

  it('returns empty for an empty input', () => {
    const dragged = o({ id: 'a' });
    expect(findRelatedOrdersForSlTp([], dragged)).toEqual([]);
  });
});
