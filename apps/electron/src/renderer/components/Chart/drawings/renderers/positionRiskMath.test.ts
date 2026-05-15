import { describe, expect, it } from 'vitest';
import { computePositionRisk } from './positionRiskMath';

describe('computePositionRisk', () => {
  it('returns NaN when any input is invalid', () => {
    const base = { entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0.0004 };
    expect(computePositionRisk({ ...base, entryPrice: 0 }).exposurePercent).toBeNaN();
    expect(computePositionRisk({ ...base, stopLossPrice: 0 }).exposurePercent).toBeNaN();
    expect(computePositionRisk({ ...base, sizePercent: 0 }).exposurePercent).toBeNaN();
    expect(computePositionRisk({ ...base, balance: 0 }).exposurePercent).toBeNaN();
    expect(computePositionRisk({ ...base, leverage: 0 }).exposurePercent).toBeNaN();
  });

  it('basic LONG: 10% size at 1x leverage, 5% stop → ~0.50% pure + ~0.0078% fees', () => {
    // balance=1000, 10% size → notional 100 → qty 1. SL distance 5 (entry 100, SL 95) → loss 5.
    // fees: (100 + 95) × 0.0004 = 0.078. Total 5.078 / 1000 = 0.5078%
    const r = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0.0004,
    });
    expect(r.exposurePercent).toBeCloseTo(0.5078, 3);
  });

  it('SHORT (stop above entry) has same magnitude as equivalent-distance LONG', () => {
    const longRisk = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0.0004,
    });
    const shortRisk = computePositionRisk({
      entryPrice: 100, stopLossPrice: 105, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0.0004,
    });
    // Risk magnitude should be close; only fee notional differs slightly because
    // exit notional uses stopLossPrice (which differs between long↑ vs short↑).
    expect(Math.abs(longRisk.exposurePercent - shortRisk.exposurePercent)).toBeLessThan(0.005);
  });

  it('leverage scales risk linearly', () => {
    const at1x = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0,
    });
    const at5x = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 5, takerRate: 0,
    });
    expect(at5x.exposurePercent / at1x.exposurePercent).toBeCloseTo(5, 6);
  });

  it('size scales risk linearly', () => {
    const at10pct = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0,
    });
    const at20pct = computePositionRisk({
      entryPrice: 100, stopLossPrice: 95, sizePercent: 20, balance: 1000, leverage: 1, takerRate: 0,
    });
    expect(at20pct.exposurePercent / at10pct.exposurePercent).toBeCloseTo(2, 6);
  });

  it('zero stop distance → only fees', () => {
    const r = computePositionRisk({
      entryPrice: 100, stopLossPrice: 100, sizePercent: 10, balance: 1000, leverage: 1, takerRate: 0.0004,
    });
    // 0 loss + (100 + 100) × 0.0004 = 0.08 → 0.008%
    expect(r.exposurePercent).toBeCloseTo(0.008, 4);
  });

  it('100% size at 10x leverage with 0.5% stop hits ~5.8% (loss + fees)', () => {
    // balance=10k, 100%×10 leverage → 100k notional, qty=2 BTC.
    // SL distance 250 → loss 500. Fees: (100000 + 99500)×0.0004 = 79.8.
    // Total 579.8 / 10000 = 5.798%. With leverage even a "small" 0.5%
    // stop blows through the typical 2% warning threshold — exactly
    // the kind of mistake the warning icon is meant to catch.
    const r = computePositionRisk({
      entryPrice: 50000, stopLossPrice: 49750, sizePercent: 100, balance: 10_000, leverage: 10, takerRate: 0.0004,
    });
    expect(r.exposurePercent).toBeCloseTo(5.798, 2);
  });
});
