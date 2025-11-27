import type { AIStudyLine, AIStudyPoint, Candle } from '@shared/types';
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

const validateTrendlineBounces = (
  pivots: PivotPoint[],
  trendline: TrendlineData
): number => {
  let bounces = 0;
  
  for (const pivot of pivots) {
    const expectedPrice = trendline.slope * pivot.index + trendline.intercept;
    const deviation = Math.abs(pivot.price - expectedPrice) / expectedPrice;
    
    if (deviation <= PATTERN_DETECTION_CONFIG.MAX_TRENDLINE_DEVIATION) {
      bounces++;
    }
  }
  
  return bounces;
};

export const detectBullishTrendlines = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyLine[] => {
  if (!candles) return [];
  
  const trendlines: AIStudyLine[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.index - b.index);
  
  if (lowPivots.length < PATTERN_DETECTION_CONFIG.MIN_PIVOTS_TRENDLINE) return [];

  for (let i = 0; i < lowPivots.length - 1; i++) {
    for (let j = i + 1; j < lowPivots.length; j++) {
      const pivot1 = lowPivots[i];
      const pivot2 = lowPivots[j];
      
      if (!pivot1 || !pivot2) continue;
      if (pivot2.price <= pivot1.price) continue;

      const points: Point[] = [
        { x: pivot1.index, y: pivot1.price },
        { x: pivot2.index, y: pivot2.price },
      ];
      
      const trendline = fitTrendline(points);
      
      if (trendline.slope <= 0) continue;
      
      const bounces = validateTrendlineBounces(lowPivots, trendline);
      
      if (bounces < PATTERN_DETECTION_CONFIG.MIN_PIVOTS_TRENDLINE) continue;
      
      const touchPointsScore = normalizeTouchPoints(
        bounces,
        PATTERN_DETECTION_CONFIG.PREFERRED_PIVOTS_TRENDLINE
      );
      
      const candlesBetween = pivot2.index - pivot1.index;
      const timeScore = normalizeTimeInPattern(
        candlesBetween,
        PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
        PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
      );
      
      const confidence = calculateConfidence({
        touchPoints: touchPointsScore,
        volumeConfirmation: 0.5,
        timeInPattern: timeScore,
        symmetry: trendline.r2,
      });

      if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

      const startPoint: AIStudyPoint = {
        timestamp: pivot1.timestamp,
        price: pivot1.price,
      };
      
      const endPoint: AIStudyPoint = {
        timestamp: pivot2.timestamp,
        price: pivot2.price,
      };

      const startDate = new Date(pivot1.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endDate = new Date(pivot2.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const priceChange = ((pivot2.price - pivot1.price) / pivot1.price * 100).toFixed(1);
      const confidencePercent = Math.round(confidence * 100);
      
      trendlines.push({
        id: trendlines.length + 1,
        type: 'trendline-bullish',
        points: [startPoint, endPoint],
        label: `Bullish Trendline · +${priceChange}% gain · ${bounces} bounces · ${trendline.angle.toFixed(1)}° angle · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
        confidence,
        visible: true,
        timestamp: pivot1.timestamp,
      });
    }
  }

  return trendlines
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectBearishTrendlines = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIStudyLine[] => {
  if (!candles) return [];
  
  const trendlines: AIStudyLine[] = [];
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => a.index - b.index);
  
  if (highPivots.length < PATTERN_DETECTION_CONFIG.MIN_PIVOTS_TRENDLINE) return [];

  for (let i = 0; i < highPivots.length - 1; i++) {
    for (let j = i + 1; j < highPivots.length; j++) {
      const pivot1 = highPivots[i];
      const pivot2 = highPivots[j];
      
      if (!pivot1 || !pivot2) continue;
      if (pivot2.price >= pivot1.price) continue;

      const points: Point[] = [
        { x: pivot1.index, y: pivot1.price },
        { x: pivot2.index, y: pivot2.price },
      ];
      
      const trendline = fitTrendline(points);
      
      if (trendline.slope >= 0) continue;
      
      const bounces = validateTrendlineBounces(highPivots, trendline);
      
      if (bounces < PATTERN_DETECTION_CONFIG.MIN_PIVOTS_TRENDLINE) continue;
      
      const touchPointsScore = normalizeTouchPoints(
        bounces,
        PATTERN_DETECTION_CONFIG.PREFERRED_PIVOTS_TRENDLINE
      );
      
      const candlesBetween = pivot2.index - pivot1.index;
      const timeScore = normalizeTimeInPattern(
        candlesBetween,
        PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
        PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
      );
      
      const confidence = calculateConfidence({
        touchPoints: touchPointsScore,
        volumeConfirmation: 0.5,
        timeInPattern: timeScore,
        symmetry: trendline.r2,
      });

      if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

      const startPoint: AIStudyPoint = {
        timestamp: pivot1.timestamp,
        price: pivot1.price,
      };
      
      const endPoint: AIStudyPoint = {
        timestamp: pivot2.timestamp,
        price: pivot2.price,
      };

      const startDate = new Date(pivot1.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endDate = new Date(pivot2.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const priceChange = ((pivot1.price - pivot2.price) / pivot1.price * 100).toFixed(1);
      const confidencePercent = Math.round(confidence * 100);
      
      trendlines.push({
        id: trendlines.length + 1,
        type: 'trendline-bearish',
        points: [startPoint, endPoint],
        label: `Bearish Trendline · -${priceChange}% drop · ${bounces} bounces · ${trendline.angle.toFixed(1)}° angle · ${startDate} to ${endDate} · ${confidencePercent}% confidence`,
        confidence,
        visible: true,
        timestamp: pivot1.timestamp,
      });
    }
  }

  return trendlines
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
