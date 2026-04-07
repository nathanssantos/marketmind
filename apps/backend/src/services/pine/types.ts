import type { SetupDirection, TradingSetup } from '@marketmind/types';

export interface PineStrategyMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tags: string[];
  status: string;
  enabled: boolean;
  parameters: Record<string, PineParameterMeta>;
  filters: PineStrategyFilters;
  recommendedTimeframes?: PineRecommendedTimeframes;
  backtestSummary?: Record<string, unknown>;
  education?: Record<string, unknown>;
}

export interface PineParameterMeta {
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

export interface PineStrategyFilters {
  minConfidence?: number;
  minRiskReward?: number;
  strategyType?: string;
  momentumType?: string;
  volumeType?: string;
}

export interface PineRecommendedTimeframes {
  primary?: string;
  secondary?: string[];
  avoid?: string[];
  notes?: string;
}

export interface PineStrategy {
  metadata: PineStrategyMetadata;
  source: string;
  filePath: string;
}

export interface PineSignal {
  index: number;
  direction: SetupDirection;
  entryPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  confidence: number;
}

export interface PinePlotEntry {
  title: string;
  time: number;
  value: number | null;
  options: Record<string, unknown>;
}

export interface PineRunOptions {
  parameterOverrides?: Record<string, number>;
  minConfidence?: number;
  minRiskReward?: number;
}

export interface PineDetectionResult {
  setup: TradingSetup | null;
  confidence: number;
  triggerKlineIndex?: number;
  exitSignals?: (number | null)[];
}
