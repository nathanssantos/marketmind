import type { Kline } from '@marketmind/types';

/**
 * Bollinger Bands calculation result
 * @property upper - Upper band (middle + stdDev × multiplier)
 * @property middle - Middle band (SMA)
 * @property lower - Lower band (middle - stdDev × multiplier)
 */
export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
}

/**
 * Bollinger Bands
 *
 * A volatility indicator consisting of a middle band (SMA) and two outer bands
 * at standard deviation levels above and below the middle band.
 *
 * @reference Bollinger, J. (2001). "Bollinger on Bollinger Bands"
 * @see https://www.bollingerbands.com
 *
 * @formula
 * Middle Band = SMA(period)
 * Upper Band = Middle Band + (stdDev × σ)
 * Lower Band = Middle Band - (stdDev × σ)
 * σ = Standard deviation of closing prices over the period
 *
 * @interpretation
 * - Price near upper band: Overbought / strong uptrend
 * - Price near lower band: Oversold / strong downtrend
 * - Band contraction (squeeze): Low volatility, potential breakout
 * - Band expansion: High volatility
 * - Walking the bands: Strong trending market
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period for SMA and std dev (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns BollingerBands object or null if insufficient data
 *
 * @example
 * const bb = calculateBollingerBands(klines, 20, 2);
 * // bb.middle: 20-period SMA
 * // bb.upper: Middle + 2σ
 * // bb.lower: Middle - 2σ
 */
export const calculateBollingerBands = (
    klines: Kline[],
    period: number = 20,
    stdDev: number = 2
): BollingerBands | null => {
    const length = klines.length;
    if (length < period) {
        return null;
    }

    const startIdx = length - period;
    let sum = 0;

    for (let i = startIdx; i < length; i++) {
        sum += parseFloat(klines[i]!.close);
    }
    const middle = sum / period;

    let squaredDiffSum = 0;
    for (let i = startIdx; i < length; i++) {
        const close = parseFloat(klines[i]!.close);
        squaredDiffSum += Math.pow(close - middle, 2);
    }
    const variance = squaredDiffSum / period;
    const standardDeviation = Math.sqrt(variance);

    return {
        upper: middle + stdDev * standardDeviation,
        middle,
        lower: middle - stdDev * standardDeviation,
    };
};

/**
 * Calculate Bollinger Bands for all klines (array version)
 *
 * @param klines - Array of candlestick data
 * @param period - Lookback period (default: 20)
 * @param stdDev - Standard deviation multiplier (default: 2)
 * @returns Array of BollingerBands, null for insufficient data periods
 */
export const calculateBollingerBandsArray = (
    klines: Kline[],
    period: number = 20,
    stdDev: number = 2
): (BollingerBands | null)[] => {
    const length = klines.length;
    const result: (BollingerBands | null)[] = new Array(length);

    for (let i = 0; i < period - 1; i++) {
        result[i] = null;
    }

    for (let i = period - 1; i < length; i++) {
        let sum = 0;
        const startIdx = i - period + 1;

        for (let j = startIdx; j <= i; j++) {
            sum += parseFloat(klines[j]!.close);
        }
        const middle = sum / period;

        let squaredDiffSum = 0;
        for (let j = startIdx; j <= i; j++) {
            const close = parseFloat(klines[j]!.close);
            squaredDiffSum += Math.pow(close - middle, 2);
        }
        const variance = squaredDiffSum / period;
        const standardDeviation = Math.sqrt(variance);

        result[i] = {
            upper: middle + stdDev * standardDeviation,
            middle,
            lower: middle - stdDev * standardDeviation,
        };
    }

    return result;
};

/**
 * Bollinger Bands Width
 *
 * Measures the width of the bands relative to the middle band.
 * Useful for detecting volatility squeezes.
 *
 * @formula BBWidth = (Upper Band - Lower Band) / Middle Band
 *
 * @param bb - Bollinger Bands values
 * @returns Width as a decimal (e.g., 0.2 = 20% of middle band)
 */
export const calculateBBWidth = (bb: BollingerBands): number => {
    return (bb.upper - bb.lower) / bb.middle;
};

/**
 * Bollinger Bands %B (Percent B)
 *
 * Shows where the current price is relative to the bands.
 *
 * @formula %B = (Price - Lower Band) / (Upper Band - Lower Band)
 *
 * @interpretation
 * - %B > 1: Price above upper band
 * - %B = 1: Price at upper band
 * - %B = 0.5: Price at middle band
 * - %B = 0: Price at lower band
 * - %B < 0: Price below lower band
 *
 * @param price - Current price
 * @param bb - Bollinger Bands values
 * @returns %B value (typically 0-1, can exceed bounds)
 */
export const calculateBBPercentB = (price: number, bb: BollingerBands): number => {
    return (price - bb.lower) / (bb.upper - bb.lower);
};
