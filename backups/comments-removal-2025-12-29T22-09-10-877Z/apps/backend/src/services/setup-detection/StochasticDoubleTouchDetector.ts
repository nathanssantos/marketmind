import { calculateStochastic, isVolumeConfirmed } from '@marketmind/indicators';
import type { Kline, StochasticDoubleTouchConfig } from '@marketmind/types';
import {
  createDefaultStochasticDoubleTouchConfig,
  getKlineClose,
} from '@marketmind/types';
import type { SetupDetectorResult } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

export type { StochasticDoubleTouchConfig };
export { createDefaultStochasticDoubleTouchConfig };

const VOLUME_LOOKBACK = 20;
const BASE_CONFIDENCE = 70;
const MAX_CONFIDENCE = 95;

export class StochasticDoubleTouchDetector extends BaseSetupDetector {
  private stochConfig: StochasticDoubleTouchConfig;

  constructor(config: StochasticDoubleTouchConfig) {
    super(config);
    this.stochConfig = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const minIndex = this.stochConfig.stochPeriod + 20;
    if (currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const current = klines[currentIndex];
    if (!current) {
      return { setup: null, confidence: 0 };
    }

    const klinesUpToCurrent = klines.slice(0, currentIndex + 1);
    const stochResult = calculateStochastic(
      klinesUpToCurrent,
      this.stochConfig.stochPeriod,
      this.stochConfig.stochSmoothK
    );

    const kValues = stochResult.k;
    if (kValues.length < 10) {
      return { setup: null, confidence: 0 };
    }

    const currentK = kValues[kValues.length - 1];
    const previousK = kValues[kValues.length - 2];

    if (currentK === null || currentK === undefined || previousK === null || previousK === undefined) {
      return { setup: null, confidence: 0 };
    }

    const volumeConfirmed = isVolumeConfirmed(klines, currentIndex, VOLUME_LOOKBACK, this.stochConfig.volumeMultiplier);

    if (!volumeConfirmed) {
      return { setup: null, confidence: 0 };
    }

    const longSetup = this.detectLongDoubleTouch(kValues, currentIndex, klines, volumeConfirmed);
    if (longSetup) {
      return longSetup;
    }

    const shortSetup = this.detectShortDoubleTouch(kValues, currentIndex, klines, volumeConfirmed);
    if (shortSetup) {
      return shortSetup;
    }

    return { setup: null, confidence: 0 };
  }

  private detectLongDoubleTouch(
    kValues: (number | null)[],
    currentIndex: number,
    klines: Kline[],
    volumeConfirmed: boolean
  ): SetupDetectorResult | null {
    const currentK = kValues[kValues.length - 1]!;
    const previousK = kValues[kValues.length - 2]!;

    const isExitingOversold = previousK < this.stochConfig.oversoldThreshold && currentK >= this.stochConfig.oversoldThreshold;

    if (!isExitingOversold) {
      return null;
    }

    let firstTouchIndex = -1;
    for (let i = kValues.length - 3; i >= Math.max(0, kValues.length - 20); i--) {
      const k = kValues[i];
      if (k === null || k === undefined) continue;

      if (k < this.stochConfig.oversoldThreshold) {
        firstTouchIndex = i;
        break;
      }
    }

    if (firstTouchIndex === -1) {
      return null;
    }

    let crossed50 = false;
    for (let i = firstTouchIndex + 1; i < kValues.length - 2; i++) {
      const k = kValues[i];
      if (k !== null && k !== undefined && k >= 50) {
        crossed50 = true;
        break;
      }
    }

    if (crossed50) {
      return null;
    }

    const current = klines[currentIndex]!;
    const entryPrice = getKlineClose(current);

    const swingLow = this.findSwingLow(klines, currentIndex, 20);
    const swingHigh = this.findSwingHigh(klines, currentIndex, 20);

    if (swingLow === null || swingHigh === null) {
      return null;
    }

    const atr = this.calculateATR(klines, currentIndex, 14);
    const tickSize = atr * 0.1;

    const stopLoss = swingLow - tickSize;
    const takeProfit = swingHigh;

    const confidence = this.calculateConfidence(entryPrice, stopLoss, takeProfit);

    const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
    if (!this.meetsMinimumRequirements(confidence, riskReward)) {
      return { setup: null, confidence: 0 };
    }

    const setup = this.createSetup(
      'stochastic-double-touch',
      'LONG',
      klines,
      currentIndex,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmed,
      0.9,
      {
        currentK,
        previousK,
        firstTouchIndex,
        oversoldThreshold: this.stochConfig.oversoldThreshold,
      }
    );

    return { setup, confidence };
  }

  private detectShortDoubleTouch(
    kValues: (number | null)[],
    currentIndex: number,
    klines: Kline[],
    volumeConfirmed: boolean
  ): SetupDetectorResult | null {
    const currentK = kValues[kValues.length - 1]!;
    const previousK = kValues[kValues.length - 2]!;

    const isExitingOverbought = previousK > this.stochConfig.overboughtThreshold && currentK <= this.stochConfig.overboughtThreshold;

    if (!isExitingOverbought) {
      return null;
    }

    let firstTouchIndex = -1;
    for (let i = kValues.length - 3; i >= Math.max(0, kValues.length - 20); i--) {
      const k = kValues[i];
      if (k === null || k === undefined) continue;

      if (k > this.stochConfig.overboughtThreshold) {
        firstTouchIndex = i;
        break;
      }
    }

    if (firstTouchIndex === -1) {
      return null;
    }

    let crossed50 = false;
    for (let i = firstTouchIndex + 1; i < kValues.length - 2; i++) {
      const k = kValues[i];
      if (k !== null && k !== undefined && k <= 50) {
        crossed50 = true;
        break;
      }
    }

    if (crossed50) {
      return null;
    }

    const current = klines[currentIndex]!;
    const entryPrice = getKlineClose(current);

    const swingLow = this.findSwingLow(klines, currentIndex, 20);
    const swingHigh = this.findSwingHigh(klines, currentIndex, 20);

    if (swingLow === null || swingHigh === null) {
      return null;
    }

    const atr = this.calculateATR(klines, currentIndex, 14);
    const tickSize = atr * 0.1;

    const stopLoss = swingHigh + tickSize;
    const takeProfit = swingLow;

    const confidence = this.calculateConfidence(entryPrice, stopLoss, takeProfit);

    const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);
    if (!this.meetsMinimumRequirements(confidence, riskReward)) {
      return { setup: null, confidence: 0 };
    }

    const setup = this.createSetup(
      'stochastic-double-touch',
      'SHORT',
      klines,
      currentIndex,
      entryPrice,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmed,
      0.9,
      {
        currentK,
        previousK,
        firstTouchIndex,
        overboughtThreshold: this.stochConfig.overboughtThreshold,
      }
    );

    return { setup, confidence };
  }

