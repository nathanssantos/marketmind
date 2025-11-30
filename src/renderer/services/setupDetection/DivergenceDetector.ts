import { calculateMACD } from '@renderer/utils/indicators/macd';
import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import { calculateRSI } from '@renderer/utils/rsi';
import type { Kline, TradingSetup } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import type { SetupDetectorConfig } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

const RSI_PERIOD = 14;
const MACD_FAST = 12;
const MACD_SLOW = 26;
const MACD_SIGNAL = 9;
const DIVERGENCE_LOOKBACK = 20;
const MIN_DIVERGENCE_BARS = 5;
const VOLUME_LOOKBACK = 20;
const VOLUME_WEIGHT = 10;
const DIVERGENCE_WEIGHT = 15;
const MAX_CONFIDENCE = 95;
const BASE_CONFIDENCE = 70;
const MIN_INDEX_OFFSET = 3;

export interface DivergenceConfig extends SetupDetectorConfig {
  rsiPeriod: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  divergenceLookback: number;
  targetMultiplier: number;
  useRSI: boolean;
  useMACD: boolean;
}

export const createDefaultDivergenceConfig = (): DivergenceConfig => ({
  enabled: false,
  minConfidence: 75,
  minRiskReward: 2.0,
  rsiPeriod: RSI_PERIOD,
  macdFast: MACD_FAST,
  macdSlow: MACD_SLOW,
  macdSignal: MACD_SIGNAL,
  divergenceLookback: DIVERGENCE_LOOKBACK,
  targetMultiplier: 2.0,
  useRSI: true,
  useMACD: true,
});

export class DivergenceDetector extends BaseSetupDetector {
  constructor(config: DivergenceConfig) {
    super(config);
  }

  detect(candles: Kline[], currentIndex: number): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const divConfig = this.config as DivergenceConfig;

    if (currentIndex < divConfig.divergenceLookback + MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const currentCandle = candles[currentIndex];
    if (!currentCandle) {
      return { setup: null, confidence: 0 };
    }

    if (divConfig.useRSI) {
      const rsiSetup = this.tryDetectRSIDivergence(candles, currentIndex);
      if (rsiSetup) return rsiSetup;
    }

    if (divConfig.useMACD) {
      const macdSetup = this.tryDetectMACDDivergence(candles, currentIndex);
      if (macdSetup) return macdSetup;
    }

    return { setup: null, confidence: 0 };
  }

  private tryDetectRSIDivergence(
    candles: Kline[],
    currentIndex: number
  ): { setup: TradingSetup | null; confidence: number } | null {
    const bullishRSIDivergence = this.detectBullishRSIDivergence(candles, currentIndex);
    if (bullishRSIDivergence) {
      const setup = this.createBullishSetup(candles, currentIndex, 'rsi', bullishRSIDivergence);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    const bearishRSIDivergence = this.detectBearishRSIDivergence(candles, currentIndex);
    if (bearishRSIDivergence) {
      const setup = this.createBearishSetup(candles, currentIndex, 'rsi', bearishRSIDivergence);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    return null;
  }

  private tryDetectMACDDivergence(
    candles: Kline[],
    currentIndex: number
  ): { setup: TradingSetup | null; confidence: number } | null {
    const bullishMACDDivergence = this.detectBullishMACDDivergence(candles, currentIndex);
    if (bullishMACDDivergence) {
      const setup = this.createBullishSetup(candles, currentIndex, 'macd', bullishMACDDivergence);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    const bearishMACDDivergence = this.detectBearishMACDDivergence(candles, currentIndex);
    if (bearishMACDDivergence) {
      const setup = this.createBearishSetup(candles, currentIndex, 'macd', bearishMACDDivergence);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, true);
          return { setup, confidence };
        }
      }
    }

    return null;
  }

