import { calculateATR } from '@renderer/utils/indicators/atr';
import { findHighestSwingHigh, findLowestSwingLow } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline } from '@shared/types';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

const DEFAULT_EMA_PERIOD = 9;
const DEFAULT_ATR_PERIOD = 12;
const ATR_STOP_MULTIPLIER = 2;
const ATR_TARGET_MULTIPLIER = 4;
const VOLUME_LOOKBACK = 20;
const MIN_VOLUME_MULTIPLIER = 1.0;
const BASE_CONFIDENCE = 60;
const DISTANCE_CLOSE_THRESHOLD = 0.005;
const DISTANCE_NEAR_THRESHOLD = 0.01;
const CANDLE_STRONG_THRESHOLD = 0.015;
const CANDLE_MODERATE_THRESHOLD = 0.01;
const CONFIDENCE_BOOST_SMALL = 5;
const CONFIDENCE_BOOST_MEDIUM = 10;
const CONFIDENCE_BOOST_LARGE = 20;
const MAX_CONFIDENCE = 100;
const SWING_STRENGTH = 3;
const STOP_BUFFER_LONG = 0.998;
const STOP_BUFFER_SHORT = 1.002;

export interface Setup92Config extends SetupDetectorConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export class Setup92Detector extends BaseSetupDetector {
  private setup92Config: Setup92Config;

  constructor(config: Setup92Config) {
    super(config);
    this.setup92Config = config;
  }

  private validateInputs(
    current: Kline | undefined,
    previous: Kline | undefined,
    ema9Current: number | null | undefined,
    ema9Prev: number | null | undefined,
    atrCurrent: number | undefined,
  ): boolean {
    return (
      !!current &&
      !!previous &&
      ema9Current !== null &&
      ema9Current !== undefined &&
      ema9Prev !== null &&
      ema9Prev !== undefined &&
      atrCurrent !== undefined &&
      !isNaN(atrCurrent)
    );
  }

  private calculateVolumeConfirmation(
    candles: Kline[],
    currentIndex: number,
    current: Candle,
  ): { avgVolume: number; volumeConfirmation: boolean } {
    const volumeData = candles.slice(
      Math.max(0, currentIndex - VOLUME_LOOKBACK),
      currentIndex,
    );
    const avgVolume =
      volumeData.reduce((sum, c) => sum + c.volume, 0) / volumeData.length;
    const volumeConfirmation =
      current.volume >= avgVolume * this.setup92Config.volumeMultiplier;
    return { avgVolume, volumeConfirmation };
  }

  private createLongSetup(
    candles: Kline[],
    currentIndex: number,
    current: Candle,
    ema9Current: number,
    atrCurrent: number,
    avgVolume: number,
    volumeConfirmation: boolean,
    previous: Candle,
  ): SetupDetectorResult {
    const entry = current.high;
    const swingLow = findLowestSwingLow(candles, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
    const atrStop = entry - atrCurrent * this.setup92Config.atrStopMultiplier;
    const swingStop = swingLow ? swingLow * STOP_BUFFER_LONG : atrStop;
    const stopLoss = Math.max(current.low * STOP_BUFFER_LONG, Math.min(swingStop, atrStop));
    const takeProfit = entry + atrCurrent * this.setup92Config.atrTargetMultiplier;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);
    const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, true);

    if (!this.meetsMinimumCriteria(confidence, rr)) return { setup: null, confidence: 0 };

    const setup = this.createSetup(
      'setup-9-2',
      'LONG',
      candles,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      1,
      {
        ema9: ema9Current,
        atr: atrCurrent,
        volumeRatio: current.volume / avgVolume,
        closeBelowPrevLow: true,
      },
    );
    return { setup, confidence };
  }

  private createShortSetup(
    candles: Kline[],
    currentIndex: number,
    current: Candle,
    ema9Current: number,
    atrCurrent: number,
    avgVolume: number,
    volumeConfirmation: boolean,
    previous: Candle,
  ): SetupDetectorResult {
    const entry = current.low;
    const swingHigh = findHighestSwingHigh(candles, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
    const atrStop = entry + atrCurrent * this.setup92Config.atrStopMultiplier;
    const swingStop = swingHigh ? swingHigh * STOP_BUFFER_SHORT : atrStop;
    const stopLoss = Math.min(current.high * STOP_BUFFER_SHORT, Math.max(swingStop, atrStop));
    const takeProfit = entry - atrCurrent * this.setup92Config.atrTargetMultiplier;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);
    const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, false);

    if (!this.meetsMinimumCriteria(confidence, rr)) return { setup: null, confidence: 0 };

    const setup = this.createSetup(
      'setup-9-2',
      'SHORT',
      candles,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      1,
      {
        ema9: ema9Current,
        atr: atrCurrent,
        volumeRatio: current.volume / avgVolume,
        closeAbovePrevHigh: true,
      },
    );
    return { setup, confidence };
  }

  detect(candles: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.setup92Config.emaPeriod,
      this.setup92Config.atrPeriod,
    ) + VOLUME_LOOKBACK + 1;
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const ema9 = calculateEMA(candles, this.setup92Config.emaPeriod);
    const atr = calculateATR(candles, this.setup92Config.atrPeriod);

    const current = candles[currentIndex];
    const previous = candles[currentIndex - 1];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const atrCurrent = atr[currentIndex];

    if (!this.validateInputs(current, previous, ema9Current, ema9Prev, atrCurrent)) {
      return { setup: null, confidence: 0 };
    }

    if (!current || !previous || ema9Current === null || ema9Current === undefined || ema9Prev === null || ema9Prev === undefined || atrCurrent === undefined) {
      return { setup: null, confidence: 0 };
    }

    const { avgVolume, volumeConfirmation } = this.calculateVolumeConfirmation(
      candles,
      currentIndex,
      current,
    );

    const emaUptrend = ema9Current > ema9Prev;
    const emaDowntrend = ema9Current < ema9Prev;

    if (emaUptrend && current.close < previous.low) {
      return this.createLongSetup(
        candles,
        currentIndex,
        current,
        ema9Current,
        atrCurrent,
        avgVolume,
        volumeConfirmation,
        previous,
      );
    }

    if (emaDowntrend && current.close > previous.high) {
      return this.createShortSetup(
        candles,
        currentIndex,
        current,
        ema9Current,
        atrCurrent,
        avgVolume,
        volumeConfirmation,
        previous,
      );
    }

    return { setup: null, confidence: 0 };
  }

  private calculateConfidence(
    current: Candle,
    previous: Candle,
    ema: number,
    volumeConfirmed: boolean,
    isLong: boolean,
  ): number {
    const confidence = BASE_CONFIDENCE;
    let boost = 0;

    const distanceFromEMA = Math.abs(current.close - ema) / ema;
    if (distanceFromEMA < DISTANCE_CLOSE_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (distanceFromEMA < DISTANCE_NEAR_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    if (volumeConfirmed) boost += CONFIDENCE_BOOST_LARGE;

    const pullbackStrength = isLong
      ? (previous.low - current.close) / previous.low
      : (current.close - previous.high) / previous.high;
    
    if (pullbackStrength > CANDLE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (pullbackStrength > CANDLE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    const candleStrength = Math.abs(current.close - current.open) / current.open;
    if (candleStrength > CANDLE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}

export const createDefault92Config = (): Setup92Config => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.0,
  emaPeriod: DEFAULT_EMA_PERIOD,
  atrPeriod: DEFAULT_ATR_PERIOD,
  atrStopMultiplier: ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: ATR_TARGET_MULTIPLIER,
  volumeMultiplier: MIN_VOLUME_MULTIPLIER,
});
