import type { FibonacciProjectionData, TrailingStopOptimizationConfig } from '@marketmind/types';
import { TRAILING_STOP } from '../constants';
import type { AutoTradingConfig, SymbolTrailingStopOverride } from '../db/schema';
import {
    computeTrailingStopCore,
    type TrailingStopReason,
} from './trailing-stop-core';

export const calculateAutoStopOffset = (atrPercent: number): number => {
  if (atrPercent < 0.005) return 0;
  if (atrPercent < 0.01) return 0.0025;
  if (atrPercent < 0.02) return 0.005;
  if (atrPercent < 0.03) return 0.0075;
  if (atrPercent < 0.04) return 0.01;
  return 0.015;
};

export const DEFAULT_TRAILING_STOP_CONFIG: TrailingStopOptimizationConfig = {
  minTrailingDistancePercent: 0.002,
  swingLookback: 3,
  useATRMultiplier: true,
  atrMultiplier: 2.0,
  trailingDistancePercent: TRAILING_STOP.PEAK_PROFIT_FLOOR,
  useVolatilityBasedThresholds: true,
  marketType: 'FUTURES',
  useBnbDiscount: false,
};

export const resolveTrailingStopConfig = (
  side: 'LONG' | 'SHORT',
  symbolOverride: SymbolTrailingStopOverride | null,
  walletConfig: AutoTradingConfig | null,
  baseConfig: TrailingStopOptimizationConfig
): TrailingStopOptimizationConfig => {
  const useOverride = symbolOverride?.useIndividualConfig === true;

  const activationPercentLong = useOverride && symbolOverride.trailingActivationPercentLong !== null
    ? parseFloat(symbolOverride.trailingActivationPercentLong)
    : walletConfig?.trailingActivationPercentLong
      ? parseFloat(walletConfig.trailingActivationPercentLong)
      : undefined;

  const activationPercentShort = useOverride && symbolOverride.trailingActivationPercentShort !== null
    ? parseFloat(symbolOverride.trailingActivationPercentShort)
    : walletConfig?.trailingActivationPercentShort
      ? parseFloat(walletConfig.trailingActivationPercentShort)
      : undefined;

  const distanceLong = useOverride && symbolOverride.trailingDistancePercentLong !== null
    ? parseFloat(symbolOverride.trailingDistancePercentLong)
    : walletConfig?.trailingDistancePercentLong
      ? parseFloat(walletConfig.trailingDistancePercentLong)
      : baseConfig.trailingDistancePercent;

  const distanceShort = useOverride && symbolOverride.trailingDistancePercentShort !== null
    ? parseFloat(symbolOverride.trailingDistancePercentShort)
    : walletConfig?.trailingDistancePercentShort
      ? parseFloat(walletConfig.trailingDistancePercentShort)
      : baseConfig.trailingDistancePercent;

  const trailingDistancePercent = side === 'LONG' ? distanceLong : distanceShort;

  const trailingDistanceMode = useOverride && symbolOverride.trailingDistanceMode !== null
    ? symbolOverride.trailingDistanceMode
    : walletConfig?.trailingDistanceMode ?? baseConfig.trailingDistanceMode ?? 'fixed';

  const trailingStopOffsetPercent = useOverride && symbolOverride.trailingStopOffsetPercent !== null
    ? parseFloat(symbolOverride.trailingStopOffsetPercent!)
    : walletConfig?.trailingStopOffsetPercent
      ? parseFloat(walletConfig.trailingStopOffsetPercent)
      : baseConfig.trailingStopOffsetPercent ?? 0;

  const useVolatilityBasedThresholds = useOverride && symbolOverride.useAdaptiveTrailing !== null
    ? symbolOverride.useAdaptiveTrailing
    : walletConfig?.useAdaptiveTrailing ?? baseConfig.useVolatilityBasedThresholds;

  const activationModeLong = useOverride && symbolOverride.trailingActivationModeLong !== null
    ? symbolOverride.trailingActivationModeLong
    : walletConfig?.trailingActivationModeLong ?? 'auto';
  const activationModeShort = useOverride && symbolOverride.trailingActivationModeShort !== null
    ? symbolOverride.trailingActivationModeShort
    : walletConfig?.trailingActivationModeShort ?? 'auto';
  const activationMode = side === 'LONG' ? activationModeLong : activationModeShort;
  const isManuallyActivated = side === 'LONG'
    ? (symbolOverride?.manualTrailingActivatedLong ?? false)
    : (symbolOverride?.manualTrailingActivatedShort ?? false);
  const forceActivated = activationMode === 'manual' && isManuallyActivated;

  return {
    ...baseConfig,
    activationPercentLong,
    activationPercentShort,
    trailingDistancePercent,
    trailingDistanceMode,
    trailingStopOffsetPercent,
    useVolatilityBasedThresholds,
    forceActivated,
  };
};

export interface TrailingStopUpdate {
  executionId: string;
  oldStopLoss: number | null;
  newStopLoss: number;
  reason: TrailingStopReason;
  isFirstActivation?: boolean;
  currentExtremePrice?: number;
}

export interface TrailingStopInput {
  entryPrice: number;
  currentPrice: number;
  currentStopLoss: number | null;
  side: 'LONG' | 'SHORT';
  takeProfit?: number | null;
  swingPoints: Array<{ price: number; type: 'high' | 'low' }>;
  atr?: number;
  highestPrice?: number;
  lowestPrice?: number;
  fibonacciProjection?: FibonacciProjectionData | null;
}

export interface TrailingStopResult {
  newStopLoss: number;
  reason: TrailingStopReason;
}

export { calculateATRTrailingStop, calculateProfitPercent, calculateProgressiveFloor, findBestSwingStop, shouldUpdateStopLoss } from './trailing-stop-core';

export const computeTrailingStop = (
  input: TrailingStopInput,
  config: TrailingStopOptimizationConfig
): TrailingStopResult | null => {
  const { entryPrice, currentPrice, currentStopLoss, side, takeProfit, swingPoints, highestPrice, lowestPrice, atr, fibonacciProjection } = input;
  const isLong = side === 'LONG';
  const useFibonacciThresholds = config.useFibonacciThresholds ?? false;

  return computeTrailingStopCore(
    {
      entryPrice,
      currentPrice,
      currentStopLoss,
      side,
      takeProfit,
      swingPoints,
      atr,
      highestPrice: isLong ? highestPrice : undefined,
      lowestPrice: isLong ? undefined : lowestPrice,
      fibonacciProjection,
    },
    {
      minTrailingDistancePercent: config.minTrailingDistancePercent,
      atrMultiplier: config.atrMultiplier,
      trailingDistancePercent: config.trailingDistancePercent,
      useFibonacciThresholds,
      activationPercentLong: config.activationPercentLong,
      activationPercentShort: config.activationPercentShort,
      forceActivated: config.forceActivated,
    }
  );
};