  private detectBullishRSIDivergence(
    candles: Kline[],
    currentIndex: number
  ): { firstLowIndex: number; secondLowIndex: number; firstRSI: number; secondRSI: number } | null {
    const divConfig = this.config as DivergenceConfig;
    const rsiResult = calculateRSI(candles, divConfig.rsiPeriod);
    
    const startIndex = Math.max(0, currentIndex - divConfig.divergenceLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);
    
    let firstLowIndex = -1;
    let firstLowPrice = Infinity;
    
    for (let i = 0; i < recentCandles.length - MIN_DIVERGENCE_BARS; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;
      
      if (getKlineLow(candle) < firstLowPrice) {
        firstLowPrice = getKlineLow(candle);
        firstLowIndex = startIndex + i;
      }
    }
    
    if (firstLowIndex === -1) return null;
    
    const currentPrice = candles[currentIndex]?.low;
    if (!currentPrice) return null;
    
    if (currentPrice >= firstLowPrice) return null;
    
    const firstRSI = rsiResult.values[firstLowIndex];
    const currentRSI = rsiResult.values[currentIndex];
    
    if (firstRSI === null || firstRSI === undefined || currentRSI === null || currentRSI === undefined) return null;
    
    if (currentRSI <= firstRSI) return null;
    
    return {
      firstLowIndex,
      secondLowIndex: currentIndex,
      firstRSI,
      secondRSI: currentRSI,
    };
  }

  private detectBearishRSIDivergence(
    candles: Kline[],
    currentIndex: number
  ): { firstHighIndex: number; secondHighIndex: number; firstRSI: number; secondRSI: number } | null {
    const divConfig = this.config as DivergenceConfig;
    const rsiResult = calculateRSI(candles, divConfig.rsiPeriod);
    
    const startIndex = Math.max(0, currentIndex - divConfig.divergenceLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);
    
    let firstHighIndex = -1;
    let firstHighPrice = -Infinity;
    
    for (let i = 0; i < recentCandles.length - MIN_DIVERGENCE_BARS; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;
      
      if (getKlineHigh(candle) > firstHighPrice) {
        firstHighPrice = getKlineHigh(candle);
        firstHighIndex = startIndex + i;
      }
    }
    
    if (firstHighIndex === -1) return null;
    
    const currentPrice = candles[currentIndex]?.high;
    if (!currentPrice) return null;
    
    if (currentPrice <= firstHighPrice) return null;
    
    const firstRSI = rsiResult.values[firstHighIndex];
    const currentRSI = rsiResult.values[currentIndex];
    
    if (firstRSI === null || firstRSI === undefined || currentRSI === null || currentRSI === undefined) return null;
    
    if (currentRSI >= firstRSI) return null;
    
    return {
      firstHighIndex,
      secondHighIndex: currentIndex,
      firstRSI,
      secondRSI: currentRSI,
    };
  }

  private detectBullishMACDDivergence(
    candles: Kline[],
    currentIndex: number
  ): { firstLowIndex: number; secondLowIndex: number; firstMACD: number; secondMACD: number } | null {
    const divConfig = this.config as DivergenceConfig;
    const macdResult = calculateMACD(candles, divConfig.macdFast, divConfig.macdSlow, divConfig.macdSignal);
    
    const startIndex = Math.max(0, currentIndex - divConfig.divergenceLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);
    
    let firstLowIndex = -1;
    let firstLowPrice = Infinity;
    
    for (let i = 0; i < recentCandles.length - MIN_DIVERGENCE_BARS; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;
      
      if (getKlineLow(candle) < firstLowPrice) {
        firstLowPrice = getKlineLow(candle);
        firstLowIndex = startIndex + i;
      }
    }
    
    if (firstLowIndex === -1) return null;
    
    const currentPrice = candles[currentIndex]?.low;
    if (!currentPrice) return null;
    
    if (currentPrice >= firstLowPrice) return null;
    
    const firstMACD = macdResult.macd[firstLowIndex];
    const currentMACD = macdResult.macd[currentIndex];
    
    if (firstMACD === undefined || currentMACD === undefined) return null;
    if (isNaN(firstMACD) || isNaN(currentMACD)) return null;
    
    if (currentMACD <= firstMACD) return null;
    
    return {
      firstLowIndex,
      secondLowIndex: currentIndex,
      firstMACD,
      secondMACD: currentMACD,
    };
  }

