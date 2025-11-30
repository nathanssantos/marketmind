import type { AIPatternWedge, Kline } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
    calculateConfidence,
    normalizeTimeInPattern,
    normalizeTouchPoints,
} from '../core/confidenceScoring';
import type { PivotPoint, Point, TrendlineData } from '../types';

const fitTrendline = (points: Point[]): TrendlineData => {
  if (points.length < 2) {
    return {
      slope: 0,
      intercept: 0,
      r2: 0,
      points: [],
      angle: 0,
    };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumXX += point.x * point.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  let ssRes = 0;
  let ssTot = 0;
  const meanY = sumY / n;

  for (const point of points) {
    const predicted = slope * point.x + intercept;
    ssRes += (point.y - predicted) ** 2;
    ssTot += (point.y - meanY) ** 2;
  }

  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
  const angle = Math.atan(slope) * (180 / Math.PI);

  return {
    slope,
    intercept,
    r2,
    points: [],
    angle,
  };
};

const findConvergence = (upperLine: TrendlineData, lowerLine: TrendlineData): { x: number; y: number } | null => {
  if (upperLine.slope === lowerLine.slope) return null;

  const x = (lowerLine.intercept - upperLine.intercept) / (upperLine.slope - lowerLine.slope);
  const y = upperLine.slope * x + upperLine.intercept;

  return { x, y };
};

export const detectRisingWedges = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternWedge[] => {
  if (!candles || candles.length < 20) return [];

  const wedges: AIPatternWedge[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 2) return [];

  for (let i = 0; i < lowPivots.length - 1; i++) {
    for (let j = i + 1; j < lowPivots.length; j++) {
      const low1 = lowPivots[i];
      const low2 = lowPivots[j];

      if (!low1 || !low2) continue;
      if (low2.price <= low1.price) continue;

      const lowerLine = fitTrendline([
        { x: low1.index, y: low1.price },
        { x: low2.index, y: low2.price },
      ]);

      if (lowerLine.slope <= 0 || lowerLine.r2 < 0.8) continue;

      const relevantHighs = highPivots.filter(h => h.index >= low1.index && h.index <= low2.index);
      if (relevantHighs.length < 2) continue;

      for (let k = 0; k < relevantHighs.length - 1; k++) {
        for (let l = k + 1; l < relevantHighs.length; l++) {
          const high1 = relevantHighs[k];
          const high2 = relevantHighs[l];

          if (!high1 || !high2) continue;
          if (high2.price <= high1.price) continue;

          const upperLine = fitTrendline([
            { x: high1.index, y: high1.price },
            { x: high2.index, y: high2.price },
          ]);

          if (upperLine.slope <= 0 || upperLine.r2 < 0.8) continue;
          if (upperLine.slope >= lowerLine.slope) continue;

          const convergence = findConvergence(upperLine, lowerLine);
          if (!convergence || convergence.x < high2.index) continue;

          const wedgeHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const candlesBetween = high2.index - low1.index;

          const touchPointsScore = normalizeTouchPoints(4, 6);
          const timeScore = normalizeTimeInPattern(
            candlesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
          );

          let context: 'uptrend' | 'downtrend' = 'uptrend';
          if (i > 0) {
            const prevLow = lowPivots[i - 1];
            if (prevLow && low1.price < prevLow.price) {
              context = 'downtrend';
            }
          }

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.5,
            timeInPattern: timeScore,
            symmetry: (upperLine.r2 + lowerLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const startDate = new Date(low1.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(high2.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          const convergenceCandle = candles[Math.round(convergence.x)];
          const convergenceTimestamp = convergenceCandle?.timestamp || high2.timestamp + (high2.timestamp - low1.timestamp);

          const bias = context === 'uptrend' ? 'Bearish reversal likely' : 'Continuation pattern';

          wedges.push({
            id: wedges.length + 1,
            type: 'wedge-rising',
            upperTrendline: [
              { timestamp: high1.timestamp, price: high1.price },
              { timestamp: high2.timestamp, price: high2.price },
            ],
            lowerTrendline: [
              { timestamp: low1.timestamp, price: low1.price },
              { timestamp: low2.timestamp, price: low2.price },
            ],
            convergencePoint: {
              timestamp: convergenceTimestamp,
              price: convergence.y,
            },
            context,
            label: `Rising Wedge · ${wedgeHeight}% height · ${bias} · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            timestamp: low1.timestamp,
          });
        }
      }
    }
  }

  return wedges
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectFallingWedges = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternWedge[] => {
  if (!candles || candles.length < 20) return [];

  const wedges: AIPatternWedge[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 2) return [];

  for (let i = 0; i < highPivots.length - 1; i++) {
    for (let j = i + 1; j < highPivots.length; j++) {
      const high1 = highPivots[i];
      const high2 = highPivots[j];

      if (!high1 || !high2) continue;
      if (high2.price >= high1.price) continue;

      const upperLine = fitTrendline([
        { x: high1.index, y: high1.price },
        { x: high2.index, y: high2.price },
      ]);

      if (upperLine.slope >= 0 || upperLine.r2 < 0.8) continue;

      const relevantLows = lowPivots.filter(l => l.index >= high1.index && l.index <= high2.index);
      if (relevantLows.length < 2) continue;

      for (let k = 0; k < relevantLows.length - 1; k++) {
        for (let l = k + 1; l < relevantLows.length; l++) {
          const low1 = relevantLows[k];
          const low2 = relevantLows[l];

          if (!low1 || !low2) continue;
          if (low2.price >= low1.price) continue;

          const lowerLine = fitTrendline([
            { x: low1.index, y: low1.price },
            { x: low2.index, y: low2.price },
          ]);

          if (lowerLine.slope >= 0 || lowerLine.r2 < 0.8) continue;
          if (lowerLine.slope <= upperLine.slope) continue;

          const convergence = findConvergence(upperLine, lowerLine);
          if (!convergence || convergence.x < low2.index) continue;

          const wedgeHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const candlesBetween = low2.index - high1.index;

          const touchPointsScore = normalizeTouchPoints(4, 6);
          const timeScore = normalizeTimeInPattern(
            candlesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
          );

          let context: 'uptrend' | 'downtrend' = 'downtrend';
          if (i > 0) {
            const prevHigh = highPivots[i - 1];
            if (prevHigh && high1.price > prevHigh.price) {
              context = 'uptrend';
            }
          }

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.5,
            timeInPattern: timeScore,
            symmetry: (upperLine.r2 + lowerLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const startDate = new Date(high1.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(low2.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          const convergenceCandle = candles[Math.round(convergence.x)];
          const convergenceTimestamp = convergenceCandle?.timestamp || low2.timestamp + (low2.timestamp - high1.timestamp);

          const bias = context === 'downtrend' ? 'Bullish reversal likely' : 'Continuation pattern';

          wedges.push({
            id: wedges.length + 1,
            type: 'wedge-falling',
            upperTrendline: [
              { timestamp: high1.timestamp, price: high1.price },
              { timestamp: high2.timestamp, price: high2.price },
            ],
            lowerTrendline: [
              { timestamp: low1.timestamp, price: low1.price },
              { timestamp: low2.timestamp, price: low2.price },
            ],
            convergencePoint: {
              timestamp: convergenceTimestamp,
              price: convergence.y,
            },
            context,
            label: `Falling Wedge · ${wedgeHeight}% height · ${bias} · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            timestamp: high1.timestamp,
          });
        }
      }
    }
  }

  return wedges
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
