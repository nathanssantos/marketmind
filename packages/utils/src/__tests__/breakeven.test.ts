import { describe, expect, it } from 'vitest';
import { calculateBreakevenPrice } from '../breakeven';
import { calculatePnl } from '../pnl';

describe('calculateBreakevenPrice', () => {
  const ENTRY = 50_000;
  const TAKER = 0.0004;

  it('returns a price above entry for LONG', () => {
    const be = calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG', takerRate: TAKER });
    expect(be).toBeGreaterThan(ENTRY);
    expect(be).toBeCloseTo(50_040.016, 2);
  });

  it('returns a price below entry for SHORT', () => {
    const be = calculateBreakevenPrice({ entryPrice: ENTRY, side: 'SHORT', takerRate: TAKER });
    expect(be).toBeLessThan(ENTRY);
    expect(be).toBeCloseTo(49_960.016, 2);
  });

  it('returns entry exactly when takerRate is 0 (no fees)', () => {
    expect(calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG', takerRate: 0 })).toBe(ENTRY);
    expect(calculateBreakevenPrice({ entryPrice: ENTRY, side: 'SHORT', takerRate: 0 })).toBe(ENTRY);
  });

  it('uses Binance Futures VIP 0 (0.04%) as the default takerRate', () => {
    const beExplicit = calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG', takerRate: 0.0004 });
    const beDefault = calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG' });
    expect(beDefault).toBe(beExplicit);
  });

  it('returns the entry price for invalid inputs (no NaN leakage)', () => {
    expect(calculateBreakevenPrice({ entryPrice: 0, side: 'LONG' })).toBe(0);
    expect(calculateBreakevenPrice({ entryPrice: NaN, side: 'LONG' })).toBeNaN();
    expect(calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG', takerRate: 1 })).toBe(ENTRY);
    expect(calculateBreakevenPrice({ entryPrice: ENTRY, side: 'LONG', takerRate: 2 })).toBe(ENTRY);
  });

  it('yields net-PnL ≈ 0 when round-tripped through calculatePnl', () => {
    for (const side of ['LONG', 'SHORT'] as const) {
      const be = calculateBreakevenPrice({ entryPrice: ENTRY, side, takerRate: TAKER });
      const result = calculatePnl({
        entryPrice: ENTRY,
        exitPrice: be,
        quantity: 1,
        side,
        marketType: 'FUTURES',
      });
      expect(result.netPnl).toBeCloseTo(0, 6);
    }
  });
});
