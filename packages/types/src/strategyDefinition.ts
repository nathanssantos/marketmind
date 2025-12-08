/**
 * Strategy Definition Types
 *
 * Declarative JSON-based strategy definition system for dynamic setup detection.
 * Allows strategies to be defined in external files without TypeScript code changes.
 *
 * @package @marketmind/types
 */

// =============================================================================
// Indicator Types
// =============================================================================

/**
 * Supported indicator types that map to @marketmind/indicators functions
 */
export type IndicatorType =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'macd'
  | 'bollingerBands'
  | 'atr'
  | 'stochastic'
  | 'vwap'
  | 'pivotPoints'
  | 'adx'
  | 'obv'
  | 'williamsR'
  | 'cci'
  | 'mfi'
  | 'donchian'
  | 'keltner'
  | 'supertrend'
  | 'ibs'
  | 'percentB'
  | 'cumulativeRsi'
  | 'nDayHighLow'
  | 'nr7';

/**
 * Price source for indicator calculations
 */
export type PriceSource = 'open' | 'high' | 'low' | 'close' | 'volume';

/**
 * Indicator definition with type-specific parameters
 */
export interface IndicatorDefinition {
  type: IndicatorType;
  params: Record<string, number | string>; // string for "$paramName" references
  source?: PriceSource;
}

/**
 * Computed indicator values at runtime
 */
export interface ComputedIndicator {
  type: IndicatorType;
  values: (number | null)[] | Record<string, (number | null)[]>;
}

/**
 * Collection of computed indicators for a strategy
 */
export type ComputedIndicators = Record<string, ComputedIndicator>;

// =============================================================================
// Parameter Types
// =============================================================================

/**
 * Strategy parameter with default value and optimization range
 */
export interface StrategyParameter {
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}

// =============================================================================
// Condition Types
// =============================================================================

/**
 * Comparison operators for conditions
 */
export type ComparisonOperator =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | '!='
  | 'crossover'
  | 'crossunder';

/**
 * Logical operators for combining conditions
 */
export type LogicalOperator = 'AND' | 'OR';

/**
 * Reference types for condition operands:
 * - Price: "close", "open", "high", "low", "volume"
 * - Indicator: "rsi", "ema20", "bb.upper", "macd.signal"
 * - Parameter: "$bbPeriod", "$rsiOversold"
 * - Literal number
 */
export type ConditionOperand = string | number;

/**
 * Simple condition comparing two values
 */
export interface Condition {
  left: ConditionOperand;
  op: ComparisonOperator;
  right: ConditionOperand;
}

/**
 * Group of conditions combined with AND/OR
 */
export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}

// =============================================================================
// Exit Level Types
// =============================================================================

/**
 * Types of exit level calculations
 */
export type ExitLevelType =
  | 'atr'           // Multiplier of ATR
  | 'percent'       // Percentage of entry price
  | 'fixed'         // Fixed price value
  | 'indicator'     // Value from indicator (e.g., "bb.middle")
  | 'riskReward';   // Multiple of stop loss distance

/**
 * Stop loss or take profit level definition
 */
export interface ExitLevel {
  type: ExitLevelType;
  value?: ConditionOperand;       // For fixed, indicator, percent
  multiplier?: ConditionOperand;  // For atr, riskReward
  indicator?: string;             // Indicator reference for atr type
  fallback?: ExitLevel;           // Fallback if primary fails
}

/**
 * Trailing stop configuration
 */
export interface TrailingStopConfig {
  enabled: boolean;
  type: 'atr' | 'percent';
  initialMultiplier: number;
  trailMultiplier: number;
  breakEvenAfterR?: number;
}

// =============================================================================
// Confidence Calculation Types
// =============================================================================

/**
 * Bonus applied to base confidence when condition is met
 */
export interface ConfidenceBonus {
  condition: Condition;
  bonus: number;
  description?: string;
}

/**
 * Declarative confidence calculation
 */
export interface ConfidenceConfig {
  base: number;
  bonuses?: ConfidenceBonus[];
  max?: number;
}

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Time-based filters for strategy execution
 */
export interface TimeFilters {
  allowedDays?: number[];     // 0-6 (Sunday-Saturday)
  allowedHours?: number[];    // 0-23
  excludeDates?: string[];    // ISO date strings
}

/**
 * Trend filter configuration
 */
export interface TrendFilter {
  enabled: boolean;
  indicator: string;
  period: number;
  allowCounterTrend: boolean;
}

/**
 * All strategy filters
 */
export interface StrategyFilters {
  minConfidence?: number;
  minRiskReward?: number;
  trendFilter?: TrendFilter;
  timeFilters?: TimeFilters;
}

// =============================================================================
// Strategy Status Types
// =============================================================================

