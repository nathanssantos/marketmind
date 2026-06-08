import type { IncomeType } from '../../constants/income-types';
import type { EquityCurvePoint } from './dailyAggregate';

const PERCENT_MULTIPLIER = 100;

export const EQUITY_CURVE_TYPES: readonly IncomeType[] = [
  'REALIZED_PNL',
  'COMMISSION',
  'FUNDING_FEE',
  'TRANSFER',
];

/**
 * Max drawdown (%) measured on the deposit-neutralized equity curve.
 *
 * The curve is rebuilt chronologically from income events seeded at
 * `initialBalance`. PnL / fee / funding events move the running balance and
 * count toward drawdown. TRANSFER events (deposits/withdrawals) shift BOTH
 * the running balance and the peak by the same amount, so they never register
 * as a gain or a drawdown — matching how trading platforms report drawdown.
 *
 * `measureFrom` restricts the measured window: balance/peak still accumulate
 * over earlier history, but the peak resets to the balance at the window start
 * so the result is the worst peak-to-trough within the selected period. Omit
 * it (period 'all') to measure across the entire history.
 */
export const computeMaxDrawdown = (
  points: EquityCurvePoint[],
  initialBalance: number,
  measureFrom?: number,
): number => {
  let runningBalance = initialBalance;
  let peak = initialBalance;
  let maxDrawdown = 0;
  let started = measureFrom === undefined;

  for (const point of points) {
    if (!started && point.time >= measureFrom!) {
      peak = runningBalance;
      started = true;
    }

    runningBalance += point.delta;

    if (point.incomeType === 'TRANSFER') {
      peak += point.delta;
      continue;
    }

    if (runningBalance > peak) {
      peak = runningBalance;
    } else if (started && peak > 0) {
      const drawdown = ((peak - runningBalance) / peak) * PERCENT_MULTIPLIER;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};
