import { calculateATR } from '@renderer/utils/indicators/atr';
import { findHighestSwingHigh, findLowestSwingLow } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
import {
    BaseSetupDetector,
    type SetupDetectorResult,
    type SetupDetectorConfig,
} from './BaseSetupDetector';

export interface Setup94Config extends SetupDetectorConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export const createDefault94Config = (): Setup94Config => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.0,
  emaPeriod: 9,
  atrPeriod: 14,
  atrStopMultiplier: 1.5,
  atrTargetMultiplier: 2.5,
  volumeMultiplier: 1.2,
});

const VOLUME_LOOKBACK = 20;
const EMA_LOOKBACK = 2;
const BASE_CONFIDENCE = 55;
const DISTANCE_CLOSE_THRESHOLD = 0.005;
const DISTANCE_NEAR_THRESHOLD = 0.01;
const KLINE_STRONG_THRESHOLD = 0.015;
const KLINE_MODERATE_THRESHOLD = 0.01;
const CONFIDENCE_BOOST_SMALL = 5;
const CONFIDENCE_BOOST_MEDIUM = 10;
const CONFIDENCE_BOOST_LARGE = 20;
const MAX_CONFIDENCE = 100;
const SWING_STRENGTH = 3;
const STOP_BUFFER_LONG = 0.998;
const STOP_BUFFER_SHORT = 1.002;
const LOOKBACK_TWO_PREV = 2;
const LOOKBACK_THREE_PREV = 3;

export class Setup94Detector extends BaseSetupDetector {
  private setup94Config: Setup94Config;

  constructor(config: Setup94Config) {
    super(config);
    this.setup94Config = config;
  }

  private validateInputs(
    current: Kline | undefined,
    previous: Kline | undefined,
    twoPrev: Kline | undefined,
    ema9Current: number | null | undefined,
    ema9Prev: number | null | undefined,
    ema9TwoPrev: number | null | undefined,
    ema9ThreePrev: number | null | undefined,
    atrCurrent: number | undefined,
  ): boolean {
    return (
      !!current &&
      !!previous &&
      !!twoPrev &&
      ema9Current !== null &&
      ema9Current !== undefined &&
      ema9Prev !== null &&
      ema9Prev !== undefined &&
      ema9TwoPrev !== null &&
      ema9TwoPrev !== undefined &&
      ema9ThreePrev !== null &&
      ema9ThreePrev !== undefined &&
      atrCurrent !== undefined &&
      !isNaN(atrCurrent)
    );
  }

