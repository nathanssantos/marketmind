/**
 * Position Sizing Calculator
 * 
 * Implements professional position sizing strategies:
 * 1. Risk-Based: Size based on % of capital willing to risk
 * 2. Kelly Criterion: Optimal sizing based on win rate and risk/reward
 * 3. Volatility-Based: Adjust position size based on market volatility
 * 4. Fixed Fractional: Simple % of total equity
 */

export interface PositionSizingConfig {
  method: 'risk-based' | 'kelly' | 'volatility' | 'fixed-fractional';
  
  // Risk-Based parameters
  riskPerTrade?: number; // % of equity to risk per trade (e.g., 1, 2, 3)
  
  // Kelly Criterion parameters
  winRate?: number; // Historical win rate (0-1)
  avgWinPercent?: number; // Average win size as %
  avgLossPercent?: number; // Average loss size as %
  kellyFraction?: number; // Fraction of Kelly (0.25 = quarter Kelly, safer)
  
  // Volatility-Based parameters
  atr?: number; // Current ATR value
  atrMultiplier?: number; // Multiplier for volatility adjustment
  
  // Fixed Fractional
  fixedPercent?: number; // Fixed % of equity per trade
  
  // Global constraints
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
    const minPercent = config.minPositionPercent ?? 1;
    const maxPercent = config.maxPositionPercent ?? 100;

    let positionPercent: number;
    let rationale: string;

    switch (config.method) {
      case 'risk-based':
        ({ positionPercent, rationale } = this.calculateRiskBased(
          equity,
          entryPrice,
          stopLossPrice,
          config.riskPerTrade ?? 2
        ));
        break;

      case 'kelly':
        ({ positionPercent, rationale } = this.calculateKelly(
          config.winRate ?? 0.5,
          config.avgWinPercent ?? 5,
          config.avgLossPercent ?? 2,
          config.kellyFraction ?? 0.25
        ));
        break;

      case 'volatility':
        ({ positionPercent, rationale } = this.calculateVolatilityBased(
          config.atr ?? 0,
          entryPrice,
          config.atrMultiplier ?? 2.0,
          maxPercent
        ));
        break;

      case 'fixed-fractional':
      default:
        positionPercent = config.fixedPercent ?? 10;
        rationale = `Fixed ${positionPercent}% of equity`;
        break;
    }

    // Apply constraints
    positionPercent = Math.max(minPercent, Math.min(maxPercent, positionPercent));

    // Calculate actual values
    const positionValue = equity * (positionPercent / 100);
    const positionSize = positionValue / entryPrice;

    // Calculate risk amount
    const riskAmount = stopLossPrice
      ? Math.abs(entryPrice - stopLossPrice) * positionSize
      : positionValue * 0.02; // Default 2% risk if no stop

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
      // Fallback to fixed % if no valid stop
      return {
        positionPercent: 10,
        rationale: `No stop loss - using fixed 10%`,
      };
    }

    const riskAmount = equity * (riskPercent / 100);
    const stopDistance = Math.abs(entryPrice - stopLossPrice);
    const stopDistancePercent = (stopDistance / entryPrice) * 100;

    // Position value needed to risk exactly riskPercent
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

    // Kelly formula
    const kellyPercent = ((p * b - q) / b) * 100;

    // Apply Kelly fraction for safety (typically 0.25 to 0.5)
    const adjustedPercent = kellyPercent * kellyFraction;

    // Ensure positive and reasonable
    const finalPercent = Math.max(1, Math.min(100, adjustedPercent));

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
    atrMultiplier: number,
    maxPercent: number
  ): { positionPercent: number; rationale: string } {
    if (atr === 0 || !atr) {
      return {
        positionPercent: 10,
        rationale: `No ATR available - using fixed 10%`,
      };
    }

    const atrPercent = (atr / entryPrice) * 100;

    // Inverse relationship: higher volatility = smaller position
    // Target: If ATR is 2%, position = 50%
    // If ATR is 4%, position = 25%
    // If ATR is 1%, position = 100%
    const targetAtrPercent = 2.0; // Baseline ATR %
    const baselinePosition = 50; // Position size at baseline ATR

    const positionPercent = (baselinePosition * targetAtrPercent) / atrPercent;

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
    // Start with quarter-Kelly (conservative default)
    let kellyFraction = 0.25;

    // Adjust based on win rate confidence
    if (winRate > 0.5) {
      kellyFraction += 0.05; // More aggressive with higher win rate
    }

    // Adjust based on profit factor
    if (profitFactor > 2.0) {
      kellyFraction += 0.1; // Much more aggressive with strong PF
    } else if (profitFactor < 1.2) {
      kellyFraction -= 0.1; // More conservative with weak PF
    }

    // Adjust based on drawdown risk
    if (maxDrawdownPercent > 20) {
      kellyFraction -= 0.15; // Very conservative with high DD
    } else if (maxDrawdownPercent < 5) {
      kellyFraction += 0.05; // Slightly more aggressive with low DD
    }

    // Constrain to reasonable range
    return Math.max(0.1, Math.min(0.5, kellyFraction));
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
    // Need sufficient sample size for Kelly
    if (totalTrades < 30) {
      return hasStopLoss ? 'risk-based' : 'fixed-fractional';
    }

    // Kelly works best with consistent edge
    if (profitFactor > 1.5 && winRate > 0.35 && winRate < 0.65) {
      return 'kelly';
    }

    // Risk-based is safest with defined stops
    if (hasStopLoss) {
      return 'risk-based';
    }

    // Default to fixed fractional
    return 'fixed-fractional';
  }
}
