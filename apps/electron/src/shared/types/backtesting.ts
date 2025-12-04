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
  winRate: number; // %

  totalPnl: number;
  totalPnlPercent: number;
  avgPnl: number;
  avgPnlPercent: number;

  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  profitFactor: number; // Total wins / Total losses

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
