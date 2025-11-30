import type { AIPatternDoublePattern, AIPatternHeadAndShoulders, AIPatternTriplePattern, Kline } from '@shared/types';
import { getKlineClose, getKlineOpen, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
    calculateConfidence,
    normalizeTimeInPattern,
    normalizeTouchPoints,
} from '../core/confidenceScoring';
import type { PivotPoint } from '../types';

export const detectHeadAndShoulders = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternHeadAndShoulders[] => {
  if (!candles || candles.length < 20) return [];

  const patterns: AIPatternHeadAndShoulders[] = [];
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);

  if (highPivots.length < 3 || lowPivots.length < 2) return [];

  for (let i = 0; i < highPivots.length - 2; i++) {
    const leftShoulder = highPivots[i];
    const head = highPivots[i + 1];
    const rightShoulder = highPivots[i + 2];

    if (!leftShoulder || !head || !rightShoulder) continue;

    if (head.price <= leftShoulder.price || head.price <= rightShoulder.price) continue;

    const shoulderDiff = Math.abs(rightShoulder.price - leftShoulder.price) / leftShoulder.price;
    if (shoulderDiff > 0.05) continue;

    const headHeight = (head.price - leftShoulder.price) / leftShoulder.price;
    if (headHeight < 0.02) continue;

    const lowsBetween = lowPivots.filter(l => l.index > leftShoulder.index && l.index < rightShoulder.index);
    if (lowsBetween.length < 2) continue;

    const neckLow1 = lowsBetween.find(l => l.index < head.index);
    const neckLow2 = lowsBetween.find(l => l.index > head.index);

    if (!neckLow1 || !neckLow2) continue;

    const necklineDiff = Math.abs(neckLow2.price - neckLow1.price) / neckLow1.price;
    if (necklineDiff > 0.03) continue;

    const patternHeight = ((head.price - neckLow1.price) / neckLow1.price * 100).toFixed(1);
    const candlesBetween = rightShoulder.index - leftShoulder.index;

    const touchPointsScore = normalizeTouchPoints(5, 7);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 2,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES * 2
    );

    const symmetryScore = 1 - Math.min(shoulderDiff / 0.05, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.6,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'head-and-shoulders',
      leftShoulder: { timestamp: leftShoulder.timestamp, price: leftShoulder.price },
      head: { timestamp: head.timestamp, price: head.price },
      rightShoulder: { timestamp: rightShoulder.timestamp, price: rightShoulder.price },
      neckline: [
        { timestamp: neckLow1.timestamp, price: neckLow1.price },
        { timestamp: neckLow2.timestamp, price: neckLow2.price },
      ],
      label: `H&S (Bearish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: leftShoulder.timestamp,
    });
  }

  const result = patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
  return result;
};

export const detectInverseHeadAndShoulders = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternHeadAndShoulders[] => {
  if (!candles || candles.length < 20) return [];

  const patterns: AIPatternHeadAndShoulders[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 3 || highPivots.length < 2) return [];

  for (let i = 0; i < lowPivots.length - 2; i++) {
    const leftShoulder = lowPivots[i];
    const head = lowPivots[i + 1];
    const rightShoulder = lowPivots[i + 2];

    if (!leftShoulder || !head || !rightShoulder) continue;

    if (head.price >= leftShoulder.price || head.price >= rightShoulder.price) continue;

    const shoulderDiff = Math.abs(rightShoulder.price - leftShoulder.price) / leftShoulder.price;
    if (shoulderDiff > 0.05) continue;

    const headDepth = (leftShoulder.price - head.price) / head.price;
    if (headDepth < 0.02) continue;

    const highsBetween = highPivots.filter(h => h.index > leftShoulder.index && h.index < rightShoulder.index);
    if (highsBetween.length < 2) continue;

    const neckHigh1 = highsBetween.find(h => h.index < head.index);
    const neckHigh2 = highsBetween.find(h => h.index > head.index);

    if (!neckHigh1 || !neckHigh2) continue;

    const necklineDiff = Math.abs(neckHigh2.price - neckHigh1.price) / neckHigh1.price;
    if (necklineDiff > 0.03) continue;

    const patternHeight = ((neckHigh1.price - head.price) / head.price * 100).toFixed(1);
    const candlesBetween = rightShoulder.index - leftShoulder.index;

    const touchPointsScore = normalizeTouchPoints(5, 7);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 2,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES * 2
    );

    const symmetryScore = 1 - Math.min(shoulderDiff / 0.05, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.6,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'inverse-head-and-shoulders',
      leftShoulder: { timestamp: leftShoulder.timestamp, price: leftShoulder.price },
      head: { timestamp: head.timestamp, price: head.price },
      rightShoulder: { timestamp: rightShoulder.timestamp, price: rightShoulder.price },
      neckline: [
        { timestamp: neckHigh1.timestamp, price: neckHigh1.price },
        { timestamp: neckHigh2.timestamp, price: neckHigh2.price },
      ],
      label: `Inv H&S (Bullish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: leftShoulder.timestamp,
    });
  }

  const result = patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
  return result;
};

