import {
  calculateKellyPercentage,
  calculateOptimalKellyFraction as coreCalculateOptimalKellyFraction,
  calculateAdaptiveSize as coreCalculateAdaptiveSize,
  roundQuantity,
  type AdaptiveConditions,
} from '@marketmind/trading-core';
import { POSITION_SIZING_CONFIG } from '@marketmind/types';

const {
  DEFAULT_MIN_PERCENT,
  DEFAULT_MAX_PERCENT,
  DEFAULT_RISK_PER_TRADE,
  DEFAULT_KELLY_FRACTION,
  DEFAULT_WIN_RATE,
  DEFAULT_AVG_WIN_PERCENT,
  DEFAULT_AVG_LOSS_PERCENT,
  DEFAULT_ATR_MULTIPLIER,
  DEFAULT_FIXED_PERCENT,
  DEFAULT_RISK_PERCENT,
  VOLATILITY_TARGET,
  STRATEGY_EVALUATION,
} = POSITION_SIZING_CONFIG;

export interface PositionSizingConfig {
  method: 'risk-based' | 'kelly' | 'volatility' | 'fixed-fractional';
  riskPerTrade?: number;
  winRate?: number;
  avgWinPercent?: number;
  avgLossPercent?: number;
  kellyFraction?: number;
  atr?: number;
  atrMultiplier?: number;
  fixedPercent?: number;
  minPositionPercent?: number;
  maxPositionPercent?: number;
}

export interface PositionSizingResult {
  positionPercent: number;
  positionSize: number;
  positionValue: number;
  method: string;
  riskAmount: number;
  rationale?: string;
}

export class PositionSizer {
  static calculatePositionSize(
    equity: number,
    entryPrice: number,
    stopLossPrice: number | undefined,
    config: PositionSizingConfig
  ): PositionSizingResult {
    const minPercent = config.minPositionPercent ?? DEFAULT_MIN_PERCENT;
    const maxPercent = config.maxPositionPercent ?? DEFAULT_MAX_PERCENT;

    let positionPercent: number;
    let rationale: string;

    switch (config.method) {
      case 'risk-based':
        ({ positionPercent, rationale } = this.calculateRiskBased(
          equity,
          entryPrice,
          stopLossPrice,
          config.riskPerTrade ?? DEFAULT_RISK_PER_TRADE
        ));
        break;

      case 'kelly':
        ({ positionPercent, rationale } = this.calculateKelly(
          config.winRate ?? DEFAULT_WIN_RATE,
          config.avgWinPercent ?? DEFAULT_AVG_WIN_PERCENT,
          config.avgLossPercent ?? DEFAULT_AVG_LOSS_PERCENT,
          config.kellyFraction ?? DEFAULT_KELLY_FRACTION
        ));
        break;

      case 'volatility':
        ({ positionPercent, rationale } = this.calculateVolatilityBased(
          config.atr ?? 0,
          entryPrice,
          config.atrMultiplier ?? DEFAULT_ATR_MULTIPLIER,
          maxPercent
        ));
        break;

      case 'fixed-fractional':
      default:
        positionPercent = config.fixedPercent ?? DEFAULT_FIXED_PERCENT;
        rationale = `Fixed ${positionPercent}% of equity`;
        break;
    }

    positionPercent = Math.max(minPercent, Math.min(maxPercent, positionPercent));

    const positionValue = equity * (positionPercent / 100);
    const positionSize = positionValue / entryPrice;

    const riskAmount = stopLossPrice
      ? Math.abs(entryPrice - stopLossPrice) * positionSize
      : positionValue * DEFAULT_RISK_PERCENT;

    return {
      positionPercent,
      positionSize: roundQuantity(positionSize),
      positionValue,
      method: config.method,
      riskAmount,
      rationale,
    };
  }

  private static calculateRiskBased(
    equity: number,
    entryPrice: number,
    stopLossPrice: number | undefined,
    riskPercent: number
  ): { positionPercent: number; rationale: string } {
    if (!stopLossPrice || stopLossPrice === entryPrice) {
      return {
        positionPercent: DEFAULT_FIXED_PERCENT,
        rationale: `No stop loss - using fixed ${DEFAULT_FIXED_PERCENT}%`,
      };
    }

    const riskAmount = equity * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice);
    const stopDistancePercent = (stopDistance / entryPrice) * 100;

    const positionValue = riskAmount / (stopDistancePercent / 100);
    const positionPercent = (positionValue / equity) * 100;

    return {
      positionPercent,
      rationale: `Risk ${riskPercent}% of equity ($${riskAmount.toFixed(2)}) with ${stopDistancePercent.toFixed(2)}% stop`,
    };
  }

  private static calculateKelly(
    winRate: number,
    avgWinPercent: number,
    avgLossPercent: number,
    kellyFraction: number
  ): { positionPercent: number; rationale: string } {
    const b = avgWinPercent / avgLossPercent;
    const kellyPercent = calculateKellyPercentage(winRate, b);
    const adjustedPercent = kellyPercent * kellyFraction;
    const finalPercent = Math.max(DEFAULT_MIN_PERCENT, Math.min(DEFAULT_MAX_PERCENT, adjustedPercent));

    return {
      positionPercent: finalPercent,
      rationale: `Kelly: WR=${(winRate * 100).toFixed(1)}%, R:R=${b.toFixed(2)}, Raw=${kellyPercent.toFixed(1)}%, Adjusted=${finalPercent.toFixed(1)}% (${kellyFraction}x Kelly)`,
    };
  }

  private static calculateVolatilityBased(
    atr: number,
    entryPrice: number,
    _atrMultiplier: number,
    maxPercent: number
  ): { positionPercent: number; rationale: string } {
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
  }

  static calculateOptimalKellyFraction(
    winRate: number,
    profitFactor: number,
    maxDrawdownPercent: number
  ): number {
    return coreCalculateOptimalKellyFraction(winRate, profitFactor, maxDrawdownPercent);
  }

  static recommendMethod(
    winRate: number,
    profitFactor: number,
    totalTrades: number,
    hasStopLoss: boolean
  ): 'risk-based' | 'kelly' | 'fixed-fractional' {
    if (totalTrades < STRATEGY_EVALUATION.MIN_WIN_RATE) {
      return hasStopLoss ? 'risk-based' : 'fixed-fractional';
    }

    if (profitFactor > STRATEGY_EVALUATION.MIN_PROFIT_FACTOR && winRate > STRATEGY_EVALUATION.MIN_KELLY && winRate < STRATEGY_EVALUATION.MAX_KELLY) {
      return 'kelly';
    }

    if (hasStopLoss) return 'risk-based';
    return 'fixed-fractional';
  }

  static calculateAdaptiveSize(
    basePositionPercent: number,
    conditions: AdaptiveConditions
  ): { adjustedPercent: number; rationale: string } {
    const result = coreCalculateAdaptiveSize(basePositionPercent, conditions);
    return {
      adjustedPercent: result.adjustedPercent,
      rationale: result.rationale,
    };
  }
}
