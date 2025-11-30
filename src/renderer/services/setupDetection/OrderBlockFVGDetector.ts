import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Candle, FVG, OrderBlock } from '@shared/types';
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

  detect(candles: Candle[], currentIndex: number): SetupDetectorResult {
    const minIndex = this.orderBlockFVGConfig.lookbackPeriod + VOLUME_LOOKBACK;

    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const bullishSetup = this.detectBullishOrderBlockFVG(candles, currentIndex);
    if (bullishSetup) return bullishSetup;

    const bearishSetup = this.detectBearishOrderBlockFVG(candles, currentIndex);
    if (bearishSetup) return bearishSetup;

    return { setup: null, confidence: 0 };
  }

  private detectBullishOrderBlockFVG(
    candles: Candle[],
    currentIndex: number
  ): SetupDetectorResult | null {
    const orderBlock = this.findBullishOrderBlock(candles, currentIndex);
    if (!orderBlock) return null;

    const fvg = this.findBullishFVG(candles, currentIndex);
    if (!fvg) return null;

    const volumeConfirmation = this.hasVolumeConfirmation(
      candles,
      orderBlock.index
    );

    return this.createBullishSetup(
      candles,
      currentIndex,
      orderBlock,
      fvg,
      volumeConfirmation
    );
  }

  private detectBearishOrderBlockFVG(
    candles: Candle[],
    currentIndex: number
  ): SetupDetectorResult | null {
    const orderBlock = this.findBearishOrderBlock(candles, currentIndex);
    if (!orderBlock) return null;

    const fvg = this.findBearishFVG(candles, currentIndex);
    if (!fvg) return null;

    const volumeConfirmation = this.hasVolumeConfirmation(
      candles,
      orderBlock.index
    );

    return this.createBearishSetup(
      candles,
      currentIndex,
      orderBlock,
      fvg,
      volumeConfirmation
    );
  }

  private findBullishOrderBlock(
    candles: Candle[],
    currentIndex: number
  ): (OrderBlock & { index: number }) | null {
    const lookbackStart = Math.max(
      0,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );
    const avgVolume = this.calculateAverageVolume(candles, currentIndex);

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const candle = candles[i];
      if (!candle) continue;

      const isBullish = candle.close > candle.open;
      const hasHighVolume =
        candle.volume >=
        avgVolume * this.orderBlockFVGConfig.orderBlockVolumeMultiplier;

      if (isBullish && hasHighVolume) {
        const currentCandle = candles[currentIndex];
        if (!currentCandle) continue;

        const currentPrice = currentCandle.close;
        if (currentPrice >= candle.low && currentPrice <= candle.high) {
          return {
            type: 'bullish',
            high: candle.high,
            low: candle.low,
            timestamp: candle.timestamp,
            index: i,
          };
        }
      }
    }

    return null;
  }

  private findBearishOrderBlock(
    candles: Candle[],
    currentIndex: number
  ): (OrderBlock & { index: number }) | null {
    const lookbackStart = Math.max(
      0,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );
    const avgVolume = this.calculateAverageVolume(candles, currentIndex);

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const candle = candles[i];
      if (!candle) continue;

      const isBearish = candle.close < candle.open;
      const hasHighVolume =
        candle.volume >=
        avgVolume * this.orderBlockFVGConfig.orderBlockVolumeMultiplier;

      if (isBearish && hasHighVolume) {
        const currentCandle = candles[currentIndex];
        if (!currentCandle) continue;

        const currentPrice = currentCandle.close;
        if (currentPrice >= candle.low && currentPrice <= candle.high) {
          return {
            type: 'bearish',
            high: candle.high,
            low: candle.low,
            timestamp: candle.timestamp,
            index: i,
          };
        }
      }
    }

    return null;
  }

  private findBullishFVG(
    candles: Candle[],
    currentIndex: number
  ): FVG | null {
    const minIndex = 2;
    if (currentIndex < minIndex) return null;

    const lookbackStart = Math.max(
      minIndex,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const prevCandle = candles[i - 1];
      const nextCandle = candles[i + 1];

      if (!prevCandle || !nextCandle) continue;

      const gapBottom = prevCandle.high;
      const gapTop = nextCandle.low;

      if (gapTop <= gapBottom) continue;

      const gapSize = gapTop - gapBottom;
      const gapPercent = gapSize / prevCandle.close;

      if (gapPercent < this.orderBlockFVGConfig.fvgMinSize / PERCENT_DIVISOR) continue;

      const currentCandle = candles[currentIndex];
      if (!currentCandle) continue;

      const currentPrice = currentCandle.close;
      if (currentPrice < gapBottom || currentPrice > gapTop) continue;

      const middleCandle = candles[i];
      if (!middleCandle) continue;

      return {
        type: 'bullish',
        top: gapTop,
        bottom: gapBottom,
        timestamp: middleCandle.timestamp,
      };
    }

    return null;
  }

  private findBearishFVG(
    candles: Candle[],
    currentIndex: number
  ): FVG | null {
    const minIndex = 2;
    if (currentIndex < minIndex) return null;

    const lookbackStart = Math.max(
      minIndex,
      currentIndex - this.orderBlockFVGConfig.lookbackPeriod
    );

    for (let i = currentIndex - 1; i >= lookbackStart; i -= 1) {
      const prevCandle = candles[i - 1];
      const nextCandle = candles[i + 1];

      if (!prevCandle || !nextCandle) continue;

      const gapTop = prevCandle.low;
      const gapBottom = nextCandle.high;

      if (gapTop <= gapBottom) continue;

      const gapSize = gapTop - gapBottom;
      const gapPercent = gapSize / prevCandle.close;

      if (gapPercent < this.orderBlockFVGConfig.fvgMinSize / PERCENT_DIVISOR) continue;

      const currentCandle = candles[currentIndex];
      if (!currentCandle) continue;

      const currentPrice = currentCandle.close;
      if (currentPrice < gapBottom || currentPrice > gapTop) continue;

      const middleCandle = candles[i];
      if (!middleCandle) continue;

      return {
        type: 'bearish',
        top: gapTop,
        bottom: gapBottom,
        timestamp: middleCandle.timestamp,
      };
    }

    return null;
  }

  private createBullishSetup(
    candles: Candle[],
    currentIndex: number,
    orderBlock: OrderBlock & { index: number },
    fvg: FVG,
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = orderBlock.high;
    const stopLoss = orderBlock.low;
    const risk = entry - stopLoss;

    if (risk <= 0) return null;

    const resistance = this.findNearestResistance(candles, currentIndex, entry);
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
      candles,
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
    candles: Candle[],
    currentIndex: number,
    orderBlock: OrderBlock & { index: number },
    fvg: FVG,
    volumeConfirmation: boolean
  ): SetupDetectorResult | null {
    const entry = orderBlock.low;
    const stopLoss = orderBlock.high;
    const risk = stopLoss - entry;

    if (risk <= 0) return null;

    const support = this.findNearestSupport(candles, currentIndex, entry);
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
      candles,
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
    candles: Candle[],
    currentIndex: number,
    currentPrice: number
  ): number | null {
    const lookback = Math.min(
      this.orderBlockFVGConfig.lookbackPeriod,
      currentIndex
    );
    const pivots = findPivotPoints(
      candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1),
      PIVOT_LOOKBACK
    );

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
    const lookback = Math.min(
      this.orderBlockFVGConfig.lookbackPeriod,
      currentIndex
    );
    const pivots = findPivotPoints(
      candles.slice(Math.max(0, currentIndex - lookback), currentIndex + 1),
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
    candles: Candle[],
    currentIndex: number
  ): number {
    const lookbackStart = Math.max(0, currentIndex - VOLUME_LOOKBACK);
    const volumeSum = candles
      .slice(lookbackStart, currentIndex + 1)
      .reduce((sum, c) => sum + c.volume, 0);
    const count = currentIndex - lookbackStart + 1;
    return volumeSum / count;
  }

  private hasVolumeConfirmation(
    candles: Candle[],
    candleIndex: number
  ): boolean {
    const avgVolume = this.calculateAverageVolume(candles, candleIndex);
    const candle = candles[candleIndex];
    if (!candle) return false;
    return candle.volume > avgVolume;
  }
}
