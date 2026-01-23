export type PositionSizingMethod = 'fixed' | 'percentage' | 'kelly' | 'risk-based' | 'volatility-adjusted';

export interface HistoricalStats {
  winRate: number;
  avgRiskReward: number;
  tradeCount: number;
  avgWinPercent?: number;
  avgLossPercent?: number;
}

export interface VolatilityParams {
  atrPercent: number;
}

export interface PositionSizeConfig {
  method: PositionSizingMethod;
  equity: number;
  entryPrice: number;
  maxPositionSizePercent: number;
  stopLoss?: number;
  leverage?: number;
  historicalStats?: HistoricalStats;
  volatility?: VolatilityParams;
  kellyFraction?: number;
  riskPerTrade?: number;
}

export interface PositionSizeResult {
  quantity: number;
  notionalValue: number;
  riskAmount: number;
  positionPercent: number;
  method: PositionSizingMethod;
  rationale?: string;
}

export interface KellyResult {
  kellyPercent: number;
  fractionalKelly: number;
  rawKelly: number;
  isValid: boolean;
  rationale: string;
}

export interface AdaptiveConditions {
  drawdownPercent: number;
  volatilityLevel: 'low' | 'normal' | 'high' | 'extreme';
  consecutiveLosses: number;
  consecutiveWins: number;
  recentWinRate?: number;
}

export interface AdaptiveSizeResult {
  adjustedPercent: number;
  multiplier: number;
  rationale: string;
}
