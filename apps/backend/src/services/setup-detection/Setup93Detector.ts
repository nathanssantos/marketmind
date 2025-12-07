import { calculateATR, calculateEMA, findHighestSwingHigh, findLowestSwingLow } from '@marketmind/indicators';
import type { Kline } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '../../utils/klineHelpers';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

// Optimized values from backtesting (Jan-Dec 2024)
// PnL: +4.45%, Profit Factor: 1.09, Sharpe: 0.49
// Note: Marginally profitable - consider additional filters
const DEFAULT_EMA_PERIOD = 12;
const DEFAULT_ATR_PERIOD = 16;
const ATR_STOP_MULTIPLIER = 2;
const ATR_TARGET_MULTIPLIER = 4;
const VOLUME_LOOKBACK = 20;
const MIN_VOLUME_MULTIPLIER = 1.0;
const BASE_CONFIDENCE = 60;
const DISTANCE_CLOSE_THRESHOLD = 0.005;
const DISTANCE_NEAR_THRESHOLD = 0.01;
const KLINE_STRONG_THRESHOLD = 0.015;
const KLINE_MODERATE_THRESHOLD = 0.01;
const CONFIDENCE_BOOST_SMALL = 5;
const CONFIDENCE_BOOST_MEDIUM = 10;
const CONFIDENCE_BOOST_LARGE = 20;
const MAX_CONFIDENCE = 100;
const REQUIRED_CONSECUTIVE_CLOSES = 2;
const SWING_STRENGTH = 3;
const STOP_BUFFER_LONG = 0.998;
const STOP_BUFFER_SHORT = 1.002;
const LOOKBACK_PREV2 = 2;
const LOOKBACK_REFERENCE = 3;

export interface Setup93Config extends SetupDetectorConfig {
  emaPeriod: number;
  atrPeriod: number;
  atrStopMultiplier: number;
  atrTargetMultiplier: number;
  volumeMultiplier: number;
}

export class Setup93Detector extends BaseSetupDetector {
  private setup93Config: Setup93Config;

  constructor(config: Setup93Config) {
    super(config);
    this.setup93Config = config;
  }

  private validateInputs(
    current: Kline | undefined,
    prev1: Kline | undefined,
    prev2: Kline | undefined,
    reference: Kline | undefined,
    ema9Current: number | null | undefined,
    ema9Prev: number | null | undefined,
    atrCurrent: number | undefined,
  ): boolean {
    return (
      !!current &&
      !!prev1 &&
      !!prev2 &&
      !!reference &&
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
      getKlineVolume(current) >= avgVolume * this.setup93Config.volumeMultiplier;
    return { avgVolume, volumeConfirmation };
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.setup93Config.emaPeriod,
      this.setup93Config.atrPeriod,
    ) + VOLUME_LOOKBACK + REQUIRED_CONSECUTIVE_CLOSES;
    
    if (!this.config.enabled || currentIndex < minIndex) return { setup: null, confidence: 0 };

    const ema9 = calculateEMA(klines, this.setup93Config.emaPeriod);
    const atr = calculateATR(klines, this.setup93Config.atrPeriod);

    const current = klines[currentIndex];
    const prev1 = klines[currentIndex - 1];
    const prev2 = klines[currentIndex - LOOKBACK_PREV2];
    const reference = klines[currentIndex - LOOKBACK_REFERENCE];
    const ema9Current = ema9[currentIndex];
    const ema9Prev = ema9[currentIndex - 1];
    const atrCurrent = atr[currentIndex];

    const isValid = this.validateInputs(current, prev1, prev2, reference, ema9Current, ema9Prev, atrCurrent);
    const hasAllData = current && prev1 && prev2 && reference && ema9Current !== null && ema9Current !== undefined && ema9Prev !== null && ema9Prev !== undefined && atrCurrent !== undefined;
    
    if (!isValid || !hasAllData) return { setup: null, confidence: 0 };

    const { avgVolume, volumeConfirmation } = this.calculateVolumeConfirmation(klines, currentIndex, current);

    const emaUptrend = ema9Current > ema9Prev;
    const twoLowerCloses = parseFloat(prev2.close) < parseFloat(reference.close) && parseFloat(prev1.close) < parseFloat(reference.close);
    
    if (emaUptrend && twoLowerCloses) {
      const entry = getKlineHigh(current);
      const swingLow = findLowestSwingLow(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
      const atrStop = entry - atrCurrent * this.setup93Config.atrStopMultiplier;
      const swingStop = swingLow ? swingLow * STOP_BUFFER_LONG : atrStop;
      const stopLoss = Math.max(getKlineLow(current) * STOP_BUFFER_LONG, Math.min(swingStop, atrStop));
      const takeProfit = entry + atrCurrent * this.setup93Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);
      const confidence = this.calculateConfidence(current, prev1, prev2, reference, ema9Current, volumeConfirmation, true);

      if (!this.meetsMinimumRequirements(confidence, rr)) return { setup: null, confidence: 0 };

      const setup = this.createSetup(
        'setup-9-3',
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
          consecutiveLowerCloses: REQUIRED_CONSECUTIVE_CLOSES,
        },
      );
      return { setup, confidence };
    }

