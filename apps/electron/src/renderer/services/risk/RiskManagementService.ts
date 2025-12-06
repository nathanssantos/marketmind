/**
 * Risk Management Service
 * 
 * Orchestrates all risk management components:
 * - Kelly Criterion position sizing
 * - Volatility-adjusted Kelly
 * - Portfolio heat tracking
 * - Dynamic risk limits
 * 
 * Provides unified interface for position sizing and risk assessment.
 */

import type { Kline } from '@marketmind/types';
import { KellyCriterionCalculator, type KellyResult } from './KellyCriterionCalculator';
import {
    PortfolioHeatTracker,
    type HeatLimits,
    type PortfolioHeat,
    type Position,
} from './PortfolioHeatTracker';
import { VolatilityAdjustedKelly, type VolatilityAdjustedResult } from './VolatilityAdjustedKelly';

export interface RiskProfile {
  name: 'conservative' | 'moderate' | 'aggressive';
  maxTotalHeat: number;
  maxPositionHeat: number;
  kellyFraction: number;
  maxLeverage: number;
}

export interface PositionSizingRequest {
  winRate: number;
  avgWin: number;
  avgLoss: number;
  capital: number;
  klines: Kline[];
  currentPositions: Position[];
  riskProfile?: RiskProfile;
}

export interface PositionSizingResult {
  recommendedSize: number;
  recommendedSizePercent: number;
  kellyResult: KellyResult;
  volatilityAdjusted: VolatilityAdjustedResult;
  portfolioHeat: PortfolioHeat;
  canTrade: boolean;
  reasons: string[];
  riskMetrics: {
    capitalAtRisk: number;
    riskRewardRatio: number;
    expectedValue: number;
    maxDrawdownRisk: number;
  };
}

export interface RiskAssessment {
  overall: 'low' | 'moderate' | 'high' | 'extreme';
  portfolioHeat: PortfolioHeat;
  volatilityLevel: 'low' | 'moderate' | 'high';
  diversificationScore: number;
  recommendations: string[];
}

export class RiskManagementService {
  private static readonly RISK_PROFILES: Record<string, RiskProfile> = {
    conservative: {
      name: 'conservative',
      maxTotalHeat: 0.03,
      maxPositionHeat: 0.01,
      kellyFraction: 0.25,
      maxLeverage: 2,
    },
    moderate: {
      name: 'moderate',
      maxTotalHeat: 0.06,
      maxPositionHeat: 0.02,
      kellyFraction: 0.25,
      maxLeverage: 5,
    },
    aggressive: {
      name: 'aggressive',
      maxTotalHeat: 0.10,
      maxPositionHeat: 0.03,
      kellyFraction: 0.5,
      maxLeverage: 10,
    },
  };

