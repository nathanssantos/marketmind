import type { PositionSizeConfig, PositionSizeResult } from './types';
import { calculateKellyCriterion } from './kelly';
import {
  calculateFixedPositionSize,
  calculateRiskBasedPositionSize,
  calculateMaxPositionValue,
  roundQuantity,
} from './simple';
import { applyVolatilityAdjustment } from './volatilityAdjusted';

const DEFAULT_RISK_PER_TRADE = 2;

export const calculatePositionSize = (config: PositionSizeConfig): PositionSizeResult => {
  const {
    method,
    equity,
    entryPrice,
    maxPositionSizePercent,
    stopLoss,
    leverage = 1,
    historicalStats,
    volatility,
    kellyFraction,
    riskPerTrade = DEFAULT_RISK_PER_TRADE,
  } = config;

  const effectiveEquity = equity * leverage;
  const maxPositionValue = calculateMaxPositionValue(effectiveEquity, maxPositionSizePercent);

  let quantity: number;
  let positionPercent: number;
  let rationale: string;

  switch (method) {
    case 'fixed':
    case 'percentage': {
      const result = calculateFixedPositionSize(effectiveEquity, entryPrice, maxPositionSizePercent);
      quantity = result.quantity;
      positionPercent = maxPositionSizePercent;
      rationale = `Fixed ${positionPercent.toFixed(1)}% of equity`;
      break;
    }

    case 'kelly': {
      const kellyResult = calculateKellyCriterion(historicalStats, kellyFraction);
      const kellyPositionValue = effectiveEquity * (kellyResult.kellyPercent / 100);
      const constrainedValue = Math.min(kellyPositionValue, maxPositionValue);
      quantity = constrainedValue / entryPrice;
      positionPercent = Math.min(kellyResult.kellyPercent, maxPositionSizePercent);
      rationale = kellyResult.rationale;
      break;
    }

    case 'risk-based': {
      if (!stopLoss || stopLoss === entryPrice) {
        const result = calculateFixedPositionSize(effectiveEquity, entryPrice, maxPositionSizePercent);
        quantity = result.quantity;
        positionPercent = maxPositionSizePercent;
        rationale = `No stop loss - using fixed ${maxPositionSizePercent}%`;
      } else {
        const result = calculateRiskBasedPositionSize(effectiveEquity, entryPrice, stopLoss, riskPerTrade);
        const constrainedValue = Math.min(result.positionValue, maxPositionValue);
        quantity = constrainedValue / entryPrice;
        positionPercent = (constrainedValue / effectiveEquity) * 100;

        const stopDistancePercent = (Math.abs(entryPrice - stopLoss) / entryPrice) * 100;
        rationale = `Risk ${riskPerTrade}% of equity with ${stopDistancePercent.toFixed(2)}% stop`;
      }
      break;
    }

    case 'volatility-adjusted': {
      const baseResult = calculateFixedPositionSize(effectiveEquity, entryPrice, maxPositionSizePercent);
      quantity = baseResult.quantity;

      if (volatility?.atrPercent) {
        quantity = applyVolatilityAdjustment(quantity, volatility.atrPercent);
        const adjustedValue = quantity * entryPrice;
        positionPercent = (adjustedValue / effectiveEquity) * 100;
        rationale = `Volatility-adjusted: ATR ${volatility.atrPercent.toFixed(2)}% → ${positionPercent.toFixed(1)}%`;
      } else {
        positionPercent = maxPositionSizePercent;
        rationale = `No volatility data - using fixed ${positionPercent}%`;
      }
      break;
    }

    default: {
      const result = calculateFixedPositionSize(effectiveEquity, entryPrice, maxPositionSizePercent);
      quantity = result.quantity;
      positionPercent = maxPositionSizePercent;
      rationale = `Default fixed ${positionPercent}%`;
    }
  }

  if (volatility?.atrPercent && method !== 'volatility-adjusted') {
    quantity = applyVolatilityAdjustment(quantity, volatility.atrPercent);
  }

  const finalQuantity = roundQuantity(quantity);
  const notionalValue = finalQuantity * entryPrice;
  const riskAmount = stopLoss
    ? finalQuantity * Math.abs(entryPrice - stopLoss)
    : notionalValue * 0.02;

  return {
    quantity: finalQuantity,
    notionalValue,
    riskAmount,
    positionPercent: Math.min(positionPercent, maxPositionSizePercent),
    method,
    rationale,
  };
};

export const recommendPositionSizingMethod = (
  winRate: number,
  profitFactor: number,
  totalTrades: number,
  hasStopLoss: boolean
): 'risk-based' | 'kelly' | 'fixed' => {
  if (totalTrades < 30) return hasStopLoss ? 'risk-based' : 'fixed';
  if (profitFactor > 1.5 && winRate > 0.35 && winRate < 0.65) return 'kelly';
  if (hasStopLoss) return 'risk-based';
  return 'fixed';
};
