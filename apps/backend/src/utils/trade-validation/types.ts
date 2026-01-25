import type { Kline } from '@marketmind/types';

export interface TradeValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface RiskRewardInput {
  entryPrice: number;
  stopLoss: number | undefined;
  takeProfit: number | undefined;
  direction: 'LONG' | 'SHORT';
  minRiskRewardRatio?: number;
}

export interface RiskRewardResult extends TradeValidationResult {
  riskRewardRatio: number | null;
  risk: number | null;
  reward: number | null;
}

export interface MinNotionalInput {
  positionValue: number;
  minTradeValueUsd?: number;
}

export interface MinProfitInput {
  entryPrice: number;
  takeProfit: number | undefined;
  direction: 'LONG' | 'SHORT';
  minProfitPercent: number | undefined;
  commissionRate: number;
}

export interface VolatilityAdjustmentInput {
  klines: Kline[];
  entryPrice: number;
  klineIndex?: number;
  atrPeriod?: number;
  highVolatilityThreshold?: number;
  reductionFactor?: number;
}

export interface VolatilityAdjustmentResult {
  factor: number;
  atrPercent: number | null;
  isHighVolatility: boolean;
  rationale: string;
}

export interface FibonacciProjectionData {
  levels: Array<{ level: number; price: number }>;
  primaryLevel: number;
}

export type FibonacciTargetLevel = 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';

export interface FibonacciResolverInput {
  fibonacciProjection: FibonacciProjectionData | null | undefined;
  entryPrice: number;
  direction: 'LONG' | 'SHORT';
  targetLevel?: FibonacciTargetLevel;
  targetLevelLong?: FibonacciTargetLevel;
  targetLevelShort?: FibonacciTargetLevel;
}

export interface FibonacciResolverResult {
  price: number | null;
  level: number | null;
  source: 'fibonacci' | 'fallback-1.618' | 'none';
}

export interface PositionSizingMethod {
  type: 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility';
}

export interface HistoricalStats {
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
}

export interface UnifiedPositionSizeInput {
  equity: number;
  entryPrice: number;
  stopLoss?: number;
  method: 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility';
  maxPositionSizePercent: number;
  riskPerTrade?: number;
  kellyFraction?: number;
  klines?: Kline[];
  klineIndex?: number;
  historicalStats?: HistoricalStats;
  applyVolatilityAdjustment?: boolean;
  minPositionPercent?: number;
  atr?: number;
}

export interface UnifiedPositionSizeResult {
  quantity: number;
  positionValue: number;
  positionPercent: number;
  riskAmount: number;
  volatilityFactor: number;
  rationale: string;
}
