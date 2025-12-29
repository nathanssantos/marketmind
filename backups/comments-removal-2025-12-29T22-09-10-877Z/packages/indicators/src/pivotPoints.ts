import type { Kline, PivotPoint } from '@marketmind/types';

const DEFAULT_PIVOT_LOOKBACK = 5;
const DEFAULT_PIVOT_LOOKAHEAD = 2;
const DEFAULT_VOLUME_LOOKBACK = 20;
const VOLUME_CONFIRMATION_MULTIPLIER = 1.2;
const STRENGTH_THRESHOLDS = { WEAK: 0.3, MEDIUM: 0.6, STRONG: 0.8 };

const getKlineHigh = (kline: Kline): number => parseFloat(kline.high);
const getKlineLow = (kline: Kline): number => parseFloat(kline.low);
const getKlineVolume = (kline: Kline): number => parseFloat(kline.volume);
const getKlineClose = (kline: Kline): number => parseFloat(kline.close);

export type PivotStrength = 'weak' | 'medium' | 'strong';

export interface EnhancedPivotPoint extends PivotPoint {
  strength: PivotStrength;
  volumeConfirmed: boolean;
  volumeRatio: number;
  priceDistance: number;
}

export interface PivotDetectionConfig {
  lookback?: number;
  lookahead?: number;
  volumeLookback?: number;
  volumeMultiplier?: number;
  minPriceDistancePercent?: number;
}

export interface PivotAnalysis {
  pivots: EnhancedPivotPoint[];
  resistanceLevels: number[];
  supportLevels: number[];
  nearestResistance: number | null;
  nearestSupport: number | null;
}

const calculateAverageVolume = (
  klines: Kline[],
  endIndex: number,
  lookback: number
): number => {
  const start = Math.max(0, endIndex - lookback);
  let sum = 0;
  let count = 0;
  for (let i = start; i < endIndex; i++) {
    const kline = klines[i];
    if (kline) {
      sum += getKlineVolume(kline);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
};

const calculatePivotStrength = (
  klines: Kline[],
  pivotIndex: number,
  pivotType: 'high' | 'low',
  lookback: number
): { strength: PivotStrength; score: number } => {
  const pivotKline = klines[pivotIndex];
  if (!pivotKline) return { strength: 'weak', score: 0 };

  const pivotPrice = pivotType === 'high'
    ? getKlineHigh(pivotKline)
    : getKlineLow(pivotKline);

  let touchCount = 0;
  let maxDistance = 0;
  const startIdx = Math.max(0, pivotIndex - lookback);
  const endIdx = Math.min(klines.length - 1, pivotIndex + lookback);

  for (let i = startIdx; i <= endIdx; i++) {
    if (i === pivotIndex) continue;
    const kline = klines[i];
    if (!kline) continue;

    const price = pivotType === 'high' ? getKlineHigh(kline) : getKlineLow(kline);
    const distance = Math.abs(price - pivotPrice) / pivotPrice;

    if (distance < 0.002) touchCount++;
    if (distance > maxDistance) maxDistance = distance;
  }

  const touchScore = Math.min(touchCount / 3, 1) * 0.4;
  const distanceScore = Math.min(maxDistance / 0.05, 1) * 0.6;
  const totalScore = touchScore + distanceScore;

  let strength: PivotStrength = 'weak';
  if (totalScore >= STRENGTH_THRESHOLDS.STRONG) strength = 'strong';
  else if (totalScore >= STRENGTH_THRESHOLDS.MEDIUM) strength = 'medium';

  return { strength, score: totalScore };
};

export const findEnhancedPivotHighs = (
  klines: Kline[],
  config: PivotDetectionConfig = {}
): EnhancedPivotPoint[] => {
  const {
    lookback = DEFAULT_PIVOT_LOOKBACK,
    lookahead = DEFAULT_PIVOT_LOOKAHEAD,
    volumeLookback = DEFAULT_VOLUME_LOOKBACK,
    volumeMultiplier = VOLUME_CONFIRMATION_MULTIPLIER,
  } = config;

  const pivots: EnhancedPivotPoint[] = [];
  const currentPrice = klines.length > 0
    ? getKlineClose(klines[klines.length - 1]!)
    : 0;

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;

    const currentHigh = getKlineHigh(currentKline);
    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      const avgVolume = calculateAverageVolume(klines, i, volumeLookback);
      const pivotVolume = getKlineVolume(currentKline);
      const volumeRatio = avgVolume > 0 ? pivotVolume / avgVolume : 1;
      const volumeConfirmed = volumeRatio >= volumeMultiplier;
      const { strength } = calculatePivotStrength(klines, i, 'high', lookback);
      const priceDistance = currentPrice > 0
        ? ((currentHigh - currentPrice) / currentPrice) * 100
        : 0;

      pivots.push({
        index: i,
        price: currentHigh,
        openTime: currentKline.openTime,
        type: 'high',
        strength,
        volumeConfirmed,
        volumeRatio,
        priceDistance,
      });
    }
  }

  return pivots;
};

export const findEnhancedPivotLows = (
  klines: Kline[],
  config: PivotDetectionConfig = {}
): EnhancedPivotPoint[] => {
  const {
    lookback = DEFAULT_PIVOT_LOOKBACK,
    lookahead = DEFAULT_PIVOT_LOOKAHEAD,
    volumeLookback = DEFAULT_VOLUME_LOOKBACK,
    volumeMultiplier = VOLUME_CONFIRMATION_MULTIPLIER,
  } = config;

  const pivots: EnhancedPivotPoint[] = [];
  const currentPrice = klines.length > 0
    ? getKlineClose(klines[klines.length - 1]!)
    : 0;

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;

    const currentLow = getKlineLow(currentKline);
    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;
      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      const avgVolume = calculateAverageVolume(klines, i, volumeLookback);
      const pivotVolume = getKlineVolume(currentKline);
      const volumeRatio = avgVolume > 0 ? pivotVolume / avgVolume : 1;
      const volumeConfirmed = volumeRatio >= volumeMultiplier;
      const { strength } = calculatePivotStrength(klines, i, 'low', lookback);
      const priceDistance = currentPrice > 0
        ? ((currentPrice - currentLow) / currentPrice) * 100
        : 0;

      pivots.push({
        index: i,
        price: currentLow,
        openTime: currentKline.openTime,
        type: 'low',
        strength,
        volumeConfirmed,
        volumeRatio,
        priceDistance,
      });
    }
  }

  return pivots;
};

