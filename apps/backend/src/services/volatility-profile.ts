import type { MarketType, VolatilityLevel, VolatilityProfile } from '@marketmind/types';
import { BINANCE_FEES, applyBnbDiscount } from '@marketmind/types';

export const calculateATRPercent = (atr: number, price: number): number => {
  if (price <= 0) return 0;
  return (atr / price) * 100;
};

export interface VolatilityProfileOptions {
  marketType?: MarketType;
  useBnbDiscount?: boolean;
}

const calculateBaseFeesThreshold = (
  marketType: MarketType = 'SPOT',
  useBnbDiscount: boolean = false
): number => {
  const fees = marketType === 'FUTURES'
    ? BINANCE_FEES.FUTURES.VIP_0
    : BINANCE_FEES.SPOT.VIP_0;

  const roundTripFee = fees.taker * 2;
  const effectiveFee = useBnbDiscount ? applyBnbDiscount(roundTripFee) : roundTripFee;
  return effectiveFee + 0.005;
};

export const getVolatilityProfile = (
  atrPercent: number,
  options: VolatilityProfileOptions = {}
): VolatilityProfile => {
  const { marketType = 'SPOT', useBnbDiscount = false } = options;
  const baseFees = calculateBaseFeesThreshold(marketType, useBnbDiscount);

  if (atrPercent < 1.0) {
    return {
      level: 'LOW' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 2.0,
      breakevenThreshold: 0.01,
      feesThreshold: baseFees,
      minTrailingDistance: 0.003,
    };
  }
  if (atrPercent < 2.0) {
    return {
      level: 'MEDIUM' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 2.5,
      breakevenThreshold: 0.015,
      feesThreshold: baseFees + 0.005,
      minTrailingDistance: 0.004,
    };
  }
  if (atrPercent < 3.0) {
    return {
      level: 'HIGH' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 3.0,
      breakevenThreshold: 0.02,
      feesThreshold: baseFees + 0.01,
      minTrailingDistance: 0.005,
    };
  }
  if (atrPercent < 4.0) {
    return {
      level: 'VERY_HIGH' as VolatilityLevel,
      atrPercent,
      atrMultiplier: 3.5,
      breakevenThreshold: 0.025,
      feesThreshold: baseFees + 0.015,
      minTrailingDistance: 0.006,
    };
  }
  return {
    level: 'EXTREME' as VolatilityLevel,
    atrPercent,
    atrMultiplier: Math.min(5.0, 4.0 + (atrPercent - 4) * 0.25),
    breakevenThreshold: 0.03,
    feesThreshold: baseFees + 0.02,
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
