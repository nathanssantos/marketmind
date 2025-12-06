/**
 * Portfolio Heat Tracker
 * 
 * Tracks total portfolio risk exposure across multiple positions.
 * Prevents over-leverage and concentration risk.
 * 
 * Key Concepts:
 * - Portfolio Heat: Total % of capital at risk across all positions
 * - Position Correlation: Risk adjustment for correlated assets
 * - Maximum Heat Limits: 6% typical, 10% aggressive, 3% conservative
 * - Heat Map: Visual representation of risk distribution
 * 
 * References:
 * - Van K. Tharp "Trade Your Way to Financial Freedom"
 * - Ryan Jones "The Trading Game"
 * - Mark Douglas "Trading in the Zone"
 */

export interface Position {
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  stopLoss: number;
  side: 'long' | 'short';
}

export interface PortfolioHeat {
  totalHeat: number;
  totalHeatPercent: number;
  positionCount: number;
  positions: PositionHeat[];
  isOverheated: boolean;
  heatLevel: 'low' | 'moderate' | 'high' | 'extreme';
  recommendation: string;
}

export interface PositionHeat {
  symbol: string;
  riskAmount: number;
  riskPercent: number;
  positionSize: number;
  positionSizePercent: number;
  rRatio: number;
}

export interface HeatLimits {
  maxTotalHeat: number;
  maxPositionHeat: number;
  maxCorrelatedHeat: number;
  lowHeatThreshold: number;
  moderateHeatThreshold: number;
  highHeatThreshold: number;
}

export class PortfolioHeatTracker {
  private static readonly DEFAULT_LIMITS: HeatLimits = {
    maxTotalHeat: 0.06,
    maxPositionHeat: 0.02,
    maxCorrelatedHeat: 0.04,
    lowHeatThreshold: 0.02,
    moderateHeatThreshold: 0.04,
    highHeatThreshold: 0.06,
  };

  /**
   * Calculate risk per position
   */
  static calculatePositionRisk(position: Position, capital: number): PositionHeat {
    const { symbol, entryPrice, currentPrice, quantity, stopLoss, side } = position;

    const positionSize = quantity * currentPrice;
    const positionSizePercent = positionSize / capital;

    let riskPerUnit: number;
    if (side === 'long') {
      riskPerUnit = Math.max(0, entryPrice - stopLoss);
    } else {
      riskPerUnit = Math.max(0, stopLoss - entryPrice);
    }

    const riskAmount = riskPerUnit * quantity;
    const riskPercent = riskAmount / capital;

    let potentialGain: number;
    if (side === 'long') {
      potentialGain = Math.max(0, currentPrice - entryPrice) * quantity;
    } else {
      potentialGain = Math.max(0, entryPrice - currentPrice) * quantity;
    }

    const rRatio = riskAmount > 0 ? potentialGain / riskAmount : 0;

    return {
      symbol,
      riskAmount,
      riskPercent,
      positionSize,
      positionSizePercent,
      rRatio,
    };
  }

  /**
   * Calculate total portfolio heat
   */
  static calculatePortfolioHeat(
    positions: Position[],
    capital: number,
    limits: HeatLimits = this.DEFAULT_LIMITS
  ): PortfolioHeat {
    const positionHeats = positions.map((pos) => this.calculatePositionRisk(pos, capital));

    const totalHeat = positionHeats.reduce((sum, pos) => sum + pos.riskAmount, 0);
    const totalHeatPercent = totalHeat / capital;

    const isOverheated = totalHeatPercent > limits.maxTotalHeat;

    let heatLevel: 'low' | 'moderate' | 'high' | 'extreme';
    if (totalHeatPercent <= limits.lowHeatThreshold) {
      heatLevel = 'low';
    } else if (totalHeatPercent <= limits.moderateHeatThreshold) {
      heatLevel = 'moderate';
    } else if (totalHeatPercent <= limits.highHeatThreshold) {
      heatLevel = 'high';
    } else {
      heatLevel = 'extreme';
    }

    let recommendation: string;
    if (heatLevel === 'low') {
      recommendation = 'Portfolio heat is low. Consider adding positions if setups are available.';
    } else if (heatLevel === 'moderate') {
      recommendation = 'Portfolio heat is moderate. Monitor closely and avoid correlated positions.';
    } else if (heatLevel === 'high') {
      recommendation =
        'Portfolio heat is high. Avoid new positions until heat decreases or positions close.';
    } else {
      recommendation =
        'Portfolio heat is EXTREME. Close positions immediately or tighten stops to reduce risk.';
    }

    return {
      totalHeat,
      totalHeatPercent,
      positionCount: positions.length,
      positions: positionHeats,
      isOverheated,
      heatLevel,
      recommendation,
    };
  }

