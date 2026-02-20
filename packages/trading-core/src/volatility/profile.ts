import type { MarketType, VolatilityLevel, VolatilityProfile } from '@marketmind/types';

export const calculateATRPercent = (atr: number, price: number): number => {
  if (price <= 0) return 0;
  return (atr / price) * 100;
};

export interface VolatilityProfileOptions {
  marketType?: MarketType;
  useBnbDiscount?: boolean;
}

export const getVolatilityProfile = (
  atrPercent: number,
  _options: VolatilityProfileOptions = {}
): VolatilityProfile => {
  if (atrPercent < 1.0) {
    return {
      level: 'LOW' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 2.0,
      minTrailingDistance: 0.003,
    };
  }

  if (atrPercent < 2.0) {
    return {
      level: 'MEDIUM' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 2.5,
      minTrailingDistance: 0.004,
    };
  }

  if (atrPercent < 3.0) {
    return {
      level: 'HIGH' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 3.0,
      minTrailingDistance: 0.005,
    };
  }

  if (atrPercent < 4.0) {
    return {
      level: 'VERY_HIGH' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 3.5,
      minTrailingDistance: 0.006,
    };
  }

  return {
    level: 'EXTREME' as VolatilityLevel,
    atrPercent,
    atrMultiplier: Math.min(5.0, 4.0 + (atrPercent - 4) * 0.25),
    minTrailingDistance: 0.007,
  };
};

export const getVolatilityAdjustedMultiplier = (
  baseMultiplier: number,
  atrPercent: number
): number => {
  const profile = getVolatilityProfile(atrPercent);
  const adjustmentRatio = profile.atrMultiplier / 2.0;
  return baseMultiplier * adjustmentRatio;
};

export const isHighVolatility = (atrPercent: number): boolean => atrPercent >= 3.0;
export const isExtremeVolatility = (atrPercent: number): boolean => atrPercent >= 4.0;

export const getVolatilityReductionFactor = (atrPercent: number): number => {
  if (atrPercent >= 4.0) return 0.5;
  if (atrPercent >= 3.0) return 0.7;
  return 1.0;
};
