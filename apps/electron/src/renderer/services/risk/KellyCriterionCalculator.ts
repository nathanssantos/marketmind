/**
 * Kelly Criterion Calculator
 * 
 * Implements the Kelly Criterion formula for optimal position sizing.
 * Based on academic research from:
 * - Kelly, J. L. (1956) "A New Interpretation of Information Rate"
 * - Thorp, E. O. (1997) "The Kelly Criterion in Blackjack, Sports Betting, and the Stock Market"
 * 
 * Formula: f* = (p/l - q/g)
 * Where:
 * - f* = fraction of capital to allocate
 * - p = probability of win
 * - q = probability of loss (1 - p)
 * - g = fraction gained on win
 * - l = fraction lost on loss
 * 
 * Alternative form: f* = (p/l) * (1 - 1/(WLP * WLR))
 * Where:
 * - WLP = win-loss probability ratio (p/(1-p))
 * - WLR = win-loss size ratio (average win / average loss)
 */

export interface KellyInputs {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  riskFreeRate?: number;
}

export interface KellyResult {
  kellyFraction: number;
  kellyPercent: number;
  halfKelly: number;
  quarterKelly: number;
  recommended: number;
  isValid: boolean;
  warning?: string;
}

export class KellyCriterionCalculator {
  private static readonly MAX_KELLY = 0.25;
  private static readonly MIN_EDGE = 0.01;
  private static readonly RECOMMENDED_FRACTION = 0.25;

  /**
   * Calculate Kelly Criterion position size
   */
  static calculate(inputs: KellyInputs): KellyResult {
    const { winRate, avgWin, avgLoss, riskFreeRate = 0 } = inputs;

    if (!this.validateInputs(inputs)) {
      return {
        kellyFraction: 0,
        kellyPercent: 0,
        halfKelly: 0,
        quarterKelly: 0,
        recommended: 0,
        isValid: false,
        warning: 'Invalid inputs: win rate must be between 0 and 1, avg win/loss must be positive',
      };
    }

    const p = winRate;
    const q = 1 - p;

    if (avgLoss === 0) {
      return {
        kellyFraction: 0,
        kellyPercent: 0,
        halfKelly: 0,
        quarterKelly: 0,
        recommended: 0,
        isValid: false,
        warning: 'Average loss cannot be zero',
      };
    }

    const winLossRatio = Math.abs(avgWin / avgLoss);

    const kellyFraction = (p * winLossRatio - q) / winLossRatio;

    const edge = (p * avgWin + q * avgLoss - riskFreeRate) / Math.abs(avgLoss);

    if (edge < this.MIN_EDGE) {
      return {
        kellyFraction: 0,
        kellyPercent: 0,
        halfKelly: 0,
        quarterKelly: 0,
        recommended: 0,
        isValid: false,
        warning: `Edge too small (${(edge * 100).toFixed(2)}%). Strategy may not be profitable.`,
      };
    }

    const cappedKelly = Math.max(0, Math.min(kellyFraction, this.MAX_KELLY));
    const halfKelly = cappedKelly * 0.5;
    const quarterKelly = cappedKelly * 0.25;

    const recommended = quarterKelly;

    let warning: string | undefined;
    if (kellyFraction > this.MAX_KELLY) {
      warning = `Full Kelly (${(kellyFraction * 100).toFixed(2)}%) exceeds max ${this.MAX_KELLY * 100}%. Using capped value.`;
    } else if (kellyFraction < 0) {
      warning = 'Negative Kelly fraction indicates expected losses. Do not trade this strategy.';
    }

    return {
      kellyFraction: cappedKelly,
      kellyPercent: cappedKelly * 100,
      halfKelly,
      quarterKelly,
      recommended,
      isValid: kellyFraction > 0,
      warning,
    };
  }

