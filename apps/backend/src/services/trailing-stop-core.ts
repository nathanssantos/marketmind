import type { MarketType } from '@marketmind/types';
import { getRoundTripFee } from '@marketmind/types';
import { TRAILING_STOP } from '../constants';

export interface TrailingStopCoreConfig {
  feePercent?: number;
  marketType?: MarketType;
  useBnbDiscount?: boolean;
  minTrailingDistancePercent?: number;
  atrMultiplier?: number;
  trailingDistancePercent?: number;
  vipLevel?: number;
}

export interface TrailingStopCoreInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  takeProfit?: number | null;
  swingPoints?: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
}

export type TrailingStopReason = 'fees_covered' | 'swing_trail' | 'atr_trail' | 'progressive_trail';

export interface TrailingStopCoreResult {
  newStopLoss: number;
  reason: TrailingStopReason;
}

const FALLBACK_MIN_PROFIT_THRESHOLD = TRAILING_STOP.BREAKEVEN_THRESHOLD;
const TP_THRESHOLD_FOR_BREAKEVEN = TRAILING_STOP.TP_THRESHOLD_FOR_BREAKEVEN;
const TP_THRESHOLD_FOR_ADVANCED = TRAILING_STOP.TP_THRESHOLD_FOR_ADVANCED;
const DEFAULT_TRAILING_DISTANCE_PERCENT = TRAILING_STOP.PEAK_PROFIT_FLOOR;

export const getRoundTripFeePercent = (
  marketType: MarketType = 'SPOT',
  useBnbDiscount: boolean = false,
  vipLevel: number = 0
): number => {
  return getRoundTripFee({ marketType, useBnbDiscount, vipLevel });
};

export const calculateProfitPercent = (
  entryPrice: number,
  currentPrice: number,
  isLong: boolean
): number => {
  return isLong
    ? (currentPrice - entryPrice) / entryPrice
    : (entryPrice - currentPrice) / entryPrice;
};

export const calculateStopAtProfitPercent = (
  entryPrice: number,
  profitPercent: number,
  isLong: boolean
): number => {
  return isLong
    ? entryPrice * (1 + profitPercent)
    : entryPrice * (1 - profitPercent);
};

export const calculateTPProfitPercent = (
  entryPrice: number,
  takeProfit: number,
  isLong: boolean
): number => {
  return isLong
    ? (takeProfit - entryPrice) / entryPrice
    : (entryPrice - takeProfit) / entryPrice;
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

const MIN_STOP_CHANGE_ABSOLUTE = TRAILING_STOP.MIN_STOP_CHANGE_ABSOLUTE;

export const shouldUpdateStopLoss = (
  newStopLoss: number,
  currentStopLoss: number | null,
  isLong: boolean
): boolean => {
  if (currentStopLoss === null) return true;

  const priceDiff = Math.abs(newStopLoss - currentStopLoss);
  if (priceDiff < MIN_STOP_CHANGE_ABSOLUTE) return false;

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
  } = input;

  const isLong = side === 'LONG';
  const marketType = config.marketType ?? 'SPOT';
  const useBnbDiscount = config.useBnbDiscount ?? false;
  const vipLevel = config.vipLevel ?? 0;
  const feePercent = config.feePercent ?? getRoundTripFeePercent(marketType, useBnbDiscount, vipLevel);
  const minTrailingDistancePercent = config.minTrailingDistancePercent ?? 0.002;
  const atrMultiplier = config.atrMultiplier ?? 2.0;
  const trailingDistancePercent = config.trailingDistancePercent ?? DEFAULT_TRAILING_DISTANCE_PERCENT;

  const profitPercent = calculateProfitPercent(entryPrice, currentPrice, isLong);

  const tpProfitPercent = takeProfit
    ? calculateTPProfitPercent(entryPrice, takeProfit, isLong)
    : null;

  const breakevenThreshold = tpProfitPercent
    ? tpProfitPercent * TP_THRESHOLD_FOR_BREAKEVEN
    : FALLBACK_MIN_PROFIT_THRESHOLD;

  const advancedThreshold = tpProfitPercent
    ? tpProfitPercent * TP_THRESHOLD_FOR_ADVANCED
    : null;

  if (profitPercent < breakevenThreshold) {
    return null;
  }

  const feesCoveredPrice = calculateStopAtProfitPercent(entryPrice, feePercent, isLong);

  const shouldUseAdvancedLogic = advancedThreshold !== null && profitPercent >= advancedThreshold;

  if (!shouldUseAdvancedLogic) {
    if (!shouldUpdateStopLoss(feesCoveredPrice, currentStopLoss, isLong)) {
      return null;
    }
    return { newStopLoss: feesCoveredPrice, reason: 'fees_covered' };
  }

  const candidates: Array<{ price: number; reason: TrailingStopReason }> = [
    { price: feesCoveredPrice, reason: 'fees_covered' },
  ];

  const swingStop = findBestSwingStop(
    swingPoints,
    currentPrice,
    entryPrice,
    isLong,
    minTrailingDistancePercent
  );
  if (swingStop !== null) {
    candidates.push({ price: swingStop, reason: 'swing_trail' });
  }

  if (atr && atr > 0) {
    const extremePrice = isLong ? highestPrice : lowestPrice;
    if (extremePrice !== undefined) {
      const atrStop = calculateATRTrailingStop(extremePrice, atr, isLong, atrMultiplier);
      if (shouldUpdateStopLoss(atrStop, currentStopLoss, isLong)) {
        candidates.push({ price: atrStop, reason: 'atr_trail' });
      }
    }
  }

  const progressiveFloor = calculateProgressiveFloor(
    entryPrice,
    highestPrice,
    lowestPrice,
    isLong,
    trailingDistancePercent
  );
  if (progressiveFloor !== null) {
    candidates.push({ price: progressiveFloor, reason: 'progressive_trail' });
  }

  const bestCandidate = selectBestCandidate(candidates, isLong);

  if (!shouldUpdateStopLoss(bestCandidate.price, currentStopLoss, isLong)) {
    return null;
  }

  return { newStopLoss: bestCandidate.price, reason: bestCandidate.reason };
};
