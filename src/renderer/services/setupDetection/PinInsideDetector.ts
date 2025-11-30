import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle } from '@shared/types';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

const VOLUME_LOOKBACK = 20;
const PIVOT_LOOKBACK = 5;
const MIN_INDEX_OFFSET = 2;
const PERCENT_DIVISOR = 100;
const TARGET_BUFFER_LONG = 0.998;
const TARGET_BUFFER_SHORT = 1.002;
const SR_CONFLUENCE_WEIGHT = 2;
const NO_CONFLUENCE_WEIGHT = 1;
const LOW_RISK_THRESHOLD = 0.01;
const MEDIUM_RISK_THRESHOLD = 0.02;
const LOW_RISK_BONUS = 5;
const MEDIUM_RISK_BONUS = 3;
const BASE_CONFIDENCE = 70;
const VOLUME_CONFIDENCE_BONUS = 10;
const SR_CONFIRMATION_BONUS = 15;
const MAX_CONFIDENCE = 95;

export interface PinInsideConfig extends SetupDetectorConfig {
  pinBarRatio: number;
  srTolerance: number;
  targetMultiplier: number;
  lookbackPeriod: number;
}

export const createDefaultPinInsideConfig = (): PinInsideConfig => ({
  enabled: false,
  minConfidence: 75,
  minRiskReward: 2.0,
  pinBarRatio: 2.0,
  srTolerance: 1.0,
  targetMultiplier: 2.0,
  lookbackPeriod: 50,
});

export class PinInsideDetector extends BaseSetupDetector {
  private pinInsideConfig: PinInsideConfig;

  constructor(config: PinInsideConfig) {
    super(config);
    this.pinInsideConfig = config;
  }

  updateConfig(config: PinInsideConfig): void {
    this.config = config;
    this.pinInsideConfig = config;
  }

  getConfig(): PinInsideConfig {
    return this.pinInsideConfig;
  }

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = this.pinInsideConfig.lookbackPeriod + VOLUME_LOOKBACK;
    
    if (!this.config.enabled || currentIndex < minIndex || currentIndex < MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const comboSetup = this.detectPinInsideCombo(candles, currentIndex);
    if (!comboSetup) {
      return { setup: null, confidence: 0 };
    }

    return comboSetup;
  }

  private detectPinInsideCombo(candles: Candle[], currentIndex: number): SetupDetectorResult | null {
    const pinBarCandle = candles[currentIndex - 1];
    const insideBarCandle = candles[currentIndex];

    if (!pinBarCandle || !insideBarCandle) {
      return null;
    }

    const pinBarAnalysis = this.isPinBar(pinBarCandle);
    if (!pinBarAnalysis.isPinBar) {
      return null;
    }

    const isInsideBar = this.isInsideBar(pinBarCandle, insideBarCandle);
    if (!isInsideBar) {
      return null;
    }

    const supportResistanceLevels = this.findNearbySupportResistance(
      candles,
      currentIndex - 1,
      pinBarCandle
    );

    if (!supportResistanceLevels.nearLevel) {
      return null;
    }

    const volumeConfirmation = this.checkVolumeConfirmation(candles, currentIndex - 1);

    if (pinBarAnalysis.type === 'bullish') {
      return this.createBullishSetup(
        candles,
        currentIndex,
        pinBarCandle,
        insideBarCandle,
        supportResistanceLevels,
        volumeConfirmation
      );
    } else {
      return this.createBearishSetup(
        candles,
        currentIndex,
        pinBarCandle,
        insideBarCandle,
        supportResistanceLevels,
        volumeConfirmation
      );
    }
  }

  private isPinBar(candle: Candle): { isPinBar: boolean; type: 'bullish' | 'bearish' | null } {
    const body = Math.abs(candle.close - candle.open);
    const wickLow = Math.abs(candle.low - Math.min(candle.open, candle.close));
    const wickHigh = Math.abs(candle.high - Math.max(candle.open, candle.close));
    const totalRange = candle.high - candle.low;

    if (totalRange === 0) {
      return { isPinBar: false, type: null };
    }

    const isBullishPin = wickLow > body * this.pinInsideConfig.pinBarRatio;
    const isBearishPin = wickHigh > body * this.pinInsideConfig.pinBarRatio;

    if (isBullishPin) {
      return { isPinBar: true, type: 'bullish' };
    }
    
    if (isBearishPin) {
      return { isPinBar: true, type: 'bearish' };
    }

    return { isPinBar: false, type: null };
  }

  private isInsideBar(motherCandle: Candle, insideCandle: Candle): boolean {
    return (
      insideCandle.high <= motherCandle.high &&
      insideCandle.low >= motherCandle.low
    );
  }

  private findNearbySupportResistance(
    candles: Candle[],
    pinBarIndex: number,
    pinBarCandle: Candle
  ): { nearLevel: boolean; level: number | null } {
    const lookbackStart = Math.max(0, pinBarIndex - this.pinInsideConfig.lookbackPeriod);
    const recentCandles = candles.slice(lookbackStart, pinBarIndex + 1);
    
    const pivots = findPivotPoints(recentCandles, PIVOT_LOOKBACK);
    
    const tolerance = pinBarCandle.close * (this.pinInsideConfig.srTolerance / PERCENT_DIVISOR);

    for (const pivot of pivots) {
      const isNearLow = Math.abs(pinBarCandle.low - pivot.price) < tolerance;
      const isNearHigh = Math.abs(pinBarCandle.high - pivot.price) < tolerance;

      if (isNearLow || isNearHigh) {
        return { nearLevel: true, level: pivot.price };
      }
    }

    return { nearLevel: false, level: null };
  }

