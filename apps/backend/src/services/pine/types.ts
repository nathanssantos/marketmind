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
  /**
   * Higher timeframes this strategy reads via `request.security(...)`.
   * Parsed from the `@requires-tf 4h, 1d` metadata header. Used by:
   *   - BacktestEngine + MultiWatcherBacktestEngine to pre-load HTF klines
   *     from the DB before invoking PineStrategyRunner
   *   - WatcherManager (live runtime) to subscribe to the right
   *     kline streams alongside the watcher's primary interval
   * Empty when the strategy doesn't use multi-TF data.
   */
  requiresTimeframes: string[];
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
  /**
   * Strategy-input overrides forwarded to PineTS via the `Indicator(source,
   * inputs)` wrapper. Keys must match `input.*` variable names declared in
   * the Pine source. Values may be number/string/boolean — PineTS supports
   * `input.int`, `input.float`, `input.bool`, `input.string` overrides.
   */
  parameterOverrides?: Record<string, number | string | boolean>;
  minConfidence?: number;
  minRiskReward?: number;
  /**
   * Primary timeframe label (e.g. '1h', '15m', '4h'). Required when the
   * strategy uses `request.security(...)` — PineTS compares the primary
   * TF index against the requested TF index to decide HTF vs LTF direction.
   * Defaults to '1h' for backward compatibility with single-TF strategies.
   */
  primaryTimeframe?: string;
  /**
   * Secondary kline data, keyed by timeframe label ('4h', '1d', etc.).
   * When provided, PineStrategyRunner switches from array-mode PineTS
   * (which silently NaN's on `request.security`) to a custom Provider
   * that resolves secondary-TF lookups against these pre-loaded klines.
   *
   * The map MUST include all timeframes the strategy reads via
   * `request.security(...)` — see the strategy's `@requires-tf` metadata
   * for the declared dependency set.
   */
  secondaryKlines?: Record<string, import('@marketmind/types').Kline[]>;
}

export interface PineDetectionResult {
  setup: TradingSetup | null;
  confidence: number;
  triggerKlineIndex?: number;
  exitSignals?: (number | null)[];
}