  private detectBearishMACDDivergence(
    candles: Kline[],
    currentIndex: number
  ): { firstHighIndex: number; secondHighIndex: number; firstMACD: number; secondMACD: number } | null {
    const divConfig = this.config as DivergenceConfig;
    const macdResult = calculateMACD(candles, divConfig.macdFast, divConfig.macdSlow, divConfig.macdSignal);
    
    const startIndex = Math.max(0, currentIndex - divConfig.divergenceLookback);
    const recentCandles = candles.slice(startIndex, currentIndex + 1);
    
    let firstHighIndex = -1;
    let firstHighPrice = -Infinity;
    
    for (let i = 0; i < recentCandles.length - MIN_DIVERGENCE_BARS; i += 1) {
      const candle = recentCandles[i];
      if (!candle) continue;
      
      if (getKlineHigh(candle) > firstHighPrice) {
        firstHighPrice = getKlineHigh(candle);
        firstHighIndex = startIndex + i;
      }
    }
    
    if (firstHighIndex === -1) return null;
    
    const currentPrice = candles[currentIndex]?.high;
    if (!currentPrice) return null;
    
    if (currentPrice <= firstHighPrice) return null;
    
    const firstMACD = macdResult.macd[firstHighIndex];
    const currentMACD = macdResult.macd[currentIndex];
    
    if (firstMACD === undefined || currentMACD === undefined) return null;
    if (isNaN(firstMACD) || isNaN(currentMACD)) return null;
    
    if (currentMACD >= firstMACD) return null;
    
    return {
      firstHighIndex,
      secondHighIndex: currentIndex,
      firstMACD,
      secondMACD: currentMACD,
    };
  }

  private createBullishSetup(
    candles: Kline[],
    currentIndex: number,
    _indicator: 'rsi' | 'macd',
    divergence: { firstLowIndex: number; secondLowIndex: number }
  ): TradingSetup | null {
    const currentCandle = candles[currentIndex];
    if (!currentCandle) return null;

    const entry = currentCandle.close;
    const stop = Math.min(
      candles[divergence.firstLowIndex]?.low ?? currentCandle.low,
      candles[divergence.secondLowIndex]?.low ?? currentCandle.low
    );
    const risk = entry - stop;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const resistanceLevels = pivots.filter((p) => p.type === 'high').map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const divConfig = this.config as DivergenceConfig;
    const rrTarget = entry + risk * divConfig.targetMultiplier;
    const target = nearestResistance && nearestResistance < rrTarget ? nearestResistance : rrTarget;

    const hasVolumeConfirmation = this.hasVolumeConfirmation(candles, currentIndex);
    const confidence = this.calculateConfidence(candles, currentIndex, true);

    return this.createSetup(
      'divergence-reversal',
      'LONG',
      candles,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeConfirmation,
      0,
      {
        divergenceType: 'bullish',
        firstLowIndex: divergence.firstLowIndex,
        secondLowIndex: divergence.secondLowIndex,
      }
    );
  }

  private createBearishSetup(
    candles: Kline[],
    currentIndex: number,
    _indicator: 'rsi' | 'macd',
    divergence: { firstHighIndex: number; secondHighIndex: number }
  ): TradingSetup | null {
    const currentCandle = candles[currentIndex];
    if (!currentCandle) return null;

    const entry = currentCandle.close;
    const stop = Math.max(
      candles[divergence.firstHighIndex]?.high ?? currentCandle.high,
      candles[divergence.secondHighIndex]?.high ?? currentCandle.high
    );
    const risk = stop - entry;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const supportLevels = pivots.filter((p) => p.type === 'low').map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const divConfig = this.config as DivergenceConfig;
    const rrTarget = entry - risk * divConfig.targetMultiplier;
    const target = nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const hasVolumeConfirmation = this.hasVolumeConfirmation(candles, currentIndex);
    const confidence = this.calculateConfidence(candles, currentIndex, true);

    return this.createSetup(
      'divergence-reversal',
      'SHORT',
      candles,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeConfirmation,
      0,
      {
        divergenceType: 'bearish',
        firstHighIndex: divergence.firstHighIndex,
        secondHighIndex: divergence.secondHighIndex,
      }
    );
  }

  private hasVolumeConfirmation(candles: Kline[], currentIndex: number): boolean {
    const avgVolume = this.calculateAverageVolume(candles, currentIndex);
    const currentCandle = candles[currentIndex];
    if (!currentCandle || !avgVolume) return false;
    return currentCandle.volume > avgVolume;
  }

  private calculateAverageVolume(candles: Kline[], currentIndex: number): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeCandles = candles.slice(startIndex, currentIndex);

    if (volumeCandles.length === 0) return null;

    const totalVolume = volumeCandles.reduce((sum, c) => sum + c.volume, 0);
    return totalVolume / volumeCandles.length;
  }

  private calculateConfidence(
    candles: Kline[],
    currentIndex: number,
    hasDivergence: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (hasDivergence) {
      confidence += DIVERGENCE_WEIGHT;
    }

    if (this.hasVolumeConfirmation(candles, currentIndex)) {
      confidence += VOLUME_WEIGHT;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }
}