  /**
   * Calculate optimal position size using all risk management components
   */
  static calculatePositionSize(request: PositionSizingRequest): PositionSizingResult {
    const { winRate, avgWin, avgLoss, capital, klines, currentPositions, riskProfile } = request;

    const profile = riskProfile || this.RISK_PROFILES['moderate'];
    if (!profile) throw new Error('Risk profile not found');

    const kellyResult = KellyCriterionCalculator.calculate({
      winRate,
      avgWin,
      avgLoss,
    });

    const volatilityAdjusted = VolatilityAdjustedKelly.adjustKellyForVolatility(
      kellyResult.kellyFraction,
      klines,
      capital
    );

    const heatLimits: HeatLimits = {
      maxTotalHeat: profile.maxTotalHeat,
      maxPositionHeat: profile.maxPositionHeat,
      maxCorrelatedHeat: profile.maxTotalHeat * 0.67,
      lowHeatThreshold: profile.maxTotalHeat * 0.33,
      moderateHeatThreshold: profile.maxTotalHeat * 0.67,
      highHeatThreshold: profile.maxTotalHeat,
    };

    const portfolioHeat = PortfolioHeatTracker.calculatePortfolioHeat(
      currentPositions,
      capital,
      heatLimits
    );

    const adjustedKelly = volatilityAdjusted.adjustedKelly * profile.kellyFraction;

    const maxRiskBasedOnHeat = PortfolioHeatTracker.getRecommendedPositionSize(
      currentPositions,
      capital,
      adjustedKelly,
      heatLimits
    );

    const recommendedSize = Math.min(
      volatilityAdjusted.recommendedPositionSize * profile.kellyFraction,
      maxRiskBasedOnHeat
    );

    const recommendedSizePercent = recommendedSize / capital;

    const canTrade = recommendedSize > 0 && !portfolioHeat.isOverheated && kellyResult.isValid;

    const reasons: string[] = [];
    if (!kellyResult.isValid) {
      reasons.push(kellyResult.warning || 'Invalid Kelly Criterion result');
    }
    if (portfolioHeat.isOverheated) {
      reasons.push('Portfolio heat exceeds limits');
    }
    if (volatilityAdjusted.volatilityMetrics.isHighVolatility) {
      reasons.push('High market volatility detected');
    }
    if (recommendedSize === 0) {
      reasons.push('Recommended position size is zero - conditions not favorable');
    }

    const capitalAtRisk = recommendedSize;
    const riskRewardRatio = avgWin / avgLoss;
    const expectedValue = winRate * avgWin - (1 - winRate) * avgLoss;
    const maxDrawdownRisk = portfolioHeat.totalHeatPercent;

    return {
      recommendedSize,
      recommendedSizePercent,
      kellyResult,
      volatilityAdjusted,
      portfolioHeat,
      canTrade,
      reasons,
      riskMetrics: {
        capitalAtRisk,
        riskRewardRatio,
        expectedValue,
        maxDrawdownRisk,
      },
    };
  }

  /**
   * Assess current portfolio risk
   */
  static assessRisk(
    currentPositions: Position[],
    capital: number,
    klines: Kline[],
    riskProfile?: RiskProfile
  ): RiskAssessment {
    const profile = riskProfile || this.RISK_PROFILES['moderate'];
    if (!profile) throw new Error('Risk profile not found');

    const heatLimits: HeatLimits = {
      maxTotalHeat: profile.maxTotalHeat,
      maxPositionHeat: profile.maxPositionHeat,
      maxCorrelatedHeat: profile.maxTotalHeat * 0.67,
      lowHeatThreshold: profile.maxTotalHeat * 0.33,
      moderateHeatThreshold: profile.maxTotalHeat * 0.67,
      highHeatThreshold: profile.maxTotalHeat,
    };

    const portfolioHeat = PortfolioHeatTracker.calculatePortfolioHeat(
      currentPositions,
      capital,
      heatLimits
    );

    const volatilityMetrics = VolatilityAdjustedKelly.calculateVolatilityMetrics(klines);
    const volatilityLevel = volatilityMetrics.isHighVolatility
      ? 'high'
      : volatilityMetrics.isLowVolatility
        ? 'low'
        : 'moderate';

    const diversificationScore = PortfolioHeatTracker.calculateDiversificationScore(
      currentPositions,
      capital
    );

    const overall = portfolioHeat.heatLevel;

    const recommendations: string[] = [];
    recommendations.push(portfolioHeat.recommendation);

    if (volatilityLevel === 'high') {
      recommendations.push('High volatility: Consider tightening stop losses');
    }

    if (diversificationScore < 0.5 && currentPositions.length > 1) {
      recommendations.push('Low diversification: Risk is concentrated in few positions');
    }

    if (portfolioHeat.isOverheated) {
      const reduction = PortfolioHeatTracker.calculateHeatReduction(
        currentPositions,
        capital,
        heatLimits.maxTotalHeat
      );
      recommendations.push(...reduction.suggestions);
    }

    return {
      overall,
      portfolioHeat,
      volatilityLevel,
      diversificationScore,
      recommendations,
    };
  }

  /**
   * Get risk profile by name
   */
  static getRiskProfile(name: 'conservative' | 'moderate' | 'aggressive'): RiskProfile {
    return this.RISK_PROFILES[name] ?? this.RISK_PROFILES['moderate']!;
  }

