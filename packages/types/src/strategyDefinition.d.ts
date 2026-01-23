import type { TimeInterval } from './kline';
export type IndicatorType = 'sma' | 'ema' | 'rsi' | 'macd' | 'bollingerBands' | 'atr' | 'stochastic' | 'stochRsi' | 'vwap' | 'pivotPoints' | 'adx' | 'obv' | 'williamsR' | 'cci' | 'mfi' | 'donchian' | 'keltner' | 'supertrend' | 'ibs' | 'percentB' | 'cumulativeRsi' | 'nDayHighLow' | 'nr7' | 'roc' | 'dema' | 'tema' | 'wma' | 'hma' | 'cmo' | 'ao' | 'ppo' | 'tsi' | 'ultimateOscillator' | 'aroon' | 'dmi' | 'vortex' | 'parabolicSar' | 'massIndex' | 'cmf' | 'klinger' | 'elderRay' | 'deltaVolume' | 'swingPoints' | 'fvg' | 'gapDetection' | 'fibonacci' | 'floorPivots' | 'liquidityLevels' | 'ichimoku' | 'halvingCycle' | 'fundingRate' | 'openInterest' | 'liquidations' | 'btcDominance' | 'relativeStrength' | 'highest' | 'lowest';
export type PriceSource = 'open' | 'high' | 'low' | 'close' | 'volume';
export interface IndicatorDefinition {
    type: IndicatorType;
    params: Record<string, number | string>;
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
export type ComparisonOperator = '>' | '<' | '>=' | '<=' | '==' | '!=' | 'crossover' | 'crossunder';
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
export type ExitLevelType = 'atr' | 'percent' | 'fixed' | 'indicator' | 'riskReward' | 'swingHighLow' | 'pivotBased';
export type PivotStrengthFilter = 'weak' | 'medium' | 'strong' | 'any';
export interface ExitLevel {
    type: ExitLevelType;
    value?: ConditionOperand;
    multiplier?: ConditionOperand;
    indicator?: string;
    lookback?: number;
    priorSwingLookback?: number;
    buffer?: ConditionOperand;
    fallback?: ExitLevel;
    pivotConfig?: {
        minStrength?: PivotStrengthFilter;
        requireVolumeConfirmation?: boolean;
        volumeLookback?: number;
        volumeMultiplier?: number;
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
    allowedDays?: number[];
    allowedHours?: number[];
    excludeDates?: string[];
}
export interface TrendFilter {
    enabled: boolean;
    indicator: string;
    period: number;
    allowCounterTrend: boolean;
}
export interface StrategyFilters {
    minConfidence?: number;
    minRiskReward?: number;
    trendFilter?: TrendFilter;
    timeFilters?: TimeFilters;
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
export type EntryPriceType = 'market' | 'close' | 'swingHighLow' | 'percent' | 'indicator';
export interface EntryPriceConfig {
    type: EntryPriceType;
    lookback?: number;
    retracementPercent?: number;
    indicator?: string;
    buffer?: ConditionOperand;
    expirationBars?: number;
}
export interface EntryConditions {
    long?: ConditionGroup;
    short?: ConditionGroup;
    entryPrice?: EntryPriceConfig;
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
    klines: unknown[];
    currentIndex: number;
    indicators: ComputedIndicators;
    params: Record<string, number>;
}
export interface FibonacciSwingData {
    swingLow: {
        price: number;
        index: number;
    };
    swingHigh: {
        price: number;
        index: number;
    };
}
export interface ExitContext {
    direction: 'LONG' | 'SHORT';
    entryPrice: number;
    klines: unknown[];
    currentIndex: number;
    indicators: ComputedIndicators;
    params: Record<string, number>;
    fibonacciSwing?: FibonacciSwingData;
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
export declare const isCalcExpression: (value: ConditionOperand) => value is CalcExpression;
export declare const isParameterReference: (value: ConditionOperand) => value is string;
export declare const isIndicatorReference: (value: ConditionOperand) => value is string;
export declare const isPriceReference: (value: ConditionOperand) => value is string;
export declare const isConditionGroup: (condition: Condition | ConditionGroup) => condition is ConditionGroup;
export declare const isIndicatorExitLevel: (exit: ExitLevel) => boolean;
//# sourceMappingURL=strategyDefinition.d.ts.map