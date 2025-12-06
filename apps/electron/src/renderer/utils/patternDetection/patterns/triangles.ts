import type { AIPatternTriangle, Kline } from '@marketmind/types';
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

const findApex = (upperLine: TrendlineData, lowerLine: TrendlineData): { x: number; y: number } | null => {
  if (upperLine.slope === lowerLine.slope) return null;

  const x = (lowerLine.intercept - upperLine.intercept) / (upperLine.slope - lowerLine.slope);
  const y = upperLine.slope * x + upperLine.intercept;

  return { x, y };
};

export const detectAscendingTriangles = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternTriangle[] => {
  if (!klines || klines.length < 20) return [];

  const triangles: AIPatternTriangle[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 2) return [];

  for (let i = 0; i < highPivots.length - 1; i++) {
    for (let j = i + 1; j < highPivots.length; j++) {
      const high1 = highPivots[i];
      const high2 = highPivots[j];

      if (!high1 || !high2) continue;

      const priceDiff = Math.abs(high2.price - high1.price) / high1.price;
      if (priceDiff > 0.02) continue;

      const upperLine = fitTrendline([
        { x: high1.index, y: high1.price },
        { x: high2.index, y: high2.price },
      ]);

      if (Math.abs(upperLine.slope) > 0.001 || upperLine.r2 < 0.9) continue;

      const relevantLows = lowPivots.filter(l => l.index >= high1.index && l.index <= high2.index);
      if (relevantLows.length < 2) continue;

      for (let k = 0; k < relevantLows.length - 1; k++) {
        for (let l = k + 1; l < relevantLows.length; l++) {
          const low1 = relevantLows[k];
          const low2 = relevantLows[l];

          if (!low1 || !low2) continue;
          if (low2.price <= low1.price) continue;

          const lowerLine = fitTrendline([
            { x: low1.index, y: low1.price },
            { x: low2.index, y: low2.price },
          ]);

          if (lowerLine.slope <= 0 || lowerLine.r2 < 0.8) continue;

          const apex = findApex(upperLine, lowerLine);
          if (!apex || apex.x < low2.index) continue;

          const triangleHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const klinesBetween = high2.index - high1.index;

          const touchPointsScore = normalizeTouchPoints(4, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.6,
            timeInPattern: timeScore,
            symmetry: (upperLine.r2 + lowerLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const startDate = new Date(high1.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(high2.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          const apexKline = klines[Math.round(apex.x)];
          const apexTimestamp = apexKline?.openTime || high2.openTime + (high2.openTime - high1.openTime);

          triangles.push({
            id: triangles.length + 1,
            type: 'triangle-ascending',
            upperTrendline: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerTrendline: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            apex: {
              openTime: apexTimestamp,
              price: apex.y,
            },
            label: `Ascending Triangle · ${triangleHeight}% height · Bullish breakout expected · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: high1.openTime,
          });
        }
      }
    }
  }

  return triangles
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectDescendingTriangles = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternTriangle[] => {
  if (!klines || klines.length < 20) return [];

  const triangles: AIPatternTriangle[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 2) return [];

  for (let i = 0; i < lowPivots.length - 1; i++) {
    for (let j = i + 1; j < lowPivots.length; j++) {
      const low1 = lowPivots[i];
      const low2 = lowPivots[j];

      if (!low1 || !low2) continue;

      const priceDiff = Math.abs(low2.price - low1.price) / low1.price;
      if (priceDiff > 0.02) continue;

      const lowerLine = fitTrendline([
        { x: low1.index, y: low1.price },
        { x: low2.index, y: low2.price },
      ]);

      if (Math.abs(lowerLine.slope) > 0.001 || lowerLine.r2 < 0.9) continue;

      const relevantHighs = highPivots.filter(h => h.index >= low1.index && h.index <= low2.index);
      if (relevantHighs.length < 2) continue;

      for (let k = 0; k < relevantHighs.length - 1; k++) {
        for (let l = k + 1; l < relevantHighs.length; l++) {
          const high1 = relevantHighs[k];
          const high2 = relevantHighs[l];

          if (!high1 || !high2) continue;
          if (high2.price >= high1.price) continue;

          const upperLine = fitTrendline([
            { x: high1.index, y: high1.price },
            { x: high2.index, y: high2.price },
          ]);

          if (upperLine.slope >= 0 || upperLine.r2 < 0.8) continue;

          const apex = findApex(upperLine, lowerLine);
          if (!apex || apex.x < high2.index) continue;

          const triangleHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const klinesBetween = low2.index - low1.index;

          const touchPointsScore = normalizeTouchPoints(4, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.6,
            timeInPattern: timeScore,
            symmetry: (upperLine.r2 + lowerLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const startDate = new Date(low1.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(low2.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          const apexKline = klines[Math.round(apex.x)];
          const apexTimestamp = apexKline?.openTime || low2.openTime + (low2.openTime - low1.openTime);

          triangles.push({
            id: triangles.length + 1,
            type: 'triangle-descending',
            upperTrendline: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerTrendline: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            apex: {
              openTime: apexTimestamp,
              price: apex.y,
            },
            label: `Descending Triangle · ${triangleHeight}% height · Bearish breakout expected · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: low1.openTime,
          });
        }
      }
    }
  }

  return triangles
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectSymmetricalTriangles = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternTriangle[] => {
  if (!klines || klines.length < 20) return [];

  const triangles: AIPatternTriangle[] = [];
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
          if (low2.price <= low1.price) continue;

          const lowerLine = fitTrendline([
            { x: low1.index, y: low1.price },
            { x: low2.index, y: low2.price },
          ]);

          if (lowerLine.slope <= 0 || lowerLine.r2 < 0.8) continue;

          const slopeRatio = Math.abs(upperLine.slope) / lowerLine.slope;
          if (slopeRatio < 0.7 || slopeRatio > 1.3) continue;

          const apex = findApex(upperLine, lowerLine);
          if (!apex || apex.x < Math.max(high2.index, low2.index)) continue;

          const triangleHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const klinesBetween = Math.max(high2.index, low2.index) - Math.min(high1.index, low1.index);

          const touchPointsScore = normalizeTouchPoints(4, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.6,
            timeInPattern: timeScore,
            symmetry: (upperLine.r2 + lowerLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const startDate = new Date(Math.min(high1.openTime, low1.openTime)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(Math.max(high2.openTime, low2.openTime)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          const apexKline = klines[Math.round(apex.x)];
          const apexTimestamp = apexKline?.openTime || Math.max(high2.openTime, low2.openTime) + klinesBetween * 60000;

          triangles.push({
            id: triangles.length + 1,
            type: 'triangle-symmetrical',
            upperTrendline: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerTrendline: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            apex: {
              openTime: apexTimestamp,
              price: apex.y,
            },
            label: `Symmetrical Triangle · ${triangleHeight}% height · Breakout direction uncertain · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: Math.min(high1.openTime, low1.openTime),
          });
        }
      }
    }
  }

  return triangles
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
