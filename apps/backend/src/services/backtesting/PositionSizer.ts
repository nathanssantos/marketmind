import { POSITION_SIZING } from '../../constants';

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
  KELLY_BOUNDS,
  KELLY_ADJUSTMENTS,
  DRAWDOWN_THRESHOLDS,
  STRATEGY_EVALUATION,
} = POSITION_SIZING;

export interface PositionSizingConfig {
  method: 'risk-based' | 'kelly' | 'volatility' | 'fixed-fractional';
  
  riskPerTrade?: number; // % of equity to risk per trade (e.g., 1, 2, 3)
  
  winRate?: number; // Historical win rate (0-1)
  avgWinPercent?: number; // Average win size as %
  avgLossPercent?: number; // Average loss size as %
  kellyFraction?: number; // Fraction of Kelly (0.25 = quarter Kelly, safer)
  
  atr?: number; // Current ATR value
  atrMultiplier?: number; // Multiplier for volatility adjustment
  
  fixedPercent?: number; // Fixed % of equity per trade
  
  minPositionPercent?: number; // Minimum position size (default: 1%)
  maxPositionPercent?: number; // Maximum position size (default: 100%)
}

export interface PositionSizingResult {
  positionPercent: number; // % of equity to use
  positionSize: number; // Actual quantity to trade
  positionValue: number; // Dollar value of position
  method: string; // Method used
  riskAmount: number; // Dollar amount at risk
  rationale?: string; // Explanation of sizing decision
}

export class PositionSizer {
  /**
   * Calculate optimal position size based on configuration
   */
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
      positionSize,
      positionValue,
      method: config.method,
      riskAmount,
      rationale,
    };
  }

  /**
   * Risk-Based Position Sizing
   * Size position so that a stop loss hit = X% of equity
   * 
   * Formula: Position Size = (Risk Amount) / (Entry - Stop)
   */
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

  /**
   * Kelly Criterion Position Sizing
   * Optimal position size based on edge
   * 
   * Formula: f = (p * b - q) / b
   * Where:
   * - p = win probability
   * - q = loss probability (1 - p)
   * - b = win/loss ratio (avgWin / avgLoss)
   * 
   * Returns fraction of bankroll to bet
   */
  private static calculateKelly(
    winRate: number,
    avgWinPercent: number,
    avgLossPercent: number,
    kellyFraction: number
  ): { positionPercent: number; rationale: string } {
    const p = winRate;
    const q = 1 - winRate;
    const b = avgWinPercent / avgLossPercent; // Risk/reward ratio

    const kellyPercent = ((p * b - q) / b) * 100;

    const adjustedPercent = kellyPercent * kellyFraction;

    const finalPercent = Math.max(DEFAULT_MIN_PERCENT, Math.min(DEFAULT_MAX_PERCENT, adjustedPercent));

    return {
      positionPercent: finalPercent,
      rationale: `Kelly: WR=${(winRate * 100).toFixed(1)}%, R:R=${b.toFixed(2)}, Raw=${kellyPercent.toFixed(1)}%, Adjusted=${finalPercent.toFixed(1)}% (${kellyFraction}x Kelly)`,
    };
  }

  /**
   * Volatility-Based Position Sizing
   * Reduce position size in high volatility, increase in low volatility
   * 
   * Uses ATR as volatility proxy
   */
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

  /**
   * Calculate optimal Kelly fraction based on historical performance
   * Returns recommended Kelly fraction (0.1 to 0.5)
   */
  static calculateOptimalKellyFraction(
    winRate: number,
    profitFactor: number,
    maxDrawdownPercent: number
  ): number {
    let kellyFraction = DEFAULT_KELLY_FRACTION;

    if (winRate > DEFAULT_WIN_RATE) {
      kellyFraction += KELLY_ADJUSTMENTS.SMALL;
    }

    if (profitFactor > 2.0) {
      kellyFraction += KELLY_ADJUSTMENTS.MEDIUM;
    } else if (profitFactor < 1.2) {
      kellyFraction -= KELLY_ADJUSTMENTS.MEDIUM;
    }

    if (maxDrawdownPercent > DRAWDOWN_THRESHOLDS.MAX) {
      kellyFraction -= KELLY_ADJUSTMENTS.LARGE;
    } else if (maxDrawdownPercent < DRAWDOWN_THRESHOLDS.MIN) {
      kellyFraction += KELLY_ADJUSTMENTS.SMALL;
    }

    return Math.max(KELLY_BOUNDS.MIN, Math.min(KELLY_BOUNDS.MAX, kellyFraction));
  }

  /**
   * Get recommended position sizing method based on strategy characteristics
   */
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

    if (hasStopLoss) {
      return 'risk-based';
    }

    return 'fixed-fractional';
  }
}
