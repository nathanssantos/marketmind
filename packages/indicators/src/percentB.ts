import type { Kline } from '@marketmind/types';
import { calculateBollingerBandsArray } from './bollingerBands';

export interface PercentBResult {
  values: (number | null)[];
}

/**
 * Bollinger Bands Percent B (%b) Indicator
 *
 * Formula: %b = (Close - Lower Band) / (Upper Band - Lower Band)
 *
 * %b measures where price is relative to Bollinger Bands:
 * - %b = 0: Price at lower band
 * - %b = 1: Price at upper band
 * - %b < 0: Price below lower band (oversold)
 * - %b > 1: Price above upper band (overbought)
 *
 * Used in Larry Connors' %b Strategy:
 * - Buy when %b < 0.2 for 3 consecutive days (with 200 SMA filter)
 * - Sell when %b > 0.8
 *
 * @param klines - Array of candlestick data
 * @param period - Bollinger Bands period (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns Object with %b values array
 */
export const calculatePercentBSeries = (
  klines: Kline[],
  period: number = 20,
  stdDev: number = 2
): PercentBResult => {
  const bbArray = calculateBollingerBandsArray(klines, period, stdDev);
  const values: (number | null)[] = [];

  for (let i = 0; i < klines.length; i++) {
    const kline = klines[i];
    const bb = bbArray[i];

    if (!kline || bb === null || bb === undefined) {
      values.push(null);
      continue;
    }

    const close = parseFloat(kline.close);
    const bandwidth = bb.upper - bb.lower;

    if (bandwidth === 0 || isNaN(bandwidth)) {
      values.push(0.5);
      continue;
    }

    const percentB = (close - bb.lower) / bandwidth;

    if (isNaN(percentB)) {
      values.push(null);
      continue;
    }

    values.push(percentB);
  }

  return { values };
};

/**
 * Check if %b has been below threshold for N consecutive days
 * Used in Connors' %b Strategy
 *
 * @param klines - Array of candlestick data
 * @param threshold - %b threshold (default: 0.2)
 * @param consecutiveDays - Days required below threshold (default: 3)
 * @param period - Bollinger Bands period (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns Array of booleans indicating pattern detection
 */
export const calculatePercentBConsecutive = (
  klines: Kline[],
  threshold: number = 0.2,
  consecutiveDays: number = 3,
  period: number = 20,
  stdDev: number = 2
): boolean[] => {
  const percentB = calculatePercentBSeries(klines, period, stdDev);
  const result: boolean[] = [];

  for (let i = 0; i < klines.length; i++) {
    if (i < consecutiveDays - 1) {
      result.push(false);
      continue;
    }

    let allBelowThreshold = true;

    for (let j = 0; j < consecutiveDays; j++) {
      const value = percentB.values[i - j];
      if (value === null || value === undefined || value >= threshold) {
        allBelowThreshold = false;
        break;
      }
    }

    result.push(allBelowThreshold);
  }

  return result;
};
