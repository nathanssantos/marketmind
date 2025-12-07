import { calculateATR, calculateEMA, findHighestSwingHigh, findLowestSwingLow } from '@marketmind/indicators';
import type { Kline, Setup92Config } from '@marketmind/types';
import { createDefault92Config } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '../../utils/klineHelpers';
import {
    BaseSetupDetector,
    type SetupDetectorResult,
} from './BaseSetupDetector';

// Re-export for consumers
export type { Setup92Config };
export { createDefault92Config };

const VOLUME_LOOKBACK = 20;
const BASE_CONFIDENCE = 60;
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
    klines: Kline[],
    currentIndex: number,
    current: Kline,
  ): { avgVolume: number; volumeConfirmation: boolean } {
    const volumeData = klines.slice(
      Math.max(0, currentIndex - VOLUME_LOOKBACK),
      currentIndex,
    );
    const avgVolume =
      volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) / volumeData.length;
    const volumeConfirmation =
      getKlineVolume(current) >= avgVolume * this.setup92Config.volumeMultiplier;
    return { avgVolume, volumeConfirmation };
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.setup92Config.emaPeriod,
      this.setup92Config.atrPeriod,
    ) + VOLUME_LOOKBACK + 1;
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const ema9 = calculateEMA(klines, this.setup92Config.emaPeriod);
    const atr = calculateATR(klines, this.setup92Config.atrPeriod);

    const current = klines[currentIndex];
    const previous = klines[currentIndex - 1];
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
      klines,
      currentIndex,
      current,
    );

    const emaUptrend = ema9Current > ema9Prev;
    const emaDowntrend = ema9Current < ema9Prev;

    if (emaUptrend && getKlineClose(current) < getKlineLow(previous)) {
      const entry = getKlineHigh(current);
      const swingLow = findLowestSwingLow(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
      const atrStop = entry - atrCurrent * this.setup92Config.atrStopMultiplier;
      const swingStop = swingLow ? swingLow * STOP_BUFFER_LONG : atrStop;
      const stopLoss = Math.max(getKlineLow(current) * STOP_BUFFER_LONG, Math.min(swingStop, atrStop));
      const takeProfit = entry + atrCurrent * this.setup92Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);
      const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, true);

      if (!this.meetsMinimumRequirements(confidence, rr)) return { setup: null, confidence: 0 };

      const setup = this.createSetup(
        'setup-9-2',
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
          closeBelowPrevLow: true,
        },
      );
      return { setup, confidence };
    }

    if (emaDowntrend && getKlineClose(current) > getKlineHigh(previous)) {
      const entry = getKlineLow(current);
      const swingHigh = findHighestSwingHigh(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
      const atrStop = entry + atrCurrent * this.setup92Config.atrStopMultiplier;
      const swingStop = swingHigh ? swingHigh * STOP_BUFFER_SHORT : atrStop;
      const stopLoss = Math.min(getKlineHigh(current) * STOP_BUFFER_SHORT, Math.max(swingStop, atrStop));
      const takeProfit = entry - atrCurrent * this.setup92Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);
      const confidence = this.calculateConfidence(current, previous, ema9Current, volumeConfirmation, false);

      if (!this.meetsMinimumRequirements(confidence, rr)) return { setup: null, confidence: 0 };

      const setup = this.createSetup(
        'setup-9-2',
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
          closeAbovePrevHigh: true,
        },
      );
      return { setup, confidence };
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

    const pullbackStrength = isLong
      ? (getKlineLow(previous) - getKlineClose(current)) / getKlineLow(previous)
      : (getKlineClose(current) - getKlineHigh(previous)) / getKlineHigh(previous);
    
    if (pullbackStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (pullbackStrength > KLINE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    const klineStrength = Math.abs(getKlineClose(current) - getKlineOpen(current)) / getKlineOpen(current);
    if (klineStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}
