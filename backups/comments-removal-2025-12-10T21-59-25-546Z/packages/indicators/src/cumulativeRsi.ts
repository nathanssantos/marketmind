import type { Kline } from '@marketmind/types';
import { calculateRSI } from './rsi';

export interface CumulativeRSIResult {
  values: (number | null)[];
  rsiValues: (number | null)[];
}

/**
 * Cumulative RSI Indicator (Larry Connors)
 *
 * Sum of RSI values over N periods.
 * Used to identify extended oversold/overbought conditions.
 *
 * Original rules from "Short Term Trading Strategies That Work":
 * - Buy when Cumulative RSI(2, 2 days) < 10
 * - Sell when close > 5-day SMA
 *
 * Research shows 83% win rate with this strategy
 *
 * @param klines - Array of candlestick data
 * @param rsiPeriod - RSI calculation period (default: 2)
 * @param sumPeriod - Number of periods to sum (default: 2)
 * @returns Object with cumulative RSI values and underlying RSI values
 */
export const calculateCumulativeRSI = (
  klines: Kline[],
  rsiPeriod: number = 2,
  sumPeriod: number = 2
): CumulativeRSIResult => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + sumPeriod - 1) {
      values.push(null);
      continue;
    }

    let sum = 0;
    let hasNull = false;

    for (let j = 0; j < sumPeriod; j++) {
      const rsiValue = rsi.values[i - j];
      if (rsiValue === null || rsiValue === undefined) {
        hasNull = true;
        break;
      }
      sum += rsiValue;
    }

    if (hasNull) {
      values.push(null);
    } else {
      values.push(sum);
    }
  }

  return {
    values,
    rsiValues: rsi.values,
  };
};

/**
 * Check if RSI has dropped for N consecutive days
 * Used in R3 Strategy
 *
 * @param klines - Array of candlestick data
 * @param rsiPeriod - RSI calculation period (default: 2)
 * @param consecutiveDays - Days required dropping (default: 3)
 * @returns Array of booleans indicating consecutive drops
 */
export const calculateRSIConsecutiveDrops = (
  klines: Kline[],
  rsiPeriod: number = 2,
  consecutiveDays: number = 3
): boolean[] => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + consecutiveDays) {
      result.push(false);
      continue;
    }

    let allDropping = true;

    for (let j = 0; j < consecutiveDays; j++) {
      const current = rsi.values[i - j];
      const prev = rsi.values[i - j - 1];

      if (current === null || current === undefined || prev === null || prev === undefined || current >= prev) {
        allDropping = false;
        break;
      }
    }

    result.push(allDropping);
  }

  return result;
};

/**
 * R3 Strategy Entry Detection
 *
 * Rules:
 * 1. RSI(2) drops 3 days in a row
 * 2. First day's drop is from a reading below 60
 * 3. RSI(2) is today below 10
 *
 * @param klines - Array of candlestick data
 * @param rsiPeriod - RSI calculation period (default: 2)
 * @returns Array of booleans indicating R3 entry signal
 */
export const calculateR3Entry = (
  klines: Kline[],
  rsiPeriod: number = 2
): boolean[] => {
  const rsi = calculateRSI(klines, rsiPeriod);
  const consecutiveDrops = calculateRSIConsecutiveDrops(klines, rsiPeriod, 3);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < rsiPeriod + 3) {
      result.push(false);
      continue;
    }

    const currentRSI = rsi.values[i];
    const firstDropRSI = rsi.values[i - 2];
    const consecutiveDrop = consecutiveDrops[i];

    if (
      consecutiveDrop &&
      currentRSI !== null &&
      currentRSI !== undefined &&
      firstDropRSI !== null &&
      firstDropRSI !== undefined &&
      currentRSI < 10 &&
      firstDropRSI < 60
    ) {
      result.push(true);
    } else {
      result.push(false);
    }
  }

  return result;
};
