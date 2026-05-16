import type { PositionSide } from './direction';
import type { MarketType } from './futures';
import type { Kline } from './kline';
import type { TradingSetup } from './tradingSetup';
import type { TrailingDistanceMode } from './trading-config';

export interface DirectionalVolumeConfig {
  breakoutMultiplier?: number; // Volume ratio required for breakout setups
  pullbackMultiplier?: number; // Volume ratio required for pullback setups
  useObvCheck?: boolean; // Check OBV trend alignment
  obvLookback?: number; // OBV trend lookback period
}

export interface VolumeFilterConfig {
  breakoutMultiplier?: number; // Volume ratio for breakout setups (default: 1.5) - fallback for both directions
  pullbackMultiplier?: number; // Volume ratio for pullback setups (default: 1.0) - fallback for both directions
  useObvCheck?: boolean; // Check OBV trend alignment (default: true) - fallback for both directions
  obvLookback?: number; // OBV trend lookback period (default: 5) - fallback for both directions
  longConfig?: DirectionalVolumeConfig; // LONG-specific overrides
  shortConfig?: DirectionalVolumeConfig; // SHORT-specific overrides
}

export interface BacktestConfig {
  symbol: string;
  interval: string; // e.g., '1h', '4h', '1d'
  startDate: string; // ISO date
  endDate: string; // ISO date
  initialCapital: number;
  exchange?: 'BINANCE' | 'INTERACTIVE_BROKERS'; // Exchange for data/trading (default: BINANCE)
  assetClass?: 'CRYPTO' | 'STOCKS'; // Asset class (default: CRYPTO)
  minProfitPercent?: number; // Min expected profit % per trade after fees (filters out low R:R setups)
  minRiskRewardRatio?: number; // Min risk/reward ratio to enter trade (default: 1.0, fallback for both directions)
  minRiskRewardRatioLong?: number; // Min R:R for LONG positions (default: 1.0)
  minRiskRewardRatioShort?: number; // Min R:R for SHORT positions (default: 0.8, lower due to shorter targets)
  setupTypes?: string[]; // Which setups to trade (empty = all)
  minConfidence?: number; // Minimum confidence to enter trade
  useAlgorithmicLevels?: boolean; // Use setup's calculated SL/TP instead of fixed percentages
  stopLossPercent?: number; // SL as % of entry (ignored if useAlgorithmicLevels = true)
  takeProfitPercent?: number; // TP as % of entry (ignored if useAlgorithmicLevels = true)
  commission?: number; // Trading fee % (default 0.1% spot, 0.04% futures)
  slippagePercent?: number; // Slippage % for market orders - SL (default 0.05%)
  useStochasticFilter?: boolean; // Slow Stochastic: LONG only when K < 20 (oversold), SHORT only when K > 80 (overbought)
  useStochasticRecoveryFilter?: boolean; // Stochastic Recovery: LONG if K went below 20 and hasn't crossed 50 yet, SHORT if K went above 80 and hasn't crossed 50 yet
  useStochasticHtfFilter?: boolean; // HTF Slow Stochastic: same as Slow Stochastic but on one timeframe above
  useStochasticRecoveryHtfFilter?: boolean; // HTF Stochastic Recovery: same as Stochastic Recovery but on one timeframe above
  useMomentumTimingFilter?: boolean; // RSI + MFI: LONG when RSI > 40 and rising with MFI > 30, SHORT when RSI < 60 and falling with MFI < 70
  useAdxFilter?: boolean; // Only allow LONG when +DI > -DI, SHORT when -DI > +DI (ADX >= 20)

  useMtfFilter?: boolean; // Use Multi-Timeframe filter (HTF EMA50/EMA200)
  useBtcCorrelationFilter?: boolean; // Block altcoin trades against BTC trend
  useMarketRegimeFilter?: boolean; // Block trades in wrong market regime
  useDirectionFilter?: boolean; // Block trades against market direction (bull/bear)
  enableLongInBearMarket?: boolean; // Allow LONG trades in bear market (price below EMA200)
  enableShortInBullMarket?: boolean; // Allow SHORT trades in bull market (price above EMA200)
  useVolumeFilter?: boolean; // Require volume confirmation
  volumeFilterConfig?: VolumeFilterConfig;
  useFundingFilter?: boolean; // Block trades with extreme funding rates
  useChoppinessFilter?: boolean; // Block trades in choppy/ranging markets (Choppiness Index > threshold)
  choppinessThresholdHigh?: number; // Choppiness Index above this = choppy (default: 61.8)
  choppinessThresholdLow?: number; // Choppiness Index below this = trending (default: 38.2)
  choppinessPeriod?: number; // Choppiness Index lookback period (default: 14)
  useSuperTrendFilter?: boolean; // Only LONG when SuperTrend is bullish, SHORT when bearish
  superTrendPeriod?: number; // SuperTrend ATR period (default: 10)
  superTrendMultiplier?: number; // SuperTrend ATR multiplier (default: 3.0)
  useBollingerSqueezeFilter?: boolean; // Block trades during Bollinger Band squeeze (low volatility)
  bollingerSqueezeThreshold?: number; // BB width threshold for squeeze detection (default: 0.1)
  bollingerSqueezePeriod?: number; // Bollinger Bands period (default: 20)
  bollingerSqueezeStdDev?: number; // Bollinger Bands standard deviation (default: 2.0)
  useVwapFilter?: boolean; // Only LONG above VWAP, SHORT below VWAP
  useFvgFilter?: boolean; // Only enter trades near unfilled Fair Value Gaps (S/R zones)
  fvgFilterProximityPercent?: number; // % proximity tolerance for FVG zones (default: 0.5%)
  useConfluenceScoring?: boolean; // Use confluence scoring system
  confluenceMinScore?: number; // Minimum confluence score to allow trade (default: 60)

