import type { AIPatternGap, Kline } from '@shared/types';
import { getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
    calculateConfidence,
    normalizeTimeInPattern,
} from '../core/confidenceScoring';
import type { PivotPoint } from '../types';

const detectGapsBase = (
  klines: Kline[],
  _pivots: PivotPoint[],
  type: 'gap-common' | 'gap-breakaway' | 'gap-runaway' | 'gap-exhaustion'
): AIPatternGap[] => {
  if (!klines || klines.length < 10) return [];

  const patterns: AIPatternGap[] = [];

  for (let i = 1; i < klines.length; i++) {
    const prevKline = klines[i - 1];
    const currentKline = klines[i];

    if (!prevKline || !currentKline) continue;

    const isGapUp = getKlineLow(currentKline) > getKlineHigh(prevKline);
    const isGapDown = getKlineHigh(currentKline) < getKlineLow(prevKline);

    if (!isGapUp && !isGapDown) continue;

    const gapSize = isGapUp
      ? (getKlineLow(currentKline) - getKlineHigh(prevKline)) / getKlineHigh(prevKline)
      : (getKlineLow(prevKline) - getKlineHigh(currentKline)) / getKlineHigh(currentKline);

    if (gapSize < PATTERN_DETECTION_CONFIG.GAP_MIN_PERCENT / 100) continue;

    const direction = isGapUp ? 'bullish' : 'bearish';

    let confidence = 0.5;
    const patternType = type;

    if (type === 'gap-common') {
      if (gapSize < 0.01 && getKlineVolume(currentKline) < getKlineVolume(prevKline)) {
        confidence = 0.6;
      } else {
        continue;
      }
    } else if (type === 'gap-breakaway') {
      const recentHigh = Math.max(...klines.slice(Math.max(0, i - 20), i).map(c => getKlineHigh(c)));
      const recentLow = Math.min(...klines.slice(Math.max(0, i - 20), i).map(c => getKlineLow(c)));
      const nearResistance = isGapUp && getKlineHigh(prevKline) >= recentHigh * 0.98;
      const nearSupport = isGapDown && getKlineLow(prevKline) <= recentLow * 1.02;

      if ((nearResistance || nearSupport) && gapSize > 0.01 && getKlineVolume(currentKline) > getKlineVolume(prevKline)) {
        confidence = 0.7;
      } else {
        continue;
      }
    } else if (type === 'gap-runaway') {
      const trend = klines.slice(Math.max(0, i - 10), i);
      const trendDirection = trend[trend.length - 1]!.close > trend[0]!.close ? 'up' : 'down';

      if ((trendDirection === 'up' && isGapUp) || (trendDirection === 'down' && isGapDown)) {
        if (gapSize > 0.01) {
          confidence = 0.65;
        } else {
          continue;
        }
      } else {
        continue;
      }
    } else if (type === 'gap-exhaustion') {
      const lookAhead = klines.slice(i, Math.min(klines.length, i + 5));
      if (lookAhead.length < 3) continue;

      const reversal = isGapUp
        ? lookAhead.every(c => c.close < currentKline.close)
        : lookAhead.every(c => c.close > currentKline.close);

      if (reversal && gapSize > 0.015) {
        confidence = 0.7;
      } else {
        continue;
      }
    }

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const timeScore = normalizeTimeInPattern(
      5,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
    );

    confidence = calculateConfidence({
      touchPoints: 0.6,
      volumeConfirmation: 0.5,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    const confidencePercent = Math.round(confidence * 100);
    const gapPercent = (gapSize * 100).toFixed(2);

    const gapStart = isGapUp ? getKlineHigh(prevKline) : getKlineLow(prevKline);
    const gapEnd = isGapUp ? getKlineLow(currentKline) : getKlineHigh(currentKline);

    patterns.push({
      id: patterns.length + 1,
      type: patternType,
      gapStart: { openTime: prevKline.openTime, price: gapStart },
      gapEnd: { openTime: currentKline.openTime, price: gapEnd },
      direction,
      label: `${getGapLabel(patternType)} · ${gapPercent}% gap · ${direction === 'bullish' ? '↑' : '↓'} · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      openTime: currentKline.openTime,
    });
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

const getGapLabel = (type: string): string => {
  switch (type) {
    case 'gap-common':
      return 'Common Gap';
    case 'gap-breakaway':
      return 'Breakaway Gap';
    case 'gap-runaway':
      return 'Runaway Gap';
    case 'gap-exhaustion':
      return 'Exhaustion Gap';
    default:
      return 'Gap';
  }
};

export const detectCommonGaps = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternGap[] => {
  return detectGapsBase(klines, pivots, 'gap-common');
};

export const detectBreakawayGaps = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternGap[] => {
  return detectGapsBase(klines, pivots, 'gap-breakaway');
};

export const detectRunawayGaps = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternGap[] => {
  return detectGapsBase(klines, pivots, 'gap-runaway');
};

export const detectExhaustionGaps = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternGap[] => {
  return detectGapsBase(klines, pivots, 'gap-exhaustion');
};