  /**
   * Calculate Kelly from trade history
   */
  static fromTradeHistory(trades: Array<{ pnl: number }>): KellyResult {
    if (trades.length === 0) {
      return {
        kellyFraction: 0,
        kellyPercent: 0,
        halfKelly: 0,
        quarterKelly: 0,
        recommended: 0,
        isValid: false,
        warning: 'No trade history provided',
      };
    }

    const wins = trades.filter((t) => t.pnl > 0);
    const losses = trades.filter((t) => t.pnl <= 0);

    if (losses.length === 0) {
      return {
        kellyFraction: this.MAX_KELLY,
        kellyPercent: this.MAX_KELLY * 100,
        halfKelly: this.MAX_KELLY * 0.5,
        quarterKelly: this.MAX_KELLY * 0.25,
        recommended: this.MAX_KELLY * 0.25,
        isValid: true,
        warning: 'No losing trades in history. Using maximum Kelly.',
      };
    }

    const winRate = wins.length / trades.length;
    const avgWin = wins.reduce((sum, t) => sum + t.pnl, 0) / wins.length;
    const avgLoss = Math.abs(losses.reduce((sum, t) => sum + t.pnl, 0) / losses.length);

    return this.calculate({ winRate, avgWin, avgLoss });
  }

  /**
   * Calculate optimal position size in dollars
   */
  static calculatePositionSize(
    capital: number,
    kellyFraction: number,
    useFractionalKelly = true,
    fraction = this.RECOMMENDED_FRACTION
  ): number {
    const adjustedFraction = useFractionalKelly ? kellyFraction * fraction : kellyFraction;
    return capital * adjustedFraction;
  }

  /**
   * Calculate Kelly with risk adjustment (drawdown consideration)
   */
  static calculateRiskAdjusted(
    inputs: KellyInputs,
    currentDrawdown: number,
    maxDrawdown: number
  ): KellyResult {
    const baseResult = this.calculate(inputs);

    if (!baseResult.isValid) return baseResult;

    const drawdownRatio = currentDrawdown / maxDrawdown;
    const scaleFactor = Math.max(0, 1 - drawdownRatio);

    const adjustedKelly = baseResult.kellyFraction * scaleFactor;
    const adjustedHalfKelly = adjustedKelly * 0.5;
    const adjustedQuarterKelly = adjustedKelly * 0.25;

    return {
      kellyFraction: adjustedKelly,
      kellyPercent: adjustedKelly * 100,
      halfKelly: adjustedHalfKelly,
      quarterKelly: adjustedQuarterKelly,
      recommended: adjustedQuarterKelly,
      isValid: true,
      warning:
        drawdownRatio > 0.5
          ? `High drawdown (${(drawdownRatio * 100).toFixed(1)}%). Position size reduced by ${((1 - scaleFactor) * 100).toFixed(1)}%.`
          : baseResult.warning,
    };
  }

  private static validateInputs(inputs: KellyInputs): boolean {
    const { winRate, avgWin, avgLoss } = inputs;
    return winRate >= 0 && winRate <= 1 && avgWin > 0 && avgLoss > 0;
  }

  /**
   * Calculate expected growth rate (geometric mean)
   */
  static calculateExpectedGrowth(inputs: KellyInputs, kellyFraction: number): number {
    const { winRate, avgWin, avgLoss } = inputs;
    const p = winRate;
    const q = 1 - p;

    const gainFactor = 1 + kellyFraction * (avgWin / avgLoss);
    const lossFactor = 1 - kellyFraction;

    const geometricMean = Math.pow(gainFactor, p) * Math.pow(lossFactor, q);

    return geometricMean - 1;
  }

  /**
   * Calculate probability of ruin (simplified approximation)
   */
  static calculateRuinProbability(
    winRate: number,
    winLossRatio: number,
    kellyFraction: number,
    maxDrawdown = 0.5
  ): number {
    if (kellyFraction <= 0) return 1;

    const fullKelly = (winRate * winLossRatio - (1 - winRate)) / winLossRatio;

    if (fullKelly <= 0) return 1;

    const fractionUsed = kellyFraction / fullKelly;

    const ruinProbability = Math.pow(
      (1 - winRate) / winRate / winLossRatio,
      fractionUsed / maxDrawdown
    );

    return Math.min(1, Math.max(0, ruinProbability));
  }
}