  private calculateVolumeConfirmation(
    klines: Kline[],
    currentIndex: number,
    current: Kline,
  ): { avgVolume: number; volumeConfirmation: boolean } {
    const volumeData = klines.slice(Math.max(0, currentIndex - VOLUME_LOOKBACK), currentIndex);
    const avgVolume = volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) / volumeData.length;
    const volumeConfirmation = getKlineVolume(current) >= avgVolume * this.setup94Config.volumeMultiplier;
    return { avgVolume, volumeConfirmation };
  }

  private createLongSetup(
    klines: Kline[],
    currentIndex: number,
    current: Kline,
    previous: Kline,
    ema9Current: number,
    atrCurrent: number,
    avgVolume: number,
    volumeConfirmation: boolean,
  ): SetupDetectorResult {
    const entry = getKlineHigh(current);
    const swingLow = findLowestSwingLow(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
    const atrStop = entry - atrCurrent * this.setup94Config.atrStopMultiplier;
    const swingStop = swingLow ? swingLow * STOP_BUFFER_LONG : atrStop;
    const failureLow = getKlineLow(previous) * STOP_BUFFER_LONG;
    const stopLoss = Math.max(failureLow, Math.min(swingStop, atrStop));
    const takeProfit = entry + atrCurrent * this.setup94Config.atrTargetMultiplier;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);
    const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, true);

    if (!this.meetsMinimumCriteria(confidence, rr)) return { setup: null, confidence: 0 };

    const setup = this.createSetup(
      'setup-9-4',
      'LONG',
      klines,
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
        volumeRatio: getKlineVolume(current) / avgVolume,
        continuationPattern: true,
        failureKline: true,
      },
    );
    return { setup, confidence };
  }

  private createShortSetup(
    klines: Kline[],
    currentIndex: number,
    current: Kline,
    previous: Kline,
    ema9Current: number,
    atrCurrent: number,
    avgVolume: number,
    volumeConfirmation: boolean,
  ): SetupDetectorResult {
    const entry = getKlineLow(current);
    const swingHigh = findHighestSwingHigh(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
    const atrStop = entry + atrCurrent * this.setup94Config.atrStopMultiplier;
    const swingStop = swingHigh ? swingHigh * STOP_BUFFER_SHORT : atrStop;
    const failureHigh = getKlineHigh(previous) * STOP_BUFFER_SHORT;
    const stopLoss = Math.min(failureHigh, Math.max(swingStop, atrStop));
    const takeProfit = entry - atrCurrent * this.setup94Config.atrTargetMultiplier;
    const rr = this.calculateRR(entry, stopLoss, takeProfit);
    const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, false);

    if (!this.meetsMinimumCriteria(confidence, rr)) return { setup: null, confidence: 0 };

    const setup = this.createSetup(
      'setup-9-4',
      'SHORT',
      klines,
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
        volumeRatio: getKlineVolume(current) / avgVolume,
        continuationPattern: true,
        failureKline: true,
      },
    );
    return { setup, confidence };
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(this.setup94Config.emaPeriod, this.setup94Config.atrPeriod) + VOLUME_LOOKBACK + EMA_LOOKBACK;
    if (!this.config.enabled || currentIndex < minIndex) return { setup: null, confidence: 0 };

    const ema9 = calculateEMA(klines, this.setup94Config.emaPeriod);
    const atr = calculateATR(klines, this.setup94Config.atrPeriod);
    const current = klines[currentIndex];
    const previous = klines[currentIndex - 1];
    const twoPrev = klines[currentIndex - LOOKBACK_TWO_PREV];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const ema9TwoPrev = ema9[currentIndex - LOOKBACK_TWO_PREV];
    const ema9ThreePrev = ema9[currentIndex - LOOKBACK_THREE_PREV];
    const atrCurrent = atr[currentIndex];

    const isValid = this.validateInputs(current, previous, twoPrev, ema9Current, ema9Prev, ema9TwoPrev, ema9ThreePrev, atrCurrent);
    const hasAllData = current && previous && twoPrev && ema9Current !== null && ema9Current !== undefined && ema9Prev !== null && ema9Prev !== undefined && ema9TwoPrev !== null && ema9TwoPrev !== undefined && ema9ThreePrev !== null && ema9ThreePrev !== undefined && atrCurrent !== undefined;
    if (!isValid || !hasAllData) return { setup: null, confidence: 0 };

    const { avgVolume, volumeConfirmation } = this.calculateVolumeConfirmation(klines, currentIndex, current);

    const wasUptrend = ema9ThreePrev < ema9TwoPrev;
    const turnedDown = ema9TwoPrev > ema9Prev;
    const resumedUp = ema9Prev < ema9Current;
    const lowNotLost = previous.low >= twoPrev.low;
    if (wasUptrend && turnedDown && resumedUp && lowNotLost) {
      return this.createLongSetup(klines, currentIndex, current, previous, ema9Current, atrCurrent, avgVolume, volumeConfirmation);
    }

    const wasDowntrend = ema9ThreePrev > ema9TwoPrev;
    const turnedUp = ema9TwoPrev < ema9Prev;
    const resumedDown = ema9Prev > ema9Current;
    const highNotLost = previous.high <= twoPrev.high;
    if (wasDowntrend && turnedUp && resumedDown && highNotLost) {
      return this.createShortSetup(klines, currentIndex, current, previous, ema9Current, atrCurrent, avgVolume, volumeConfirmation);
    }

    return { setup: null, confidence: 0 };
  }

  private calculateConfidence(
    current: Kline,
    previous: Kline,
    ema: number,
    volumeConfirmed: boolean,
    isLong: boolean,
  ): number {
    const confidence = BASE_CONFIDENCE;
    let boost = 0;

    const distanceFromEMA = Math.abs(getKlineClose(current) - ema) / ema;
    if (distanceFromEMA < DISTANCE_CLOSE_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (distanceFromEMA < DISTANCE_NEAR_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    if (volumeConfirmed) boost += CONFIDENCE_BOOST_LARGE;

    const resumptionStrength = isLong
      ? (getKlineHigh(current) - getKlineHigh(previous)) / getKlineHigh(previous)
      : (getKlineLow(previous) - getKlineLow(current)) / getKlineLow(previous);
    
    if (resumptionStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (resumptionStrength > KLINE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    const klineStrength = Math.abs(getKlineClose(current) - getKlineOpen(current)) / getKlineOpen(current);
    if (klineStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}

