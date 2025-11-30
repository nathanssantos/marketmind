import type { Kline, PivotPoint } from '@shared/types';

const DEFAULT_PIVOT_LOOKBACK = 5;
const DEFAULT_CLUSTER_THRESHOLD = 0.01;
const PIVOT_SIDES = 2;
const MIN_CLUSTER_SIZE = 2;
const MIN_CANDLES_FOR_BREAKOUT = 20;
const VOLUME_LOOKBACK = 20;

export const findPivotPoints = (
  candles: Kline[],
  lookback = DEFAULT_PIVOT_LOOKBACK,
): PivotPoint[] => {
  if (candles.length < lookback * PIVOT_SIDES + 1) return [];

  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < candles.length - lookback; i++) {
    const current = candles[i];
    if (!current) continue;

    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      const left = candles[i - j];
      const right = candles[i + j];

      if (!left || !right) {
        isHigh = false;
        isLow = false;
        break;
      }

      if (current.high <= left.high || current.high <= right.high) {
        isHigh = false;
      }

      if (current.low >= left.low || current.low >= right.low) {
        isLow = false;
      }

      if (!isHigh && !isLow) break;
    }

    if (isHigh) {
      pivots.push({
        index: i,
        timestamp: current.openTime,
        price: current.high,
        type: 'high',
      });
    }

    if (isLow) {
      pivots.push({
        index: i,
        timestamp: current.openTime,
        price: current.low,
        type: 'low',
      });
    }
  }

  return pivots;
};

export interface SupportResistanceLevel {
  price: number;
  strength: number;
  touches: number[];
  type: 'support' | 'resistance';
}

export const detectSupportResistance = (
  pivots: PivotPoint[],
  clusterThreshold = DEFAULT_CLUSTER_THRESHOLD,
): SupportResistanceLevel[] => {
  if (pivots.length === 0) return [];

  const levels: SupportResistanceLevel[] = [];
  const visited = new Set<number>();

  for (let i = 0; i < pivots.length; i++) {
    if (visited.has(i)) continue;

    const pivot = pivots[i];
    if (!pivot) continue;

    const cluster: PivotPoint[] = [pivot];
    visited.add(i);

    for (let j = i + 1; j < pivots.length; j++) {
      if (visited.has(j)) continue;

      const other = pivots[j];
      if (!other) continue;

      const priceDiff = Math.abs(pivot.price - other.price);
      const priceRange = (pivot.price + other.price) / PIVOT_SIDES;
      const threshold = priceRange * clusterThreshold;

      if (priceDiff <= threshold && pivot.type === other.type) {
        cluster.push(other);
        visited.add(j);
      }
    }

    if (cluster.length >= MIN_CLUSTER_SIZE) {
      const avgPrice =
        cluster.reduce((sum, p) => sum + p.price, 0) / cluster.length;

      levels.push({
        price: avgPrice,
        strength: cluster.length,
        touches: cluster.map((p) => p.index),
        type: pivot.type === 'high' ? 'resistance' : 'support',
      });
    }
  }

  levels.sort((a, b) => b.strength - a.strength);

  return levels;
};

export const isNearLevel = (
  price: number,
  level: number,
  threshold = 0.005,
): boolean => {
  const diff = Math.abs(price - level);
  return diff / level <= threshold;
};

export const findBreakouts = (
  candles: Kline[],
  levels: SupportResistanceLevel[],
  volumeThreshold = 1.5,
): Array<{
  index: number;
  level: SupportResistanceLevel;
  direction: 'up' | 'down';
  volumeConfirmation: boolean;
}> => {
  const breakouts: Array<{
    index: number;
    level: SupportResistanceLevel;
    direction: 'up' | 'down';
    volumeConfirmation: boolean;
  }> = [];

  if (candles.length < MIN_CANDLES_FOR_BREAKOUT) return breakouts;

  const avgVolume =
    candles.slice(-VOLUME_LOOKBACK).reduce((sum, c) => sum + c.volume, 0) / VOLUME_LOOKBACK;

  for (let i = 1; i < candles.length; i++) {
    const current = candles[i];
    const previous = candles[i - 1];

    if (!current || !previous) continue;

    for (const level of levels) {
      if (level.type === 'resistance') {
        if (previous.close < level.price && current.close > level.price) {
          breakouts.push({
            index: i,
            level,
            direction: 'up',
            volumeConfirmation: current.volume > avgVolume * volumeThreshold,
          });
        }
      } else {
        if (previous.close > level.price && current.close < level.price) {
          breakouts.push({
            index: i,
            level,
            direction: 'down',
            volumeConfirmation: current.volume > avgVolume * volumeThreshold,
          });
        }
      }
    }
  }

  return breakouts;
};

export const findRecentSwingLow = (
  candles: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentCandles = candles.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentCandles, pivotStrength);

  const lows = pivots
    .filter((p) => p.type === 'low')
    .sort((a, b) => b.index - a.index);

  return lows.length > 0 ? lows[0]!.price : null;
};

export const findRecentSwingHigh = (
  candles: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentCandles = candles.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentCandles, pivotStrength);

  const highs = pivots
    .filter((p) => p.type === 'high')
    .sort((a, b) => b.index - a.index);

  return highs.length > 0 ? highs[0]!.price : null;
};

export const findLowestSwingLow = (
  candles: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentCandles = candles.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentCandles, pivotStrength);

  const lows = pivots
    .filter((p) => p.type === 'low')
    .sort((a, b) => a.price - b.price);

  return lows.length > 0 ? lows[0]!.price : null;
};

export const findHighestSwingHigh = (
  candles: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (currentIndex < lookback) return null;

  const startIndex = Math.max(0, currentIndex - lookback);
  const recentCandles = candles.slice(startIndex, currentIndex + 1);
  const pivots = findPivotPoints(recentCandles, pivotStrength);

  const highs = pivots
    .filter((p) => p.type === 'high')
    .sort((a, b) => b.price - a.price);

  return highs.length > 0 ? highs[0]!.price : null;
};
