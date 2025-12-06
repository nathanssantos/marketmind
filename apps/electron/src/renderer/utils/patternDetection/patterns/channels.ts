import type { AIPatternChannel, Kline } from '@marketmind/types';
import { getKlineClose } from '@shared/utils';
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

export const detectAscendingChannels = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternChannel[] => {
  if (!klines || klines.length < 20) return [];

  const channels: AIPatternChannel[] = [];
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

      const candidateHighs = highPivots.filter(h => h.index >= low1.index && h.index <= low2.index);
      if (candidateHighs.length < 2) continue;

      for (let k = 0; k < candidateHighs.length - 1; k++) {
        for (let l = k + 1; l < candidateHighs.length; l++) {
          const high1 = candidateHighs[k];
          const high2 = candidateHighs[l];

          if (!high1 || !high2) continue;
          if (high2.price <= high1.price) continue;

          const upperLine = fitTrendline([
            { x: high1.index, y: high1.price },
            { x: high2.index, y: high2.price },
          ]);

          if (upperLine.slope <= 0 || upperLine.r2 < 0.8) continue;

          const slopeDiff = Math.abs(upperLine.slope - lowerLine.slope);
          const avgSlope = (upperLine.slope + lowerLine.slope) / 2;
          const parallelScore = 1 - Math.min(slopeDiff / avgSlope, 1);

          if (parallelScore < 0.7) continue;

          const channelWidth = Math.abs(high1.price - low1.price);
          const lastKline = klines[klines.length - 1];
          const priceRange = lastKline ? getKlineClose(lastKline) : 1;
          if (channelWidth / priceRange < 0.02) continue;

          const touches = 4;
          const klinesBetween = low2.index - low1.index;

          const touchPointsScore = normalizeTouchPoints(touches, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.5,
            timeInPattern: timeScore,
            symmetry: (lowerLine.r2 + upperLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const channelHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const startDate = new Date(low1.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(low2.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          channels.push({
            id: channels.length + 1,
            type: 'channel-ascending',
            upperLine: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerLine: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            label: `Ascending Channel · ${channelHeight}% height · ${lowerLine.angle.toFixed(1)}° angle · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: low1.openTime,
          });
        }
      }
    }
  }

  return channels
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectDescendingChannels = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternChannel[] => {
  if (!klines || klines.length < 20) return [];

  const channels: AIPatternChannel[] = [];
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

      const candidateLows = lowPivots.filter(l => l.index >= high1.index && l.index <= high2.index);
      if (candidateLows.length < 2) continue;

      for (let k = 0; k < candidateLows.length - 1; k++) {
        for (let l = k + 1; l < candidateLows.length; l++) {
          const low1 = candidateLows[k];
          const low2 = candidateLows[l];

          if (!low1 || !low2) continue;
          if (low2.price >= low1.price) continue;

          const lowerLine = fitTrendline([
            { x: low1.index, y: low1.price },
            { x: low2.index, y: low2.price },
          ]);

          if (lowerLine.slope >= 0 || lowerLine.r2 < 0.8) continue;

          const slopeDiff = Math.abs(upperLine.slope - lowerLine.slope);
          const avgSlope = Math.abs((upperLine.slope + lowerLine.slope) / 2);
          const parallelScore = 1 - Math.min(slopeDiff / avgSlope, 1);

          if (parallelScore < 0.7) continue;

          const channelWidth = Math.abs(high1.price - low1.price);
          const lastKline = klines[klines.length - 1];
          const priceRange = lastKline ? getKlineClose(lastKline) : 1;
          if (channelWidth / priceRange < 0.02) continue;

          const touches = 4;
          const klinesBetween = high2.index - high1.index;

          const touchPointsScore = normalizeTouchPoints(touches, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.5,
            timeInPattern: timeScore,
            symmetry: (lowerLine.r2 + upperLine.r2) / 2,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const channelHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const startDate = new Date(high1.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(high2.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          channels.push({
            id: channels.length + 1,
            type: 'channel-descending',
            upperLine: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerLine: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            label: `Descending Channel · ${channelHeight}% height · ${Math.abs(upperLine.angle).toFixed(1)}° angle · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: high1.openTime,
          });
        }
      }
    }
  }

  return channels
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectHorizontalChannels = (
  klines: Kline[],
  pivots: PivotPoint[]
): AIPatternChannel[] => {
  if (!klines || klines.length < 20) return [];

  const channels: AIPatternChannel[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 2) return [];

  for (let i = 0; i < lowPivots.length - 1; i++) {
    for (let j = i + 1; j < lowPivots.length; j++) {
      const low1 = lowPivots[i];
      const low2 = lowPivots[j];

      if (!low1 || !low2) continue;

      const lowDiff = Math.abs(low2.price - low1.price) / low1.price;
      if (lowDiff > 0.02) continue;

      const candidateHighs = highPivots.filter(h => h.index >= low1.index && h.index <= low2.index);
      if (candidateHighs.length < 2) continue;

      for (let k = 0; k < candidateHighs.length - 1; k++) {
        for (let l = k + 1; l < candidateHighs.length; l++) {
          const high1 = candidateHighs[k];
          const high2 = candidateHighs[l];

          if (!high1 || !high2) continue;

          const highDiff = Math.abs(high2.price - high1.price) / high1.price;
          if (highDiff > 0.02) continue;

          const channelWidth = Math.abs(high1.price - low1.price);
          const lastKline = klines[klines.length - 1];
          const priceRange = lastKline ? getKlineClose(lastKline) : 1;
          if (channelWidth / priceRange < 0.02) continue;

          const touches = 4;
          const klinesBetween = low2.index - low1.index;

          if (klinesBetween < PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES) continue;

          const touchPointsScore = normalizeTouchPoints(touches, 6);
          const timeScore = normalizeTimeInPattern(
            klinesBetween,
            PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_KLINES,
            PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_KLINES
          );

          const symmetryScore = 1 - Math.min((lowDiff + highDiff) / 0.04, 1);

          const confidence = calculateConfidence({
            touchPoints: touchPointsScore,
            volumeConfirmation: 0.5,
            timeInPattern: timeScore,
            symmetry: symmetryScore,
          });

          if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

          const channelHeight = ((high1.price - low1.price) / low1.price * 100).toFixed(1);
          const startDate = new Date(low1.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const endDate = new Date(low2.openTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const confidencePercent = Math.round(confidence * 100);

          channels.push({
            id: channels.length + 1,
            type: 'channel-horizontal',
            upperLine: [
              { openTime: high1.openTime, price: high1.price },
              { openTime: high2.openTime, price: high2.price },
            ],
            lowerLine: [
              { openTime: low1.openTime, price: low1.price },
              { openTime: low2.openTime, price: low2.price },
            ],
            label: `Horizontal Channel · ${channelHeight}% range · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
            confidence,
            visible: true,
            openTime: low1.openTime,
          });
        }
      }
    }
  }

  return channels
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
