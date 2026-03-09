import type { TimeInterval } from './kline';

export type IndicatorType =
  | 'sma'
  | 'ema'
  | 'rsi'
  | 'macd'
  | 'bollingerBands'
  | 'atr'
  | 'stochastic'
  | 'stochRsi'
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
  | 'nr7'
  | 'roc'
  | 'dema'
  | 'tema'
  | 'wma'
  | 'hma'
  | 'cmo'
  | 'ao'
  | 'ppo'
  | 'tsi'
  | 'ultimateOscillator'
  | 'aroon'
  | 'dmi'
  | 'vortex'
  | 'parabolicSar'
  | 'massIndex'
  | 'cmf'
  | 'klinger'
  | 'elderRay'
  | 'deltaVolume'
  | 'swingPoints'
  | 'fvg'
  | 'gapDetection'
  | 'fibonacci'
  | 'floorPivots'
  | 'liquidityLevels'
  | 'ichimoku'
  | 'halvingCycle'
  | 'fundingRate'
  | 'openInterest'
  | 'liquidations'
  | 'btcDominance'
  | 'relativeStrength'
  | 'highest'
  | 'lowest';

export type PriceSource = 'open' | 'high' | 'low' | 'close' | 'volume';

export interface IndicatorDefinition {
  type: IndicatorType;
  params: Record<string, number | string>; // string for "$paramName" references
  source?: PriceSource;
}

export interface ComputedIndicator {
  type: IndicatorType;
  values: (number | null)[] | Record<string, (number | null)[]>;
}

export type ComputedIndicators = Record<string, ComputedIndicator>;


export interface StrategyParameter {
  default: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
}


export type ComparisonOperator =
  | '>'
  | '<'
  | '>='
  | '<='
  | '=='
  | '!='
  | 'crossover'
  | 'crossunder';

export type LogicalOperator = 'AND' | 'OR';

export interface CalcExpression {
  calc: string;
}

export type ConditionOperand = string | number | CalcExpression;

export interface Condition {
  left: ConditionOperand;
  op: ComparisonOperator;
  right: ConditionOperand;
}

export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: (Condition | ConditionGroup)[];
}


export type ExitLevelType =
  | 'atr'           // Multiplier of ATR
  | 'percent'       // Percentage of entry price
  | 'fixed'         // Fixed price value
  | 'indicator'     // Value from indicator (e.g., "bb.middle")
  | 'riskReward'    // Multiple of stop loss distance
  | 'swingHighLow'  // Swing high/low of recent candles (including trigger candle)
  | 'pivotBased';   // Enhanced pivot detection with volume confirmation and strength

export type PivotStrengthFilter = 'weak' | 'medium' | 'strong' | 'any';

export interface ExitLevel {
  type: ExitLevelType;
  value?: ConditionOperand;       // For fixed, indicator, percent
  multiplier?: ConditionOperand;  // For atr, riskReward
  indicator?: string;             // Indicator reference for atr type
  lookback?: number;              // For swingHighLow: number of candles to consider (default: 5 for SL, 2 for entry)
  priorSwingLookback?: number;    // For swingHighLow SL: lookback for finding PRIOR swing (different from entry)
  buffer?: ConditionOperand;      // For swingHighLow: buffer to add (ATR multiplier or percent, min 0.3 for SL)
  fallback?: ExitLevel;           // Fallback if primary fails
  pivotConfig?: {                 // For pivotBased exits
    minStrength?: PivotStrengthFilter;  // Minimum pivot strength (default: 'any')
    requireVolumeConfirmation?: boolean; // Only use volume-confirmed pivots (default: false)
    volumeLookback?: number;      // Volume averaging lookback (default: 20)
    volumeMultiplier?: number;    // Volume confirmation multiplier (default: 1.2)
  };
}

export interface TrailingStopConfig {
  enabled: boolean;
  type: 'atr' | 'percent';
  initialMultiplier: number;
  trailMultiplier: number;
  breakEvenAfterR?: number;
}

export interface ExitConditions {
  long?: ConditionGroup;
  short?: ConditionGroup;
}


export interface ConfidenceBonus {
  condition: Condition;
  bonus: number;
  description?: string;
}

export interface ConfidenceConfig {
  base: number;
  bonuses?: ConfidenceBonus[];
  max?: number;
}


export interface TimeFilters {
  allowedDays?: number[];     // 0-6 (Sunday-Saturday)
  allowedHours?: number[];    // 0-23
  excludeDates?: string[];    // ISO date strings
}

export interface TrendFilter {
  enabled: boolean;
  indicator: string;
  period: number;
  allowCounterTrend: boolean;
}

import type { SetupVolumeType, SetupStrategyType, SetupMomentumType } from './filters';

export type { SetupVolumeType, SetupStrategyType, SetupMomentumType };

