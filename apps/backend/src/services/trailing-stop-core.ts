import type { FibonacciProjectionData, PositionSide } from '@marketmind/types';
import { TRAILING_STOP } from '../constants';

export interface TrailingStopCoreConfig {
  minTrailingDistancePercent?: number;
  atrMultiplier?: number;
  trailingDistancePercent?: number;
  trailingDistancePercentLong?: number;
  trailingDistancePercentShort?: number;
  useFibonacciThresholds?: boolean;
  activationPercentLong?: number;
  activationPercentShort?: number;
  forceActivated?: boolean;
}

export interface TrailingStopCoreInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: PositionSide;
  takeProfit?: number | null;
  swingPoints?: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
  fibonacciProjection?: FibonacciProjectionData | null;
}

export type TrailingStopReason = 'swing_trail' | 'atr_trail' | 'progressive_trail';

export interface TrailingStopCoreResult {
  newStopLoss: number;
  reason: TrailingStopReason;
}

const DEFAULT_TRAILING_DISTANCE_PERCENT = TRAILING_STOP.PEAK_PROFIT_FLOOR;
const DEFAULT_TRAILING_DISTANCE_PERCENT_LONG = TRAILING_STOP.PEAK_PROFIT_FLOOR_LONG;
const DEFAULT_TRAILING_DISTANCE_PERCENT_SHORT = TRAILING_STOP.PEAK_PROFIT_FLOOR_SHORT;

export const calculateProfitPercent = (
  entryPrice: number,
  currentPrice: number,
  isLong: boolean
): number => {
  return isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;
};

export const calculateProgressiveFloor = (
  entryPrice: number,
  highestPrice: number | undefined,
  lowestPrice: number | undefined,
  isLong: boolean,
  trailingDistancePercent: number = DEFAULT_TRAILING_DISTANCE_PERCENT
): number | null => {
  if (isLong) {
    if (highestPrice === undefined || highestPrice <= entryPrice) return null;
    const peakProfit = (highestPrice - entryPrice) / entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistancePercent);
    return entryPrice * (1 + floorProfit);
  } else {
    if (lowestPrice === undefined || lowestPrice >= entryPrice) return null;
    const peakProfit = (entryPrice - lowestPrice) / entryPrice;
    const floorProfit = peakProfit * (1 - trailingDistancePercent);
    return entryPrice * (1 - floorProfit);
  }
};

export const calculateATRTrailingStop = (
  extremePrice: number,
  atr: number,
  isLong: boolean,
  atrMultiplier: number
): number => {
  const atrDistance = atr * atrMultiplier;
  return isLong
    ? extremePrice - atrDistance
    : extremePrice + atrDistance;
};

export const findBestSwingStop = (
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>,
  currentPrice: number,
  entryPrice: number,
  isLong: boolean,
  minDistancePercent: number
): number | null => {
  const relevantSwings = swingPoints.filter(sp =>
    isLong ? sp.type === 'low' : sp.type === 'high'
  );

  const recentSwings = relevantSwings.slice(-5);

  if (isLong) {
    const validSwingLows = recentSwings
      .filter(sp => sp.price < currentPrice && sp.price > entryPrice)
      .sort((a, b) => b.price - a.price);

    if (validSwingLows.length > 0) {
      const swingLow = validSwingLows[0]!.price;
      const buffer = swingLow * minDistancePercent;
      return swingLow - buffer;
    }
  } else {
    const validSwingHighs = recentSwings
      .filter(sp => sp.price > currentPrice && sp.price < entryPrice)
      .sort((a, b) => a.price - b.price);

    if (validSwingHighs.length > 0) {
      const swingHigh = validSwingHighs[0]!.price;
      const buffer = swingHigh * minDistancePercent;
      return swingHigh + buffer;
    }
  }

  return null;
};

const TP_PROGRESS_THRESHOLD_LONG = TRAILING_STOP.TP_PROGRESS_THRESHOLD_LONG;
const TP_PROGRESS_THRESHOLD_SHORT = TRAILING_STOP.TP_PROGRESS_THRESHOLD_SHORT;

export const getFibonacciLevelPrice = (
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  level: number
): number | null => {
  if (!fibonacciProjection?.levels) return null;
  const levelData = fibonacciProjection.levels.find(
    (l) => Math.abs(l.level - level) < 0.001
  );
  return levelData?.price ?? null;
};

