import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { FVG, Kline, OrderBlock } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineOpen, getKlineVolume } from '@shared/utils';
import {
    BaseSetupDetector,
    type SetupDetectorConfig,
    type SetupDetectorResult,
} from './BaseSetupDetector';

const VOLUME_LOOKBACK = 20;
const PIVOT_LOOKBACK = 5;
const PERCENT_DIVISOR = 100;
const CONFLUENCE_WEIGHT = 2;
const BASE_CONFIDENCE = 70;
const VOLUME_CONFIDENCE_BONUS = 10;
const FVG_CONFIRMATION_BONUS = 15;
const MAX_CONFIDENCE = 95;

export interface OrderBlockFVGConfig extends SetupDetectorConfig {
  fvgMinSize: number;
  orderBlockVolumeMultiplier: number;
  targetMultiplier: number;
  lookbackPeriod: number;
}

export const createDefaultOrderBlockFVGConfig =
  (): OrderBlockFVGConfig => ({
    enabled: false,
    minConfidence: 75,
    minRiskReward: 2.0,
    fvgMinSize: 0.1,
    orderBlockVolumeMultiplier: 1.5,
    targetMultiplier: 2.0,
    lookbackPeriod: 50,
  });

export class OrderBlockFVGDetector extends BaseSetupDetector {
  private orderBlockFVGConfig: OrderBlockFVGConfig;

  constructor(config: OrderBlockFVGConfig) {
    super(config);
    this.orderBlockFVGConfig = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = this.orderBlockFVGConfig.lookbackPeriod + VOLUME_LOOKBACK;

    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const bullishSetup = this.detectBullishOrderBlockFVG(klines, currentIndex);
    if (bullishSetup) return bullishSetup;

    const bearishSetup = this.detectBearishOrderBlockFVG(klines, currentIndex);
    if (bearishSetup) return bearishSetup;

    return { setup: null, confidence: 0 };
  }

  private detectBullishOrderBlockFVG(
    klines: Kline[],
    currentIndex: number
  ): SetupDetectorResult | null {
    const orderBlock = this.findBullishOrderBlock(klines, currentIndex);
    if (!orderBlock) return null;

    const fvg = this.findBullishFVG(klines, currentIndex);
    if (!fvg) return null;

    const volumeConfirmation = this.hasVolumeConfirmation(
      klines,
      orderBlock.index
    );

    return this.createBullishSetup(
      klines,
      currentIndex,
      orderBlock,
      fvg,
      volumeConfirmation
    );
  }

  private detectBearishOrderBlockFVG(
    klines: Kline[],
    currentIndex: number
  ): SetupDetectorResult | null {
    const orderBlock = this.findBearishOrderBlock(klines, currentIndex);
    if (!orderBlock) return null;

    const fvg = this.findBearishFVG(klines, currentIndex);
    if (!fvg) return null;

    const volumeConfirmation = this.hasVolumeConfirmation(
      klines,
      orderBlock.index
    );

    return this.createBearishSetup(
      klines,
      currentIndex,
      orderBlock,
      fvg,
      volumeConfirmation
    );
  }

  private findBullishOrderBlock(
    klines: Kline[],
    currentIndex: number
  ): (OrderBlock & { index: number }) | null {
    const lookbackStart = Math.max(
      0,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );
    const avgVolume = this.calculateAverageVolume(klines, currentIndex);

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const kline = klines[i];
      if (!kline) continue;

      const isBullish = getKlineClose(kline) > getKlineOpen(kline);
      const hasHighVolume =
        getKlineVolume(kline) >=
        avgVolume * this.orderBlockFVGConfig.orderBlockVolumeMultiplier;

      if (isBullish && hasHighVolume) {
        const currentKline = klines[currentIndex];
        if (!currentKline) continue;

        const currentPrice = getKlineClose(currentKline);
        if (currentPrice >= getKlineLow(kline) && currentPrice <= getKlineHigh(kline)) {
          return {
            type: 'bullish',
            high: getKlineHigh(kline),
            low: getKlineLow(kline),
            openTime: kline.openTime,
            index: i,
          };
        }
      }
    }

