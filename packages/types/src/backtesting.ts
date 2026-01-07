
export interface BacktestConfig {
  symbol: string;
  interval: string; // e.g., '1h', '4h', '1d'
  startDate: string; // ISO date
  endDate: string; // ISO date
  initialCapital: number;
  minProfitPercent?: number; // Min expected profit % per trade after fees (filters out low R:R setups)
  minRiskRewardRatio?: number; // Min risk/reward ratio to enter trade (default: 1.5)
  setupTypes?: string[]; // Which setups to trade (empty = all)
  minConfidence?: number; // Minimum confidence to enter trade
  onlyWithTrend?: boolean; // Only trade setups aligned with higher timeframe trend
  useAlgorithmicLevels?: boolean; // Use setup's calculated SL/TP instead of fixed percentages
  stopLossPercent?: number; // SL as % of entry (ignored if useAlgorithmicLevels = true)
  takeProfitPercent?: number; // TP as % of entry (ignored if useAlgorithmicLevels = true)
  maxPositionSize?: number; // Max % of capital per trade
  commission?: number; // Trading fee % (default 0.1% spot, 0.04% futures)
  slippagePercent?: number; // Slippage % for market orders - SL (default 0.05%)
  useStochasticFilter?: boolean; // LONG: K was oversold and hasn't crossed to overbought; SHORT: K was overbought and hasn't crossed to oversold
  useAdxFilter?: boolean; // Only allow LONG when +DI > -DI, SHORT when -DI > +DI (ADX >= 20)
  useOptimizedSettings?: boolean; // Use strategy's optimizedParams instead of config values

  marketType?: 'SPOT' | 'FUTURES'; // Market type (default: SPOT)
  useBnbDiscount?: boolean; // Apply 25% BNB discount to fees (default: false)
  leverage?: number; // Futures leverage 1-125 (default: 1)
  marginType?: 'ISOLATED' | 'CROSSED'; // Futures margin type (default: ISOLATED)
  simulateFundingRates?: boolean; // Simulate funding rate payments every 8h
  simulateLiquidation?: boolean; // Simulate position liquidation

  positionSizingMethod?: 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility'; // Default: 'fixed-fractional'
  riskPerTrade?: number; // % of equity to risk per trade (for risk-based sizing, default: 2%)
  kellyFraction?: number; // Fraction of Kelly to use (for kelly sizing, default: 0.25 = quarter Kelly)
  
  strategyParams?: Record<string, number>;

  useKellyCriterion?: boolean; // Use Kelly Criterion for position sizing
  riskProfile?: 'conservative' | 'moderate' | 'aggressive'; // Preset risk profiles

  useTrailingStop?: boolean; // Enable ATR-based trailing stop
  trailingStopATRMultiplier?: number; // ATR multiplier for initial stop (default 2.0)
  trailingATRMultiplier?: number; // ATR multiplier for trailing (default 1.5)
  breakEvenAfterR?: number; // Move to break-even after this R-multiple (default 1.0)
  breakEvenBuffer?: number; // Buffer above/below entry for break-even (default 0.1%)

  usePartialExits?: boolean; // Enable scaled exits at profit targets
  partialExitLevels?: Array<{ percentage: number; rMultiple: number }>; // Exit levels
  lockProfitsAfterFirstExit?: boolean; // Move stop to break-even after first partial exit

  maxConcurrentPositions?: number; // Max simultaneous positions (default: 5)
  maxTotalExposure?: number; // Max % of capital in all positions (default: 0.5 = 50%)

  useMarketContextFilter?: boolean; // Use historical market context (Fear/Greed, Funding Rate) same as auto-trading
  marketContextConfig?: {
    fearGreed?: {
      enabled?: boolean;
      thresholdLow?: number; // default: 20 (extreme fear)
      thresholdHigh?: number; // default: 80 (extreme greed)
      action?: 'block' | 'reduce_size' | 'warn_only';
      sizeReduction?: number; // default: 50 (%)
    };
    fundingRate?: {
      enabled?: boolean;
      threshold?: number; // default: 0.05 (%)
      action?: 'block' | 'penalize' | 'warn_only';
      penalty?: number; // default: 20 (confidence points)
    };
  };

  useCooldown?: boolean; // Simulate cooldown between trades (same as auto-trading)
  cooldownMinutes?: number; // Minutes of cooldown per strategy-symbol-interval (default: 15)

  dailyLossLimit?: number; // Max daily loss as % of capital before stopping (default: 5%)

  onlyLong?: boolean; // Only allow LONG positions (buy only, no shorts)
  trendFilterPeriod?: number; // EMA period for trend filter (default: 200)

  tpCalculationMode?: 'default' | 'fibonacci'; // TP calculation mode (default: 'default')
  fibonacciTpLevel?: number; // Fibonacci level to use for TP (default: uses primaryLevel from projection, e.g., 0.618, 1.0, 1.618)
}

export interface BacktestTrade {
  id: string;
  setupId?: string;
  setupType?: string;
  setupConfidence?: number;
  entryTime: string; // ISO date
  entryPrice: number;
  exitTime?: string; // ISO date
  exitPrice?: number;
  side: 'LONG' | 'SHORT';
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercent?: number;
  commission: number;
  netPnl?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'END_OF_PERIOD' | 'LIQUIDATION' | 'EXIT_CONDITION' | 'MAX_BARS';
  status: 'OPEN' | 'CLOSED';

  marketType?: 'SPOT' | 'FUTURES';
  leverage?: number;
  marginType?: 'ISOLATED' | 'CROSSED';
  liquidationPrice?: number;
  fundingPayments?: number;
  liquidationFee?: number;
  leveragedPnlPercent?: number;
}

