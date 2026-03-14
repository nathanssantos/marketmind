import type { Kline } from '@marketmind/types';
import { getKlineClose } from '@marketmind/types';

/**
 * RSI calculation result
 * @property values - Array of RSI values (0-100), null for insufficient data periods
 */
export interface RSIResult {
  values: (number | null)[];
}

/**
 * Relative Strength Index (RSI)
 *
 * Measures the speed and magnitude of recent price changes to evaluate
 * overbought or oversold conditions.
 *
 * @reference Wilder, J.W. (1978). "New Concepts in Technical Trading Systems"
 * @see https://www.investopedia.com/terms/r/rsi.asp
 *
 * @formula
 * RSI = 100 - (100 / (1 + RS))
 * RS = Average Gain / Average Loss
 *
 * Initial Average (first period):
 *   Avg Gain = Sum of Gains over n periods / n
 *   Avg Loss = Sum of Losses over n periods / n
 *
 * Subsequent values (Wilder smoothing):
 *   Avg Gain = ((Previous Avg Gain × (n-1)) + Current Gain) / n
 *   Avg Loss = ((Previous Avg Loss × (n-1)) + Current Loss) / n
 *
 * @interpretation
 * - RSI > 70: Overbought (potential reversal down)
 * - RSI < 30: Oversold (potential reversal up)
 * - RSI = 50: Neutral
 * - Divergence between price and RSI indicates potential reversal
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period (default: 2, standard: 14)
 * @returns RSIResult with values array (0-100 range, null for insufficient data)
 *
 * @example
 * const klines = [...]; // Array of Kline objects
 * const result = calculateRSI(klines, 14);
 * // result.values: [null, null, ..., 70.53, 66.32, ...]
 */
export const calculateRSI = (klines: Kline[], period: number = 2): RSIResult => {
  if (klines.length < period + 1) {
    return { values: Array(klines.length).fill(null) };
  }

  const values: (number | null)[] = [];
  let prevAvgGain = 0;
  let prevAvgLoss = 0;

  for (let i = 0; i < klines.length; i++) {
    if (i < period) {
      values.push(null);
      continue;
    }

    if (i === period) {
      let gains = 0;
      let losses = 0;

      for (let j = 1; j <= period; j++) {
        const currentKline = klines[j];
        const prevKline = klines[j - 1];
        if (!currentKline || !prevKline) continue;
        const change = getKlineClose(currentKline) - getKlineClose(prevKline);
        if (change > 0) {
          gains += change;
        } else {
          losses += Math.abs(change);
        }
      }

      prevAvgGain = gains / period;
      prevAvgLoss = losses / period;
    } else {
      const currentKline = klines[i];
      const prevKline = klines[i - 1];
      if (!currentKline || !prevKline) {
        values.push(null);
        continue;
      }

      const change = getKlineClose(currentKline) - getKlineClose(prevKline);
      const currentGain = change > 0 ? change : 0;
      const currentLoss = change < 0 ? Math.abs(change) : 0;

      prevAvgGain = (prevAvgGain * (period - 1) + currentGain) / period;
      prevAvgLoss = (prevAvgLoss * (period - 1) + currentLoss) / period;
    }

    if (prevAvgLoss === 0) {
      values.push(100);
      continue;
    }

    const rs = prevAvgGain / prevAvgLoss;
    const rsi = 100 - (100 / (1 + rs));

    values.push(rsi);
  }

  return { values };
};
