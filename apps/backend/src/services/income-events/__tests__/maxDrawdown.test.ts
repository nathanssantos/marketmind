import { describe, expect, it } from 'vitest';
import type { IncomeType } from '../../../constants/income-types';
import type { EquityCurvePoint } from '../dailyAggregate';
import { computeMaxDrawdown } from '../maxDrawdown';

let clock = 0;
const point = (incomeType: IncomeType, delta: number): EquityCurvePoint => {
  clock += 1;
  return { time: clock, cumulative: 0, delta, incomeType };
};

describe('computeMaxDrawdown', () => {
  it('measures peak-to-trough on the realized-PnL curve', () => {
    // 1000 → 1200 (peak) → 900 (trough). DD = (1200 - 900) / 1200 = 25%.
    const points = [
      point('REALIZED_PNL', 200),
      point('REALIZED_PNL', -300),
      point('REALIZED_PNL', 100),
    ];

    expect(computeMaxDrawdown(points, 1000)).toBeCloseTo(25, 5);
  });

  it('does NOT let a deposit register as a recovery', () => {
    // 1000 → 1200 (peak) → 900, then a +500 deposit lifts balance to 1400.
    // Without neutralization the deposit would look like a recovery and the
    // peak would jump to 1400; the drawdown must stay anchored at 25%.
    const withDeposit = [
      point('REALIZED_PNL', 200),
      point('REALIZED_PNL', -300),
      point('TRANSFER', 500),
    ];

    expect(computeMaxDrawdown(withDeposit, 1000)).toBeCloseTo(25, 5);
  });

  it('does NOT let a withdrawal register as a drawdown', () => {
    // 1000 → 1500 (peak via PnL) → withdraw 600 → 900. The withdrawal is not
    // a loss, so max drawdown stays 0.
    const withWithdrawal = [
      point('REALIZED_PNL', 500),
      point('TRANSFER', -600),
    ];

    expect(computeMaxDrawdown(withWithdrawal, 1000)).toBeCloseTo(0, 5);
  });

  it('preserves a drawdown that happened before a later deposit', () => {
    // 1000 → 700 (30% DD) → deposit 5000 (equity 5700). The deposit must
    // not erase the earlier 30% drawdown by inflating the peak.
    const points = [
      point('REALIZED_PNL', -300),
      point('TRANSFER', 5000),
    ];

    expect(computeMaxDrawdown(points, 1000)).toBeCloseTo(30, 5);
  });

  it('counts commission and funding toward the curve', () => {
    const points = [
      point('REALIZED_PNL', 100),
      point('COMMISSION', -50),
      point('FUNDING_FEE', -100),
    ];
    // 1000 → 1100 (peak) → 1050 → 950. DD = (1100 - 950) / 1100.
    expect(computeMaxDrawdown(points, 1000)).toBeCloseTo((150 / 1100) * 100, 5);
  });

  it('restricts the measured window with measureFrom', () => {
    // A big drop before the window must be ignored; only the in-window
    // 1100 → 1000 drop counts.
    const t1 = point('REALIZED_PNL', -500); // pre-window crash
    const t2 = point('REALIZED_PNL', 600); // recover into window start
    const windowStart = t2.time;
    const t3 = point('REALIZED_PNL', -100); // in-window dip

    const dd = computeMaxDrawdown([t1, t2, t3], 1000, windowStart);
    // At window start balance = 1100 (peak reset). Dip to 1000 → ~9.09%.
    expect(dd).toBeCloseTo((100 / 1100) * 100, 5);
  });

  it('returns 0 for an empty curve', () => {
    expect(computeMaxDrawdown([], 1000)).toBe(0);
  });
});
