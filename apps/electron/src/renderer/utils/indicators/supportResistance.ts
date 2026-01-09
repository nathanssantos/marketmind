import {
    findHighestSwingHigh as findHighestSwingHighFromIndicators,
    findLowestSwingLow as findLowestSwingLowFromIndicators,
    findMostRecentSwingHigh as findSwingHighFromIndicators,
    findMostRecentSwingLow as findSwingLowFromIndicators,
} from '@marketmind/indicators';
import type { Kline, PivotPoint } from '@marketmind/types';
import { getKlineClose, getKlineHigh, getKlineLow, getKlineVolume } from '@shared/utils';

const DEFAULT_PIVOT_LOOKBACK = 5;
const DEFAULT_CLUSTER_THRESHOLD = 0.01;
const PIVOT_SIDES = 2;
const MIN_CLUSTER_SIZE = 2;
const MIN_KLINES_FOR_BREAKOUT = 20;
const VOLUME_LOOKBACK = 20;

export const findPivotPoints = (
  klines: Kline[],
  lookback = DEFAULT_PIVOT_LOOKBACK,
): PivotPoint[] => {
  if (klines.length < lookback * PIVOT_SIDES + 1) return [];

  const pivots: PivotPoint[] = [];

  for (let i = lookback; i < klines.length - lookback; i++) {
    const current = klines[i];
    if (!current) continue;

    let isHigh = true;
    let isLow = true;

    for (let j = 1; j <= lookback; j++) {
      const left = klines[i - j];
      const right = klines[i + j];

      if (!left || !right) {
        isHigh = false;
        isLow = false;
        break;
      }

      const currentHigh = getKlineHigh(current);
      const leftHigh = getKlineHigh(left);
      const rightHigh = getKlineHigh(right);
      const currentLow = getKlineLow(current);
      const leftLow = getKlineLow(left);
      const rightLow = getKlineLow(right);

      if (currentHigh <= leftHigh || currentHigh <= rightHigh) {
        isHigh = false;
      }

      if (currentLow >= leftLow || currentLow >= rightLow) {
        isLow = false;
      }

      if (!isHigh && !isLow) break;
    }

    if (isHigh) {
      pivots.push({
        index: i,
        openTime: current.openTime,
        price: getKlineHigh(current),
        type: 'high',
      });
    }

    if (isLow) {
      pivots.push({
        index: i,
        openTime: current.openTime,
        price: getKlineLow(current),
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
  klines: Kline[],
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

  if (klines.length < MIN_KLINES_FOR_BREAKOUT) return breakouts;

  const avgVolume =
    klines.slice(-VOLUME_LOOKBACK).reduce((sum, c) => sum + getKlineVolume(c), 0) / VOLUME_LOOKBACK;

  for (let i = 1; i < klines.length; i++) {
    const current = klines[i];
    const previous = klines[i - 1];

    if (!current || !previous) continue;

    const currentClose = getKlineClose(current);
    const previousClose = getKlineClose(previous);
    const currentVolume = getKlineVolume(current);

    for (const level of levels) {
      if (level.type === 'resistance') {
        if (previousClose < level.price && currentClose > level.price) {
          breakouts.push({
            index: i,
            level,
            direction: 'up',
            volumeConfirmation: currentVolume > avgVolume * volumeThreshold,
          });
        }
      } else {
        if (previousClose > level.price && currentClose < level.price) {
          breakouts.push({
            index: i,
            level,
            direction: 'down',
            volumeConfirmation: currentVolume > avgVolume * volumeThreshold,
          });
        }
      }
    }
  }

  return breakouts;
};

export const findRecentSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (klines.length === 0 || currentIndex < 0) return null;

  const result = findSwingLowFromIndicators(klines, currentIndex, lookback, pivotStrength);
  return result ? result.price : null;
};

export const findRecentSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (klines.length === 0 || currentIndex < 0) return null;

  const result = findSwingHighFromIndicators(klines, currentIndex, lookback, pivotStrength);
  return result ? result.price : null;
};

export const findLowestSwingLow = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (klines.length === 0 || currentIndex < 0) return null;

  const result = findLowestSwingLowFromIndicators(klines, currentIndex, lookback, pivotStrength);
  return result ? result.price : null;
};

export const findHighestSwingHigh = (
  klines: Kline[],
  currentIndex: number,
  lookback: number = 20,
  pivotStrength: number = 3,
): number | null => {
  if (klines.length === 0 || currentIndex < 0) return null;

  const result = findHighestSwingHighFromIndicators(klines, currentIndex, lookback, pivotStrength);
  return result ? result.price : null;
};
