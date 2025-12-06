import { calculateATR } from '@renderer/utils/indicators/atr';
import { findHighestSwingHigh, findLowestSwingLow } from '@renderer/utils/indicators/supportResistance';
import { calculateEMA } from '@renderer/utils/movingAverages';
import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
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
const EMA_LOOKBACK = 2;
const BASE_CONFIDENCE = 60;
const DISTANCE_CLOSE_THRESHOLD = 0.005;
const DISTANCE_NEAR_THRESHOLD = 0.01;
const KLINE_STRONG_THRESHOLD = 0.015;
const KLINE_MODERATE_THRESHOLD = 0.01;
const CONFIDENCE_BOOST_SMALL = 5;
const CONFIDENCE_BOOST_MEDIUM = 10;
const CONFIDENCE_BOOST_LARGE = 20;
const MAX_CONFIDENCE = 100;

export interface Setup91Config extends SetupDetectorConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export class Setup91Detector extends BaseSetupDetector {
  private setup91Config: Setup91Config;

  constructor(config: Setup91Config) {
    super(config);
    this.setup91Config = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.setup91Config.emaPeriod,
      this.setup91Config.atrPeriod,
    ) + VOLUME_LOOKBACK;
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const ema9 = calculateEMA(klines, this.setup91Config.emaPeriod);
    const atr = calculateATR(klines, this.setup91Config.atrPeriod);

    const current = klines[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const ema9PrevPrev = ema9[currentIndex - EMA_LOOKBACK];
    const atrCurrent = atr[currentIndex];

    if (
      !current ||
      ema9Current === null ||
      ema9Current === undefined ||
      ema9Prev === null ||
      ema9Prev === undefined ||
      ema9PrevPrev === null ||
      ema9PrevPrev === undefined ||
      atrCurrent === undefined ||
      isNaN(atrCurrent)
    ) {
      return { setup: null, confidence: 0 };
    }

    const volumeData = klines.slice(
      Math.max(0, currentIndex - VOLUME_LOOKBACK),
      currentIndex,
    );
    const avgVolume =
      volumeData.reduce((sum, c) => sum + getKlineVolume(c), 0) / volumeData.length;
    const volumeConfirmation =
      getKlineVolume(current) >= avgVolume * this.setup91Config.volumeMultiplier;

    const bullishTurn = ema9PrevPrev > ema9Prev && ema9Current > ema9Prev;
    const bearishTurn = ema9PrevPrev < ema9Prev && ema9Current < ema9Prev;

    if (bullishTurn && getKlineClose(current) > ema9Current && volumeConfirmation) {
      const entry = getKlineClose(current);
      
      const swingLow = findLowestSwingLow(klines, currentIndex, VOLUME_LOOKBACK, 3);
      const atrStop = entry - atrCurrent * this.setup91Config.atrStopMultiplier;
      const swingStop = swingLow ? swingLow * 0.998 : atrStop;
      const stopLoss = Math.min(swingStop, atrStop);
      
      const takeProfit = entry + atrCurrent * this.setup91Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);

      const confidence = this.calculateConfidence(
        current,
        ema9Current,
        volumeConfirmation,
      );

      if (!this.meetsMinimumCriteria(confidence, rr)) {
        return { setup: null, confidence: 0 };
      }

      const setup = this.createSetup(
        'setup-9-1',
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
        },
      );

      return { setup, confidence };
    }

    if (bearishTurn && getKlineClose(current) < ema9Current && volumeConfirmation) {
      const entry = getKlineClose(current);
      
      const swingHigh = findHighestSwingHigh(klines, currentIndex, VOLUME_LOOKBACK, 3);
      const atrStop = entry + atrCurrent * this.setup91Config.atrStopMultiplier;
      const swingStop = swingHigh ? swingHigh * 1.002 : atrStop;
      const stopLoss = Math.max(swingStop, atrStop);
      
      const takeProfit = entry - atrCurrent * this.setup91Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);

      const confidence = this.calculateConfidence(
        current,
        ema9Current,
        volumeConfirmation,
      );

      if (!this.meetsMinimumCriteria(confidence, rr)) {
        return { setup: null, confidence: 0 };
      }

      const setup = this.createSetup(
        'setup-9-1',
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
        },
      );

      return { setup, confidence };
    }

    return { setup: null, confidence: 0 };
  }

  private calculateConfidence(
    kline: Kline,
    ema: number,
    volumeConfirmed: boolean,
  ): number {
    const confidence = BASE_CONFIDENCE;
    let boost = 0;

    const distanceFromEMA = Math.abs(getKlineClose(kline) - ema) / ema;
    if (distanceFromEMA < DISTANCE_CLOSE_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (distanceFromEMA < DISTANCE_NEAR_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    if (volumeConfirmed) boost += CONFIDENCE_BOOST_LARGE;

    const klineStrength = Math.abs(getKlineClose(kline) - getKlineOpen(kline)) / getKlineOpen(kline);
    if (klineStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (klineStrength > KLINE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}

export const createDefault91Config = (): Setup91Config => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.5,
  emaPeriod: DEFAULT_EMA_PERIOD,
  atrPeriod: DEFAULT_ATR_PERIOD,
  atrStopMultiplier: ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: ATR_TARGET_MULTIPLIER,
  volumeMultiplier: MIN_VOLUME_MULTIPLIER,
});