  private checkVolumeConfirmation(candles: Candle[], pinBarIndex: number): boolean {
    const lookbackStart = Math.max(0, pinBarIndex - VOLUME_LOOKBACK);
    const recentCandles = candles.slice(lookbackStart, pinBarIndex);
    
    if (recentCandles.length === 0) return false;

    const avgVolume = recentCandles.reduce((sum, c) => sum + c.volume, 0) / recentCandles.length;
    const pinBarVolume = candles[pinBarIndex]?.volume ?? 0;

    return pinBarVolume > avgVolume;
  }

  private createBullishSetup(
    candles: Candle[],
    currentIndex: number,
    pinBarCandle: Candle,
    insideBarCandle: Candle,
    srLevels: { nearLevel: boolean; level: number | null },
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = insideBarCandle.high;
    const stopLoss = pinBarCandle.low;
    const risk = entry - stopLoss;

    if (risk <= 0) return null;

    const resistance = this.findNearestResistance(candles, currentIndex, entry);
    const rrTarget = entry + risk * this.pinInsideConfig.targetMultiplier;
    const structuralTarget = resistance && resistance < rrTarget ? resistance * TARGET_BUFFER_LONG : rrTarget;
    const takeProfit = Math.max(structuralTarget, entry + risk * this.pinInsideConfig.targetMultiplier);
    
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(BASE_CONFIDENCE, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      volumeConfirmation,
      srLevels.nearLevel,
      risk / entry
    );

    const setup = this.createSetup(
      'pin-inside-combo',
      'LONG',
      candles,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      srLevels.nearLevel ? SR_CONFLUENCE_WEIGHT : NO_CONFLUENCE_WEIGHT,
      {
        pinBarIndex: currentIndex - 1,
        insideBarIndex: currentIndex,
        srLevel: srLevels.level,
        pinBarLow: pinBarCandle.low,
        insideBarHigh: insideBarCandle.high,
      },
    );

    return { setup, confidence };
  }

  private createBearishSetup(
    candles: Candle[],
    currentIndex: number,
    pinBarCandle: Candle,
    insideBarCandle: Candle,
    srLevels: { nearLevel: boolean; level: number | null },
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = insideBarCandle.low;
    const stopLoss = pinBarCandle.high;
    const risk = stopLoss - entry;

    if (risk <= 0) return null;

    const support = this.findNearestSupport(candles, currentIndex, entry);
    const rrTarget = entry - risk * this.pinInsideConfig.targetMultiplier;
    const structuralTarget = support && support > rrTarget ? support * TARGET_BUFFER_SHORT : rrTarget;
    const takeProfit = Math.min(structuralTarget, entry - risk * this.pinInsideConfig.targetMultiplier);
    
    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(BASE_CONFIDENCE, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      volumeConfirmation,
      srLevels.nearLevel,
      risk / entry
    );

    const setup = this.createSetup(
      'pin-inside-combo',
      'SHORT',
      candles,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      srLevels.nearLevel ? SR_CONFLUENCE_WEIGHT : NO_CONFLUENCE_WEIGHT,
      {
        pinBarIndex: currentIndex - 1,
        insideBarIndex: currentIndex,
        srLevel: srLevels.level,
        pinBarHigh: pinBarCandle.high,
        insideBarLow: insideBarCandle.low,
      },
    );

    return { setup, confidence };
  }

  private findNearestResistance(
    candles: Candle[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(this.pinInsideConfig.lookbackPeriod, currentIndex);
    const pivots = findPivotPoints(candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), PIVOT_LOOKBACK);
    
    const resistances = pivots
      .filter((p) => p.type === 'high' && p.price > currentPrice)
      .map((p) => p.price)
      .sort((a, b) => a - b);
    
    return resistances[0] ?? null;
  }

  private findNearestSupport(
    candles: Candle[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(this.pinInsideConfig.lookbackPeriod, currentIndex);
    const pivots = findPivotPoints(candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), PIVOT_LOOKBACK);
    
    const supports = pivots
      .filter((p) => p.type === 'low' && p.price < currentPrice)
      .map((p) => p.price)
      .sort((a, b) => b - a);
    
    return supports[0] ?? null;
  }

  private calculateConfidence(
    volumeConfirmation: boolean,
    nearSR: boolean,
    riskPercent: number
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (volumeConfirmation) {
      confidence += VOLUME_CONFIDENCE_BONUS;
    }

    if (nearSR) {
      confidence += SR_CONFIRMATION_BONUS;
    }

    if (riskPercent < LOW_RISK_THRESHOLD) {
      confidence += LOW_RISK_BONUS;
    } else if (riskPercent < MEDIUM_RISK_THRESHOLD) {
      confidence += MEDIUM_RISK_BONUS;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }
}
