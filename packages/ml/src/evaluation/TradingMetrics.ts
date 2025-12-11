import type { BacktestTrade } from '@marketmind/types';
import type { PredictionResult } from '../types';

export interface TradingMetrics {
  signalAccuracy: number;
  falsePositiveRate: number;
  falseNegativeRate: number;

  mlEnhancedSharpe: number;
  baselineSharpe: number;
  sharpeImprovement: number;

  mlEnhancedWinRate: number;
  baselineWinRate: number;
  winRateImprovement: number;

  mlEnhancedProfitFactor: number;
  baselineProfitFactor: number;
  profitFactorImprovement: number;

  mlEnhancedMaxDrawdown: number;
  baselineMaxDrawdown: number;
  maxDrawdownImprovement: number;

  tradesFiltered: number;
  tradesAccepted: number;
  filteringRate: number;

  avgProfitPerTrade: number;
  avgLossPerTrade: number;
  expectancy: number;
}

export interface ThresholdConfig {
  minProbability: number;
  minConfidence: number;
}

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  minProbability: 0.5,
  minConfidence: 50,
};

interface TradeStats {
  winRate: number;
  profitFactor: number;
  sharpe: number;
  maxDrawdown: number;
  avgProfit: number;
  avgLoss: number;
  expectancy: number;
}

export class TradingMetricsEvaluator {
  evaluate(
    baselineTrades: BacktestTrade[],
    mlPredictions: Map<string, PredictionResult>,
    thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
  ): TradingMetrics {
    const mlFilteredTrades = baselineTrades.filter((trade) => {
      const prediction = mlPredictions.get(trade.setupId ?? '');
      return prediction && prediction.probability >= thresholds.minProbability;
    });

    const baselineMetrics = this.calculateTradeMetrics(baselineTrades);
    const mlMetrics = this.calculateTradeMetrics(mlFilteredTrades);

    const signalAccuracy = this.calculateSignalAccuracy(baselineTrades, mlPredictions);
    const { fpr, fnr } = this.calculateErrorRates(baselineTrades, mlPredictions, thresholds.minProbability);

    return {
      signalAccuracy,
      falsePositiveRate: fpr,
      falseNegativeRate: fnr,

      mlEnhancedSharpe: mlMetrics.sharpe,
      baselineSharpe: baselineMetrics.sharpe,
      sharpeImprovement: this.calculateImprovement(baselineMetrics.sharpe, mlMetrics.sharpe),

      mlEnhancedWinRate: mlMetrics.winRate,
      baselineWinRate: baselineMetrics.winRate,
      winRateImprovement: mlMetrics.winRate - baselineMetrics.winRate,

      mlEnhancedProfitFactor: mlMetrics.profitFactor,
      baselineProfitFactor: baselineMetrics.profitFactor,
      profitFactorImprovement: this.calculateImprovement(baselineMetrics.profitFactor, mlMetrics.profitFactor),

      mlEnhancedMaxDrawdown: mlMetrics.maxDrawdown,
      baselineMaxDrawdown: baselineMetrics.maxDrawdown,
      maxDrawdownImprovement: this.calculateImprovement(baselineMetrics.maxDrawdown, mlMetrics.maxDrawdown, true),

      tradesFiltered: baselineTrades.length - mlFilteredTrades.length,
      tradesAccepted: mlFilteredTrades.length,
      filteringRate:
        baselineTrades.length > 0
          ? ((baselineTrades.length - mlFilteredTrades.length) / baselineTrades.length) * 100
          : 0,

      avgProfitPerTrade: mlMetrics.avgProfit,
      avgLossPerTrade: mlMetrics.avgLoss,
      expectancy: mlMetrics.expectancy,
    };
  }

  evaluateBySetupType(
    baselineTrades: BacktestTrade[],
    mlPredictions: Map<string, PredictionResult>,
    thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
  ): Map<string, TradingMetrics> {
    const tradesByType = new Map<string, BacktestTrade[]>();

    for (const trade of baselineTrades) {
      const setupType = trade.setupType ?? 'unknown';
      const existing = tradesByType.get(setupType) ?? [];
      existing.push(trade);
      tradesByType.set(setupType, existing);
    }

    const resultsByType = new Map<string, TradingMetrics>();

    for (const [setupType, trades] of tradesByType) {
      const metrics = this.evaluate(trades, mlPredictions, thresholds);
      resultsByType.set(setupType, metrics);
    }

    return resultsByType;
  }

