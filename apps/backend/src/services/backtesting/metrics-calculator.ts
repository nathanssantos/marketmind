import type { BacktestMetrics } from '@marketmind/types';

interface MetricsTrade {
  pnl: number;
  netPnl: number;
  pnlPercent: number;
  commission: number;
  entryTime: string | number;
  exitTime?: string | number | null;
}

const toTimestamp = (t: string | number): number =>
  typeof t === 'string' ? new Date(t).getTime() : t;

const calculateDurationMinutes = (trade: MetricsTrade): number => {
  if (!trade.exitTime) return 0;
  return (toTimestamp(trade.exitTime) - toTimestamp(trade.entryTime)) / 60_000;
};

export const calculateBacktestMetrics = (
  trades: MetricsTrade[],
  initialCapital: number,
  maxDrawdown: number,
  maxDrawdownPercent?: number,
): BacktestMetrics => {
  if (trades.length === 0) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      avgPnl: 0,
      avgPnlPercent: 0,
      grossWinRate: 0,
      grossProfitFactor: 0,
      totalGrossPnl: 0,
      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,
      maxDrawdown,
      maxDrawdownPercent: maxDrawdownPercent ?? 0,
      totalCommission: 0,
      avgTradeDuration: 0,
      avgWinDuration: 0,
      avgLossDuration: 0,
    };
  }

  const winningTrades = trades.filter((t) => t.pnl > 0);
  const losingTrades = trades.filter((t) => t.pnl <= 0);

  const totalPnl = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0);
  const totalGrossPnl = trades.reduce((sum, t) => sum + t.pnl, 0);

  const totalWins = winningTrades.reduce((sum, t) => sum + t.pnl, 0);
  const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0));
  const grossProfitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

  const winRate = (winningTrades.length / trades.length) * 100;

  let cumulativePnl = 0;
  let peakPnl = 0;
  for (const trade of trades) {
    cumulativePnl += trade.netPnl;
    if (cumulativePnl > peakPnl) peakPnl = cumulativePnl;
  }
  const peakEquity = initialCapital + peakPnl;

  const avgTradeDuration = trades.reduce((sum, t) => sum + calculateDurationMinutes(t), 0) / trades.length;
  const avgWinDuration = winningTrades.length > 0
    ? winningTrades.reduce((sum, t) => sum + calculateDurationMinutes(t), 0) / winningTrades.length
    : 0;
  const avgLossDuration = losingTrades.length > 0
    ? losingTrades.reduce((sum, t) => sum + calculateDurationMinutes(t), 0) / losingTrades.length
    : 0;

  const metrics: BacktestMetrics = {
    totalTrades: trades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    winRate,
    totalPnl,
    totalPnlPercent: (totalPnl / initialCapital) * 100,
    avgPnl: totalPnl / trades.length,
    avgPnlPercent: trades.reduce((sum, t) => sum + t.pnlPercent, 0) / trades.length,
    grossWinRate: winRate,
    grossProfitFactor,
    totalGrossPnl,
    avgWin: winningTrades.length > 0 ? totalWins / winningTrades.length : 0,
    avgLoss: losingTrades.length > 0 ? totalLosses / losingTrades.length : 0,
    largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map((t) => t.pnl)) : 0,
    largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map((t) => t.pnl)) : 0,
    profitFactor: grossProfitFactor,
    maxDrawdown,
    maxDrawdownPercent: maxDrawdownPercent ?? (peakEquity > 0 ? (maxDrawdown / peakEquity) * 100 : 0),
    totalCommission,
    avgTradeDuration,
    avgWinDuration,
    avgLossDuration,
    sharpeRatio: 0,
  };

  if (trades.length > 1) {
    const returns = trades.map((t) => t.pnlPercent);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1);
    const stdDev = Math.sqrt(variance);
    metrics.sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0;
  }

  return metrics;
};
