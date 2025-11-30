import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Candle, TradingSetup } from '@shared/types';
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
  enabled: false,
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

  detect(candles: Candle[], currentIndex: number): { setup: TradingSetup | null; confidence: number } {
    if (!this.config.enabled) {
      return { setup: null, confidence: 0 };
    }

    const vwapConfig = this.config as VWAPEMACrossConfig;

    if (currentIndex < vwapConfig.lookbackPeriod + MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const currentCandle = candles[currentIndex];
    if (!currentCandle) {
      return { setup: null, confidence: 0 };
    }

    const lookbackCandles = candles.slice(
      Math.max(0, currentIndex - vwapConfig.lookbackPeriod),
      currentIndex + 1
    );

    const vwap = this.calculateVWAP(lookbackCandles);
    if (!vwap) {
      return { setup: null, confidence: 0 };
    }

    const emaValues = calculateEMA(lookbackCandles, vwapConfig.emaPeriod);
    const currentEMA = emaValues[emaValues.length - 1];
    if (!currentEMA) {
      return { setup: null, confidence: 0 };
    }

    const bullishCross = this.detectBullishCross(candles, currentIndex, vwap, currentEMA);
    if (bullishCross) {
      const setup = this.createBullishSetup(candles, currentIndex, vwap, currentEMA, bullishCross);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, bullishCross.hasVolumeConfirmation);
          return { setup, confidence };
        }
      }
    }

    const bearishCross = this.detectBearishCross(candles, currentIndex, vwap, currentEMA);
    if (bearishCross) {
      const setup = this.createBearishSetup(candles, currentIndex, vwap, currentEMA, bearishCross);
      if (setup) {
        const rr = this.calculateRR(setup.entryPrice, setup.stopLoss, setup.takeProfit);
        if (rr >= this.config.minRiskReward) {
          const confidence = this.calculateConfidence(candles, currentIndex, bearishCross.hasVolumeConfirmation);
          return { setup, confidence };
        }
      }
    }

    return { setup: null, confidence: 0 };
  }

  private calculateVWAP(candles: Candle[]): number | null {
    if (candles.length === 0) return null;

    let cumulativeTPV = 0;
    let cumulativeVolume = 0;

    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / MIN_INDEX_OFFSET;
      cumulativeTPV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
    }

    if (cumulativeVolume === 0) return null;

    return cumulativeTPV / cumulativeVolume;
  }

  private detectBullishCross(
    candles: Candle[],
    currentIndex: number,
    vwap: number,
    _currentEMA: number
  ): { crossIndex: number; hasVolumeConfirmation: boolean; pullbackCandle: Candle } | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;

    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - CROSS_LOOKBACK); i -= 1) {
      const candle = candles[i];
      const prevCandle = candles[i - 1];
      if (!candle || !prevCandle) continue;

      const emaValues = calculateEMA(candles.slice(0, i + 1), vwapConfig.emaPeriod);
      const ema = emaValues[emaValues.length - 1];
      const prevEmaValues = calculateEMA(candles.slice(0, i), vwapConfig.emaPeriod);
      const prevEMA = prevEmaValues[prevEmaValues.length - 1];

      if (!ema || !prevEMA) continue;

      const crossedAbove = prevEMA <= vwap && ema > vwap;
      if (!crossedAbove) continue;

      const pullbackCandle = this.findBullishPullback(candles, i, currentIndex, vwap);
      if (!pullbackCandle) continue;

      const hasVolumeConfirmation = this.hasVolumeConfirmation(candles, currentIndex);

      return { crossIndex: i, hasVolumeConfirmation, pullbackCandle };
    }

    return null;
  }

  private detectBearishCross(
    candles: Candle[],
    currentIndex: number,
    vwap: number,
    _currentEMA: number
  ): { crossIndex: number; hasVolumeConfirmation: boolean; pullbackCandle: Candle } | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;

    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - CROSS_LOOKBACK); i -= 1) {
      const candle = candles[i];
      const prevCandle = candles[i - 1];
      if (!candle || !prevCandle) continue;

      const emaValues = calculateEMA(candles.slice(0, i + 1), vwapConfig.emaPeriod);
      const ema = emaValues[emaValues.length - 1];
      const prevEmaValues = calculateEMA(candles.slice(0, i), vwapConfig.emaPeriod);
      const prevEMA = prevEmaValues[prevEmaValues.length - 1];

      if (!ema || !prevEMA) continue;

      const crossedBelow = prevEMA >= vwap && ema < vwap;
      if (!crossedBelow) continue;

      const pullbackCandle = this.findBearishPullback(candles, i, currentIndex, vwap);
      if (!pullbackCandle) continue;

      const hasVolumeConfirmation = this.hasVolumeConfirmation(candles, currentIndex);

      return { crossIndex: i, hasVolumeConfirmation, pullbackCandle };
    }

    return null;
  }

  private findBullishPullback(
    candles: Candle[],
    crossIndex: number,
    currentIndex: number,
    vwap: number
  ): Candle | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;
    const toleranceAmount = vwap * (vwapConfig.pullbackTolerance / PERCENT_DIVISOR);
    const pullbackTarget = vwap - toleranceAmount;

    for (let i = crossIndex + 1; i <= currentIndex; i += 1) {
      const candle = candles[i];
      if (!candle) continue;

      const touchedVWAP = candle.low <= vwap + toleranceAmount && candle.low >= pullbackTarget;

      if (touchedVWAP && candle.close > candle.open) {
        return candle;
      }
    }

    return null;
  }

  private findBearishPullback(
    candles: Candle[],
    crossIndex: number,
    currentIndex: number,
    vwap: number
  ): Candle | null {
    const vwapConfig = this.config as VWAPEMACrossConfig;
    const toleranceAmount = vwap * (vwapConfig.pullbackTolerance / PERCENT_DIVISOR);
    const pullbackTarget = vwap + toleranceAmount;

    for (let i = crossIndex + 1; i <= currentIndex; i += 1) {
      const candle = candles[i];
      if (!candle) continue;

      const touchedVWAP = candle.high >= vwap - toleranceAmount && candle.high <= pullbackTarget;

      if (touchedVWAP && candle.close < candle.open) {
        return candle;
      }
    }

    return null;
  }

  private hasVolumeConfirmation(candles: Candle[], currentIndex: number): boolean {
    const avgVolume = this.calculateAverageVolume(candles, currentIndex);
    const currentCandle = candles[currentIndex];
    if (!currentCandle || !avgVolume) return false;
    return currentCandle.volume > avgVolume;
  }

  private calculateAverageVolume(candles: Candle[], currentIndex: number): number | null {
    const startIndex = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeCandles = candles.slice(startIndex, currentIndex);

    if (volumeCandles.length === 0) return null;

    const totalVolume = volumeCandles.reduce((sum, c) => sum + c.volume, 0);
    return totalVolume / volumeCandles.length;
  }

  private createBullishSetup(
    candles: Candle[],
    currentIndex: number,
    _vwap: number,
    _ema: number,
    crossData: { crossIndex: number; hasVolumeConfirmation: boolean; pullbackCandle: Candle }
  ): TradingSetup | null {
    const { pullbackCandle, hasVolumeConfirmation } = crossData;

    const entry = pullbackCandle.high;
    const stop = pullbackCandle.low;
    const risk = entry - stop;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const resistanceLevels = pivots.filter((p) => p.type === 'high').map((p) => p.price);
    const nearestResistance = resistanceLevels.find((r) => r > entry);

    const rrTarget = entry + risk * (this.config as VWAPEMACrossConfig).targetMultiplier;
    const target = nearestResistance && nearestResistance < rrTarget ? nearestResistance : rrTarget;

    const confidence = this.calculateConfidence(candles, currentIndex, hasVolumeConfirmation);

    return this.createSetup(
      'vwap-ema-cross',
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
        crossIndex: crossData.crossIndex,
        pullbackHigh: pullbackCandle.high,
        pullbackLow: pullbackCandle.low,
      }
    );
  }

  private createBearishSetup(
    candles: Candle[],
    currentIndex: number,
    _vwap: number,
    _ema: number,
    crossData: { crossIndex: number; hasVolumeConfirmation: boolean; pullbackCandle: Candle }
  ): TradingSetup | null {
    const { pullbackCandle, hasVolumeConfirmation } = crossData;

    const entry = pullbackCandle.low;
    const stop = pullbackCandle.high;
    const risk = stop - entry;

    if (risk <= 0) return null;

    const pivots = findPivotPoints(candles);
    const supportLevels = pivots.filter((p) => p.type === 'low').map((p) => p.price);
    const nearestSupport = supportLevels.reverse().find((s) => s < entry);

    const rrTarget = entry - risk * (this.config as VWAPEMACrossConfig).targetMultiplier;
    const target = nearestSupport && nearestSupport > rrTarget ? nearestSupport : rrTarget;

    const confidence = this.calculateConfidence(candles, currentIndex, hasVolumeConfirmation);

    return this.createSetup(
      'vwap-ema-cross',
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
        crossIndex: crossData.crossIndex,
        pullbackHigh: pullbackCandle.high,
        pullbackLow: pullbackCandle.low,
      }
    );
  }

  private calculateConfidence(
    candles: Candle[],
    currentIndex: number,
    hasVolumeConfirmation: boolean
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (hasVolumeConfirmation) {
      confidence += VOLUME_WEIGHT;
    }

    const currentCandle = candles[currentIndex];
    if (!currentCandle) return confidence;

    const candleSize = Math.abs(currentCandle.close - currentCandle.open);
    const atr = this.calculateATR(candles, currentIndex, ATR_PERIOD);
    
    if (atr && candleSize > atr) {
      confidence += VOLUME_WEIGHT;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private calculateATR(candles: Candle[], currentIndex: number, period: number): number | null {
    if (currentIndex < period) return null;

    const trueRanges: number[] = [];

    for (let i = Math.max(1, currentIndex - period + 1); i <= currentIndex; i += 1) {
      const current = candles[i];
      const previous = candles[i - 1];
      if (!current || !previous) continue;

      const high = current.high;
      const low = current.low;
      const previousClose = previous.close;

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
