import type { AIStudyGap, Candle } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
    calculateConfidence,
    normalizeTimeInPattern,
} from '../core/confidenceScoring';
import type { PivotPoint } from '../types';

const detectGapsBase = (
  candles: Candle[],
  _pivots: PivotPoint[],
  type: 'gap-common' | 'gap-breakaway' | 'gap-runaway' | 'gap-exhaustion'
): AIStudyGap[] => {
  if (!candles || candles.length < 10) return [];

  const patterns: AIStudyGap[] = [];

  for (let i = 1; i < candles.length; i++) {
    const prevCandle = candles[i - 1];
    const currentCandle = candles[i];

    if (!prevCandle || !currentCandle) continue;

    const isGapUp = currentCandle.low > prevCandle.high;
    const isGapDown = currentCandle.high < prevCandle.low;

    if (!isGapUp && !isGapDown) continue;

    const gapSize = isGapUp
      ? (currentCandle.low - prevCandle.high) / prevCandle.high
      : (prevCandle.low - currentCandle.high) / currentCandle.high;

    if (gapSize < PATTERN_DETECTION_CONFIG.GAP_MIN_PERCENT / 100) continue;

    const direction = isGapUp ? 'bullish' : 'bearish';

    let confidence = 0.5;
    const patternType = type;

    if (type === 'gap-common') {
      if (gapSize < 0.01 && currentCandle.volume < prevCandle.volume) {
        confidence = 0.6;
      } else {
        continue;
      }
    } else if (type === 'gap-breakaway') {
      const recentHigh = Math.max(...candles.slice(Math.max(0, i - 20), i).map(c => c.high));
      const recentLow = Math.min(...candles.slice(Math.max(0, i - 20), i).map(c => c.low));
      const nearResistance = isGapUp && prevCandle.high >= recentHigh * 0.98;
      const nearSupport = isGapDown && prevCandle.low <= recentLow * 1.02;

      if ((nearResistance || nearSupport) && gapSize > 0.01 && currentCandle.volume > prevCandle.volume) {
        confidence = 0.7;
      } else {
        continue;
      }
    } else if (type === 'gap-runaway') {
      const trend = candles.slice(Math.max(0, i - 10), i);
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
      const lookAhead = candles.slice(i, Math.min(candles.length, i + 5));
      if (lookAhead.length < 3) continue;

      const reversal = isGapUp
        ? lookAhead.every(c => c.close < currentCandle.close)
        : lookAhead.every(c => c.close > currentCandle.close);

      if (reversal && gapSize > 0.015) {
        confidence = 0.7;
      } else {
        continue;
      }
    }

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const timeScore = normalizeTimeInPattern(
      5,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    confidence = calculateConfidence({
      touchPoints: 0.6,
      volumeConfirmation: 0.5,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    const confidencePercent = Math.round(confidence * 100);
    const gapPercent = (gapSize * 100).toFixed(2);

    const gapStart = isGapUp ? prevCandle.high : prevCandle.low;
    const gapEnd = isGapUp ? currentCandle.low : currentCandle.high;

    patterns.push({
      id: patterns.length + 1,
      type: patternType,
      gapStart: { timestamp: prevCandle.timestamp, price: gapStart },
      gapEnd: { timestamp: currentCandle.timestamp, price: gapEnd },
      direction,
      label: `${getGapLabel(patternType)} · ${gapPercent}% gap · ${direction === 'bullish' ? '↑' : '↓'} · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: currentCandle.timestamp,
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
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyGap[] => {
  return detectGapsBase(candles, pivots, 'gap-common');
};

export const detectBreakawayGaps = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyGap[] => {
  return detectGapsBase(candles, pivots, 'gap-breakaway');
};

export const detectRunawayGaps = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyGap[] => {
  return detectGapsBase(candles, pivots, 'gap-runaway');
};

export const detectExhaustionGaps = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyGap[] => {
  return detectGapsBase(candles, pivots, 'gap-exhaustion');
};
