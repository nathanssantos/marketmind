import { describe, expect, it } from 'vitest';
import { computeOrderQuantity } from './orderSizing';

describe('computeOrderQuantity', () => {
  // Fine stepSize so lot flooring loss is negligible for the math assertions.
  const base = { balance: 1000, leverage: 50, isFutures: true, price: 1, stepSize: 0.0001, takerFee: 0.0005 };

  it('reserves only the opening taker fee at 100% (max deployment)', () => {
    const qty = parseFloat(computeOrderQuantity({ ...base, sizePercent: 100 }));
    const notional = qty * base.price;
    // notionalMax = balance / (1/leverage + takerFee) = 1000 / (0.02 + 0.0005).
    const expectedNotional = 1000 / (1 / 50 + 0.0005);
    expect(notional).toBeCloseTo(expectedNotional, 2);
  });

  it('deploys far more than the old fee-less-but-lot-floored result (≈97.5% of margin)', () => {
    const qty = parseFloat(computeOrderQuantity({ ...base, sizePercent: 100 }));
    const marginUsed = (qty * base.price) / base.leverage;
    const marginPctOfBalance = (marginUsed / base.balance) * 100;
    expect(marginPctOfBalance).toBeGreaterThan(97);
    expect(marginPctOfBalance).toBeLessThan(100);
  });

  it('scales linearly with the selector percentage', () => {
    const q100 = parseFloat(computeOrderQuantity({ ...base, sizePercent: 100 }));
    const q25 = parseFloat(computeOrderQuantity({ ...base, sizePercent: 25 }));
    expect(q25).toBeCloseTo(q100 * 0.25, 1);
  });

  it('uses the full notional (no leverage divisor) for spot', () => {
    const qty = parseFloat(
      computeOrderQuantity({ ...base, isFutures: false, sizePercent: 100 }),
    );
    const notional = qty * base.price;
    expect(notional).toBeCloseTo(1000 / (1 + 0.0005), 2);
  });

  it('floors to the lot stepSize', () => {
    const qty = computeOrderQuantity({ ...base, sizePercent: 100, stepSize: 0.1, price: 6316 });
    const steps = parseFloat(qty) / 0.1;
    expect(Math.abs(steps - Math.round(steps))).toBeLessThan(1e-6);
  });

  it('returns zero for an empty balance', () => {
    expect(parseFloat(computeOrderQuantity({ ...base, balance: 0, sizePercent: 100 }))).toBe(0);
  });
});