export interface StrategyFilters {
  minConfidence?: number;
  minRiskReward?: number;
  trendFilter?: TrendFilter;
  timeFilters?: TimeFilters;
  volumeType?: SetupVolumeType;
  strategyType?: SetupStrategyType;
  momentumType?: SetupMomentumType;
}

export type StrategyStatus = 'active' | 'unprofitable' | 'experimental' | 'deprecated';

export type TimeframeInterval = Exclude<TimeInterval, '1s'>;

export interface RecommendedTimeframes {
  primary: TimeframeInterval;
  secondary?: TimeframeInterval[];
  avoid?: TimeframeInterval[];
  notes?: string;
}

export interface StrategyBacktestSummary {
  profitFactor: number;
  winRate: number;
  totalTrades: number;
  netPnlPercent: number;
  testedAt: string;
  testedTimeframe: string;
  testedSymbol: string;
}


export type EntryPriceType =
  | 'market'        // Execute at current market price (immediate)
  | 'close'         // Use close price of triggering candle
  | 'swingHighLow'  // Use swing high (SHORT) or swing low (LONG) for better entry
  | 'percent'       // Percentage retracement from swing
  | 'indicator';    // Use indicator value (e.g., EMA, VWAP)

export interface EntryPriceConfig {
  type: EntryPriceType;
  lookback?: number;              // For swingHighLow: candles to consider (default: 2)
  retracementPercent?: number;    // For percent: how much retracement to wait for (0-100)
  indicator?: string;             // For indicator: indicator reference
  buffer?: ConditionOperand;      // Buffer to add (ATR multiplier or percent)
  expirationBars?: number;        // How many bars to wait before canceling unfilled order
}

export interface EntryConditions {
  long?: ConditionGroup;
  short?: ConditionGroup;
  entryPrice?: EntryPriceConfig;  // How to calculate entry price (default: market)
}

export interface ExitConfig {
  stopLoss?: ExitLevel;
  takeProfit?: ExitLevel;
  trailingStop?: TrailingStopConfig;
  conditions?: ExitConditions;
  maxBarsInTrade?: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  tags?: string[];

  status?: StrategyStatus;
  enabled?: boolean;
  group?: string;
  backtestSummary?: StrategyBacktestSummary;
  recommendedTimeframes?: RecommendedTimeframes;

  parameters: Record<string, StrategyParameter>;
  indicators: Record<string, IndicatorDefinition>;

  entry: EntryConditions;
  exit: ExitConfig;

  confidence?: ConfidenceConfig;
  filters?: StrategyFilters;

  education?: {
    origin: string;
    createdYear?: number;
    candlePattern: {
      lookback: number;
      candles: Array<{
        offset: number;
        role: 'reference' | 'confirmation' | 'trigger' | 'context';
        descriptionKey: string;
      }>;
      indicatorsToShow: string[];
    };
    howItWorks: {
      summaryKey: string;
      entryKey: string;
      exitKey: string;
    };
  };
}


export interface ResolvedStrategy {
  definition: StrategyDefinition;
  resolvedParams: Record<string, number>;
}

export interface StrategyFile {
  path: string;
  definition: StrategyDefinition;
  loadedAt: Date;
  hash: string;
}

export interface EvaluationContext {
  klines: unknown[]; // Kline[] - avoiding circular dependency
  currentIndex: number;
  indicators: ComputedIndicators;
  params: Record<string, number>;
}

export interface FibonacciSwingData {
  swingLow: { price: number; index: number };
  swingHigh: { price: number; index: number };
}

export interface ExitContext {
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  klines: unknown[]; // Kline[] - avoiding circular dependency
  currentIndex: number;
  indicators: ComputedIndicators;
  params: Record<string, number>;
  fibonacciSwing?: FibonacciSwingData;
  initialStopMode?: 'fibo_target' | 'nearest_swing';
}


export interface StrategyValidationError {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface StrategyValidationResult {
  valid: boolean;
  errors: StrategyValidationError[];
  warnings: StrategyValidationError[];
}


export const isCalcExpression = (value: ConditionOperand): value is CalcExpression =>
  typeof value === 'object' && value !== null && 'calc' in value;

export const isParameterReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' && value.startsWith('$');

export const isIndicatorReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' && !value.startsWith('$') && !isPriceReference(value);

export const isPriceReference = (value: ConditionOperand): value is string =>
  typeof value === 'string' &&
  ['open', 'high', 'low', 'close', 'volume'].includes(value);

export const isConditionGroup = (
  condition: Condition | ConditionGroup
): condition is ConditionGroup =>
  'operator' in condition && 'conditions' in condition;

export const isIndicatorExitLevel = (exit: ExitLevel): boolean =>
  exit.type === 'indicator' || exit.type === 'atr';