export interface BacktestMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number; // % (based on gross PnL - trade quality)

  totalPnl: number; // Net PnL (after fees)
  totalPnlPercent: number;
  avgPnl: number;
  avgPnlPercent: number;

  grossWinRate: number; // % (same as winRate, for clarity)
  grossProfitFactor: number; // Total gross wins / Total gross losses
  totalGrossPnl: number; // Gross PnL (before fees)

  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number; // Total gross wins / Total gross losses (same as grossProfitFactor)

  maxDrawdown: number;
  maxDrawdownPercent: number;

  sharpeRatio?: number;
  sortinoRatio?: number;

  totalCommission: number;

  avgTradeDuration: number; // in minutes
  avgWinDuration: number;
  avgLossDuration: number;
}

export interface BacktestEquityPoint {
  time: string; // ISO date
  equity: number;
  drawdown: number;
  drawdownPercent: number;
}

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  trades: BacktestTrade[];
  metrics: BacktestMetrics;
  equityCurve: BacktestEquityPoint[];
  startTime: string;
  endTime: string;
  duration: number; // execution time in ms
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
  setupDetections?: import('./tradingSetup').TradingSetup[];
  klines?: import('./kline').Kline[];
}

export interface BacktestSummary {
  id: string;
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalEquity: number;
  totalPnl: number;
  totalPnlPercent: number;
  winRate: number;
  totalTrades: number;
  maxDrawdown: number;
  sharpeRatio?: number;
  createdAt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
}

export interface PyramidingConfig {
  profitThreshold: number;
  minDistance: number;
  maxEntries: number;
  scaleFactor: number;
  mlConfidenceBoost: number;
}

export type VolatilityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | 'EXTREME';

export interface VolatilityProfile {
  level: VolatilityLevel;
  atrPercent: number;
  atrMultiplier: number;
  breakevenThreshold: number;
  feesThreshold: number;
  minTrailingDistance: number;
}

export interface TrailingStopOptimizationConfig {
  breakevenProfitThreshold: number;
  breakevenWithFeesThreshold?: number;
  minTrailingDistancePercent: number;
  swingLookback: number;
  useATRMultiplier: boolean;
  atrMultiplier: number;
  feePercent?: number;
  trailingDistancePercent?: number;
  useVolatilityBasedThresholds?: boolean;
  marketType?: 'SPOT' | 'FUTURES';
  useBnbDiscount?: boolean;
}

export interface TimeframeThreshold {
  minProbability: number;
  minConfidence: number;
}

export interface FullSystemOptimizationConfig {
  symbol: string;
  interval: string;
  startDate: string;
  endDate: string;
  initialCapital: number;

  mlThresholds: number[];
  pyramidingConfigs: Partial<PyramidingConfig>[];
  trailingStopConfigs: Partial<TrailingStopOptimizationConfig>[];

  walkForward: {
    trainingMonths: number;
    testingMonths: number;
    stepMonths: number;
    minWindows: number;
  };

  minTrades: number;
  maxDegradation: number;
  topResultsForValidation: number;
}

export interface OptimizationResult {
  id: string;
  config: FullSystemOptimizationConfig;
  totalCombinations: number;
  completedCombinations: number;
  results: OptimizationResultEntry[];
  bestResult?: OptimizationResultEntry;
  walkForwardResults?: WalkForwardResult[];
  calibratedThresholds?: Record<string, TimeframeThreshold>;
  startTime: string;
  endTime?: string;
  duration?: number;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED';
  error?: string;
}

export interface OptimizationResultEntry {
  id: string;
  params: {
    mlThreshold: number;
    pyramiding: Partial<PyramidingConfig>;
    trailingStop: Partial<TrailingStopOptimizationConfig>;
  };
  metrics: BacktestMetrics;
  walkForwardValidated?: boolean;
  degradationPercent?: number;
  rank?: number;
}

export interface WalkForwardResult {
  windowIndex: number;
  trainingStart: string;
  trainingEnd: string;
  testingStart: string;
  testingEnd: string;
  inSampleMetrics: BacktestMetrics;
  outOfSampleMetrics: BacktestMetrics;
  degradationPercent: number;
  isRobust: boolean;
}

export interface WatcherConfig {
  symbol: string;
  interval: string;
  setupTypes?: string[];
  marketType?: 'SPOT' | 'FUTURES';
  profileId?: string;
}

export interface MultiWatcherBacktestConfig extends Omit<BacktestConfig, 'symbol' | 'interval'> {
  watchers: WatcherConfig[];
  exposureMultiplier?: number;
  useSharedExposure?: boolean;
  trailingStopSimulationInterval?: import('./kline').Interval;
}

export interface WatcherStats {
  symbol: string;
  interval: string;
  totalSetups: number;
  tradesExecuted: number;
  tradesSkipped: number;
  skippedReasons: Record<string, number>;
  pnl: number;
  winRate: number;
  winningTrades: number;
  losingTrades: number;
}

export interface TimelineEvent {
  timestamp: number;
  type: 'setup' | 'entry' | 'exit' | 'conflict';
  watcherSymbol: string;
  watcherInterval: string;
  details: Record<string, unknown>;
}

export interface ConflictStats {
  totalConflicts: number;
  resolvedBy: Record<string, number>;
  conflictsPerWatcher: Record<string, number>;
}

export interface MultiWatcherBacktestResult extends Omit<BacktestResult, 'config'> {
  config: MultiWatcherBacktestConfig;
  watcherStats: WatcherStats[];
  timeline: TimelineEvent[];
  conflictStats: ConflictStats;
}