export const detectDoubleTops = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternDoublePattern[] => {
  if (!candles || candles.length < 15) return [];

  const patterns: AIPatternDoublePattern[] = [];
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);

  if (highPivots.length < 2 || lowPivots.length < 1) return [];

  for (let i = 0; i < highPivots.length - 1; i++) {
    const firstPeak = highPivots[i];
    const secondPeak = highPivots[i + 1];

    if (!firstPeak || !secondPeak) continue;

    const peakDiff = Math.abs(secondPeak.price - firstPeak.price) / firstPeak.price;
    if (peakDiff > 0.03) continue;

    const lowBetween = lowPivots.filter(l => l.index > firstPeak.index && l.index < secondPeak.index);
    if (lowBetween.length === 0) continue;

    const neckline = lowBetween.reduce((lowest, current) => 
      current.price < lowest.price ? current : lowest
    );

    const patternHeight = ((firstPeak.price - neckline.price) / neckline.price * 100).toFixed(1);
    const candlesBetween = secondPeak.index - firstPeak.index;

    if (candlesBetween < 3) continue;

    const touchPointsScore = normalizeTouchPoints(3, 5);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const symmetryScore = 1 - Math.min(peakDiff / 0.02, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.5,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'double-top',
      firstPeak: { timestamp: firstPeak.timestamp, price: firstPeak.price },
      secondPeak: { timestamp: secondPeak.timestamp, price: secondPeak.price },
      neckline: { timestamp: neckline.openTime, price: neckline.price },
      label: `Double Top (Bearish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: firstPeak.timestamp,
    });
  }

  const result = patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
  return result;
};

export const detectDoubleBottoms = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternDoublePattern[] => {
  if (!candles || candles.length < 15) return [];

  const patterns: AIPatternDoublePattern[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 2 || highPivots.length < 1) return [];

  for (let i = 0; i < lowPivots.length - 1; i++) {
    const firstPeak = lowPivots[i];
    const secondPeak = lowPivots[i + 1];

    if (!firstPeak || !secondPeak) continue;

    const peakDiff = Math.abs(secondPeak.price - firstPeak.price) / firstPeak.price;
    if (peakDiff > 0.03) continue;

    const highBetween = highPivots.filter(h => h.index > firstPeak.index && h.index < secondPeak.index);
    if (highBetween.length === 0) continue;

    const neckline = highBetween.reduce((highest, current) => 
      current.price > highest.price ? current : highest
    );

    const patternHeight = ((neckline.price - firstPeak.price) / firstPeak.price * 100).toFixed(1);
    const candlesBetween = secondPeak.index - firstPeak.index;

    if (candlesBetween < 3) continue;

    const touchPointsScore = normalizeTouchPoints(3, 5);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const symmetryScore = 1 - Math.min(peakDiff / 0.02, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.5,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'double-bottom',
      firstPeak: { timestamp: firstPeak.timestamp, price: firstPeak.price },
      secondPeak: { timestamp: secondPeak.timestamp, price: secondPeak.price },
      neckline: { timestamp: neckline.openTime, price: neckline.price },
      label: `Double Bottom (Bullish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: firstPeak.timestamp,
    });
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectTripleTops = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternTriplePattern[] => {
  if (!candles || candles.length < 30) return [];

  const patterns: AIPatternTriplePattern[] = [];
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);

  if (highPivots.length < 3 || lowPivots.length < 2) return [];

  for (let i = 0; i < highPivots.length - 2; i++) {
    const peak1 = highPivots[i];
    const peak2 = highPivots[i + 1];
    const peak3 = highPivots[i + 2];

    if (!peak1 || !peak2 || !peak3) continue;

    const avgPrice = (peak1.price + peak2.price + peak3.price) / 3;
    const maxDiff = Math.max(
      Math.abs(peak1.price - avgPrice),
      Math.abs(peak2.price - avgPrice),
      Math.abs(peak3.price - avgPrice)
    ) / avgPrice;

    if (maxDiff > PATTERN_DETECTION_CONFIG.TRIPLE_TOP_TOLERANCE) continue;

    const lowsBetween = lowPivots.filter(l => l.index > peak1.index && l.index < peak3.index);
    if (lowsBetween.length < 2) continue;

    const neckline1 = lowsBetween.find(l => l.index < peak2.index);
    const neckline2 = lowsBetween.find(l => l.index > peak2.index);

    if (!neckline1 || !neckline2) continue;

    const necklineDiff = Math.abs(neckline2.price - neckline1.price) / neckline1.price;
    if (necklineDiff > 0.04) continue;

    const patternHeight = ((avgPrice - neckline1.price) / neckline1.price * 100).toFixed(1);
    const candlesBetween = peak3.index - peak1.index;

    const touchPointsScore = normalizeTouchPoints(5, 7);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 2,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES * 2
    );

    const symmetryScore = 1 - Math.min(maxDiff / PATTERN_DETECTION_CONFIG.TRIPLE_TOP_TOLERANCE, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.65,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'triple-top',
      peak1: { timestamp: peak1.timestamp, price: peak1.price },
      peak2: { timestamp: peak2.timestamp, price: peak2.price },
      peak3: { timestamp: peak3.timestamp, price: peak3.price },
      neckline: [
        { timestamp: neckline1.timestamp, price: neckline1.price },
        { timestamp: neckline2.timestamp, price: neckline2.price },
      ],
      label: `Triple Top (Very Bearish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: peak1.timestamp,
    });
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectTripleBottoms = (
  candles: Kline[],
  pivots: PivotPoint[]
): AIPatternTriplePattern[] => {
  if (!candles || candles.length < 30) return [];

  const patterns: AIPatternTriplePattern[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);

  if (lowPivots.length < 3 || highPivots.length < 2) return [];

  for (let i = 0; i < lowPivots.length - 2; i++) {
    const peak1 = lowPivots[i];
    const peak2 = lowPivots[i + 1];
    const peak3 = lowPivots[i + 2];

    if (!peak1 || !peak2 || !peak3) continue;

    const avgPrice = (peak1.price + peak2.price + peak3.price) / 3;
    const maxDiff = Math.max(
      Math.abs(peak1.price - avgPrice),
      Math.abs(peak2.price - avgPrice),
      Math.abs(peak3.price - avgPrice)
    ) / avgPrice;

    if (maxDiff > PATTERN_DETECTION_CONFIG.TRIPLE_TOP_TOLERANCE) continue;

    const highsBetween = highPivots.filter(h => h.index > peak1.index && h.index < peak3.index);
    if (highsBetween.length < 2) continue;

    const neckline1 = highsBetween.find(h => h.index < peak2.index);
    const neckline2 = highsBetween.find(h => h.index > peak2.index);

    if (!neckline1 || !neckline2) continue;

    const necklineDiff = Math.abs(neckline2.price - neckline1.price) / neckline1.price;
    if (necklineDiff > 0.04) continue;

    const patternHeight = ((neckline1.price - avgPrice) / avgPrice * 100).toFixed(1);
    const candlesBetween = peak3.index - peak1.index;

    const touchPointsScore = normalizeTouchPoints(5, 7);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES * 2,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES * 2
    );

    const symmetryScore = 1 - Math.min(maxDiff / PATTERN_DETECTION_CONFIG.TRIPLE_TOP_TOLERANCE, 1);

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.65,
      timeInPattern: timeScore,
      symmetry: symmetryScore,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const confidencePercent = Math.round(confidence * 100);

    patterns.push({
      id: patterns.length + 1,
      type: 'triple-bottom',
      peak1: { timestamp: peak1.timestamp, price: peak1.price },
      peak2: { timestamp: peak2.timestamp, price: peak2.price },
      peak3: { timestamp: peak3.timestamp, price: peak3.price },
      neckline: [
        { timestamp: neckline1.timestamp, price: neckline1.price },
        { timestamp: neckline2.timestamp, price: neckline2.price },
      ],
      label: `Triple Bottom (Very Bullish) · ${patternHeight}% · ${confidencePercent}%`,
      confidence,
      visible: true,
      timestamp: peak1.timestamp,
    });
  }

  return patterns
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
