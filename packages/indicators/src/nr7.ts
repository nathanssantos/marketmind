import type { Kline } from '@marketmind/types';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

export interface NR7Result {
  isNR7: boolean[];
  ranges: (number | null)[];
  minRange: (number | null)[];
}

/**
 * NR7 (Narrow Range 7) Indicator
 *
 * Identifies bars with the narrowest range in the last 7 bars.
 * NR7 patterns suggest low volatility and potential breakout.
 *
 * From Tony Crabel's "Day Trading with Short Term Price Patterns"
 *
 * Research shows CAGR of 7.8% with 899 trades on SPY since 1993
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period (default: 7)
 * @returns Object with NR7 detection and range values
 */
export const calculateNR7 = (klines: Kline[], period: number = 7): NR7Result => {
  const isNR7: boolean[] = [];
  const ranges: (number | null)[] = [];
  const minRange: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    if (!kline) {
      isNR7.push(false);
      ranges.push(null);
      minRange.push(null);
      continue;
    }
    const currentRange = getKlineHigh(kline) - getKlineLow(kline);
    ranges.push(currentRange);

    if (i < period - 1) {
      isNR7.push(false);
      minRange.push(null);
      continue;
    }

    let isNarrowest = true;
    let minRangeValue = currentRange;

    for (let j = i - period + 1; j < i; j++) {
      const prevKline = klines[j];
      if (!prevKline) continue;
      const prevRange = getKlineHigh(prevKline) - getKlineLow(prevKline);
      if (prevRange < minRangeValue) {
        minRangeValue = prevRange;
      }
      if (prevRange <= currentRange) {
        isNarrowest = false;
      }
    }

    isNR7.push(isNarrowest);
    minRange.push(minRangeValue);
  }

  return { isNR7, ranges, minRange };
};

/**
 * Detect Inside Bar pattern
 *
 * An inside bar has its high lower than previous high
 * and its low higher than previous low.
 *
 * @param klines - Array of candlestick data
 * @returns Array of booleans indicating inside bar detection
 */
export const calculateInsideBar = (klines: Kline[]): boolean[] => {
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i === 0) {
      result.push(false);
      continue;
    }

    const currentKline = klines[i];
    const prevKline = klines[i - 1];
    if (!currentKline || !prevKline) {
      result.push(false);
      continue;
    }

    const currentHigh = getKlineHigh(currentKline);
    const currentLow = getKlineLow(currentKline);
    const prevHigh = getKlineHigh(prevKline);
    const prevLow = getKlineLow(prevKline);

    const isInside = currentHigh < prevHigh && currentLow > prevLow;
    result.push(isInside);
  }

  return result;
};

/**
 * Detect NR7 + Inside Bar combination pattern
 *
 * This powerful pattern combines:
 * 1. NR7: Narrowest range in 7 bars (low volatility)
 * 2. Inside Bar: Bar contained within previous bar
 *
 * @param klines - Array of candlestick data
 * @param period - NR7 lookback period (default: 7)
 * @returns Array of booleans indicating NR7 Inside Bar pattern
 */
export const calculateNR7InsideBar = (
  klines: Kline[],
  period: number = 7
): boolean[] => {
  const nr7 = calculateNR7(klines, period);
  const insideBar = calculateInsideBar(klines);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    const isNR7Value = nr7.isNR7[i];
    const insideBarValue = insideBar[i];
    result.push((isNR7Value ?? false) && (insideBarValue ?? false));
  }

  return result;
};

/**
 * NR4 (Narrow Range 4) Indicator
 *
 * Similar to NR7 but uses 4-bar lookback.
 * Faster signals but may have more false positives.
 *
 * @param klines - Array of candlestick data
 * @returns Object with NR4 detection and range values
 */
export const calculateNR4 = (klines: Kline[]): NR7Result => {
  return calculateNR7(klines, 4);
};

/**
 * Calculate breakout levels from NR7 bar
 *
 * @param klines - Array of candlestick data
 * @param period - NR7 lookback period (default: 7)
 * @returns Object with breakout levels
 */
export interface NR7BreakoutLevels {
  longEntry: (number | null)[];
  shortEntry: (number | null)[];
  longStop: (number | null)[];
  shortStop: (number | null)[];
  targetMultiplier: number;
}

export const calculateNR7BreakoutLevels = (
  klines: Kline[],
  period: number = 7,
  targetMultiplier: number = 2
): NR7BreakoutLevels => {
  const nr7 = calculateNR7(klines, period);
  const longEntry: (number | null)[] = [];
  const shortEntry: (number | null)[] = [];
  const longStop: (number | null)[] = [];
  const shortStop: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (!nr7.isNR7[i]) {
      longEntry.push(null);
      shortEntry.push(null);
      longStop.push(null);
      shortStop.push(null);
      continue;
    }

    const kline = klines[i];
    if (!kline) {
      longEntry.push(null);
      shortEntry.push(null);
      longStop.push(null);
      shortStop.push(null);
      continue;
    }

    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);

    longEntry.push(high);
    shortEntry.push(low);
    longStop.push(low);
    shortStop.push(high);
  }

  return {
    longEntry,
    shortEntry,
    longStop,
    shortStop,
    targetMultiplier,
  };
};
