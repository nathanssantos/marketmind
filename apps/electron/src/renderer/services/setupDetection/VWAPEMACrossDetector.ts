import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline, TradingSetup } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
import type { SetupDetectorConfig } from './BaseSetupDetector';
import { BaseSetupDetector } from './BaseSetupDetector';

const VWAP_LOOKBACK = 50;
const EMA_PERIOD = 20;
const PULLBACK_TOLERANCE = 0.5;
const PERCENT_DIVISOR = 100;
const MIN_INDEX_OFFSET = 3;
const VOLUME_LOOKBACK = 20;
const VOLUME_WEIGHT = 10;
const MAX_CONFIDENCE = 95;
const BASE_CONFIDENCE = 70;
const CROSS_LOOKBACK = 10;
const ATR_PERIOD = 14;

export interface VWAPEMACrossConfig extends SetupDetectorConfig {
  emaPeriod: number;
  pullbackTolerance: number;
  targetMultiplier: number;
  lookbackPeriod: number;
}

export const createDefaultVWAPEMACrossConfig = (): VWAPEMACrossConfig => ({
  enabled: true,
  minConfidence: 75,
  minRiskReward: 2.0,
  emaPeriod: EMA_PERIOD,
  pullbackTolerance: PULLBACK_TOLERANCE,
  targetMultiplier: 2.0,
  lookbackPeriod: VWAP_LOOKBACK,
});

export class VWAPEMACrossDetector extends BaseSetupDetector {
  constructor(config: VWAPEMACrossConfig) {
    super(config);
  }

  detect(klines: Kline[], currentIndex: number): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const vwapConfig = this.config as VWAPEMACrossConfig;

