import { VOLATILITY_ADJUSTMENT } from '../constants';
import { getVolatilityReductionFactor } from '../volatility/profile';

export interface VolatilityAdjustmentResult {
  adjustmentFactor: number;
  rationale: string;
}

export const calculateVolatilityAdjustment = (
  atrPercent: number
): VolatilityAdjustmentResult => {
  const reductionFactor = getVolatilityReductionFactor(atrPercent);

  if (atrPercent >= VOLATILITY_ADJUSTMENT.ATR_HIGH_THRESHOLD) {
    return {
      adjustmentFactor: reductionFactor,
      rationale: `High volatility (ATR ${atrPercent.toFixed(2)}%): position reduced to ${(reductionFactor * 100).toFixed(0)}%`,
    };
  }

  return {
    adjustmentFactor: 1.0,
    rationale: `Normal volatility (ATR ${atrPercent.toFixed(2)}%): no adjustment`,
  };
};

export const applyVolatilityAdjustment = (
  baseQuantity: number,
  atrPercent: number
): number => {
  const { adjustmentFactor } = calculateVolatilityAdjustment(atrPercent);
  return baseQuantity * adjustmentFactor;
};