export const findEnhancedPivotPoints = (
  klines: Kline[],
  config?: PivotDetectionConfig
): EnhancedPivotPoint[] => {
  const highs = findEnhancedPivotHighs(klines, config);
  const lows = findEnhancedPivotLows(klines, config);
  return [...highs, ...lows].sort((a, b) => a.index - b.index);
};

export const analyzePivots = (
  klines: Kline[],
  config?: PivotDetectionConfig
): PivotAnalysis => {
  const pivots = findEnhancedPivotPoints(klines, config);
  const currentPrice = klines.length > 0
    ? getKlineClose(klines[klines.length - 1]!)
    : 0;

  const resistanceLevels = pivots
    .filter(p => p.type === 'high' && p.price > currentPrice)
    .sort((a, b) => a.price - b.price)
    .map(p => p.price);

  const supportLevels = pivots
    .filter(p => p.type === 'low' && p.price < currentPrice)
    .sort((a, b) => b.price - a.price)
    .map(p => p.price);

  return {
    pivots,
    resistanceLevels,
    supportLevels,
    nearestResistance: resistanceLevels[0] ?? null,
    nearestSupport: supportLevels[0] ?? null,
  };
};

export const findPivotHighs = (
  klines: Kline[],
  lookback: number = DEFAULT_PIVOT_LOOKBACK,
  lookahead: number = DEFAULT_PIVOT_LOOKAHEAD
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;

    const currentHigh = getKlineHigh(currentKline);

    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;

      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;

      if (getKlineHigh(kline) >= currentHigh) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentHigh,
        openTime: currentKline.openTime,
        type: 'high',
      });
    }
  }

  return pivots;
};

export const findPivotLows = (
  klines: Kline[],
  lookback: number = DEFAULT_PIVOT_LOOKBACK,
  lookahead: number = DEFAULT_PIVOT_LOOKAHEAD
): PivotPoint[] => {
  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookahead; i++) {
    const currentKline = klines[i];
    if (!currentKline) continue;

    const currentLow = getKlineLow(currentKline);

    let isPivot = true;

    for (let j = i - lookback; j < i; j++) {
      const kline = klines[j];
      if (!kline) continue;

      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (!isPivot) continue;

    for (let j = i + 1; j <= i + lookahead; j++) {
      const kline = klines[j];
      if (!kline) continue;

      if (getKlineLow(kline) <= currentLow) {
        isPivot = false;
        break;
      }
    }

    if (isPivot) {
      pivots.push({
        index: i,
        price: currentLow,
        openTime: currentKline.openTime,
        type: 'low',
      });
    }
  }

  return pivots;
};

export const findPivotPoints = (
  klines: Kline[],
  lookback?: number,
  lookahead?: number
): PivotPoint[] => {
  const highs = findPivotHighs(klines, lookback, lookahead);
  const lows = findPivotLows(klines, lookback, lookahead);

  return [...highs, ...lows].sort((a, b) => a.index - b.index);
};

export const findLowestSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentKlines = klines.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentKlines, pivotStrength);

  const lows = pivots
    .filter((p) => p.type === 'low')
    .sort((a, b) => a.price - b.price);

  return lows.length > 0 ? lows[0]!.price : null;
};

export const findHighestSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentKlines = klines.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentKlines, pivotStrength);

  const highs = pivots
    .filter((p) => p.type === 'high')
    .sort((a, b) => b.price - a.price);

  return highs.length > 0 ? highs[0]!.price : null;
};

export const findNearestPivotTarget = (
  klines: Kline[],
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  config?: PivotDetectionConfig
): { target: number | null; pivot: EnhancedPivotPoint | null } => {
  const analysis = analyzePivots(klines, config);

  if (direction === 'LONG') {
    const validResistances = analysis.pivots
      .filter(p => p.type === 'high' && p.price > entryPrice)
      .sort((a, b) => a.price - b.price);

    const target = validResistances[0];
    return { target: target?.price ?? null, pivot: target ?? null };
  }

  const validSupports = analysis.pivots
    .filter(p => p.type === 'low' && p.price < entryPrice)
    .sort((a, b) => b.price - a.price);

  const target = validSupports[0];
  return { target: target?.price ?? null, pivot: target ?? null };
};

export const findNearestPivotStop = (
  klines: Kline[],
  entryPrice: number,
  direction: 'LONG' | 'SHORT',
  config?: PivotDetectionConfig
): { stop: number | null; pivot: EnhancedPivotPoint | null } => {
  const analysis = analyzePivots(klines, config);

  if (direction === 'LONG') {
    const validSupports = analysis.pivots
      .filter(p => p.type === 'low' && p.price < entryPrice)
      .sort((a, b) => b.price - a.price);

    const stop = validSupports[0];
    return { stop: stop?.price ?? null, pivot: stop ?? null };
  }

  const validResistances = analysis.pivots
    .filter(p => p.type === 'high' && p.price > entryPrice)
    .sort((a, b) => a.price - b.price);

  const stop = validResistances[0];
  return { stop: stop?.price ?? null, pivot: stop ?? null };
};