    const emaDowntrend = ema9Current < ema9Prev;
    const twoHigherCloses = parseFloat(prev2.close) > parseFloat(reference.close) && parseFloat(prev1.close) > parseFloat(reference.close);
    
    if (emaDowntrend && twoHigherCloses) {
      const entry = getKlineLow(current);
      const swingHigh = findHighestSwingHigh(klines, currentIndex, VOLUME_LOOKBACK, SWING_STRENGTH);
      const atrStop = entry + atrCurrent * this.setup93Config.atrStopMultiplier;
      const swingStop = swingHigh ? swingHigh * STOP_BUFFER_SHORT : atrStop;
      const stopLoss = Math.min(getKlineHigh(current) * STOP_BUFFER_SHORT, Math.max(swingStop, atrStop));
      const takeProfit = entry - atrCurrent * this.setup93Config.atrTargetMultiplier;
      const rr = this.calculateRR(entry, stopLoss, takeProfit);
      const confidence = this.calculateConfidence(current, prev1, prev2, reference, ema9Current, volumeConfirmation, false);

      if (!this.meetsMinimumRequirements(confidence, rr)) return { setup: null, confidence: 0 };

      const setup = this.createSetup(
        'setup-9-3',
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
          consecutiveHigherCloses: REQUIRED_CONSECUTIVE_CLOSES,
        },
      );
      return { setup, confidence };
    }

    return { setup: null, confidence: 0 };
  }

  private calculateConfidence(
    current: Kline,
    prev1: Kline,
    prev2: Kline,
    reference: Kline,
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

    const pullbackDepth = isLong
      ? (getKlineClose(reference) - Math.min(getKlineClose(prev1), getKlineClose(prev2))) / getKlineClose(reference)
      : (Math.max(getKlineClose(prev1), getKlineClose(prev2)) - getKlineClose(reference)) / getKlineClose(reference);
    
    if (pullbackDepth > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_MEDIUM;
    else if (pullbackDepth > KLINE_MODERATE_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    const klineStrength = Math.abs(getKlineClose(current) - getKlineOpen(current)) / getKlineOpen(current);
    if (klineStrength > KLINE_STRONG_THRESHOLD) boost += CONFIDENCE_BOOST_SMALL;

    return Math.min(confidence + boost, MAX_CONFIDENCE);
  }
}

export const createDefault93Config = (): Setup93Config => ({
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.0,
  emaPeriod: DEFAULT_EMA_PERIOD,
  atrPeriod: DEFAULT_ATR_PERIOD,
  atrStopMultiplier: ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: ATR_TARGET_MULTIPLIER,
  volumeMultiplier: MIN_VOLUME_MULTIPLIER,
});