  /**
   * Check if new position can be added without exceeding limits
   */
  static canAddPosition(
    currentPositions: Position[],
    newPosition: Position,
    capital: number,
    limits: HeatLimits = this.DEFAULT_LIMITS
  ): { allowed: boolean; reason?: string; currentHeat: number; newHeat: number } {
    const currentHeat = this.calculatePortfolioHeat(currentPositions, capital, limits);

    const newPositionHeat = this.calculatePositionRisk(newPosition, capital);

    const newTotalHeatPercent = currentHeat.totalHeatPercent + newPositionHeat.riskPercent;

    if (newPositionHeat.riskPercent > limits.maxPositionHeat) {
      return {
        allowed: false,
        reason: `Position risk (${(newPositionHeat.riskPercent * 100).toFixed(2)}%) exceeds max position heat (${(limits.maxPositionHeat * 100).toFixed(2)}%)`,
        currentHeat: currentHeat.totalHeatPercent,
        newHeat: newTotalHeatPercent,
      };
    }

    if (newTotalHeatPercent > limits.maxTotalHeat) {
      return {
        allowed: false,
        reason: `Total portfolio heat would be ${(newTotalHeatPercent * 100).toFixed(2)}%, exceeding limit of ${(limits.maxTotalHeat * 100).toFixed(2)}%`,
        currentHeat: currentHeat.totalHeatPercent,
        newHeat: newTotalHeatPercent,
      };
    }

    return {
      allowed: true,
      currentHeat: currentHeat.totalHeatPercent,
      newHeat: newTotalHeatPercent,
    };
  }

  /**
   * Calculate correlated heat (simplified - assumes symbols with same base are correlated)
   */
  static calculateCorrelatedHeat(
    positions: Position[],
    capital: number,
    baseAsset: string
  ): number {
    const correlatedPositions = positions.filter((pos) => pos.symbol.includes(baseAsset));

    const correlatedHeat = correlatedPositions.reduce((sum, pos) => {
      const heat = this.calculatePositionRisk(pos, capital);
      return sum + heat.riskAmount;
    }, 0);

    return correlatedHeat / capital;
  }

  /**
   * Get recommended position size based on current heat
   */
  static getRecommendedPositionSize(
    currentPositions: Position[],
    capital: number,
    targetRiskPercent: number,
    limits: HeatLimits = this.DEFAULT_LIMITS
  ): number {
    const currentHeat = this.calculatePortfolioHeat(currentPositions, capital, limits);

    const availableHeat = limits.maxTotalHeat - currentHeat.totalHeatPercent;

    const recommendedRisk = Math.min(targetRiskPercent, availableHeat, limits.maxPositionHeat);

    return capital * Math.max(0, recommendedRisk);
  }

  /**
   * Calculate heat reduction needed to reach target
   */
  static calculateHeatReduction(
    currentPositions: Position[],
    capital: number,
    targetHeatPercent: number
  ): { reductionNeeded: number; positionsToClose: number; suggestions: string[] } {
    const currentHeat = this.calculatePortfolioHeat(currentPositions, capital);

    const reductionNeeded = Math.max(0, currentHeat.totalHeatPercent - targetHeatPercent);

    if (reductionNeeded === 0) {
      return {
        reductionNeeded: 0,
        positionsToClose: 0,
        suggestions: ['Portfolio heat is within target range.'],
      };
    }

    const sortedPositions = [...currentHeat.positions].sort(
      (a, b) => b.riskPercent - a.riskPercent
    );

    let cumulativeReduction = 0;
    let positionsToClose = 0;

    for (const pos of sortedPositions) {
      if (cumulativeReduction >= reductionNeeded) break;
      cumulativeReduction += pos.riskPercent;
      positionsToClose++;
    }

    const suggestions: string[] = [];
    suggestions.push(`Reduce portfolio heat by ${(reductionNeeded * 100).toFixed(2)}%`);
    suggestions.push(`Consider closing ${positionsToClose} position(s)`);
    suggestions.push(`Highest risk positions: ${sortedPositions.slice(0, 3).map((p) => p.symbol).join(', ')}`);
    suggestions.push('Or tighten stop losses on existing positions');

    return {
      reductionNeeded,
      positionsToClose,
      suggestions,
    };
  }

  /**
   * Get heat distribution by symbol
   */
  static getHeatDistribution(positions: Position[], capital: number): Map<string, number> {
    const distribution = new Map<string, number>();

    positions.forEach((pos) => {
      const heat = this.calculatePositionRisk(pos, capital);
      distribution.set(pos.symbol, heat.riskPercent);
    });

    return distribution;
  }

  /**
   * Calculate diversification score (0-1, higher is better)
   */
  static calculateDiversificationScore(positions: Position[], capital: number): number {
    if (positions.length === 0) return 1;
    if (positions.length === 1) return 0;

    const heats = positions.map((pos) => this.calculatePositionRisk(pos, capital).riskPercent);

    const avgHeat = heats.reduce((sum, h) => sum + h, 0) / heats.length;

    if (avgHeat === 0) return 1;

    const variance = heats.reduce((sum, h) => sum + Math.pow(h - avgHeat, 2), 0) / heats.length;
    const stdDev = Math.sqrt(variance);

    const coefficientOfVariation = stdDev / avgHeat;

    const diversificationScore = 1 / (1 + coefficientOfVariation);

    return Math.min(1, Math.max(0, diversificationScore));
  }

  /**
   * Get heat status message
   */
  static getHeatStatus(heatPercent: number, limits: HeatLimits = this.DEFAULT_LIMITS): string {
    const percentage = (heatPercent * 100).toFixed(2);

    if (heatPercent <= limits.lowHeatThreshold) {
      return `Low heat (${percentage}%) - Safe to add positions`;
    }
    if (heatPercent <= limits.moderateHeatThreshold) {
      return `Moderate heat (${percentage}%) - Monitor closely`;
    }
    if (heatPercent <= limits.highHeatThreshold) {
      return `High heat (${percentage}%) - Avoid new positions`;
    }
    return `EXTREME heat (${percentage}%) - Reduce positions immediately`;
  }
}