  findOptimalThreshold(
    baselineTrades: BacktestTrade[],
    mlPredictions: Map<string, PredictionResult>,
    metric: 'sharpe' | 'winRate' | 'profitFactor' | 'expectancy' = 'sharpe'
  ): { threshold: number; improvement: number } {
    const thresholds = [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];
    let bestThreshold = 0.5;
    let bestScore = -Infinity;

    const baselineStats = this.calculateTradeMetrics(baselineTrades);

    for (const threshold of thresholds) {
      const filteredTrades = baselineTrades.filter((trade) => {
        const prediction = mlPredictions.get(trade.setupId ?? '');
        return prediction && prediction.probability >= threshold;
      });

      if (filteredTrades.length < 10) continue;

      const stats = this.calculateTradeMetrics(filteredTrades);

      let score: number;
      switch (metric) {
        case 'sharpe':
          score = stats.sharpe;
          break;
        case 'winRate':
          score = stats.winRate;
          break;
        case 'profitFactor':
          score = stats.profitFactor;
          break;
        case 'expectancy':
          score = stats.expectancy;
          break;
      }

      if (score > bestScore) {
        bestScore = score;
        bestThreshold = threshold;
      }
    }

    const baselineScore =
      metric === 'sharpe'
        ? baselineStats.sharpe
        : metric === 'winRate'
          ? baselineStats.winRate
          : metric === 'profitFactor'
            ? baselineStats.profitFactor
            : baselineStats.expectancy;

    return {
      threshold: bestThreshold,
      improvement: this.calculateImprovement(baselineScore, bestScore),
    };
  }

  private calculateTradeMetrics(trades: BacktestTrade[]): TradeStats {
    if (trades.length === 0) {
      return {
        winRate: 0,
        profitFactor: 0,
        sharpe: 0,
        maxDrawdown: 0,
        avgProfit: 0,
        avgLoss: 0,
        expectancy: 0,
      };
    }

    const winningTrades = trades.filter((t) => (t.pnlPercent ?? 0) > 0);
    const losingTrades = trades.filter((t) => (t.pnlPercent ?? 0) < 0);

    const winRate = winningTrades.length / trades.length;

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

    const avgProfit = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;

    const expectancy = winRate * avgProfit - (1 - winRate) * avgLoss;

    const returns = trades.map((t) => t.pnlPercent ?? 0);
    const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const variance =
      returns.length > 1
        ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)
        : 0;
    const stdReturn = Math.sqrt(variance);
    const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252) : 0;

    const maxDrawdown = this.calculateMaxDrawdown(trades);

    return {
      winRate,
      profitFactor,
      sharpe,
      maxDrawdown,
      avgProfit,
      avgLoss,
      expectancy,
    };
  }

  private calculateMaxDrawdown(trades: BacktestTrade[]): number {
    if (trades.length === 0) return 0;

    let peak = 100;
    let equity = 100;
    let maxDrawdown = 0;

    for (const trade of trades) {
      equity *= 1 + (trade.pnlPercent ?? 0) / 100;
      if (equity > peak) {
        peak = equity;
      }
      const drawdown = ((peak - equity) / peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  private calculateSignalAccuracy(
    trades: BacktestTrade[],
    mlPredictions: Map<string, PredictionResult>
  ): number {
    let correct = 0;
    let total = 0;

    for (const trade of trades) {
      const prediction = mlPredictions.get(trade.setupId ?? '');
      if (!prediction) continue;

      total++;
      const wasWinning = (trade.pnlPercent ?? 0) > 0;
      const predictedWinning = prediction.label === 1;

      if (wasWinning === predictedWinning) {
        correct++;
      }
    }

    return total > 0 ? correct / total : 0;
  }

  private calculateErrorRates(
    trades: BacktestTrade[],
    mlPredictions: Map<string, PredictionResult>,
    threshold: number
  ): { fpr: number; fnr: number } {
    let fp = 0;
    let fn = 0;
    let totalNegative = 0;
    let totalPositive = 0;

    for (const trade of trades) {
      const prediction = mlPredictions.get(trade.setupId ?? '');
      if (!prediction) continue;

      const wasWinning = (trade.pnlPercent ?? 0) > 0;
      const acceptedTrade = prediction.probability >= threshold;

      if (wasWinning) {
        totalPositive++;
        if (!acceptedTrade) fn++;
      } else {
        totalNegative++;
        if (acceptedTrade) fp++;
      }
    }

    return {
      fpr: totalNegative > 0 ? fp / totalNegative : 0,
      fnr: totalPositive > 0 ? fn / totalPositive : 0,
    };
  }

  private calculateImprovement(baseline: number, enhanced: number, lowerIsBetter = false): number {
    if (baseline === 0) {
      return enhanced > 0 ? (lowerIsBetter ? -100 : 100) : 0;
    }

    const improvement = ((enhanced - baseline) / Math.abs(baseline)) * 100;
    return lowerIsBetter ? -improvement : improvement;
  }
}