  positionSizePercent?: number; // Position size as percentage of available capital (default: 10%)

  marketType?: MarketType; // Market type (default: FUTURES)
  useBnbDiscount?: boolean; // Apply 25% BNB discount to fees (default: false)
  vipLevel?: number; // Binance VIP level 0-9 for fee calculation (default: 0)
  leverage?: number; // Futures leverage 1-125 (default: 1)
  marginType?: 'ISOLATED' | 'CROSSED'; // Futures margin type (default: ISOLATED)
  simulateFundingRates?: boolean; // Simulate funding rate payments every 8h
  simulateLiquidation?: boolean; // Simulate position liquidation

  strategyParams?: Record<string, number>;

  usePartialExits?: boolean; // Enable scaled exits at profit targets
  partialExitLevels?: Array<{ percentage: number; rMultiple: number }>; // Exit levels
  lockProfitsAfterFirstExit?: boolean; // Move stop to break-even after first partial exit

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

  onlyLong?: boolean; // Only allow LONG positions (buy only, no shorts) - legacy, prefer directionMode
  directionMode?: 'long_only' | 'short_only'; // Direction filter (overrides onlyLong if set)
  trendFilterPeriod?: number; // EMA period for trend filter (default: 21 to match auto-trading)
  useTrendFilter?: boolean; // Enable trend filter (EMA21 alignment)

  tpCalculationMode?: 'default' | 'fibonacci'; // TP calculation mode (default: 'default')
  fibonacciTpLevel?: number; // Fibonacci level to use for TP (default: uses primaryLevel from projection, e.g., 0.618, 1.0, 1.618)
  fibonacciTargetLevel?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236'; // Named Fibonacci target level (fallback for both directions)
  fibonacciTargetLevelLong?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236'; // Fibonacci target for LONG positions (default: '2')
  fibonacciTargetLevelShort?: 'auto' | '1' | '1.272' | '1.382' | '1.618' | '2' | '2.618' | '3' | '3.618' | '4.236'; // Fibonacci target for SHORT positions (default: '1.272')

  maxFibonacciEntryProgressPercentLong?: number; // Max % progress for LONG entries (default: 127.2)
  maxFibonacciEntryProgressPercentShort?: number; // Max % progress for SHORT entries (default: 127.2)
  fibonacciSwingRange?: 'extended' | 'nearest'; // Swing range for Fibonacci projection (default: 'nearest')
  initialStopMode?: 'fibo_target' | 'nearest_swing'; // Stop placement mode (default: 'fibo_target')

  silent?: boolean; // Suppress verbose logging in strategy interpreters (useful for batch backtests/optimization)

  /**
   * Override path to Pine strategy `.pine` files. When omitted, engines
   * load from `apps/backend/strategies/builtin`. Used by integration
   * tests to load synthetic strategies from a tmp directory without
   * polluting the production set.
   */
  pineStrategiesDir?: string;
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
  side: PositionSide;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercent?: number;
  commission: number;
  netPnl?: number;
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'END_OF_PERIOD' | 'LIQUIDATION' | 'EXIT_CONDITION' | 'MAX_BARS';
  status: 'OPEN' | 'CLOSED';

  marketType?: MarketType;
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
  setupDetections?: TradingSetup[];
  klines?: Kline[];
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
  minTrailingDistance: number;
}

export interface TrailingStopOptimizationConfig {
  minTrailingDistancePercent: number;
  swingLookback: number;
  useATRMultiplier: boolean;
  atrMultiplier: number;
  trailingDistancePercent?: number;
  trailingDistanceMode?: TrailingDistanceMode;
  trailingStopOffsetPercent?: number;
  useVolatilityBasedThresholds?: boolean;
  marketType?: MarketType;
  useBnbDiscount?: boolean;
  useFibonacciThresholds?: boolean;
  activationPercentLong?: number;
  activationPercentShort?: number;
  forceActivated?: boolean;
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
  marketType?: MarketType;
  profileId?: string;
}

export interface MultiWatcherBacktestConfig extends Omit<BacktestConfig, 'symbol' | 'interval'> {
  watchers: WatcherConfig[];
  positionSizePercent?: number;
  useSharedExposure?: boolean;
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