  /**
   * Calculate stop loss using ATR
   */
  static calculateStopLoss(klines: Kline[], _side: 'long' | 'short', multiplier = 2): number {
    return VolatilityAdjustedKelly.calculateATRStopLoss(klines, multiplier);
  }

  /**
   * Calculate take profit using ATR
   */
  static calculateTakeProfit(klines: Kline[], _side: 'long' | 'short', multiplier = 3): number {
    return VolatilityAdjustedKelly.calculateATRTakeProfit(klines, multiplier);
  }

  /**
   * Validate position against risk limits
   */
  static validatePosition(
    position: Position,
    currentPositions: Position[],
    capital: number,
    riskProfile?: RiskProfile
  ): { valid: boolean; reasons: string[] } {
    const profile = riskProfile || this.RISK_PROFILES['moderate'];

    const heatLimits: HeatLimits = {
      maxTotalHeat: profile!.maxTotalHeat,
      maxPositionHeat: profile!.maxPositionHeat,
      maxCorrelatedHeat: profile!.maxTotalHeat * 0.67,
      lowHeatThreshold: profile!.maxTotalHeat * 0.33,
      moderateHeatThreshold: profile!.maxTotalHeat * 0.67,
      highHeatThreshold: profile!.maxTotalHeat,
    };

    const result = PortfolioHeatTracker.canAddPosition(
      currentPositions,
      position,
      capital,
      heatLimits
    );

    const reasons: string[] = [];
    if (!result.allowed && result.reason) {
      reasons.push(result.reason);
    }

    const positionHeat = PortfolioHeatTracker.calculatePositionRisk(position, capital);

    if (positionHeat.riskPercent > heatLimits.maxPositionHeat) {
      reasons.push(
        `Position risk ${(positionHeat.riskPercent * 100).toFixed(2)}% exceeds max ${(heatLimits.maxPositionHeat * 100).toFixed(2)}%`
      );
    }

    return {
      valid: result.allowed && reasons.length === 0,
      reasons,
    };
  }

  /**
   * Calculate recommended leverage based on volatility
   */
  static calculateRecommendedLeverage(
    klines: Kline[],
    riskProfile?: RiskProfile
  ): number {
    const profile = riskProfile || this.RISK_PROFILES['moderate'];
    return VolatilityAdjustedKelly.calculateRecommendedLeverage(klines, profile!.maxLeverage);
  }

  /**
   * Get comprehensive risk summary
   */
  static getRiskSummary(
    currentPositions: Position[],
    capital: number,
    klines: Kline[],
    riskProfile?: RiskProfile
  ): {
    assessment: RiskAssessment;
    heatStatus: string;
    volatilityStatus: string;
    diversificationStatus: string;
    actionable: string[];
  } {
    const assessment = this.assessRisk(currentPositions, capital, klines, riskProfile);

    const profile = riskProfile || this.RISK_PROFILES['moderate'];
    const heatLimits: HeatLimits = {
      maxTotalHeat: profile!.maxTotalHeat,
      maxPositionHeat: profile!.maxPositionHeat,
      maxCorrelatedHeat: profile!.maxTotalHeat * 0.67,
      lowHeatThreshold: profile!.maxTotalHeat * 0.33,
      moderateHeatThreshold: profile!.maxTotalHeat * 0.67,
      highHeatThreshold: profile!.maxTotalHeat,
    };

    const heatStatus = PortfolioHeatTracker.getHeatStatus(
      assessment.portfolioHeat.totalHeatPercent,
      heatLimits
    );

    const volatilityStatus = `Volatility: ${assessment.volatilityLevel} (ATR: ${VolatilityAdjustedKelly.calculateATRPercent(klines).toFixed(2)}%)`;

    const diversificationStatus =
      assessment.diversificationScore > 0.7
        ? 'Well diversified'
        : assessment.diversificationScore > 0.4
          ? 'Moderately diversified'
          : 'Poorly diversified';

    const actionable = assessment.recommendations.filter((r) =>
      r.includes('Consider') || r.includes('Avoid') || r.includes('Close') || r.includes('Reduce')
    );

    return {
      assessment,
      heatStatus,
      volatilityStatus,
      diversificationStatus,
      actionable,
    };
  }
}
