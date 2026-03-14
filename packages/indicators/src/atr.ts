import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow } from '@marketmind/types';

const DEFAULT_ATR_PERIOD = 14;

/**
 * Average True Range (ATR)
 *
 * A volatility indicator that measures market volatility by decomposing
 * the entire range of an asset price for a given period.
 *
 * @reference Wilder, J.W. (1978). "New Concepts in Technical Trading Systems"
 * @see https://www.investopedia.com/terms/a/atr.asp
 *
 * @formula
 * True Range = max(
 *   High - Low,
 *   |High - Previous Close|,
 *   |Low - Previous Close|
 * )
 *
 * First ATR = Simple average of first n True Ranges
 * Subsequent ATR = ((Previous ATR × (n-1)) + Current TR) / n (Wilder smoothing)
 *
 * @interpretation
 * - Higher ATR: Greater volatility
 * - Lower ATR: Lower volatility
 * - ATR expansion: Increasing volatility / trend strength
 * - ATR contraction: Decreasing volatility / consolidation
 *
 * @usage
 * - Position sizing: ATR-based stop losses (e.g., 2× ATR)
 * - Volatility filtering: Avoid trades when ATR too high/low
 * - Breakout confirmation: High ATR validates breakout
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period (default: 14)
 * @returns Array of ATR values (NaN for first period-1 values)
 *
 * @example
 * const atr = calculateATR(klines, 14);
 * // atr: [NaN, NaN, ..., 1.5, 1.52, 1.48, ...]
 * const stopLoss = currentPrice - 2 * atr[atr.length - 1];
 */
export const calculateATR = (
  klines: Kline[],
  period = DEFAULT_ATR_PERIOD,
): number[] => {
  if (klines.length === 0) return [];

  const trueRanges: number[] = [];

  for (let i = 0; i < klines.length; i++) {
    const current = klines[i];
    if (!current) continue;

    if (i === 0) {
      trueRanges.push(getKlineHigh(current) - getKlineLow(current));
    } else {
      const prev = klines[i - 1];
      if (!prev) continue;

      const tr = Math.max(
        getKlineHigh(current) - getKlineLow(current),
        Math.abs(getKlineHigh(current) - getKlineClose(prev)),
        Math.abs(getKlineLow(current) - getKlineClose(prev)),
      );

      trueRanges.push(tr);
    }
  }

  const atr: number[] = [];

  let smaSum = 0;
  for (let i = 0; i < trueRanges.length; i++) {
    const tr = trueRanges[i];
    if (tr === undefined) continue;

    if (i < period - 1) {
      smaSum += tr;
      atr.push(NaN);
    } else if (i === period - 1) {
      smaSum += tr;
      atr.push(smaSum / period);
    } else {
      const prevATR = atr[i - 1];
      if (prevATR === undefined || isNaN(prevATR)) continue;
      const smoothedATR = (prevATR * (period - 1) + tr) / period;
      atr.push(smoothedATR);
    }
  }

  return atr;
};