    if (currentIndex < vwapConfig.lookbackPeriod + MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const currentKline = klines[currentIndex];
    if (!currentKline) {
      return { setup: null, confidence: 0 };
    }

    const lookbackKlines = klines.slice(
      Math.max(0, currentIndex - vwapConfig.lookbackPeriod),
      currentIndex + 1
    );

    const vwap = this.calculateVWAP(lookbackKlines);
    if (!vwap) {
      return { setup: null, confidence: 0 };
    }

    const emaValues = calculateEMA(lookbackKlines, vwapConfig.emaPeriod);
    const currentEMA = emaValues[emaValues.length - 1];
    if (!currentEMA) {
      return { setup: null, confidence: 0 };
    }

    const bullishCross = this.detectBullishCross(klines, currentIndex, vwap, currentEMA);
    if (bullishCross) {
      const setup = this.createBullishSetup(klines, currentIndex, vwap, currentEMA, bullishCross);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(klines, currentIndex, bullishCross.hasVolumeConfirmation);
          return { setup, confidence };
        }
      }
    }

    const bearishCross = this.detectBearishCross(klines, currentIndex, vwap, currentEMA);
    if (bearishCross) {
      const setup = this.createBearishSetup(klines, currentIndex, vwap, currentEMA, bearishCross);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(klines, currentIndex, bearishCross.hasVolumeConfirmation);
          return { setup, confidence };
        }
      }
    }

    return { setup: null, confidence: 0 };
  }

  private calculateVWAP(klines: Kline[]): number | null {
    if (klines.length === 0) return null;

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const kline of klines) {
      const typicalPrice = (getKlineHigh(kline) + getKlineLow(kline) + getKlineClose(kline)) / MIN_INDEX_OFFSET;
      cumulativeTPV += typicalPrice * getKlineVolume(kline);
      cumulativeVolume += getKlineVolume(kline);
    }

    if (cumulativeVolume === 0) return null;

    return cumulativeTPV / cumulativeVolume;
  }

  private detectBullishCross(
    klines: Kline[],
    currentIndex: number,
    vwap: number,
    _currentEMA: number
  ): { crossIndex: number; hasVolumeConfirmation: boolean; pullbackKline: Kline } | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;

    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - CROSS_LOOKBACK); i -= 1) {
      const kline = klines[i];
      const prevKline = klines[i - 1];
      if (!kline || !prevKline) continue;

      const emaValues = calculateEMA(klines.slice(0, i + 1), vwapConfig.emaPeriod);
      const ema = emaValues[emaValues.length - 1];
      const prevEmaValues = calculateEMA(klines.slice(0, i), vwapConfig.emaPeriod);
      const prevEMA = prevEmaValues[prevEmaValues.length - 1];

      if (!ema || !prevEMA) continue;

      const crossedAbove = prevEMA <= vwap && ema > vwap;
      if (!crossedAbove) continue;

      const pullbackKline = this.findBullishPullback(klines, i, currentIndex, vwap);
      if (!pullbackKline) continue;

      const hasVolumeConfirmation = this.hasVolumeConfirmation(klines, currentIndex);

      return { crossIndex: i, hasVolumeConfirmation, pullbackKline };
    }

    return null;
  }

  private detectBearishCross(
    klines: Kline[],
    currentIndex: number,
    vwap: number,
    _currentEMA: number
  ): { crossIndex: number; hasVolumeConfirmation: boolean; pullbackKline: Kline } | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;

    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - CROSS_LOOKBACK); i -= 1) {
      const kline = klines[i];
      const prevKline = klines[i - 1];
      if (!kline || !prevKline) continue;

      const emaValues = calculateEMA(klines.slice(0, i + 1), vwapConfig.emaPeriod);
      const ema = emaValues[emaValues.length - 1];
      const prevEmaValues = calculateEMA(klines.slice(0, i), vwapConfig.emaPeriod);
      const prevEMA = prevEmaValues[prevEmaValues.length - 1];

      if (!ema || !prevEMA) continue;

      const crossedBelow = prevEMA >= vwap && ema < vwap;
      if (!crossedBelow) continue;

      const pullbackKline = this.findBearishPullback(klines, i, currentIndex, vwap);
      if (!pullbackKline) continue;

      const hasVolumeConfirmation = this.hasVolumeConfirmation(klines, currentIndex);

      return { crossIndex: i, hasVolumeConfirmation, pullbackKline };
    }

    return null;
  }

  private findBullishPullback(
    klines: Kline[],
    crossIndex: number,
    currentIndex: number,
    vwap: number
  ): Kline | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;
    const toleranceAmount = vwap * (vwapConfig.pullbackTolerance / PERCENT_DIVISOR);
    const pullbackTarget = vwap - toleranceAmount;

    for (let i = crossIndex + 1; i <= currentIndex; i += 1) {
      const kline = klines[i];
      if (!kline) continue;

      const touchedVWAP = getKlineLow(kline) <= vwap + toleranceAmount && getKlineLow(kline) >= pullbackTarget;

      if (touchedVWAP && getKlineClose(kline) > getKlineOpen(kline)) {
        return kline;
      }
    }

    return null;
  }

  private findBearishPullback(
    klines: Kline[],
    crossIndex: number,
    currentIndex: number,
    vwap: number
  ): Kline | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;
    const toleranceAmount = vwap * (vwapConfig.pullbackTolerance / PERCENT_DIVISOR);
    const pullbackTarget = vwap + toleranceAmount;

    for (let i = crossIndex + 1; i <= currentIndex; i += 1) {
      const kline = klines[i];
      if (!kline) continue;

      const touchedVWAP = getKlineHigh(kline) >= vwap - toleranceAmount && getKlineHigh(kline) <= pullbackTarget;

      if (touchedVWAP && getKlineClose(kline) < getKlineOpen(kline)) {
        return kline;
      }
    }

    return null;
  }

  private hasVolumeConfirmation(klines: Kline[], currentIndex: number): boolean {
    const avgVolume = this.calculateAverageVolume(klines, currentIndex);
    const currentKline = klines[currentIndex];
    if (!currentKline || !avgVolume) return false;
    return getKlineVolume(currentKline) > avgVolume;
  }

  private calculateAverageVolume(klines: Kline[], currentIndex: number): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeKlines = klines.slice(startIndex, currentIndex);

    if (volumeKlines.length === 0) return null;

    const totalVolume = volumeKlines.reduce((sum, c) => sum + getKlineVolume(c), 0);
    return totalVolume / volumeKlines.length;
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    _vwap: number,
    _ema: number,
    crossData: { crossIndex: number; hasVolumeConfirmation: boolean; pullbackKline: Kline }
  ): TradingSetup | null {
    const { pullbackKline, hasVolumeConfirmation } = crossData;

    const entry = getKlineHigh(pullbackKline);
    const stop = getKlineLow(pullbackKline);
    const risk = entry - stop;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(klines);
    const resistanceLevels = pivots.filter((p) => p.type === 'high').map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const rrTarget = entry + risk * (this.config as VWAPEMACrossConfig).targetMultiplier;
    const target = nearestResistance && nearestResistance < rrTarget ? nearestResistance : rrTarget;

    const confidence = this.calculateConfidence(klines, currentIndex, hasVolumeConfirmation);

    return this.createSetup(
      'vwap-ema-cross',
      'LONG',
      klines,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeConfirmation,
      0,
      {
        crossIndex: crossData.crossIndex,
        pullbackHigh: pullbackKline.high,
        pullbackLow: pullbackKline.low,
      }
    );
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    _vwap: number,
    _ema: number,
    crossData: { crossIndex: number; hasVolumeConfirmation: boolean; pullbackKline: Kline }
  ): TradingSetup | null {
    const { pullbackKline, hasVolumeConfirmation } = crossData;

    const entry = getKlineLow(pullbackKline);
    const stop = getKlineHigh(pullbackKline);
    const risk = stop - entry;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(klines);
    const supportLevels = pivots.filter((p) => p.type === 'low').map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const rrTarget = entry - risk * (this.config as VWAPEMACrossConfig).targetMultiplier;
    const target = nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const confidence = this.calculateConfidence(klines, currentIndex, hasVolumeConfirmation);

    return this.createSetup(
      'vwap-ema-cross',
      'SHORT',
      klines,
      currentIndex,
      entry,
      stop,
      target,
      confidence,
      hasVolumeConfirmation,
      0,
      {
        crossIndex: crossData.crossIndex,
        pullbackHigh: pullbackKline.high,
        pullbackLow: pullbackKline.low,
      }
    );
  }

  private calculateConfidence(
    klines: Kline[],
    currentIndex: number,
    hasVolumeConfirmation: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (hasVolumeConfirmation) {
      confidence += VOLUME_WEIGHT;
    }

    const currentKline = klines[currentIndex];
    if (!currentKline) return confidence;

    const klineSize = Math.abs(getKlineClose(currentKline) - getKlineOpen(currentKline));
    const atr = this.calculateATR(klines, currentIndex, ATR_PERIOD);
    
    if (atr && klineSize > atr) {
      confidence += VOLUME_WEIGHT;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private calculateATR(klines: Kline[], currentIndex: number, period: number): number | null {
    if (currentIndex < period) return null;

    const trueRanges: number[] = [];

    for (let i = Math.max(1, currentIndex - period + 1); i <= currentIndex; i += 1) {
      const current = klines[i];
      const previous = klines[i - 1];
      if (!current || !previous) continue;

      const high = getKlineHigh(current);
      const low = getKlineLow(current);
      const previousClose = getKlineClose(previous);

      const tr = Math.max(
        high - low,
        Math.abs(high - previousClose),
        Math.abs(low - previousClose)
      );

      trueRanges.push(tr);
    }

    if (trueRanges.length === 0) return null;

    return trueRanges.reduce((sum, tr) => sum + tr, 0) / trueRanges.length;
  }
}
