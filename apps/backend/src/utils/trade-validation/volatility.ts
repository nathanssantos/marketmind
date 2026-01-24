import { calculateATR } from '@marketmind/indicators';
import type { VolatilityAdjustmentInput, VolatilityAdjustmentResult } from './types';

const DEFAULT_ATR_PERIOD = 14;
const DEFAULT_HIGH_VOLATILITY_THRESHOLD = 3.0;
const DEFAULT_REDUCTION_FACTOR = 0.7;

export const calculateVolatilityAdjustment = (input: VolatilityAdjustmentInput): VolatilityAdjustmentResult => {
  const {
    klines,
    entryPrice,
    klineIndex,
    atrPeriod = DEFAULT_ATR_PERIOD,
    highVolatilityThreshold = DEFAULT_HIGH_VOLATILITY_THRESHOLD,
    reductionFactor = DEFAULT_REDUCTION_FACTOR,
  } = input;

  const effectiveIndex = klineIndex ?? klines.length - 1;

  if (effectiveIndex < atrPeriod - 1) {
    return {
      factor: 1.0,
      atrPercent: null,
      isHighVolatility: false,
      rationale: `Insufficient klines for ATR (${effectiveIndex + 1} < ${atrPeriod})`,
    };
  }

  const startIndex = Math.max(0, effectiveIndex - atrPeriod + 1);
  const endIndex = effectiveIndex + 1;
  const recentKlines = klines.slice(startIndex, endIndex);

  if (recentKlines.length < atrPeriod) {
    return {
      factor: 1.0,
      atrPercent: null,
      isHighVolatility: false,
      rationale: `Insufficient klines for ATR after slicing (${recentKlines.length} < ${atrPeriod})`,
    };
  }

  const atrValues = calculateATR(recentKlines, atrPeriod);

  if (atrValues.length === 0) {
    return {
      factor: 1.0,
      atrPercent: null,
      isHighVolatility: false,
      rationale: 'ATR calculation returned empty array',
    };
  }

  const currentATR = atrValues[atrValues.length - 1];

  if (currentATR === null || currentATR === undefined) {
    return {
      factor: 1.0,
      atrPercent: null,
      isHighVolatility: false,
      rationale: 'Current ATR is null',
    };
  }

  const atrPercent = (currentATR / entryPrice) * 100;

  if (atrPercent > highVolatilityThreshold) {
    const reductionPercent = ((1 - reductionFactor) * 100).toFixed(0);
    return {
      factor: reductionFactor,
      atrPercent,
      isHighVolatility: true,
      rationale: `High volatility: ATR=${atrPercent.toFixed(2)}% > ${highVolatilityThreshold}% threshold, reducing position by ${reductionPercent}%`,
    };
  }

  return {
    factor: 1.0,
    atrPercent,
    isHighVolatility: false,
    rationale: `Normal volatility: ATR=${atrPercent.toFixed(2)}% <= ${highVolatilityThreshold}%`,
  };
};

export const VOLATILITY_DEFAULTS = {
  ATR_PERIOD: DEFAULT_ATR_PERIOD,
  HIGH_VOLATILITY_THRESHOLD: DEFAULT_HIGH_VOLATILITY_THRESHOLD,
  REDUCTION_FACTOR: DEFAULT_REDUCTION_FACTOR,
} as const;
