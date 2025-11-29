import type { Candle } from '@shared/types';
import { calculateEMA } from '@renderer/utils/indicators/ema';
import { calculateATR } from '@renderer/utils/indicators/atr';
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
const CANDLE_STRONG_THRESHOLD = 0.015;
const CANDLE_MODERATE_THRESHOLD = 0.01;
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

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    if (
      !this.config.enabled ||
      currentIndex < this.setup91Config.emaPeriod + VOLUME_LOOKBACK
    ) {
      return { setup: null, confidence: 0 };
    }

    const ema9 = calculateEMA(candles, this.setup91Config.emaPeriod);
    const atr = calculateATR(candles, this.setup91Config.atrPeriod);

    const current = candles[currentIndex];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const ema9PrevPrev = ema9[currentIndex - EMA_LOOKBACK];
    const atrCurrent = atr[currentIndex];

    if (
      !current ||
      ema9Current === undefined ||
      isNaN(ema9Current) ||
      ema9Prev === undefined ||
      isNaN(ema9Prev) ||
      ema9PrevPrev === undefined ||
      isNaN(ema9PrevPrev) ||
      atrCurrent === undefined ||
      isNaN(atrCurrent)
    ) {
      return { setup: null, confidence: 0 };
    }

    const volumeData = candles.slice(
      Math.max(0, currentIndex - VOLUME_LOOKBACK),
      currentIndex,
    );
    const avgVolume =
      volumeData.reduce((sum, c) => sum + c.volume, 0) / volumeData.length;
    const volumeConfirmation =
      current.volume >= avgVolume * this.setup91Config.volumeMultiplier;

    const bullishTurn = ema9PrevPrev > ema9Prev && ema9Current > ema9Prev;
    const bearishTurn = ema9PrevPrev < ema9Prev && ema9Current < ema9Prev;

    if (bullishTurn && current.close > ema9Current && volumeConfirmation) {
      const entry = current.close;
      const stopLoss = entry - atrCurrent * this.setup91Config.atrStopMultiplier;
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
        },
      );

      return { setup, confidence };
    }

    if (bearishTurn && current.close < ema9Current && volumeConfirmation) {
      const entry = current.close;
      const stopLoss = entry + atrCurrent * this.setup91Config.atrStopMultiplier;
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
        },
      );

      return { setup, confidence };
    }

    return { setup: null, confidence: 0 };
  }

  private calculateConfidence(
    candle: Candle,
    ema: number,
    volumeConfirmed: boolean,
  ): number {
    const confidence = BASE_CONFIDENCE;
    let boost = 0;

    const distanceFromEMA = Math.abs(candle.close - ema) / ema;
    if (distanceFromEMA < DISTANCE_CLOSE_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (distanceFromEMA < DISTANCE_NEAR_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    if (volumeConfirmed) boost += CONFIDENCE_BOOST_LARGE;

    const candleStrength = Math.abs(candle.close - candle.open) / candle.open;
    if (candleStrength > CANDLE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (candleStrength > CANDLE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}

export const createDefault91Config = (): Setup91Config => ({
  enabled: true,
  minConfidence: 60,
  minRiskReward: 2.0,
  emaPeriod: DEFAULT_EMA_PERIOD,
  atrPeriod: DEFAULT_ATR_PERIOD,
  atrStopMultiplier: ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: ATR_TARGET_MULTIPLIER,
  volumeMultiplier: MIN_VOLUME_MULTIPLIER,
});
