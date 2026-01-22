import type { Kline } from '@marketmind/types';

const EMA_MULTIPLIER_NUMERATOR = 2;

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

/**
 * MACD calculation result
 * @property macd - MACD line values (fast EMA - slow EMA)
 * @property signal - Signal line values (EMA of MACD line)
 * @property histogram - Histogram values (MACD - signal)
 */
export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = EMA_MULTIPLIER_NUMERATOR / (period + 1);
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const currentValue = data[i];
    if (currentValue === undefined) continue;

    if (i < period) {
      sum += currentValue;
      if (i === period - 1) {
        ema.push(sum / period);
      } else {
        ema.push(NaN);
      }
    } else {
      const prevEMA = ema[i - 1];
      if (prevEMA === undefined) continue;
      const currentEMA = (currentValue - prevEMA) * multiplier + prevEMA;
      ema.push(currentEMA);
    }
  }

  return ema;
};

/**
 * Moving Average Convergence Divergence (MACD)
 *
 * A trend-following momentum indicator showing the relationship between
 * two exponential moving averages of a security's price.
 *
 * @reference Appel, G. (1979). "The Moving Average Convergence-Divergence Method"
 * @see https://www.investopedia.com/terms/m/macd.asp
 *
 * @formula
 * MACD Line = EMA(fastPeriod) - EMA(slowPeriod)
 * Signal Line = EMA(signalPeriod) of MACD Line
 * Histogram = MACD Line - Signal Line
 *
 * EMA = Price × α + Previous EMA × (1 - α)
 * where α = 2 / (period + 1)
 *
 * @interpretation
 * - MACD crosses above signal: Bullish signal
 * - MACD crosses below signal: Bearish signal
 * - Histogram positive: Bullish momentum
 * - Histogram negative: Bearish momentum
 * - Divergence: Potential trend reversal
 *
 * @param klines - Array of candlestick data
 * @param fastPeriod - Fast EMA period (default: 12)
 * @param slowPeriod - Slow EMA period (default: 26)
 * @param signalPeriod - Signal line EMA period (default: 9)
 * @returns MACDResult with macd, signal, and histogram arrays
 *
 * @example
 * const result = calculateMACD(klines, 12, 26, 9);
 * // result.macd: Fast EMA - Slow EMA
 * // result.signal: 9-period EMA of MACD
 * // result.histogram: MACD - Signal
 */
export const calculateMACD = (
  klines: Kline[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): MACDResult => {
  if (klines.length === 0) {
    return { macd: [], signal: [], histogram: [] };
  }

  const closes = klines.map((c) => getKlineClose(c));

  const emaFast = calculateEMA(closes, fastPeriod);
  const emaSlow = calculateEMA(closes, slowPeriod);

  const macd = emaFast.map((fast, i) => {
    const slow = emaSlow[i];
    return slow !== undefined ? fast - slow : NaN;
  });

  const validMacdIndex = macd.findIndex((v) => !isNaN(v));

  if (validMacdIndex === -1) {
    return {
      macd,
      signal: macd.map(() => NaN),
      histogram: macd.map(() => NaN),
    };
  }

  const validMacd = macd.slice(validMacdIndex).filter((v) => !isNaN(v));
  const signal = calculateEMA(validMacd, signalPeriod);

  const paddedSignal = [
    ...new Array(validMacdIndex).fill(NaN),
    ...signal,
  ];

  const histogram = macd.map((m, i) => {
    const sig = paddedSignal[i];
    if (sig === undefined || isNaN(m) || isNaN(sig)) return NaN;
    return m - sig;
  });

  return { macd, signal: paddedSignal, histogram };
};