export const calculateFibonacciPriceAtLevel = (
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  level: number,
  isLong: boolean
): number | null => {
  if (!fibonacciProjection?.swingLow || !fibonacciProjection?.swingHigh) return null;

  const swingLow = fibonacciProjection.swingLow.price;
  const swingHigh = fibonacciProjection.swingHigh.price;
  const range = Math.abs(swingHigh - swingLow);

  if (range === 0) return null;

  if (isLong) {
    return level <= 1
      ? swingLow + range * level
      : swingHigh + range * (level - 1);
  }
  return level <= 1
    ? swingHigh - range * level
    : swingLow - range * (level - 1);
};

export const interpolateActivationPrice = (
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  activationLevel: number,
  isLong: boolean
): number | null => {
  if (!fibonacciProjection?.levels?.length) return null;

  const sorted = [...fibonacciProjection.levels].sort((a, b) => a.level - b.level);

  const exactMatch = sorted.find(l => Math.abs(l.level - activationLevel) < 0.001);
  if (exactMatch) return exactMatch.price;

  let lower = sorted[0]!;
  let upper = sorted[sorted.length - 1]!;

  if (activationLevel <= lower.level) return lower.price;
  if (activationLevel >= upper.level) return upper.price;

  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i]!.level <= activationLevel && sorted[i + 1]!.level >= activationLevel) {
      lower = sorted[i]!;
      upper = sorted[i + 1]!;
      break;
    }
  }

  const levelRange = upper.level - lower.level;
  if (levelRange === 0) return lower.price;

  const t = (activationLevel - lower.level) / levelRange;
  const interpolatedPrice = lower.price + t * (upper.price - lower.price);

  if (isLong) return interpolatedPrice;
  return interpolatedPrice;
};

export const hasReachedFibonacciLevel = (
  currentPrice: number,
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  level: number,
  isLong: boolean
): boolean => {
  const levelPrice = calculateFibonacciPriceAtLevel(fibonacciProjection, level, isLong);
  if (levelPrice === null) return false;
  return isLong ? currentPrice >= levelPrice : currentPrice <= levelPrice;
};

export const calculateTPProgress = (
  entryPrice: number,
  currentPrice: number,
  takeProfit: number,
  isLong: boolean
): number => {
  const totalDistance = Math.abs(takeProfit - entryPrice);
  if (totalDistance === 0) return 0;
  const currentDistance = isLong
    ? currentPrice - entryPrice
    : entryPrice - currentPrice;
  return Math.max(0, currentDistance / totalDistance);
};

const DEFAULT_FIB_TARGET_LONG = 1.618;
const DEFAULT_FIB_TARGET_SHORT = 1.272;

export const getImpliedTakeProfit = (
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  isLong: boolean
): number | null => {
  if (!fibonacciProjection?.levels?.length) return null;
  const defaultLevel = isLong ? DEFAULT_FIB_TARGET_LONG : DEFAULT_FIB_TARGET_SHORT;
  const levelData = fibonacciProjection.levels.find(
    (l) => Math.abs(l.level - defaultLevel) < 0.001
  );
  return levelData?.price ?? null;
};

export const hasReachedTPProgressThreshold = (
  entryPrice: number,
  currentPrice: number,
  takeProfit: number | null | undefined,
  fibonacciProjection: FibonacciProjectionData | null | undefined,
  isLong: boolean,
  activationPercentLong?: number,
  activationPercentShort?: number
): boolean => {
  const activationLevel = isLong
    ? (activationPercentLong ?? TP_PROGRESS_THRESHOLD_LONG)
    : (activationPercentShort ?? TP_PROGRESS_THRESHOLD_SHORT);

  const primaryPrice = calculateFibonacciPriceAtLevel(fibonacciProjection, activationLevel, isLong);
  if (primaryPrice !== null) {
    return isLong ? currentPrice >= primaryPrice : currentPrice <= primaryPrice;
  }

  const interpolatedPrice = interpolateActivationPrice(fibonacciProjection, activationLevel, isLong);
  if (interpolatedPrice !== null) {
    return isLong ? currentPrice >= interpolatedPrice : currentPrice <= interpolatedPrice;
  }

  if (takeProfit) {
    const progress = calculateTPProgress(entryPrice, currentPrice, takeProfit, isLong);
    return progress >= activationLevel;
  }

  return false;
};

