import type { Candle } from '@shared/types';
import { calculateEMA } from '@renderer/utils/movingAverages';
import { calculateATR } from '@renderer/utils/indicators/atr';
import { findLowestSwingLow, findHighestSwingHigh, findPivotPoints } from '@renderer/utils/indicators/supportResistance';
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
  targetMultiplier: number;
  volumeMultiplier: number;
}

export class Setup91Detector extends BaseSetupDetector {
  private setup91Config: Setup91Config;

  constructor(config: Setup91Config) {
    super(config);
    this.setup91Config = config;
  }

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = Math.max(
      this.setup91Config.emaPeriod,
      this.setup91Config.atrPeriod,
    ) + VOLUME_LOOKBACK;
    
    if (!this.config.enabled || currentIndex < minIndex) {
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
      
      const swingLow = findLowestSwingLow(candles, currentIndex, VOLUME_LOOKBACK, 3);
      const atrStop = entry - atrCurrent * this.setup91Config.atrStopMultiplier;
      const swingStop = swingLow ? swingLow * 0.998 : atrStop;
      const stopLoss = Math.min(swingStop, atrStop);
      
      const resistance = this.findNearestResistance(candles, currentIndex, entry);
      const atrTarget = entry + atrCurrent * this.setup91Config.atrTargetMultiplier;
      const minTarget = entry + (entry - stopLoss) * this.setup91Config.targetMultiplier;
      const structuralTarget = resistance && resistance < atrTarget ? resistance * 0.998 : atrTarget;
      const takeProfit = Math.max(structuralTarget, minTarget);
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
      
      const swingHigh = findHighestSwingHigh(candles, currentIndex, VOLUME_LOOKBACK, 3);
      const atrStop = entry + atrCurrent * this.setup91Config.atrStopMultiplier;
      const swingStop = swingHigh ? swingHigh * 1.002 : atrStop;
      const stopLoss = Math.max(swingStop, atrStop);
      
      const support = this.findNearestSupport(candles, currentIndex, entry);
      const atrTarget = entry - atrCurrent * this.setup91Config.atrTargetMultiplier;
      const minTarget = entry - (stopLoss - entry) * this.setup91Config.targetMultiplier;
      const structuralTarget = support && support > atrTarget ? support * 1.002 : atrTarget;
      const takeProfit = Math.min(structuralTarget, minTarget);
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

  private findNearestResistance(
    candles: Candle[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(VOLUME_LOOKBACK * 3, currentIndex);
    const pivots = findPivotPoints(candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), 5);
    
    const resistances = pivots
      .filter((p) => p.type === 'high' && p.price > currentPrice)
      .map((p) => p.price)
      .sort((a, b) => a - b);
    
    return resistances[0] ?? null;
  }

  private findNearestSupport(
    candles: Candle[],
    currentIndex: number,
    currentPrice: number,
  ): number | null {
    const lookback = Math.min(VOLUME_LOOKBACK * 3, currentIndex);
    const pivots = findPivotPoints(candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), 5);
    
    const supports = pivots
      .filter((p) => p.type === 'low' && p.price < currentPrice)
      .map((p) => p.price)
      .sort((a, b) => b - a);
    
    return supports[0] ?? null;
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
  enabled: false,
  minConfidence: 70,
  minRiskReward: 2.5,
  emaPeriod: DEFAULT_EMA_PERIOD,
  atrPeriod: DEFAULT_ATR_PERIOD,
  atrStopMultiplier: ATR_STOP_MULTIPLIER,
  atrTargetMultiplier: ATR_TARGET_MULTIPLIER,
  targetMultiplier: 2.0,
  volumeMultiplier: MIN_VOLUME_MULTIPLIER,
});
