import type { Kline } from '@marketmind/types';
import { describe, expect, it } from 'vitest';
import {
    calculateBBWidth,
    calculateBollingerBands,
    calculateBollingerBandsArray,
    calculatePercentB,
} from './bollingerBands';

const createMockKlines = (count: number, basePrice: number = 100): Kline[] => {
    return Array.from({ length: count }, (_, i) => ({
        openTime: Date.now() + i * 60000,
        open: (basePrice + i).toString(),
        high: (basePrice + i + 2).toString(),
        low: (basePrice + i - 2).toString(),
        close: (basePrice + i).toString(),
        volume: '1000',
        closeTime: Date.now() + (i + 1) * 60000,
        quoteVolume: '100000',
        trades: 100,
        takerBuyBaseVolume: '500',
        takerBuyQuoteVolume: '50000',
    }));
};

describe('bollingerBands', () => {
    describe('calculateBollingerBands', () => {
        it('should return null for insufficient data', () => {
            const klines = createMockKlines(10);
            const result = calculateBollingerBands(klines, 20);
            expect(result).toBeNull();
        });

        it('should calculate Bollinger Bands correctly', () => {
            const klines = createMockKlines(100, 100);
            const result = calculateBollingerBands(klines, 20, 2);

            expect(result).not.toBeNull();
            expect(result!.middle).toBeGreaterThan(0);
            expect(result!.upper).toBeGreaterThan(result!.middle);
            expect(result!.lower).toBeLessThan(result!.middle);
        });

        it('should have symmetric bands around middle', () => {
            // Create klines with constant price (no volatility)
            const klines: Kline[] = Array.from({ length: 20 }, (_, i) => ({
                openTime: Date.now() + i * 60000,
                open: '100',
                high: '101',
                low: '99',
                close: '100',
                volume: '1000000',
                closeTime: Date.now() + (i + 1) * 60000,
                quoteVolume: '100000000',
                trades: 100,
                takerBuyBaseVolume: '500000',
                takerBuyQuoteVolume: '50000000',
            }));

            const result = calculateBollingerBands(klines, 20, 2);

            expect(result).not.toBeNull();
            expect(result!.middle).toBe(100);
            expect(result!.upper).toBe(100);
            expect(result!.lower).toBe(100);
        });

        it('should widen with higher standard deviation', () => {
            const klines = createMockKlines(100, 100);

            const bb1 = calculateBollingerBands(klines, 20, 1);
            const bb2 = calculateBollingerBands(klines, 20, 2);
            const bb3 = calculateBollingerBands(klines, 20, 3);

            expect(bb1).not.toBeNull();
            expect(bb2).not.toBeNull();
            expect(bb3).not.toBeNull();

            const width1 = bb1!.upper - bb1!.lower;
            const width2 = bb2!.upper - bb2!.lower;
            const width3 = bb3!.upper - bb3!.lower;

            expect(width2).toBeGreaterThan(width1);
            expect(width3).toBeGreaterThan(width2);
        });
    });

    describe('calculateBollingerBandsArray', () => {
        it('should return null for initial periods', () => {
            const klines = createMockKlines(30);
            const result = calculateBollingerBandsArray(klines, 20);

            expect(result.length).toBe(30);
            expect(result[0]).toBeNull();
            expect(result[18]).toBeNull();
            expect(result[19]).not.toBeNull();
        });

        it('should calculate for all valid klines', () => {
            const klines = createMockKlines(50);
            const result = calculateBollingerBandsArray(klines, 20);

            expect(result.length).toBe(50);

            for (let i = 19; i < 50; i++) {
                expect(result[i]).not.toBeNull();
                expect(result[i]!.upper).toBeGreaterThan(result[i]!.middle);
                expect(result[i]!.lower).toBeLessThan(result[i]!.middle);
            }
        });
    });

    describe('calculateBBWidth', () => {
        it('should calculate band width correctly', () => {
            const bb = {
                upper: 110,
                middle: 100,
                lower: 90,
            };

            const width = calculateBBWidth(bb);
            expect(width).toBe(0.2); // (110 - 90) / 100 = 0.2
        });

        it('should return 0 for no volatility', () => {
            const bb = {
                upper: 100,
                middle: 100,
                lower: 100,
            };

            const width = calculateBBWidth(bb);
            expect(width).toBe(0);
        });
    });

    describe('calculatePercentB', () => {
        const bb = {
            upper: 110,
            middle: 100,
            lower: 90,
        };

        it('should return 0 at lower band', () => {
            const percentB = calculatePercentB(90, bb);
            expect(percentB).toBe(0);
        });

        it('should return 0.5 at middle band', () => {
            const percentB = calculatePercentB(100, bb);
            expect(percentB).toBe(0.5);
        });

        it('should return 1 at upper band', () => {
            const percentB = calculatePercentB(110, bb);
            expect(percentB).toBe(1);
        });

        it('should return >1 above upper band', () => {
            const percentB = calculatePercentB(120, bb);
            expect(percentB).toBeGreaterThan(1);
        });

        it('should return <0 below lower band', () => {
            const percentB = calculatePercentB(80, bb);
            expect(percentB).toBeLessThan(0);
        });
    });
});
