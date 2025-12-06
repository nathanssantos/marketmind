import { calculateBollingerBands, calculatePercentB, calculateRSI } from '@marketmind/indicators';
import type { Kline, SetupType } from '@shared/types';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

export interface MeanReversionConfig extends SetupDetectorConfig {
    bbPeriod: number;
    bbStdDev: number;
    rsiPeriod: number;
    rsiOversold: number;
    rsiOverbought: number;
    minVolume: number; // Multiplier of average volume
    maxHoldBars: number; // Max klines to hold position
}

/**
 * Mean Reversion Detector
 * 
 * Strategy: Buy oversold conditions, sell overbought conditions
 * Entry: Price < Lower Band AND RSI < 30 (LONG)
 *        Price > Upper Band AND RSI > 70 (SHORT)
 * Target: Middle Band (mean)
 * 
 * Expected Performance:
 * - Win Rate: 60-70%
 * - R:R: 1.5:1 to 2:1
 * - Best in ranging markets
 */
export class MeanReversionDetector extends BaseSetupDetector {
    private meanRevConfig: MeanReversionConfig;

    constructor(config: MeanReversionConfig) {
        super(config);
        this.meanRevConfig = config;
    }

    detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
        if (currentIndex < Math.max(this.meanRevConfig.bbPeriod, this.meanRevConfig.rsiPeriod)) {
            return { setup: null, confidence: 0 };
        }

        const current = klines[currentIndex];
        if (!current) {
            return { setup: null, confidence: 0 };
        }

        // Calculate Bollinger Bands
        const klinesUpToCurrent = klines.slice(0, currentIndex + 1);
        const bb = calculateBollingerBands(
            klinesUpToCurrent,
            this.meanRevConfig.bbPeriod,
            this.meanRevConfig.bbStdDev
        );

        if (!bb) {
            return { setup: null, confidence: 0 };
        }

        // Calculate RSI
        const rsiResult = calculateRSI(klinesUpToCurrent, this.meanRevConfig.rsiPeriod);
        const rsi = rsiResult.values[rsiResult.values.length - 1];
        if (rsi === null) {
            return { setup: null, confidence: 0 };
        }

        // Check volume confirmation
        const avgVolume = this.calculateAverageVolume(klines, currentIndex, 20);
        const volumeConfirmed = Number(current.volume) >= avgVolume * this.meanRevConfig.minVolume;

        if (!volumeConfirmed) {
            return { setup: null, confidence: 0 };
        }

        // Check for LONG setup (oversold)
        if (rsi !== undefined && Number(current!.close) < bb.lower && rsi < this.meanRevConfig.rsiOversold) {
            return this.createLongSetup(klines, currentIndex, bb, rsi);
        }

        // Check for SHORT setup (overbought)
        if (rsi !== undefined && Number(current!.close) > bb.upper && rsi > this.meanRevConfig.rsiOverbought) {
            return this.createShortSetup(klines, currentIndex, bb, rsi);
        }

        return { setup: null, confidence: 0 };
    }

    private createLongSetup(
        klines: Kline[],
        currentIndex: number,
        bb: { upper: number; middle: number; lower: number },
        rsi: number
    ): SetupDetectorResult {
        const current = klines[currentIndex]!;
        const entryPrice = Number(current.close);

        // Stop loss: Below lower band
        const stopDistance = bb.middle - bb.lower;
        const stopLoss = entryPrice - stopDistance * 0.5;

        // Take profit: Middle band (mean)
        const takeProfit = bb.middle;

        // Calculate confidence
        const confidence = this.calculateConfidence(Number(current.close), bb, rsi, 'LONG');

        // Check minimum criteria
        const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
        if (!this.meetsMinimumCriteria(confidence, riskReward)) {
            return { setup: null, confidence: 0 };
        }

        const setup = this.createSetup(
            'MEAN_REVERSION' as SetupType,
            'LONG',
            klines,
            currentIndex,
            entryPrice,
            stopLoss,
            takeProfit,
            confidence,
            true, // Volume confirmed
            0.8, // Indicator confluence (BB + RSI)
            {
                bbUpper: bb.upper,
                bbMiddle: bb.middle,
                bbLower: bb.lower,
                rsi,
                percentB: calculatePercentB(Number(current!.close), bb),
                strategy: 'oversold',
            }
        );

        return { setup, confidence };
    }

    private createShortSetup(
        klines: Kline[],
        currentIndex: number,
        bb: { upper: number; middle: number; lower: number },
        rsi: number
    ): SetupDetectorResult {
        const current = klines[currentIndex]!;
        const entryPrice = Number(current.close);

        // Stop loss: Above upper band
        const stopDistance = bb.upper - bb.middle;
        const stopLoss = entryPrice + stopDistance * 0.5;

        // Take profit: Middle band (mean)
        const takeProfit = bb.middle;

        // Calculate confidence
        const confidence = this.calculateConfidence(Number(current.close), bb, rsi, 'SHORT');

        // Check minimum criteria
        const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
        if (!this.meetsMinimumCriteria(confidence, riskReward)) {
            return { setup: null, confidence: 0 };
        }

        const setup = this.createSetup(
            'MEAN_REVERSION' as SetupType,
            'SHORT',
            klines,
            currentIndex,
            entryPrice,
            stopLoss,
            takeProfit,
            confidence,
            true, // Volume confirmed
            0.8, // Indicator confluence (BB + RSI)
            {
                bbUpper: bb.upper,
                bbMiddle: bb.middle,
                bbLower: bb.lower,
                rsi,
                percentB: calculatePercentB(Number(current.close), bb),
                strategy: 'overbought',
            }
        );

        return { setup, confidence };
    }

    private calculateConfidence(
        close: number,
        bb: { upper: number; middle: number; lower: number },
        rsi: number,
        direction: 'LONG' | 'SHORT'
    ): number {
        let confidence = 0.6; // Base confidence

        // Distance from band (more extreme = higher confidence)
        const percentB = calculatePercentB(close, bb);
        const deviation = direction === 'LONG' ? -percentB : percentB - 1;

        if (Math.abs(deviation) > 0.1) confidence += 0.15; // >10% outside band
        if (Math.abs(deviation) > 0.15) confidence += 0.1; // >15% outside band

        // RSI extremes
        if (direction === 'LONG') {
            if (rsi < 25) confidence += 0.1;
            if (rsi < 20) confidence += 0.05;
        } else {
            if (rsi > 75) confidence += 0.1;
            if (rsi > 80) confidence += 0.05;
        }

        return Math.min(confidence, 0.95);
    }

    private calculateAverageVolume(
        klines: Kline[],
        currentIndex: number,
        period: number
    ): number {
        const start = Math.max(0, currentIndex - period + 1);
        const slice = klines.slice(start, currentIndex + 1);
        const sum = slice.reduce((acc, k) => acc + Number(k.volume), 0);
        return sum / slice.length;
    }
}

export const createDefaultMeanReversionConfig = (): MeanReversionConfig => ({
    enabled: true,
    minConfidence: 65,
    minRiskReward: 1.5,
    bbPeriod: 20,
    bbStdDev: 2,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    minVolume: 1.0,
    maxHoldBars: 10,
});
