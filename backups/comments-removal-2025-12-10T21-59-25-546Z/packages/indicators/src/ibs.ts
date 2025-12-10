import type { Kline } from '@marketmind/types';

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export interface IBSResult {
  values: (number | null)[];
}

/**
 * Internal Bar Strength (IBS) Indicator
 *
 * Formula: IBS = (Close - Low) / (High - Low)
 *
 * IBS measures where the close is relative to the day's range:
 * - IBS = 0: Close at the low (bearish)
 * - IBS = 1: Close at the high (bullish)
 * - IBS < 0.2: Oversold (potential buy signal)
 * - IBS > 0.8: Overbought (potential sell signal)
 *
 * Used in mean-reversion strategies like Turnaround Tuesday
 * Research shows 74% win rate when IBS < 0.2 with proper filters
 */
export const calculateIBS = (klines: Kline[]): IBSResult => {
  const values: (number | null)[] = [];

  for (const kline of klines) {
    const high = getKlineHigh(kline);
    const low = getKlineLow(kline);
    const close = getKlineClose(kline);

    const range = high - low;

    if (range === 0) {
      values.push(0.5);
      continue;
    }

    const ibs = (close - low) / range;
    values.push(ibs);
  }

  return { values };
};
