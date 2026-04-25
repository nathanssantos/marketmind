import type { BacktestConfig, BacktestEquityPoint, BacktestMetrics, FibonacciProjectionData, Interval, Kline, MarketType, PositionSide, TrailingStopOptimizationConfig } from '@marketmind/types';

export type LogLevel = 'silent' | 'summary' | 'verbose';

export interface OutputConfig {
  logLevel: LogLevel;
  progressIntervalPercent: number;
  progressIntervalSeconds: number;
  outputFile: string;
  maxConsoleLines: number;
}

export interface DirectionalTrailingConfig {
  activationPercent: number;
  distancePercent: number;
  atrMultiplier: number;
  trailingDistanceMode?: 'auto' | 'fixed';
  stopOffsetPercent?: number;
}

export interface TrailingStopBacktestConfig extends TrailingStopOptimizationConfig {
  trailingStopEnabled: boolean;
  long: DirectionalTrailingConfig;
  short: DirectionalTrailingConfig;
}

export interface BacktestTradeSetup {
  id: string;
  symbol: string;
  side: PositionSide;
  entryPrice: number;
  entryTime: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  atr?: number;
  fibonacciProjection?: FibonacciProjectionData | null;
  maxExitTime?: number;
}

export type TrailingStopReason = 'swing_trail' | 'atr_trail' | 'progressive_trail';

export interface StopLossHistoryEntry {
  timestamp: number;
  price: number;
  reason: TrailingStopReason;
}

export interface TrailingSimulationState {
  isActivated: boolean;
  activatedAt: number | null;
  highestPrice: number;
  lowestPrice: number;
  currentStopLoss: number;
  stopLossHistory: StopLossHistoryEntry[];
}

export type TrailingExitReason = 'TRAILING_STOP' | 'TAKE_PROFIT' | 'STOP_LOSS' | 'END_OF_PERIOD' | 'MAX_BARS';

export interface TrailingSimulationResult {
  tradeId: string;
  exitPrice: number;
  exitTime: number;
  exitReason: TrailingExitReason;
  trailingState: TrailingSimulationState;
  pnl: number;
  pnlPercent: number;
  commission: number;
  netPnl: number;
  pricePathSummary: {
    maxFavorableExcursion: number;
    maxAdverseExcursion: number;
    timeToActivation: number | null;
    totalBarsInTrade: number;
  };
}

export interface GranularDataConfig {
  symbol: string;
  mainInterval: Interval;
  granularInterval: Interval;
  startDate: Date;
  endDate: Date;
  marketType: MarketType;
}

export interface TrailingOptimizationParams {
  long: DirectionalTrailingConfig;
  short: DirectionalTrailingConfig;
  useAdaptiveTrailing: boolean;
  minFibEntryLevel: number;
  fibTargetLevelLong: string;
  fibTargetLevelShort: string;
}

export interface TrailingOptimizationResult {
  params: TrailingOptimizationParams;
  metrics: BacktestMetrics;
  equityCurve: BacktestEquityPoint[];
  compositeScore: number;
}

export interface ValidationConfig extends Omit<BacktestConfig, 'startDate' | 'endDate'> {
  startDate: Date;
  endDate: Date;
  mainInterval: Interval;
  granularInterval: Interval;
  verbose: boolean;
  combinations: TrailingOptimizationParams[];
}

export interface BacktestProgress {
  currentCombination: number;
  totalCombinations: number;
  percentComplete: number;
  elapsedMs: number;
  estimatedRemainingMs: number;
  bestPnlSoFar: number;
  bestSharpeSoFar: number;
}

export interface KlineIndex {
  get(timestamp: number): Kline | undefined;
  getRange(startTs: number, endTs: number): Kline[];
  iterate(startTs: number, endTs: number): Generator<Kline>;
  size: number;
  firstTimestamp: number;
  lastTimestamp: number;
}
