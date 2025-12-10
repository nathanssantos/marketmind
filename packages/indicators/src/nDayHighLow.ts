import type { Kline } from '@marketmind/types';

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface NDayHighLowResult {
  isNDayHigh: boolean[];
  isNDayLow: boolean[];
  highestClose: (number | null)[];
  lowestClose: (number | null)[];
  highestHigh: (number | null)[];
  lowestLow: (number | null)[];
}

/**
 * N-Day High/Low Indicator
 *
 * Calculates whether current bar is at N-day high or low.
 * Used in Double Seven and 3-Day High/Low strategies.
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period (default: 7 for Double Seven)
 * @returns Object with high/low detection arrays and actual values
 */
export const calculateNDayHighLow = (
  klines: Kline[],
  period: number = 7
): NDayHighLowResult => {
  const isNDayHigh: boolean[] = [];
  const isNDayLow: boolean[] = [];
  const highestClose: (number | null)[] = [];
  const lowestClose: (number | null)[] = [];
  const highestHigh: (number | null)[] = [];
  const lowestLow: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < period - 1) {
      isNDayHigh.push(false);
      isNDayLow.push(false);
      highestClose.push(null);
      lowestClose.push(null);
      highestHigh.push(null);
      lowestLow.push(null);
      continue;
    }

    const currentKline = klines[i];
    if (!currentKline) {
      isNDayHigh.push(false);
      isNDayLow.push(false);
      highestClose.push(null);
      lowestClose.push(null);
      highestHigh.push(null);
      lowestLow.push(null);
      continue;
    }
    const currentClose = getKlineClose(currentKline);

    let maxClose = -Infinity;
    let minClose = Infinity;
    let maxHigh = -Infinity;
    let minLow = Infinity;

    for (let j = i - period + 1; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      const close = getKlineClose(kline);
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);

      if (close > maxClose) maxClose = close;
      if (close < minClose) minClose = close;
      if (high > maxHigh) maxHigh = high;
      if (low < minLow) minLow = low;
    }

    isNDayHigh.push(currentClose >= maxClose);
    isNDayLow.push(currentClose <= minClose);
    highestClose.push(maxClose);
    lowestClose.push(minClose);
    highestHigh.push(maxHigh);
    lowestLow.push(minLow);
  }

  return {
    isNDayHigh,
    isNDayLow,
    highestClose,
    lowestClose,
    highestHigh,
    lowestLow,
  };
};

/**
 * Check if current bar has N consecutive lower highs and lower lows
 * Used in 3-Day High/Low strategy
 *
 * @param klines - Array of candlestick data
 * @param consecutiveDays - Number of consecutive days required (default: 3)
 * @returns Array of booleans indicating pattern detection
 */
export const calculateConsecutiveLowerHighsLows = (
  klines: Kline[],
  consecutiveDays: number = 3
): boolean[] => {
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < consecutiveDays) {
      result.push(false);
      continue;
    }

    let hasPattern = true;

    for (let j = 0; j < consecutiveDays; j++) {
      const current = klines[i - j];
      const prev = klines[i - j - 1];

      if (!current || !prev) {
        hasPattern = false;
        break;
      }

      const currentHigh = getKlineHigh(current);
      const currentLow = getKlineLow(current);
      const prevHigh = getKlineHigh(prev);
      const prevLow = getKlineLow(prev);

      if (currentHigh >= prevHigh || currentLow >= prevLow) {
        hasPattern = false;
        break;
      }
    }

    result.push(hasPattern);
  }

  return result;
};

/**
 * Check number of down days in last N days
 * Used in Multiple Days Down strategy
 *
 * @param klines - Array of candlestick data
 * @param lookbackDays - Total days to look back (default: 5)
 * @param minDownDays - Minimum down days required (default: 4)
 * @returns Array of booleans indicating if condition is met
 */
export const calculateMultipleDaysDown = (
  klines: Kline[],
  lookbackDays: number = 5,
  minDownDays: number = 4
): boolean[] => {
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < lookbackDays) {
      result.push(false);
      continue;
    }

    let downDays = 0;

    for (let j = 0; j < lookbackDays; j++) {
      const current = klines[i - j];
      const prev = klines[i - j - 1];

      if (!current || !prev) continue;

      if (getKlineClose(current) < getKlineClose(prev)) {
        downDays++;
      }
    }

    result.push(downDays >= minDownDays);
  }

  return result;
};
