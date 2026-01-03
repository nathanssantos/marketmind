import type { Kline } from '@marketmind/types';

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
}

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

export const calculateBBWidth = (bb: BollingerBands): number => {
    return (bb.upper - bb.lower) / bb.middle;
};

export const calculateBBPercentB = (price: number, bb: BollingerBands): number => {
    return (price - bb.lower) / (bb.upper - bb.lower);
};