  private calculateConfidence(
    entryPrice: number,
    stopLoss: number,
    takeProfit: number
  ): number {
    const riskReward = this.calculateRR(entryPrice, stopLoss, takeProfit);

    let confidence = BASE_CONFIDENCE;

    if (riskReward >= 3.0) confidence += 15;
    else if (riskReward >= 2.5) confidence += 10;
    else if (riskReward >= 2.0) confidence += 5;

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private calculateATR(klines: Kline[], currentIndex: number, period: number): number {
    const start = Math.max(0, currentIndex - period + 1);
    const slice = klines.slice(start, currentIndex + 1);

    if (slice.length < 2) return 0;

    let sumTR = 0;
    for (let i = 1; i < slice.length; i++) {
      const high = Number(slice[i]!.high);
      const low = Number(slice[i]!.low);
      const prevClose = Number(slice[i - 1]!.close);

      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      sumTR += tr;
    }

    return sumTR / (slice.length - 1);
  }

  private findSwingHigh(klines: Kline[], currentIndex: number, lookback: number): number | null {
    const start = Math.max(0, currentIndex - lookback);
    const slice = klines.slice(start, currentIndex + 1);

    if (slice.length < 5) return null;

    let highestHigh = 0;
    for (let i = 2; i < slice.length - 2; i++) {
      const current = slice[i]!;
      const leftBar1 = slice[i - 1]!;
      const leftBar2 = slice[i - 2]!;
      const rightBar1 = slice[i + 1]!;
      const rightBar2 = slice[i + 2]!;

      const currentHigh = Number(current.high);
      const leftBar1High = Number(leftBar1.high);
      const leftBar2High = Number(leftBar2.high);
      const rightBar1High = Number(rightBar1.high);
      const rightBar2High = Number(rightBar2.high);

      const isSwingHigh = currentHigh > leftBar1High &&
                          currentHigh > leftBar2High &&
                          currentHigh > rightBar1High &&
                          currentHigh > rightBar2High;

      if (isSwingHigh && currentHigh > highestHigh) {
        highestHigh = currentHigh;
      }
    }

    return highestHigh > 0 ? highestHigh : null;
  }

  private findSwingLow(klines: Kline[], currentIndex: number, lookback: number): number | null {
    const start = Math.max(0, currentIndex - lookback);
    const slice = klines.slice(start, currentIndex + 1);

    if (slice.length < 5) return null;

    let lowestLow = Infinity;
    for (let i = 2; i < slice.length - 2; i++) {
      const current = slice[i]!;
      const leftBar1 = slice[i - 1]!;
      const leftBar2 = slice[i - 2]!;
      const rightBar1 = slice[i + 1]!;
      const rightBar2 = slice[i + 2]!;

      const currentLow = Number(current.low);
      const leftBar1Low = Number(leftBar1.low);
      const leftBar2Low = Number(leftBar2.low);
      const rightBar1Low = Number(rightBar1.low);
      const rightBar2Low = Number(rightBar2.low);

      const isSwingLow = currentLow < leftBar1Low &&
                         currentLow < leftBar2Low &&
                         currentLow < rightBar1Low &&
                         currentLow < rightBar2Low;

      if (isSwingLow && currentLow < lowestLow) {
        lowestLow = currentLow;
      }
    }

    return lowestLow < Infinity ? lowestLow : null;
  }
}
