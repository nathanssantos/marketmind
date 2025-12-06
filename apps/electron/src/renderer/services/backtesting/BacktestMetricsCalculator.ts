import type { BacktestMetrics, BacktestTrade } from '@shared/types/backtesting';

export class BacktestMetricsCalculator {
  calculate(trades: BacktestTrade[], initialCapital: number): BacktestMetrics {
    if (trades.length === 0) {
      return this.createEmptyMetrics();
    }

    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    if (closedTrades.length === 0) {
      return this.createEmptyMetrics();
    }

    const winningTrades = closedTrades.filter((t) => (t.netPnl || 0) > 0);
    const losingTrades = closedTrades.filter((t) => (t.netPnl || 0) <= 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const totalPnlPercent = (totalPnl / initialCapital) * 100;

    const avgPnl = totalPnl / closedTrades.length;
    const avgPnlPercent = (avgPnl / initialCapital) * 100;

    const totalWins = winningTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0);
    const totalLosses = Math.abs(
      losingTrades.reduce((sum, t) => sum + (t.netPnl || 0), 0)
    );

    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;

    const largestWin = winningTrades.length > 0
      ? Math.max(...winningTrades.map((t) => t.netPnl || 0))
      : 0;
    
    const largestLoss = losingTrades.length > 0
      ? Math.min(...losingTrades.map((t) => t.netPnl || 0))
      : 0;

    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0;

    const { maxDrawdown, maxDrawdownPercent } = this.calculateMaxDrawdown(
      closedTrades,
      initialCapital
    );

    const sharpeRatio = this.calculateSharpeRatio(closedTrades, initialCapital);
    const sortinoRatio = this.calculateSortinoRatio(closedTrades, initialCapital);

    const totalCommission = closedTrades.reduce((sum, t) => sum + t.commission, 0);

    const { avgTradeDuration, avgWinDuration, avgLossDuration } =
      this.calculateDurations(closedTrades, winningTrades, losingTrades);

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: (winningTrades.length / closedTrades.length) * 100,

      totalPnl,
      totalPnlPercent,
      avgPnl,
      avgPnlPercent,

      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      profitFactor,

      maxDrawdown,
      maxDrawdownPercent,

      sharpeRatio,
      sortinoRatio,

      totalCommission,

      avgTradeDuration,
      avgWinDuration,
      avgLossDuration,
    };
  }

  createEmptyMetrics(): BacktestMetrics {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,

      totalPnl: 0,
      totalPnlPercent: 0,
      avgPnl: 0,
      avgPnlPercent: 0,

      avgWin: 0,
      avgLoss: 0,
      largestWin: 0,
      largestLoss: 0,
      profitFactor: 0,

      maxDrawdown: 0,
      maxDrawdownPercent: 0,

      sharpeRatio: 0,
      sortinoRatio: 0,

      totalCommission: 0,

      avgTradeDuration: 0,
      avgWinDuration: 0,
      avgLossDuration: 0,
    };
  }

  private calculateMaxDrawdown(
    trades: BacktestTrade[],
    initialCapital: number
  ): { maxDrawdown: number; maxDrawdownPercent: number } {
    let equity = initialCapital;
    let peakEquity = initialCapital;
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;

    for (const trade of trades) {
      equity += trade.netPnl || 0;
      
      if (equity > peakEquity) {
        peakEquity = equity;
      } else {
        const drawdown = peakEquity - equity;
        const drawdownPercent = (drawdown / peakEquity) * 100;
        
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
          maxDrawdownPercent = drawdownPercent;
        }
      }
    }

    return { maxDrawdown, maxDrawdownPercent };
  }

  private calculateSharpeRatio(
    trades: BacktestTrade[],
    initialCapital: number
  ): number {
    if (trades.length < 2) return 0;

    const returns = trades.map((t) => (t.netPnl || 0) / initialCapital);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) /
      (returns.length - 1);
    
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) return 0;

    const riskFreeRate = 0;
    const sharpeRatio = (avgReturn - riskFreeRate) / stdDev;

    return sharpeRatio * Math.sqrt(252);
  }

  private calculateSortinoRatio(
    trades: BacktestTrade[],
    initialCapital: number
  ): number {
    if (trades.length < 2) return 0;

    const returns = trades.map((t) => (t.netPnl || 0) / initialCapital);
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    
    const downside = returns.filter((r) => r < 0);
    
    if (downside.length === 0) return 0;

    const downsideVariance =
      downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length;
    
    const downsideStdDev = Math.sqrt(downsideVariance);

    if (downsideStdDev === 0) return 0;

    const riskFreeRate = 0;
    const sortinoRatio = (avgReturn - riskFreeRate) / downsideStdDev;

    return sortinoRatio * Math.sqrt(252);
  }

  private calculateDurations(
    allTrades: BacktestTrade[],
    winningTrades: BacktestTrade[],
    losingTrades: BacktestTrade[]
  ): {
    avgTradeDuration: number;
    avgWinDuration: number;
    avgLossDuration: number;
  } {
    const calculateAvgDuration = (trades: BacktestTrade[]): number => {
      if (trades.length === 0) return 0;

      const durations = trades
        .filter((t) => t.exitTime)
        .map((t) => {
          const entry = new Date(t.entryTime).getTime();
          const exit = new Date(t.exitTime!).getTime();
          return (exit - entry) / (1000 * 60);
        });

      if (durations.length === 0) return 0;

      return durations.reduce((sum, d) => sum + d, 0) / durations.length;
    };

    return {
      avgTradeDuration: calculateAvgDuration(allTrades),
      avgWinDuration: calculateAvgDuration(winningTrades),
      avgLossDuration: calculateAvgDuration(losingTrades),
    };
  }

  calculateWinRateBySetup(trades: BacktestTrade[]): Map<string, number> {
    const setupStats = new Map<string, { wins: number; total: number }>();

    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    for (const trade of closedTrades) {
      if (!trade.setupType) continue;

      const stats = setupStats.get(trade.setupType) || { wins: 0, total: 0 };
      stats.total++;
      if ((trade.netPnl || 0) > 0) stats.wins++;
      setupStats.set(trade.setupType, stats);
    }

    const winRates = new Map<string, number>();
    for (const [setup, stats] of setupStats) {
      winRates.set(setup, (stats.wins / stats.total) * 100);
    }

    return winRates;
  }

  calculateAvgPnlBySetup(trades: BacktestTrade[]): Map<string, number> {
    const setupPnl = new Map<string, { total: number; count: number }>();

    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    for (const trade of closedTrades) {
      if (!trade.setupType) continue;

      const stats = setupPnl.get(trade.setupType) || { total: 0, count: 0 };
      stats.total += trade.netPnl || 0;
      stats.count++;
      setupPnl.set(trade.setupType, stats);
    }

    const avgPnl = new Map<string, number>();
    for (const [setup, stats] of setupPnl) {
      avgPnl.set(setup, stats.total / stats.count);
    }

    return avgPnl;
  }

  calculateProfitFactorBySetup(trades: BacktestTrade[]): Map<string, number> {
    const setupStats = new Map<string, { wins: number; losses: number }>();

    const closedTrades = trades.filter((t) => t.status === 'CLOSED');

    for (const trade of closedTrades) {
      if (!trade.setupType) continue;

      const stats = setupStats.get(trade.setupType) || { wins: 0, losses: 0 };
      const pnl = trade.netPnl || 0;
      
      if (pnl > 0) {
        stats.wins += pnl;
      } else {
        stats.losses += Math.abs(pnl);
      }
      
      setupStats.set(trade.setupType, stats);
    }

    const profitFactors = new Map<string, number>();
    for (const [setup, stats] of setupStats) {
      const pf = stats.losses > 0 ? stats.wins / stats.losses : stats.wins > 0 ? Infinity : 0;
      profitFactors.set(setup, pf);
    }

    return profitFactors;
  }
}
