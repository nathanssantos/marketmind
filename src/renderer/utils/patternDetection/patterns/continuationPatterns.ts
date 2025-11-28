import type { AIPatternCupAndHandle, AIPatternFlag, AIPatternPennant, AIPatternRoundingBottom, Candle } from '@shared/types';
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

export const detectBullishFlags = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternFlag[] => {
  if (!candles || candles.length < 20) return [];

  const patterns: AIPatternFlag[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 4 || highPivots.length < 4) return [];

  for (let i = 0; i < lowPivots.length - 3; i++) {
    const poleStart = lowPivots[i];
    if (!poleStart) continue;

    for (let j = i + 1; j < highPivots.length; j++) {
      const poleEnd = highPivots[j];
      if (!poleEnd || poleEnd.index <= poleStart.index) continue;

      const poleHeight = (poleEnd.price - poleStart.price) / poleStart.price;
      if (poleHeight < 0.05) continue;

      const poleCandles = poleEnd.index - poleStart.index;
      if (poleCandles < 5 || poleCandles > 20) continue;

      const flagPivots = [...highPivots, ...lowPivots]
        .filter(p => p.index > poleEnd.index && p.index < poleEnd.index + 30)
        .sort((a, b) => a.index - b.index);

      if (flagPivots.length < 4) continue;

      const flagHighs = flagPivots.filter(p => p.type === 'high').slice(0, 2);
      const flagLows = flagPivots.filter(p => p.type === 'low').slice(0, 2);

      if (flagHighs.length < 2 || flagLows.length < 2) continue;

      const upperLine = fitTrendline([
        { x: flagHighs[0]!.index, y: flagHighs[0]!.price },
        { x: flagHighs[1]!.index, y: flagHighs[1]!.price },
      ]);

      const lowerLine = fitTrendline([
        { x: flagLows[0]!.index, y: flagLows[0]!.price },
        { x: flagLows[1]!.index, y: flagLows[1]!.price },
      ]);

      if (upperLine.slope >= 0 || lowerLine.slope >= 0) continue;
      if (upperLine.r2 < 0.7 || lowerLine.r2 < 0.7) continue;

      const slopeDiff = Math.abs(upperLine.slope - lowerLine.slope);
      const avgSlope = Math.abs((upperLine.slope + lowerLine.slope) / 2);
      const parallelScore = 1 - Math.min(slopeDiff / avgSlope, 1);

      if (parallelScore < 0.6) continue;

      const totalCandles = flagLows[1]!.index - poleStart.index;

      const touchPointsScore = normalizeTouchPoints(6, 8);
      const timeScore = normalizeTimeInPattern(
        totalCandles,
        PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
        PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
      );

      const confidence = calculateConfidence({
        touchPoints: touchPointsScore,
        volumeConfirmation: 0.6,
        timeInPattern: timeScore,
        symmetry: parallelScore,
      });

      if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

      const confidencePercent = Math.round(confidence * 100);
      const heightPercent = (poleHeight * 100).toFixed(1);

      patterns.push({
        id: patterns.length + 1,
        type: 'flag-bullish',
        flagpole: {
          start: { timestamp: poleStart.timestamp, price: poleStart.price },
          end: { timestamp: poleEnd.timestamp, price: poleEnd.price },
        },
        flag: {
          upperTrendline: [
            { timestamp: flagHighs[0]!.timestamp, price: flagHighs[0]!.price },
            { timestamp: flagHighs[1]!.timestamp, price: flagHighs[1]!.price },
          ],
          lowerTrendline: [
            { timestamp: flagLows[0]!.timestamp, price: flagLows[0]!.price },
            { timestamp: flagLows[1]!.timestamp, price: flagLows[1]!.price },
          ],
        },
        label: `Bullish Flag · ${heightPercent}% pole · ${confidencePercent}% confidence`,
        confidence,
        visible: true,
        timestamp: poleStart.timestamp,
      });

      break;
    }
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectBearishFlags = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternFlag[] => {
  if (!candles || candles.length < 20) return [];

  const patterns: AIPatternFlag[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 4 || highPivots.length < 4) return [];

  for (let i = 0; i < highPivots.length - 3; i++) {
    const poleStart = highPivots[i];
    if (!poleStart) continue;

    for (let j = i + 1; j < lowPivots.length; j++) {
      const poleEnd = lowPivots[j];
      if (!poleEnd || poleEnd.index <= poleStart.index) continue;

      const poleHeight = (poleStart.price - poleEnd.price) / poleEnd.price;
      if (poleHeight < 0.05) continue;

      const poleCandles = poleEnd.index - poleStart.index;
      if (poleCandles < 5 || poleCandles > 20) continue;

      const flagPivots = [...highPivots, ...lowPivots]
        .filter(p => p.index > poleEnd.index && p.index < poleEnd.index + 30)
        .sort((a, b) => a.index - b.index);

      if (flagPivots.length < 4) continue;

      const flagHighs = flagPivots.filter(p => p.type === 'high').slice(0, 2);
      const flagLows = flagPivots.filter(p => p.type === 'low').slice(0, 2);

      if (flagHighs.length < 2 || flagLows.length < 2) continue;

      const upperLine = fitTrendline([
        { x: flagHighs[0]!.index, y: flagHighs[0]!.price },
        { x: flagHighs[1]!.index, y: flagHighs[1]!.price },
      ]);

      const lowerLine = fitTrendline([
        { x: flagLows[0]!.index, y: flagLows[0]!.price },
        { x: flagLows[1]!.index, y: flagLows[1]!.price },
      ]);

      if (upperLine.slope <= 0 || lowerLine.slope <= 0) continue;
      if (upperLine.r2 < 0.7 || lowerLine.r2 < 0.7) continue;

      const slopeDiff = Math.abs(upperLine.slope - lowerLine.slope);
      const avgSlope = (upperLine.slope + lowerLine.slope) / 2;
      const parallelScore = 1 - Math.min(slopeDiff / avgSlope, 1);

      if (parallelScore < 0.6) continue;

      const totalCandles = flagLows[1]!.index - poleStart.index;

      const touchPointsScore = normalizeTouchPoints(6, 8);
      const timeScore = normalizeTimeInPattern(
        totalCandles,
        PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
        PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
      );

      const confidence = calculateConfidence({
        touchPoints: touchPointsScore,
        volumeConfirmation: 0.6,
        timeInPattern: timeScore,
        symmetry: parallelScore,
      });

      if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

      const confidencePercent = Math.round(confidence * 100);
      const heightPercent = (poleHeight * 100).toFixed(1);

      patterns.push({
        id: patterns.length + 1,
        type: 'flag-bearish',
        flagpole: {
          start: { timestamp: poleStart.timestamp, price: poleStart.price },
          end: { timestamp: poleEnd.timestamp, price: poleEnd.price },
        },
        flag: {
          upperTrendline: [
            { timestamp: flagHighs[0]!.timestamp, price: flagHighs[0]!.price },
            { timestamp: flagHighs[1]!.timestamp, price: flagHighs[1]!.price },
          ],
          lowerTrendline: [
            { timestamp: flagLows[0]!.timestamp, price: flagLows[0]!.price },
            { timestamp: flagLows[1]!.timestamp, price: flagLows[1]!.price },
          ],
        },
        label: `Bearish Flag · ${heightPercent}% pole · ${confidencePercent}% confidence`,
        confidence,
        visible: true,
        timestamp: poleStart.timestamp,
      });

      break;
    }
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectPennants = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternPennant[] => {
  if (!candles || candles.length < 20) return [];

  const patterns: AIPatternPennant[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 4 || highPivots.length < 4) return [];

  for (let i = 0; i < lowPivots.length - 3; i++) {
    const poleStart = lowPivots[i];
    if (!poleStart) continue;

    for (let j = i + 1; j < highPivots.length; j++) {
      const poleEnd = highPivots[j];
      if (!poleEnd || poleEnd.index <= poleStart.index) continue;

      const poleHeight = (poleEnd.price - poleStart.price) / poleStart.price;
      if (poleHeight < 0.05) continue;

      const pennantPivots = [...highPivots, ...lowPivots]
        .filter(p => p.index > poleEnd.index && p.index < poleEnd.index + 30)
        .sort((a, b) => a.index - b.index);

      if (pennantPivots.length < 4) continue;

      const pennantHighs = pennantPivots.filter(p => p.type === 'high').slice(0, 2);
      const pennantLows = pennantPivots.filter(p => p.type === 'low').slice(0, 2);

      if (pennantHighs.length < 2 || pennantLows.length < 2) continue;

      const upperLine = fitTrendline([
        { x: pennantHighs[0]!.index, y: pennantHighs[0]!.price },
        { x: pennantHighs[1]!.index, y: pennantHighs[1]!.price },
      ]);

      const lowerLine = fitTrendline([
        { x: pennantLows[0]!.index, y: pennantLows[0]!.price },
        { x: pennantLows[1]!.index, y: pennantLows[1]!.price },
      ]);

      if (upperLine.slope >= 0 || lowerLine.slope <= 0) continue;
      if (upperLine.r2 < 0.7 || lowerLine.r2 < 0.7) continue;

      const convergence = Math.abs(upperLine.slope) + Math.abs(lowerLine.slope);
      if (convergence < 0.001) continue;

      const totalCandles = pennantLows[1]!.index - poleStart.index;

      const touchPointsScore = normalizeTouchPoints(6, 8);
      const timeScore = normalizeTimeInPattern(
        totalCandles,
        PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
        PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
      );

      const confidence = calculateConfidence({
        touchPoints: touchPointsScore,
        volumeConfirmation: 0.6,
        timeInPattern: timeScore,
        symmetry: 0.75,
      });

      if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

      const confidencePercent = Math.round(confidence * 100);
      const heightPercent = (poleHeight * 100).toFixed(1);

      patterns.push({
        id: patterns.length + 1,
        type: 'pennant',
        flagpole: {
          start: { timestamp: poleStart.timestamp, price: poleStart.price },
          end: { timestamp: poleEnd.timestamp, price: poleEnd.price },
        },
        pennant: {
          upperTrendline: [
            { timestamp: pennantHighs[0]!.timestamp, price: pennantHighs[0]!.price },
            { timestamp: pennantHighs[1]!.timestamp, price: pennantHighs[1]!.price },
          ],
          lowerTrendline: [
            { timestamp: pennantLows[0]!.timestamp, price: pennantLows[0]!.price },
            { timestamp: pennantLows[1]!.timestamp, price: pennantLows[1]!.price },
          ],
        },
        direction: 'bullish',
        label: `Pennant (Bullish) · ${heightPercent}% pole · ${confidencePercent}% confidence`,
        confidence,
        visible: true,
        timestamp: poleStart.timestamp,
      });

      break;
    }
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectCupAndHandle = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternCupAndHandle[] => {
  if (!candles || candles.length < 40) return [];

  const patterns: AIPatternCupAndHandle[] = [];
  const allPivots = [...pivots].sort((a, b) => a.index - b.index);

  if (allPivots.length < 6) return [];

  for (let i = 0; i < allPivots.length - 5; i++) {
    const cupStart = allPivots[i];
    if (cupStart?.type !== 'high') continue;

    let cupBottom: PivotPoint | undefined;
    let cupEnd: PivotPoint | undefined;

    for (let j = i + 1; j < allPivots.length - 3; j++) {
      const candidate = allPivots[j];
      if (candidate?.type !== 'low') continue;

      if (!cupBottom || candidate.price < cupBottom.price) {
        cupBottom = candidate;
      }
    }

    if (!cupBottom) continue;

    for (let j = cupBottom.index + 1; j < allPivots.length - 2; j++) {
      const candidate = allPivots.find(p => p.index > cupBottom.index && p.type === 'high');
      if (!candidate) break;

      const priceDiff = Math.abs(candidate.price - cupStart.price) / cupStart.price;
      if (priceDiff < 0.05) {
        cupEnd = candidate;
        break;
      }
    }

    if (!cupEnd) continue;

    const cupDepth = (cupStart.price - cupBottom.price) / cupBottom.price;
    if (cupDepth < 0.03) continue;

    const handlePivots = allPivots.filter(p => p.index > cupEnd.index && p.index < cupEnd.index + 15);
    if (handlePivots.length < 3) continue;

    const handleStart = handlePivots.find(p => p.type === 'high');
    const handleLow = handlePivots.find(p => p.type === 'low');
    const handleEnd = handlePivots.reverse().find(p => p.type === 'high');

    if (!handleStart || !handleLow || !handleEnd) continue;

    const handleDepth = (handleStart.price - handleLow.price) / handleLow.price;
    if (handleDepth > cupDepth * 0.5) continue;

    const totalCandles = handleEnd.index - cupStart.index;

    const touchPointsScore = normalizeTouchPoints(6, 8);
    const timeScore = normalizeTimeInPattern(
      totalCandles,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 3,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES * 2
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.65,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);
    const depthPercent = (cupDepth * 100).toFixed(1);

    patterns.push({
      id: patterns.length + 1,
      type: 'cup-and-handle',
      cupStart: { timestamp: cupStart.timestamp, price: cupStart.price },
      cupBottom: { timestamp: cupBottom.timestamp, price: cupBottom.price },
      cupEnd: { timestamp: cupEnd.timestamp, price: cupEnd.price },
      handleStart: { timestamp: handleStart.timestamp, price: handleStart.price },
      handleLow: { timestamp: handleLow.timestamp, price: handleLow.price },
      handleEnd: { timestamp: handleEnd.timestamp, price: handleEnd.price },
      label: `Cup & Handle (Bullish) · ${depthPercent}% depth · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: cupStart.timestamp,
    });

    break;
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectRoundingBottom = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternRoundingBottom[] => {
  if (!candles || candles.length < 30) return [];

  const patterns: AIPatternRoundingBottom[] = [];
  const allPivots = [...pivots].sort((a, b) => a.index - b.index);

  if (allPivots.length < 3) return [];

  for (let i = 0; i < allPivots.length - 2; i++) {
    const start = allPivots[i];
    if (!start) continue;

    let bottom: PivotPoint | undefined;

    for (let j = i + 1; j < allPivots.length - 1; j++) {
      const candidate = allPivots[j];
      if (candidate?.type !== 'low') continue;

      if (!bottom || candidate.price < bottom.price) {
        bottom = candidate;
      }
    }

    if (!bottom) continue;

    const end = allPivots.find(p => p.index > bottom.index && p.type === 'high');
    if (!end) continue;

    const startEndDiff = Math.abs(end.price - start.price) / start.price;
    if (startEndDiff > 0.05) continue;

    const depth = (start.price - bottom.price) / bottom.price;
    if (depth < 0.03) continue;

    const totalCandles = end.index - start.index;
    if (totalCandles < 15) continue;

    const touchPointsScore = normalizeTouchPoints(3, 5);
    const timeScore = normalizeTimeInPattern(
      totalCandles,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 2,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.6,
      timeInPattern: timeScore,
      symmetry: 0.75,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);
    const depthPercent = (depth * 100).toFixed(1);

    patterns.push({
      id: patterns.length + 1,
      type: 'rounding-bottom',
      start: { timestamp: start.timestamp, price: start.price },
      bottom: { timestamp: bottom.timestamp, price: bottom.price },
      end: { timestamp: end.timestamp, price: end.price },
      label: `Rounding Bottom (Bullish) · ${depthPercent}% depth · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: start.timestamp,
    });

    break;
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
