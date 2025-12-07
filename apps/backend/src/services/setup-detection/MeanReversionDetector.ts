import { calculateBollingerBands, calculateRSI } from '@marketmind/indicators';
import type { Kline, MeanReversionConfig } from '@marketmind/types';
import { createDefaultMeanReversionConfig } from '@marketmind/types';
import { getKlineClose, getKlineVolume } from '../../utils/klineHelpers';
import type { SetupDetectorResult } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

// Re-export for consumers
export type { MeanReversionConfig };
export { createDefaultMeanReversionConfig };

const VOLUME_LOOKBACK = 20;
const BASE_CONFIDENCE = 60;
const MAX_CONFIDENCE = 95;

export class MeanReversionDetector extends BaseSetupDetector {
  private meanRevConfig: MeanReversionConfig;

  constructor(config: MeanReversionConfig) {
    super(config);
    this.meanRevConfig = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const minIndex = Math.max(this.meanRevConfig.bbPeriod, this.meanRevConfig.rsiPeriod);
    if (currentIndex < minIndex) {
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
    if (rsi === null || rsi === undefined) {
      return { setup: null, confidence: 0 };
    }

    // Check volume confirmation
    const avgVolume = this.calculateAverageVolume(klines, currentIndex, VOLUME_LOOKBACK);
    const volumeConfirmed = getKlineVolume(current) >= avgVolume * this.meanRevConfig.volumeMultiplier;

    if (!volumeConfirmed) {
      return { setup: null, confidence: 0 };
    }

    const closePrice = getKlineClose(current);

    // Check for LONG setup (oversold)
    if (closePrice < bb.lower && rsi < this.meanRevConfig.rsiOversold) {
      return this.createLongSetup(klines, currentIndex, bb, rsi, volumeConfirmed);
    }

    // Check for SHORT setup (overbought)
    if (closePrice > bb.upper && rsi > this.meanRevConfig.rsiOverbought) {
      return this.createShortSetup(klines, currentIndex, bb, rsi, volumeConfirmed);
    }

    return { setup: null, confidence: 0 };
  }

  private createLongSetup(
    klines: Kline[],
    currentIndex: number,
    bb: { upper: number; middle: number; lower: number },
    rsi: number,
    volumeConfirmed: boolean
  ): SetupDetectorResult {
    const current = klines[currentIndex]!;
    const entryPrice = getKlineClose(current);

    // Stop loss: Below lower band
    const stopDistance = bb.middle - bb.lower;
    const stopLoss = entryPrice - stopDistance * 0.5;

    // Take profit: Middle band (mean)
    const takeProfit = bb.middle;

    // Calculate confidence
    const confidence = this.calculateConfidence(entryPrice, bb, rsi, 'LONG');

    // Check minimum criteria
    const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
    if (!this.meetsMinimumRequirements(confidence, riskReward)) {
      return { setup: null, confidence: 0 };
    }

    const setup = this.createSetup(
      'mean-reversion',
      'LONG',
      klines,
      currentIndex,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmed,
      0.8, // Indicator confluence (BB + RSI)
      {
        bbUpper: bb.upper,
        bbMiddle: bb.middle,
        bbLower: bb.lower,
        rsi,
        percentB: this.calculatePercentB(entryPrice, bb),
        strategy: 'oversold',
      }
    );

    return { setup, confidence };
  }

  private createShortSetup(
    klines: Kline[],
    currentIndex: number,
    bb: { upper: number; middle: number; lower: number },
    rsi: number,
    volumeConfirmed: boolean
  ): SetupDetectorResult {
    const current = klines[currentIndex]!;
    const entryPrice = getKlineClose(current);

    // Stop loss: Above upper band
    const stopDistance = bb.upper - bb.middle;
    const stopLoss = entryPrice + stopDistance * 0.5;

    // Take profit: Middle band (mean)
    const takeProfit = bb.middle;

    // Calculate confidence
    const confidence = this.calculateConfidence(entryPrice, bb, rsi, 'SHORT');

    // Check minimum criteria
    const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
    if (!this.meetsMinimumRequirements(confidence, riskReward)) {
      return { setup: null, confidence: 0 };
    }

    const setup = this.createSetup(
      'mean-reversion',
      'SHORT',
      klines,
      currentIndex,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmed,
      0.8, // Indicator confluence (BB + RSI)
      {
        bbUpper: bb.upper,
        bbMiddle: bb.middle,
        bbLower: bb.lower,
        rsi,
        percentB: this.calculatePercentB(entryPrice, bb),
        strategy: 'overbought',
      }
    );

    return { setup, confidence };
  }

  private calculatePercentB(
    close: number,
    bb: { upper: number; middle: number; lower: number }
  ): number {
    const range = bb.upper - bb.lower;
    if (range === 0) return 0.5;
    return (close - bb.lower) / range;
  }

  private calculateConfidence(
    close: number,
    bb: { upper: number; middle: number; lower: number },
    rsi: number,
    direction: 'LONG' | 'SHORT'
  ): number {
    let confidence = BASE_CONFIDENCE;

    // Distance from band (more extreme = higher confidence)
    const percentB = this.calculatePercentB(close, bb);
    const deviation = direction === 'LONG' ? -percentB : percentB - 1;

    if (Math.abs(deviation) > 0.1) confidence += 15; // >10% outside band
    if (Math.abs(deviation) > 0.15) confidence += 10; // >15% outside band

    // RSI extremes
    if (direction === 'LONG') {
      if (rsi < 25) confidence += 10;
      if (rsi < 20) confidence += 5;
    } else {
      if (rsi > 75) confidence += 10;
      if (rsi > 80) confidence += 5;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private calculateAverageVolume(
    klines: Kline[],
    currentIndex: number,
    period: number
  ): number {
    const start = Math.max(0, currentIndex - period + 1);
    const slice = klines.slice(start, currentIndex + 1);
    const sum = slice.reduce((acc, k) => acc + getKlineVolume(k), 0);
    return sum / slice.length;
  }
}