export const shouldUpdateStopLoss = (
  newStopLoss: number,
  currentStopLoss: number | null,
  isLong: boolean
): boolean => {
  if (currentStopLoss === null) return true;

  const priceDiff = Math.abs(newStopLoss - currentStopLoss);
  const percentDiff = priceDiff / currentStopLoss;
  const MIN_STOP_CHANGE_PERCENT = 0.001;
  if (percentDiff < MIN_STOP_CHANGE_PERCENT) return false;

  return isLong ? newStopLoss > currentStopLoss : newStopLoss < currentStopLoss;
};

const selectBestCandidate = (
  candidates: Array<{ price: number; reason: TrailingStopReason }>,
  isLong: boolean
): { price: number; reason: TrailingStopReason } => {
  return isLong
    ? candidates.reduce((best, c) => c.price > best.price ? c : best)
    : candidates.reduce((best, c) => c.price < best.price ? c : best);
};

export const computeTrailingStopCore = (
  input: TrailingStopCoreInput,
  config: TrailingStopCoreConfig
): TrailingStopCoreResult | null => {
  const {
    entryPrice,
    currentPrice,
    currentStopLoss,
    side,
    takeProfit,
    swingPoints = [],
    atr,
    highestPrice,
    lowestPrice,
    fibonacciProjection,
  } = input;

  const isLong = side === 'LONG';
  const minTrailingDistancePercent = config.minTrailingDistancePercent ?? 0.002;
  const atrMultiplier = config.atrMultiplier ?? 2.0;
  const defaultDistance = isLong ? DEFAULT_TRAILING_DISTANCE_PERCENT_LONG : DEFAULT_TRAILING_DISTANCE_PERCENT_SHORT;
  const trailingDistancePercent = isLong
    ? (config.trailingDistancePercentLong ?? config.trailingDistancePercent ?? defaultDistance)
    : (config.trailingDistancePercentShort ?? config.trailingDistancePercent ?? defaultDistance);
  const useFibonacciThresholds = config.useFibonacciThresholds ?? false;
  const activationPercentLong = config.activationPercentLong;
  const activationPercentShort = config.activationPercentShort;
  const forceActivated = config.forceActivated ?? false;

  const canUseFibonacciThresholds = useFibonacciThresholds && fibonacciProjection?.levels?.length;

  if (!forceActivated) {
    if (canUseFibonacciThresholds) {
      const reachedThreshold = hasReachedTPProgressThreshold(
        entryPrice,
        currentPrice,
        takeProfit,
        fibonacciProjection,
        isLong,
        activationPercentLong,
        activationPercentShort
      );
      if (!reachedThreshold) return null;
    } else if (takeProfit) {
      const activationLevel = isLong
        ? (activationPercentLong ?? TP_PROGRESS_THRESHOLD_LONG)
        : (activationPercentShort ?? TP_PROGRESS_THRESHOLD_SHORT);
      const progress = calculateTPProgress(entryPrice, currentPrice, takeProfit, isLong);
      if (progress < activationLevel) return null;
    } else {
      return null;
    }
  }

  const candidates: Array<{ price: number; reason: TrailingStopReason }> = [];

  const progressiveFloor = calculateProgressiveFloor(entryPrice, highestPrice, lowestPrice, isLong, trailingDistancePercent);
  if (progressiveFloor !== null) candidates.push({ price: progressiveFloor, reason: 'progressive_trail' });

  const swingStop = findBestSwingStop(swingPoints, currentPrice, entryPrice, isLong, minTrailingDistancePercent);
  if (swingStop !== null) candidates.push({ price: swingStop, reason: 'swing_trail' });

  if (atr && atr > 0) {
    const extremePrice = isLong ? highestPrice : lowestPrice;
    if (extremePrice !== undefined) {
      const atrStop = calculateATRTrailingStop(extremePrice, atr, isLong, atrMultiplier);
      if (shouldUpdateStopLoss(atrStop, currentStopLoss, isLong)) {
        candidates.push({ price: atrStop, reason: 'atr_trail' });
      }
    }
  }

  if (candidates.length === 0) return null;

  const bestCandidate = selectBestCandidate(candidates, isLong);
  if (!shouldUpdateStopLoss(bestCandidate.price, currentStopLoss, isLong)) return null;
  return { newStopLoss: bestCandidate.price, reason: bestCandidate.reason };
};