    return null;
  }

  private findBearishOrderBlock(
    klines: Kline[],
    currentIndex: number
  ): (OrderBlock & { index: number }) | null {
    const lookbackStart = Math.max(
      0,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );
    const avgVolume = this.calculateAverageVolume(klines, currentIndex);

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const kline = klines[i];
      if (!kline) continue;

      const isBearish = getKlineClose(kline) < getKlineOpen(kline);
      const hasHighVolume =
        getKlineVolume(kline) >=
        avgVolume * this.orderBlockFVGConfig.orderBlockVolumeMultiplier;

      if (isBearish && hasHighVolume) {
        const currentKline = klines[currentIndex];
        if (!currentKline) continue;

        const currentPrice = getKlineClose(currentKline);
        if (currentPrice >= getKlineLow(kline) && currentPrice <= getKlineHigh(kline)) {
          return {
            type: 'bearish',
            high: getKlineHigh(kline),
            low: getKlineLow(kline),
            openTime: kline.openTime,
            index: i,
          };
        }
      }
    }

    return null;
  }

  private findBullishFVG(
    klines: Kline[],
    currentIndex: number
  ): FVG | null {
    const minIndex = 2;
    if (currentIndex < minIndex) return null;

    const lookbackStart = Math.max(
      minIndex,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const prevKline = klines[i - 1];
      const nextKline = klines[i + 1];

      if (!prevKline || !nextKline) continue;

      const gapBottom = getKlineHigh(prevKline);
      const gapTop = getKlineLow(nextKline);

      if (gapTop <= gapBottom) continue;

      const gapSize = gapTop - gapBottom;
      const gapPercent = gapSize / getKlineClose(prevKline);

      if (gapPercent < this.orderBlockFVGConfig.fvgMinSize / PERCENT_DIVISOR) continue;

      const currentKline = klines[currentIndex];
      if (!currentKline) continue;

      const currentPrice = getKlineClose(currentKline);
      if (currentPrice < gapBottom || currentPrice > gapTop) continue;

      const middleKline = klines[i];
      if (!middleKline) continue;

      return {
        type: 'bullish',
        top: gapTop,
        bottom: gapBottom,
        openTime: middleKline.openTime,
      };
    }

    return null;
  }

  private findBearishFVG(
    klines: Kline[],
    currentIndex: number
  ): FVG | null {
    const minIndex = 2;
    if (currentIndex < minIndex) return null;

    const lookbackStart = Math.max(
      minIndex,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const prevKline = klines[i - 1];
      const nextKline = klines[i + 1];

      if (!prevKline || !nextKline) continue;

      const gapTop = getKlineLow(prevKline);
      const gapBottom = getKlineHigh(nextKline);

      if (gapTop <= gapBottom) continue;

      const gapSize = gapTop - gapBottom;
      const gapPercent = gapSize / getKlineClose(prevKline);

      if (gapPercent < this.orderBlockFVGConfig.fvgMinSize / PERCENT_DIVISOR) continue;

      const currentKline = klines[currentIndex];
      if (!currentKline) continue;

      const currentPrice = getKlineClose(currentKline);
      if (currentPrice < gapBottom || currentPrice > gapTop) continue;

      const middleKline = klines[i];
      if (!middleKline) continue;

      return {
        type: 'bearish',
        top: gapTop,
        bottom: gapBottom,
        openTime: middleKline.openTime,
      };
    }

    return null;
  }

  private createBullishSetup(
    klines: Kline[],
    currentIndex: number,
    orderBlock: OrderBlock & { index: number },
    fvg: FVG,
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = orderBlock.high;
    const stopLoss = orderBlock.low;
    const risk = entry - stopLoss;

    if (risk <= 0) return null;

    const resistance = this.findNearestResistance(klines, currentIndex, entry);
    const rrTarget = entry + risk * this.orderBlockFVGConfig.targetMultiplier;
    const takeProfit = resistance && resistance < rrTarget ? resistance : rrTarget;

    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(BASE_CONFIDENCE, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      volumeConfirmation,
      true,
      risk / entry
    );

    const setup = this.createSetup(
      'order-block-fvg',
      'LONG',
      klines,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      CONFLUENCE_WEIGHT,
      {
        orderBlockIndex: orderBlock.index,
        orderBlockHigh: orderBlock.high,
        orderBlockLow: orderBlock.low,
        fvgTop: fvg.top,
        fvgBottom: fvg.bottom,
      }
    );

    return { setup, confidence };
  }

  private createBearishSetup(
    klines: Kline[],
    currentIndex: number,
    orderBlock: OrderBlock & { index: number },
    fvg: FVG,
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = orderBlock.low;
    const stopLoss = orderBlock.high;
    const risk = stopLoss - entry;

    if (risk <= 0) return null;

    const support = this.findNearestSupport(klines, currentIndex, entry);
    const rrTarget = entry - risk * this.orderBlockFVGConfig.targetMultiplier;
    const takeProfit = support && support > rrTarget ? support : rrTarget;

    const rr = this.calculateRR(entry, stopLoss, takeProfit);

    if (!this.meetsMinimumCriteria(BASE_CONFIDENCE, rr)) {
      return null;
    }

    const confidence = this.calculateConfidence(
      volumeConfirmation,
      true,
      risk / entry
    );

    const setup = this.createSetup(
      'order-block-fvg',
      'SHORT',
      klines,
      currentIndex,
      entry,
      stopLoss,
      takeProfit,
      confidence,
      volumeConfirmation,
      CONFLUENCE_WEIGHT,
      {
        orderBlockIndex: orderBlock.index,
        orderBlockHigh: orderBlock.high,
        orderBlockLow: orderBlock.low,
        fvgTop: fvg.top,
        fvgBottom: fvg.bottom,
      }
    );

    return { setup, confidence };
  }

  private findNearestResistance(
    klines: Kline[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(
      this.orderBlockFVGConfig.lookbackPeriod,
      currentIndex
    );
    const pivots = findPivotPoints(
      klines.slice(Math.max(0, currentIndex - lookback), currentIndex + 1),
      PIVOT_LOOKBACK
    );

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
    const lookback = Math.min(
      this.orderBlockFVGConfig.lookbackPeriod,
      currentIndex
    );
    const pivots = findPivotPoints(
      klines.slice(Math.max(0, currentIndex - lookback), currentIndex + 1),
      PIVOT_LOOKBACK
    );

    const supports = pivots
      .filter((p) => p.type === 'low' && p.price < currentPrice)
      .map((p) => p.price)
      .sort((a, b) => b - a);

    return supports[0] ?? null;
  }

  private calculateConfidence(
    volumeConfirmation: boolean,
    hasFVG: boolean,
    riskPercent: number
  ): number {
    let confidence = BASE_CONFIDENCE;

    if (volumeConfirmation) {
      confidence += VOLUME_CONFIDENCE_BONUS;
    }

    if (hasFVG) {
      confidence += FVG_CONFIRMATION_BONUS;
    }

    const lowRiskThreshold = 0.01;
    const mediumRiskThreshold = 0.02;
    const lowRiskBonus = 5;
    const mediumRiskBonus = 3;

    if (riskPercent < lowRiskThreshold) {
      confidence += lowRiskBonus;
    } else if (riskPercent < mediumRiskThreshold) {
      confidence += mediumRiskBonus;
    }

    return Math.min(confidence, MAX_CONFIDENCE);
  }

  private calculateAverageVolume(
    klines: Kline[],
    currentIndex: number
  ): number {
    const lookbackStart = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeSum = klines
      .slice(lookbackStart, currentIndex + 1)
      .reduce((sum, c) => sum + getKlineVolume(c), 0);
    const count = currentIndex - lookbackStart + 1;
    return volumeSum / count;
  }

  private hasVolumeConfirmation(
    klines: Kline[],
    klineIndex: number
  ): boolean {
    const avgVolume = this.calculateAverageVolume(klines, klineIndex);
    const kline = klines[klineIndex];
    if (!kline) return false;
    return getKlineVolume(kline) > avgVolume;
  }
}
