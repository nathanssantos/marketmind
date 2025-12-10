import { findPivotPoints } from '@renderer/utils/indicators/supportResistance';
import type { Kline, Pattern123Config } from '@marketmind/types';
import { createDefault123Config } from '@marketmind/types';
import { getKlineClose, getKlineOpen, getKlineVolume } from '@shared/utils';
import {
    BaseSetupDetector,
    type SetupDetectorResult,
} from './BaseSetupDetector';

export type { Pattern123Config };
export { createDefault123Config };

const MIN_HIGHER_LOW_PERCENT = 0.001;

export class Pattern123Detector extends BaseSetupDetector {
  private pattern123Config: Pattern123Config;

  constructor(config: Pattern123Config) {
    super(config);
    this.pattern123Config = config;
  }

  detect(klines: Kline[], currentIndex: number): SetupDetectorResult {
    const minIndex = this.pattern123Config.pivotLookback * 6;
    
    if (!this.config.enabled || currentIndex < minIndex) {
      return { setup: null, confidence: 0 };
    }

    const recentKlines = klines.slice(
      Math.max(0, currentIndex - this.pattern123Config.pivotLookback * 6),
      currentIndex + 1,
    );

    const pivots = findPivotPoints(
      recentKlines,
      this.pattern123Config.pivotLookback,
    );

    if (pivots.length < 3) {
      return { setup: null, confidence: 0 };
    }

    const bullishSetup = this.detectBullish123(
      klines,
      pivots,
      currentIndex,
    );
    if (bullishSetup) return bullishSetup;

    const bearishSetup = this.detectBearish123(
      klines,
      pivots,
      currentIndex,
    );
    if (bearishSetup) return bearishSetup;

    return { setup: null, confidence: 0 };
  }

  private detectBullish123(
    klines: Kline[],
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): SetupDetectorResult | null {
    const lowPivots = pivots.filter((p) => p.type === 'low');
    const highPivots = pivots.filter((p) => p.type === 'high');

    for (let i = 0; i < lowPivots.length - 1; i++) {
      const p1 = lowPivots[i];
      const p3 = lowPivots[i + 1];

      if (!p1 || !p3) continue;

      const higherLow = p3.price > p1.price * (1 + MIN_HIGHER_LOW_PERCENT);

      if (!higherLow) continue;

      const p2Candidates = highPivots.filter(
        (h) => h.index > p1.index && h.index < p3.index,
      );

      if (p2Candidates.length === 0) continue;

      const p2 = p2Candidates.reduce((max, h) =>
        h.price > max.price ? h : max,
      );

      const current = klines[currentIndex];
      if (!current) continue;

      const breakoutPrice = p2.price * (1 + this.pattern123Config.breakoutThreshold);

      if (getKlineClose(current) > breakoutPrice) {
        const entry = getKlineClose(current);
        const stopLoss = p3.price;
        const riskDistance = entry - stopLoss;
        
        const resistance = this.findNearestResistance(pivots, entry);
        const rrTarget = entry + riskDistance * this.pattern123Config.targetMultiplier;
        const takeProfit = resistance && resistance < rrTarget ? resistance * 0.998 : rrTarget;
        const rr = this.calculateRR(entry, stopLoss, takeProfit);

        const confidence = this.calculateConfidence(p1, p2, p3, current);

        if (!this.meetsMinimumCriteria(confidence, rr)) {
          return null;
        }

        const setup = this.createSetup(
          '123-reversal',
          'LONG',
          klines,
          currentIndex,
          entry,
          stopLoss,
          takeProfit,
          confidence,
          true,
          2,
          {
            p1: { index: p1.index, price: p1.price },
            p2: { index: p2.index, price: p2.price },
            p3: { index: p3.index, price: p3.price },
            breakoutPrice,
          },
        );

        return { setup, confidence };
      }
    }

    return null;
  }

  private detectBearish123(
    klines: Kline[],
    pivots: ReturnType<typeof findPivotPoints>,
    currentIndex: number,
  ): SetupDetectorResult | null {
    const highPivots = pivots.filter((p) => p.type === 'high');
    const lowPivots = pivots.filter((p) => p.type === 'low');

    for (let i = 0; i < highPivots.length - 1; i++) {
      const p1 = highPivots[i];
      const p3 = highPivots[i + 1];

      if (!p1 || !p3) continue;

      const lowerHigh = p3.price < p1.price * (1 - MIN_HIGHER_LOW_PERCENT);

      if (!lowerHigh) continue;

      const p2Candidates = lowPivots.filter(
        (l) => l.index > p1.index && l.index < p3.index,
      );

      if (p2Candidates.length === 0) continue;

      const p2 = p2Candidates.reduce((min, l) =>
        l.price < min.price ? l : min,
      );

      const current = klines[currentIndex];
      if (!current) continue;

      const breakoutPrice = p2.price * (1 - this.pattern123Config.breakoutThreshold);

      if (getKlineClose(current) < breakoutPrice) {
        const entry = getKlineClose(current);
        const stopLoss = p3.price;
        const riskDistance = stopLoss - entry;
        
        const support = this.findNearestSupport(pivots, entry);
        const rrTarget = entry - riskDistance * this.pattern123Config.targetMultiplier;
        const takeProfit = support && support > rrTarget ? support * 1.002 : rrTarget;
        const rr = this.calculateRR(entry, stopLoss, takeProfit);

        const confidence = this.calculateConfidence(p1, p2, p3, current);

        if (!this.meetsMinimumCriteria(confidence, rr)) {
          return null;
        }

        const setup = this.createSetup(
          '123-reversal',
          'SHORT',
          klines,
          currentIndex,
          entry,
          stopLoss,
          takeProfit,
          confidence,
          true,
          2,
          {
            p1: { index: p1.index, price: p1.price },
            p2: { index: p2.index, price: p2.price },
            p3: { index: p3.index, price: p3.price },
            breakoutPrice,
          },
        );

        return { setup, confidence };
      }
    }

    return null;
  }

  private findNearestResistance(pivots: { type: string; price: number }[], currentPrice: number): number | null {
    const resistances = pivots
      .filter((p) => p.type === 'high' && p.price > currentPrice)
      .map((p) => p.price)
      .sort((a, b) => a - b);
    
    return resistances[0] ?? null;
  }

  private findNearestSupport(pivots: { type: string; price: number }[], currentPrice: number): number | null {
    const supports = pivots
      .filter((p) => p.type === 'low' && p.price < currentPrice)
      .map((p) => p.price)
      .sort((a, b) => b - a);
    
    return supports[0] ?? null;
  }

  private calculateConfidence(
    p1: { price: number },
    p2: { price: number },
    p3: { price: number },
    current: Kline,
  ): number {
    const BASE_CONFIDENCE = 65;
    let boost = 0;

    const p1p3Range = Math.abs(p3.price - p1.price);
    const p2Distance = Math.abs(p2.price - (p1.price + p3.price) / 2);
    const symmetry = p2Distance / p1p3Range;

    if (symmetry < 0.1) boost += 10;
    else if (symmetry < 0.2) boost += 5;

    const volumeStrength = getKlineVolume(current);
    if (volumeStrength > 0) boost += 10;

    const klineSize = Math.abs(getKlineClose(current) - getKlineOpen(current)) / getKlineOpen(current);
    if (klineSize > 0.02) boost += 10;
    else if (klineSize > 0.01) boost += 5;

    const MAX_CONFIDENCE = 100;
    return Math.min(BASE_CONFIDENCE + boost, MAX_CONFIDENCE);
  }
}

