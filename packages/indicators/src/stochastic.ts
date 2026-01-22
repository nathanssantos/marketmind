import type { Kline } from '@marketmind/types';

const getKlineClose = (kline: Kline): number => parseFloat(kline.close);
const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);

/**
 * Stochastic Oscillator calculation result
 * @property k - %K line values (smoothed fast stochastic)
 * @property d - %D line values (SMA of %K)
 */
export interface StochasticResult {
  k: (number | null)[];
  d: (number | null)[];
}

const calculatePureSMA = (values: (number | null)[], period: number): (number | null)[] => {
  const len = values.length;
  if (period <= 0 || len === 0) {
    return [];
  }

  const result: (number | null)[] = new Array(len);

  for (let i = 0; i < len; i++) {
    if (i < period - 1) {
      result[i] = null;
      continue;
    }

    let sum = 0;
    let count = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const val = values[j];
      if (val !== null && val !== undefined) {
        sum += val;
        count++;
      }
    }

    result[i] = count === period ? sum / period : null;
  }

  return result;
};

/**
 * Stochastic Oscillator
 *
 * A momentum indicator comparing a particular closing price to a range of
 * prices over a given period. The indicator generates overbought and oversold
 * signals based on price position relative to the trading range.
 *
 * @reference Lane, G. (1950s). "Lane's Stochastics"
 * @see https://www.investopedia.com/terms/s/stochasticoscillator.asp
 *
 * @formula
 * Fast %K = 100 × (Close - Lowest Low) / (Highest High - Lowest Low)
 * Slow %K = SMA(Fast %K, kSmoothing)  [This is the %K output]
 * %D = SMA(Slow %K, dPeriod)
 *
 * Lowest Low = Lowest low of last kPeriod periods
 * Highest High = Highest high of last kPeriod periods
 *
 * @variations
 * - Fast Stochastic: Raw %K, %D = SMA(%K, 3)
 * - Slow Stochastic: %K = SMA(Fast %K, 3), %D = SMA(Slow %K, 3) [this implementation]
 * - Full Stochastic: All parameters customizable
 *
 * @interpretation
 * - %K > 80: Overbought
 * - %K < 20: Oversold
 * - %K crosses above %D: Bullish signal
 * - %K crosses below %D: Bearish signal
 * - Divergence: Potential reversal
 *
 * @param klines - Array of candlestick data
 * @param kPeriod - Lookback period for highest/lowest (default: 14)
 * @param kSmoothing - Smoothing period for %K (default: 3)
 * @param dPeriod - Period for %D line (default: 3)
 * @returns StochasticResult with k and d arrays (0-100 range)
 *
 * @example
 * const result = calculateStochastic(klines, 14, 3, 3);
 * // result.k: Slow %K (smoothed)
 * // result.d: %D (signal line)
 */
export const calculateStochastic = (
  klines: Kline[],
  kPeriod: number = 14,
  kSmoothing: number = 3,
  dPeriod: number = 3
): StochasticResult => {
  if (klines.length === 0 || kPeriod <= 0 || kSmoothing <= 0 || dPeriod <= 0) {
    return { k: [], d: [] };
  }

  const len = klines.length;
  const fastK: (number | null)[] = new Array(len);

  for (let i = 0; i < kPeriod - 1 && i < len; i++) {
    fastK[i] = null;
  }

  for (let i = kPeriod - 1; i < len; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    const startIdx = i - kPeriod + 1;

    for (let j = startIdx; j <= i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      const high = getKlineHigh(kline);
      const low = getKlineLow(kline);
      if (high > highestHigh) highestHigh = high;
      if (low < lowestLow) lowestLow = low;
    }

    const currentKline = klines[i];
    if (!currentKline) {
      fastK[i] = null;
      continue;
    }
    const currentClose = getKlineClose(currentKline);

    if (highestHigh === lowestLow) {
      fastK[i] = 50;
      continue;
    }

    fastK[i] = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
  }

  const slowK = calculatePureSMA(fastK, kSmoothing);
  const slowD = calculatePureSMA(slowK, dPeriod);

  return { k: slowK, d: slowD };
};

/**
 * Stochastic Oscillator configuration
 * @property kPeriod - Lookback period for highest/lowest calculation
 * @property kSmoothing - Smoothing period for %K
 * @property dPeriod - Period for %D (signal) line
 * @property enabled - Whether the indicator is enabled
 * @property kColor - Color for %K line
 * @property dColor - Color for %D line
 * @property overboughtLevel - Overbought threshold (typically 80)
 * @property oversoldLevel - Oversold threshold (typically 20)
 */
export interface StochasticConfig {
  kPeriod: number;
  kSmoothing: number;
  dPeriod: number;
  enabled: boolean;
  kColor: string;
  dColor: string;
  overboughtLevel: number;
  oversoldLevel: number;
}

export const DEFAULT_STOCHASTIC_CONFIG: StochasticConfig = {
  kPeriod: 14,
  kSmoothing: 3,
  dPeriod: 3,
  enabled: false,
  kColor: '#2196f3',
  dColor: '#ff5722',
  overboughtLevel: 80,
  oversoldLevel: 20,
};
