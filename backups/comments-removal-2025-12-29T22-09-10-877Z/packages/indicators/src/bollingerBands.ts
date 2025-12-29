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
    if (klines.length < period) {
        return null;
    }

    const recentKlines = klines.slice(-period);
    const closes = recentKlines.map((k) => parseFloat(k.close));

    const sum = closes.reduce((acc, val) => acc + val, 0);
    const middle = sum / period;

    const squaredDifferences = closes.map((close) => Math.pow(close - middle, 2));
    const variance = squaredDifferences.reduce((acc, val) => acc + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    const upper = middle + stdDev * standardDeviation;
    const lower = middle - stdDev * standardDeviation;

    return {
        upper,
        middle,
        lower,
    };
};

export const calculateBollingerBandsArray = (
    klines: Kline[],
    period: number = 20,
    stdDev: number = 2
): (BollingerBands | null)[] => {
    const result: (BollingerBands | null)[] = [];

    for (let i = 0; i < klines.length; i++) {
        if (i < period - 1) {
            result.push(null);
        } else {
            const slice = klines.slice(0, i + 1);
            const bb = calculateBollingerBands(slice, period, stdDev);
            result.push(bb);
        }
    }

    return result;
};

export const calculateBBWidth = (bb: BollingerBands): number => {
    return (bb.upper - bb.lower) / bb.middle;
};

export const calculateBBPercentB = (price: number, bb: BollingerBands): number => {
    return (price - bb.lower) / (bb.upper - bb.lower);
};
