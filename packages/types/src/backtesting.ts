/**
 * Backtesting Types
 * Types for historical strategy backtesting
 */

export interface BacktestConfig {
  symbol: string;
  interval: string; // e.g., '1h', '4h', '1d'
  startDate: string; // ISO date
  endDate: string; // ISO date
  initialCapital: number;
  minProfitPercent?: number; // Min expected profit % per trade after fees (filters out low R:R setups)
  setupTypes?: string[]; // Which setups to trade (empty = all)
  minConfidence?: number; // Minimum confidence to enter trade
  onlyWithTrend?: boolean; // Only trade setups aligned with higher timeframe trend
  useAlgorithmicLevels?: boolean; // Use setup's calculated SL/TP instead of fixed percentages
  stopLossPercent?: number; // SL as % of entry (ignored if useAlgorithmicLevels = true)
  takeProfitPercent?: number; // TP as % of entry (ignored if useAlgorithmicLevels = true)
  maxPositionSize?: number; // Max % of capital per trade
  commission?: number; // Trading fee % (default 0.1%)
  slippagePercent?: number; // Slippage % for market orders - SL (default 0.05%)
  useOptimizedSettings?: boolean; // Use strategy's optimizedParams instead of config values

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
  exitReason?: 'STOP_LOSS' | 'TAKE_PROFIT' | 'MANUAL' | 'END_OF_PERIOD';
  status: 'OPEN' | 'CLOSED';
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
