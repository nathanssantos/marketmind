import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Kline } from '@shared/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
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
const MIN_RISK_THRESHOLD = 0.005;
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

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = this.pinInsideConfig.lookbackPeriod + VOLUME_LOOKBACK;
    
    if (!this.config.enabled || currentIndex < minIndex || currentIndex < MIN_INDEX_OFFSET) {
      return { setup: null, confidence: 0 };
    }

    const comboSetup = this.detectPinInsideCombo(klines, currentIndex);
    if (!comboSetup) {
      return { setup: null, confidence: 0 };
    }

    return comboSetup;
  }

  private detectPinInsideCombo(klines: Kline[], currentIndex: number): SetupDetectorResult | null {
    const pinBarKline = klines[currentIndex - 1];
    const insideBarKline = klines[currentIndex];

    if (!pinBarKline || !insideBarKline) {
      return null;
    }

    const pinBarAnalysis = this.isPinBar(pinBarKline);
    if (!pinBarAnalysis.isPinBar) {
      return null;
    }

    const isInsideBar = this.isInsideBar(pinBarKline, insideBarKline);
    if (!isInsideBar) {
      return null;
    }

    const supportResistanceLevels = this.findNearbySupportResistance(
      klines,
      currentIndex - 1,
      pinBarKline
    );

    if (!supportResistanceLevels.nearLevel) {
      return null;
    }

    const volumeConfirmation = this.checkVolumeConfirmation(klines, currentIndex - 1);

    if (pinBarAnalysis.type === 'bullish') {
      return this.createBullishSetup(
        klines,
        currentIndex,
        pinBarKline,
        insideBarKline,
        supportResistanceLevels,
        volumeConfirmation
      );
    } else {
      return this.createBearishSetup(
        klines,
        currentIndex,
        pinBarKline,
        insideBarKline,
        supportResistanceLevels,
        volumeConfirmation
      );
    }
  }

  private isPinBar(kline: Kline): { isPinBar: boolean; type: 'bullish' | 'bearish' | null } {
    const body = Math.abs(getKlineClose(kline) - getKlineOpen(kline));
    const wickLow = Math.abs(getKlineLow(kline) - Math.min(getKlineOpen(kline), getKlineClose(kline)));
    const wickHigh = Math.abs(getKlineHigh(kline) - Math.max(getKlineOpen(kline), getKlineClose(kline)));
    const totalRange = getKlineHigh(kline) - getKlineLow(kline);

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

  private isInsideBar(motherKline: Kline, insideKline: Kline): boolean {
    return (
      insideKline.high <= motherKline.high &&
      insideKline.low >= motherKline.low
    );
  }

  private findNearbySupportResistance(
    klines: Kline[],
    pinBarIndex: number,
    pinBarKline: Kline
  ): { nearLevel: boolean; level: number | null } {
    const lookbackStart = Math.max(0, pinBarIndex - this.pinInsideConfig.lookbackPeriod);
    const recentKlines = klines.slice(lookbackStart, pinBarIndex + 1);
    
    const pivots = findPivotPoints(recentKlines, PIVOT_LOOKBACK);
    
    const tolerance = getKlineClose(pinBarKline) * (this.pinInsideConfig.srTolerance / PERCENT_DIVISOR);

    for (const pivot of pivots) {
      const isNearLow = Math.abs(getKlineLow(pinBarKline) - pivot.price) < tolerance;
      const isNearHigh = Math.abs(getKlineHigh(pinBarKline) - pivot.price) < tolerance;

      if (isNearLow || isNearHigh) {
        return { nearLevel: true, level: pivot.price };
      }
    }

    return { nearLevel: false, level: null };
  }

  private checkVolumeConfirmation(klines: Kline[], pinBarIndex: number): boolean {
    const lookbackStart = Math.max(0, pinBarIndex - VOLUME_LOOKBACK);
    const recentKlines = klines.slice(lookbackStart, pinBarIndex);
    
    if (recentKlines.length === 0) return false;

    const avgVolume = recentKlines.reduce((sum, c) => sum + getKlineVolume(c), 0) / recentKlines.length;
    const pinBarKline = klines[pinBarIndex];
    if (!pinBarKline) return false;
    const pinBarVolume = getKlineVolume(pinBarKline);

    return pinBarVolume > avgVolume;
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    pinBarKline: Kline,
    insideBarKline: Kline,
    srLevels: { nearLevel: boolean; level: number | null },
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = getKlineHigh(insideBarKline);
    const stopLoss = getKlineLow(pinBarKline);
    const risk = entry - stopLoss;

    if (risk <= 0) return null;

    const riskPercent = risk / entry;
    if (riskPercent < MIN_RISK_THRESHOLD) return null;

    const resistance = this.findNearestResistance(klines, currentIndex, entry);
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
      klines,
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
        pinBarLow: pinBarKline.low,
        insideBarHigh: insideBarKline.high,
      },
    );

    return { setup, confidence };
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    pinBarKline: Kline,
    insideBarKline: Kline,
    srLevels: { nearLevel: boolean; level: number | null },
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = getKlineLow(insideBarKline);
    const stopLoss = getKlineHigh(pinBarKline);
    const risk = stopLoss - entry;

    if (risk <= 0) return null;

    const riskPercent = risk / entry;
    if (riskPercent < MIN_RISK_THRESHOLD) return null;

    const support = this.findNearestSupport(klines, currentIndex, entry);
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
      klines,
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
        pinBarHigh: pinBarKline.high,
        insideBarLow: insideBarKline.low,
      },
    );

    return { setup, confidence };
  }

  private findNearestResistance(
    klines: Kline[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(this.pinInsideConfig.lookbackPeriod, currentIndex);
    const pivots = findPivotPoints(klines.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), PIVOT_LOOKBACK);
    
    const resistances = pivots
      .filter((p) => p.type === 'high' && p.price > currentPrice)
      .map((p) => p.price)
      .sort((a, b) => a - b);
    
    return resistances[0] ?? null;
  }

  private findNearestSupport(
    klines: Kline[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(this.pinInsideConfig.lookbackPeriod, currentIndex);
    const pivots = findPivotPoints(klines.slice(Math.max(0, currentIndex - lookback), currentIndex + 1), PIVOT_LOOKBACK);
    
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