/**
 * Strategy status for filtering during backtesting
 * - active: Strategy is profitable and should be tested
 * - unprofitable: Strategy has been tested and is not profitable, skip in batch tests
 * - experimental: Strategy is being developed/tested, include in tests
 * - deprecated: Strategy is outdated, skip in tests
 */
export type StrategyStatus = 'active' | 'unprofitable' | 'experimental' | 'deprecated';

/**
 * Valid timeframe intervals
 */
export type TimeframeInterval = '1m' | '3m' | '5m' | '15m' | '30m' | '1h' | '2h' | '4h' | '6h' | '8h' | '12h' | '1d' | '3d' | '1w';

/**
 * Recommended timeframes configuration
 */
export interface RecommendedTimeframes {
  primary: TimeframeInterval;
  secondary?: TimeframeInterval[];
  avoid?: TimeframeInterval[];
  notes?: string;
}

/**
 * Backtest result summary stored in strategy
 */
export interface StrategyBacktestSummary {
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  netPnlPercent: number;
  testedAt: string;
  testedTimeframe: string;
  testedSymbol: string;
}

// =============================================================================
// Optimized Backtest Parameters
// =============================================================================

/**
 * Optimized backtest parameters for a strategy
 * These override default/global settings when "Use Optimized Settings" is enabled
 */
export interface OptimizedBacktestParams {
  maxPositionSize: number;
  stopLossPercent?: number;
  takeProfitPercent?: number;
  useAlgorithmicLevels: boolean;
  onlyWithTrend: boolean;
  minConfidence?: number;
  commission?: number;
}

// =============================================================================
// Main Strategy Definition
// =============================================================================

/**
 * Entry conditions for long and short positions
 */
export interface EntryConditions {
  long?: ConditionGroup;
  short?: ConditionGroup;
}

/**
 * Exit configuration with stop loss and take profit
 */
export interface ExitConfig {
  stopLoss: ExitLevel;
  takeProfit: ExitLevel;
  trailingStop?: TrailingStopConfig;
}

/**
 * Complete strategy definition that can be serialized to JSON
 */
export interface StrategyDefinition {
  // Metadata
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];

  // Status (for filtering unprofitable strategies)
  status?: StrategyStatus;
  backtestSummary?: StrategyBacktestSummary;
  recommendedTimeframes?: RecommendedTimeframes;

  // Optimized backtest parameters (used when "Use Optimized Settings" is enabled)
  optimizedParams?: OptimizedBacktestParams;

  // Configuration
  parameters: Record<string, StrategyParameter>;
  indicators: Record<string, IndicatorDefinition>;

  // Trading logic
  entry: EntryConditions;
  exit: ExitConfig;

  // Quality gates
  confidence?: ConfidenceConfig;
  filters?: StrategyFilters;
}

// =============================================================================
// Runtime Types
// =============================================================================

/**
 * Strategy with resolved parameter values
 */
export interface ResolvedStrategy {
  definition: StrategyDefinition;
  resolvedParams: Record<string, number>;
}

/**
 * Strategy file metadata for loader
 */
export interface StrategyFile {
  path: string;
  definition: StrategyDefinition;
  loadedAt: Date;
  hash: string;
}

/**
 * Evaluation context passed to condition evaluator
 */
export interface EvaluationContext {
  klines: unknown[]; // Kline[] - avoiding circular dependency
  currentIndex: number;
  indicators: ComputedIndicators;
  params: Record<string, number>;
}

/**
 * Exit calculation context
 */
export interface ExitContext {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  klines: unknown[]; // Kline[] - avoiding circular dependency
  currentIndex: number;
  indicators: ComputedIndicators;
  params: Record<string, number>;
}

// =============================================================================
// Validation Types
// =============================================================================

/**
 * Validation error for strategy definitions
 */
export interface StrategyValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Result of strategy validation
 */
export interface StrategyValidationResult {
  valid: boolean;
  errors: StrategyValidationError[];
  warnings: StrategyValidationError[];
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Check if value is a parameter reference (starts with $)
 */
export const isParameterReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' && value.startsWith('$');

/**
 * Check if value is an indicator reference (contains indicator name)
 */
export const isIndicatorReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' && !value.startsWith('$') && !isPriceReference(value);

/**
 * Check if value is a price reference
 */
export const isPriceReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' &&
  ['open', 'high', 'low', 'close', 'volume'].includes(value);

/**
 * Check if a condition is a group
 */
export const isConditionGroup = (
  condition: Condition | ConditionGroup
): condition is ConditionGroup =>
  'operator' in condition && 'conditions' in condition;

/**
 * Check if exit level uses an indicator
 */
export const isIndicatorExitLevel = (exit: ExitLevel): boolean =>
  exit.type === 'indicator' || exit.type === 'atr';
