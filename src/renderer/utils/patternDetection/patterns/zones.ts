import type { AIPatternZone, Candle } from '@shared/types';
import { PATTERN_DETECTION_CONFIG } from '../constants';
import {
    calculateConfidence,
    normalizeTimeInPattern,
    normalizeTouchPoints,
} from '../core/confidenceScoring';
import type { PivotPoint } from '../types';

export const detectBuyZones = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternZone[] => {
  if (!candles || candles.length < 20) return [];

  const zones: AIPatternZone[] = [];
  const lowPivots = pivots.filter(p => p.type === 'low').sort((a, b) => a.price - b.price);

  if (lowPivots.length < 3) return [];

  for (let i = 0; i < lowPivots.length - 2; i++) {
    const clusteredPivots = lowPivots.filter((p, idx) => {
      if (idx < i) return false;
      const priceDiff = Math.abs(p.price - lowPivots[i]!.price) / lowPivots[i]!.price;
      return priceDiff < PATTERN_DETECTION_CONFIG.PRICE_TOLERANCE_PERCENT / 100;
    });

    if (clusteredPivots.length < 3) continue;

    const prices = clusteredPivots.map(p => p.price);
    const bottomPrice = Math.min(...prices);
    const topPrice = Math.max(...prices);

    const startTimestamp = Math.min(...clusteredPivots.map(p => p.timestamp));
    const endTimestamp = Math.max(...clusteredPivots.map(p => p.timestamp));

    const startIndex = candles.findIndex(c => c.timestamp >= startTimestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= endTimestamp);

    if (startIndex === -1 || endIndex === -1) continue;

    const candlesBetween = endIndex - startIndex;
    if (candlesBetween < PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES) continue;

    const zoneCandles = candles.slice(startIndex, endIndex + 1);
    const avgVolume = zoneCandles.reduce((sum, c) => sum + c.volume, 0) / zoneCandles.length;
    const volumeScore = avgVolume > 0 ? 0.6 : 0.5;

    const touchPointsScore = normalizeTouchPoints(clusteredPivots.length, 5);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: volumeScore,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const zoneHeight = ((topPrice - bottomPrice) / bottomPrice * 100).toFixed(2);
    const confidencePercent = Math.round(confidence * 100);

    zones.push({
      id: zones.length + 1,
      type: 'buy-zone',
      startTimestamp,
      endTimestamp,
      topPrice,
      bottomPrice,
      label: `Buy Zone · ${zoneHeight}% range · ${clusteredPivots.length} touches · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: startTimestamp,
    });
  }

  return zones
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectSellZones = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternZone[] => {
  if (!candles || candles.length < 20) return [];

  const zones: AIPatternZone[] = [];
  const highPivots = pivots.filter(p => p.type === 'high').sort((a, b) => b.price - a.price);

  if (highPivots.length < 3) return [];

  for (let i = 0; i < highPivots.length - 2; i++) {
    const clusteredPivots = highPivots.filter((p, idx) => {
      if (idx < i) return false;
      const priceDiff = Math.abs(p.price - highPivots[i]!.price) / highPivots[i]!.price;
      return priceDiff < PATTERN_DETECTION_CONFIG.PRICE_TOLERANCE_PERCENT / 100;
    });

    if (clusteredPivots.length < 3) continue;

    const prices = clusteredPivots.map(p => p.price);
    const bottomPrice = Math.min(...prices);
    const topPrice = Math.max(...prices);

    const startTimestamp = Math.min(...clusteredPivots.map(p => p.timestamp));
    const endTimestamp = Math.max(...clusteredPivots.map(p => p.timestamp));

    const startIndex = candles.findIndex(c => c.timestamp >= startTimestamp);
    const endIndex = candles.findIndex(c => c.timestamp >= endTimestamp);

    if (startIndex === -1 || endIndex === -1) continue;

    const candlesBetween = endIndex - startIndex;
    if (candlesBetween < PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES) continue;

    const zoneCandles = candles.slice(startIndex, endIndex + 1);
    const avgVolume = zoneCandles.reduce((sum, c) => sum + c.volume, 0) / zoneCandles.length;
    const volumeScore = avgVolume > 0 ? 0.6 : 0.5;

    const touchPointsScore = normalizeTouchPoints(clusteredPivots.length, 5);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: volumeScore,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const zoneHeight = ((topPrice - bottomPrice) / bottomPrice * 100).toFixed(2);
    const confidencePercent = Math.round(confidence * 100);

    zones.push({
      id: zones.length + 1,
      type: 'sell-zone',
      startTimestamp,
      endTimestamp,
      topPrice,
      bottomPrice,
      label: `Sell Zone · ${zoneHeight}% range · ${clusteredPivots.length} touches · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: startTimestamp,
    });
  }

  return zones
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectLiquidityZones = (
  candles: Candle[],
  pivots: PivotPoint[]
): AIPatternZone[] => {
  if (!candles || candles.length < 20) return [];

  const zones: AIPatternZone[] = [];
  const allPivots = [...pivots].sort((a, b) => a.index - b.index);

  if (allPivots.length < 4) return [];

  for (let i = 0; i < allPivots.length - 3; i++) {
    const clusterStart = allPivots[i];
    if (!clusterStart) continue;

    const clusteredPivots = allPivots.filter(p => {
      const timeDiff = Math.abs(p.index - clusterStart.index);
      const priceDiff = Math.abs(p.price - clusterStart.price) / clusterStart.price;
      return timeDiff <= 20 && priceDiff < 0.03;
    });

    if (clusteredPivots.length < 4) continue;

    const startIndex = Math.min(...clusteredPivots.map(p => p.index));
    const endIndex = Math.max(...clusteredPivots.map(p => p.index));

    const zoneCandles = candles.slice(startIndex, endIndex + 1);
    const totalVolume = zoneCandles.reduce((sum, c) => sum + c.volume, 0);
    const avgVolume = candles.reduce((sum, c) => sum + c.volume, 0) / candles.length;

    if (totalVolume / zoneCandles.length < avgVolume * 1.5) continue;

    const prices = clusteredPivots.map(p => p.price);
    const bottomPrice = Math.min(...prices);
    const topPrice = Math.max(...prices);

    const startTimestamp = candles[startIndex]?.timestamp || Date.now();
    const endTimestamp = candles[endIndex]?.timestamp || Date.now();

    const candlesBetween = endIndex - startIndex;

    const touchPointsScore = normalizeTouchPoints(clusteredPivots.length, 6);
    const timeScore = normalizeTimeInPattern(
      candlesBetween,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.7,
      timeInPattern: timeScore,
      symmetry: 0.65,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const zoneHeight = ((topPrice - bottomPrice) / bottomPrice * 100).toFixed(2);
    const confidencePercent = Math.round(confidence * 100);

    zones.push({
      id: zones.length + 1,
      type: 'liquidity-zone',
      startTimestamp,
      endTimestamp,
      topPrice,
      bottomPrice,
      label: `Liquidity Zone · ${zoneHeight}% range · High volume · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: startTimestamp,
    });
  }

  return zones
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};

export const detectAccumulationZones = (
  candles: Candle[],
  _pivots: PivotPoint[]
): AIPatternZone[] => {
  if (!candles || candles.length < 30) return [];

  const zones: AIPatternZone[] = [];

  for (let i = 20; i < candles.length - 10; i++) {
    const window = candles.slice(i - 20, i);
    const futureWindow = candles.slice(i, i + 10);

    const prices = window.map(c => c.close);
    const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const priceVolatility = Math.max(...prices) / Math.min(...prices) - 1;

    if (priceVolatility > 0.05) continue;

    const avgVolume = window.reduce((sum, c) => sum + c.volume, 0) / window.length;
    const recentAvgVolume = candles.slice(Math.max(0, i - 50), i - 20)
      .reduce((sum, c) => sum + c.volume, 0) / 30;

    if (avgVolume <= recentAvgVolume * 1.1) continue;

    const futurePriceMove = futureWindow[futureWindow.length - 1]?.close || avgPrice;
    const priceIncrease = (futurePriceMove - avgPrice) / avgPrice;

    if (priceIncrease < 0.02) continue;

    const bottomPrice = Math.min(...prices);
    const topPrice = Math.max(...prices);

    const startTimestamp = window[0]?.timestamp || Date.now();
    const endTimestamp = window[window.length - 1]?.timestamp || Date.now();

    const touchPointsScore = normalizeTouchPoints(4, 6);
    const timeScore = normalizeTimeInPattern(
      20,
      PATTERN_DETECTION_CONFIG.MIN_PATTERN_FORMATION_CANDLES,
      PATTERN_DETECTION_CONFIG.IDEAL_PATTERN_FORMATION_CANDLES
    );

    const confidence = calculateConfidence({
      touchPoints: touchPointsScore,
      volumeConfirmation: 0.65,
      timeInPattern: timeScore,
      symmetry: 0.7,
    });

    if (confidence < PATTERN_DETECTION_CONFIG.MIN_CONFIDENCE_THRESHOLD) continue;

    const zoneHeight = ((topPrice - bottomPrice) / bottomPrice * 100).toFixed(2);
    const confidencePercent = Math.round(confidence * 100);

    zones.push({
      id: zones.length + 1,
      type: 'accumulation-zone',
      startTimestamp,
      endTimestamp,
      topPrice,
      bottomPrice,
      label: `Accumulation Zone · ${zoneHeight}% range · Rising volume · ${confidencePercent}% confidence`,
      confidence,
      visible: true,
      timestamp: startTimestamp,
    });
  }

  return zones
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, PATTERN_DETECTION_CONFIG.MAX_PATTERNS_PER_TYPE);
};
