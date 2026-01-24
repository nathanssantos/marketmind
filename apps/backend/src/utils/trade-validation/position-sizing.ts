import {
  calculateKellyPercentage,
  roundQuantity,
} from '@marketmind/trading-core';
import { POSITION_SIZING_CONFIG } from '@marketmind/types';
import { calculateVolatilityAdjustment } from './volatility';
import type { UnifiedPositionSizeInput, UnifiedPositionSizeResult } from './types';

const {
  DEFAULT_MIN_PERCENT,
  DEFAULT_MAX_PERCENT,
  DEFAULT_RISK_PER_TRADE,
  DEFAULT_KELLY_FRACTION,
  DEFAULT_WIN_RATE,
  DEFAULT_AVG_WIN_PERCENT,
  DEFAULT_AVG_LOSS_PERCENT,
  DEFAULT_FIXED_PERCENT,
  DEFAULT_RISK_PERCENT,
  VOLATILITY_TARGET,
} = POSITION_SIZING_CONFIG;

export const calculateUnifiedPositionSize = (input: UnifiedPositionSizeInput): UnifiedPositionSizeResult => {
  const {
    equity,
    entryPrice,
    stopLoss,
    method,
    maxPositionSizePercent,
    riskPerTrade = DEFAULT_RISK_PER_TRADE,
    kellyFraction = DEFAULT_KELLY_FRACTION,
    klines,
    klineIndex,
    historicalStats,
    applyVolatilityAdjustment = true,
    minPositionPercent = DEFAULT_MIN_PERCENT,
    atr,
  } = input;

  const maxPercent = maxPositionSizePercent ?? DEFAULT_MAX_PERCENT;
  let positionPercent: number;
  let rationale: string;

  switch (method) {
    case 'risk-based': {
      const result = calculateRiskBased(equity, entryPrice, stopLoss, riskPerTrade);
      positionPercent = result.positionPercent;
      rationale = result.rationale;
      break;
    }

    case 'kelly': {
      const result = calculateKelly(
        historicalStats?.winRate ?? DEFAULT_WIN_RATE,
        historicalStats?.avgWinPercent ?? DEFAULT_AVG_WIN_PERCENT,
        historicalStats?.avgLossPercent ?? DEFAULT_AVG_LOSS_PERCENT,
        kellyFraction
      );
      positionPercent = result.positionPercent;
      rationale = result.rationale;
      break;
    }

    case 'volatility': {
      const result = calculateVolatilityBased(atr ?? 0, entryPrice, maxPercent);
      positionPercent = result.positionPercent;
      rationale = result.rationale;
      break;
    }

    case 'fixed-fractional':
    default: {
      positionPercent = maxPercent;
      rationale = `Fixed ${positionPercent}% of equity`;
      break;
    }
  }

  positionPercent = Math.max(minPositionPercent, Math.min(maxPercent, positionPercent));

  let volatilityFactor = 1.0;
  if (applyVolatilityAdjustment && klines && klines.length > 0) {
    const volResult = calculateVolatilityAdjustment({
      klines,
      entryPrice,
      klineIndex,
    });
    volatilityFactor = volResult.factor;
    if (volResult.isHighVolatility) {
      rationale += ` | Volatility adjusted: ${volResult.rationale}`;
    }
  }

  const adjustedPercent = positionPercent * volatilityFactor;
  const positionValue = equity * (adjustedPercent / 100);
  const quantity = positionValue / entryPrice;

  const riskAmount = stopLoss
    ? Math.abs(entryPrice - stopLoss) * quantity
    : positionValue * DEFAULT_RISK_PERCENT;

  return {
    quantity: roundQuantity(quantity),
    positionValue,
    positionPercent: adjustedPercent,
    riskAmount,
    volatilityFactor,
    rationale,
  };
};

const calculateRiskBased = (
  equity: number,
  entryPrice: number,
  stopLoss: number | undefined,
  riskPercent: number
): { positionPercent: number; rationale: string } => {
  if (!stopLoss || stopLoss === entryPrice) {
    return {
      positionPercent: DEFAULT_FIXED_PERCENT,
      rationale: `No stop loss - using fixed ${DEFAULT_FIXED_PERCENT}%`,
    };
  }

  const riskAmount = equity * (riskPercent / 100);
  const stopDistance = Math.abs(entryPrice - stopLoss);
  const stopDistancePercent = (stopDistance / entryPrice) * 100;

  const positionValue = riskAmount / (stopDistancePercent / 100);
  const positionPercent = (positionValue / equity) * 100;

  return {
    positionPercent,
    rationale: `Risk ${riskPercent}% of equity ($${riskAmount.toFixed(2)}) with ${stopDistancePercent.toFixed(2)}% stop`,
  };
};

const calculateKelly = (
  winRate: number,
  avgWinPercent: number,
  avgLossPercent: number,
  kellyFraction: number
): { positionPercent: number; rationale: string } => {
  const b = avgWinPercent / avgLossPercent;
  const kellyPercent = calculateKellyPercentage(winRate, b);
  const adjustedPercent = kellyPercent * kellyFraction;
  const finalPercent = Math.max(DEFAULT_MIN_PERCENT, Math.min(DEFAULT_MAX_PERCENT, adjustedPercent));

  return {
    positionPercent: finalPercent,
    rationale: `Kelly: WR=${(winRate * 100).toFixed(1)}%, R:R=${b.toFixed(2)}, Raw=${kellyPercent.toFixed(1)}%, Adjusted=${finalPercent.toFixed(1)}% (${kellyFraction}x Kelly)`,
  };
};

const calculateVolatilityBased = (
  atr: number,
  entryPrice: number,
  maxPercent: number
): { positionPercent: number; rationale: string } => {
  if (atr === 0 || !atr) {
    return {
      positionPercent: DEFAULT_FIXED_PERCENT,
      rationale: `No ATR available - using fixed ${DEFAULT_FIXED_PERCENT}%`,
    };
  }

  const atrPercent = (atr / entryPrice) * 100;
  const { TARGET_ATR_PERCENT, BASELINE_POSITION } = VOLATILITY_TARGET;
  const positionPercent = (BASELINE_POSITION * TARGET_ATR_PERCENT) / atrPercent;

  return {
    positionPercent: Math.min(maxPercent, positionPercent),
    rationale: `Volatility-adjusted: ATR=${atrPercent.toFixed(2)}% → ${positionPercent.toFixed(1)}% position`,
  };
};
