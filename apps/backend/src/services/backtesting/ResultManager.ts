import fs from 'fs/promises';
import path from 'path';
import type { BacktestResult, BacktestMetrics } from '@marketmind/types';

export interface SavedBacktestResult {
  timestamp: string;
  type: 'validation' | 'optimization';
  strategy: string;
  symbol: string;
  interval: string;
  period: {
    start: string;
    end: string;
  };
  config: any;
  result: BacktestResult;
  metrics: BacktestMetrics;
  params?: Record<string, any>;
}

export interface OptimizationSummary {
  timestamp: string;
  type: 'optimization';
  strategy: string;
  symbol: string;
  interval: string;
  period: {
    start: string;
    end: string;
  };
  totalCombinations: number;
  successfulRuns: number;
  topResults: Array<{
    params: Record<string, any>;
    metrics: BacktestMetrics;
  }>;
  statistics: {
    average: {
      winRate: number;
      totalPnlPercent: number;
      profitFactor: number;
      sharpeRatio: number;
    };
  };
}

export class ResultManager {
  private baseDir: string;

  constructor(baseDir: string = '/Users/nathan/Documents/dev/marketmind/apps/backend/results') {
    this.baseDir = baseDir;
  }

  async saveValidation(
    strategy: string,
    symbol: string,
    interval: string,
    config: any,
    result: BacktestResult
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${strategy}_${symbol}_${interval}_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'validations', filename);

    const savedResult: SavedBacktestResult = {
      timestamp: new Date().toISOString(),
      type: 'validation',
      strategy,
      symbol,
      interval,
      period: {
        start: config.startDate,
        end: config.endDate,
      },
      config,
      result,
      metrics: result.metrics,
    };

    await fs.writeFile(filepath, JSON.stringify(savedResult, null, 2), 'utf-8');

    return filepath;
  }

  async saveOptimization(
    strategy: string,
    symbol: string,
    interval: string,
    config: any,
    results: Array<{ params: any; metrics: BacktestMetrics }>,
    statistics: any
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${strategy}_${symbol}_${interval}_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'optimizations', filename);

    const summary: OptimizationSummary = {
      timestamp: new Date().toISOString(),
      type: 'optimization',
      strategy,
      symbol,
      interval,
      period: {
        start: config.startDate,
        end: config.endDate,
      },
      totalCombinations: results.length,
      successfulRuns: results.length,
      topResults: results.slice(0, 10), // Save top 10
      statistics,
    };

    await fs.writeFile(filepath, JSON.stringify(summary, null, 2), 'utf-8');

    return filepath;
  }

  async load(filepath: string): Promise<SavedBacktestResult | OptimizationSummary> {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content);
  }

  async listValidations(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'validations'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'validations', f));
    } catch {
      return [];
    }
  }

  async listOptimizations(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'optimizations'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'optimizations', f));
    } catch {
      return [];
    }
  }

  async exportToCSV(result: SavedBacktestResult, outputPath: string): Promise<void> {
    const trades = result.result.trades;

    let csv = 'Trade,Type,Entry Date,Entry Price,Exit Date,Exit Price,Reason,PnL ($),PnL (%),Commission,Net PnL,Equity\n';

    trades.forEach((trade, index) => {
      const tradeData: any = trade; // Type assertion for flexibility
      csv += [
        index + 1,
        tradeData.side || tradeData.type || 'UNKNOWN',
        trade.entryTime,
        trade.entryPrice.toFixed(2),
        trade.exitTime || '',
        trade.exitPrice?.toFixed(2) || '',
        trade.exitReason || '',
        (trade.pnl ?? 0).toFixed(2),
        (trade.pnlPercent ?? 0).toFixed(2),
        trade.commission.toFixed(4),
        (trade.netPnl ?? 0).toFixed(2),
        '', // Equity after - not always available
      ].join(',') + '\n';
    });

    csv += '\nSummary\n';
    csv += `Total Trades,${result.metrics.totalTrades}\n`;
    csv += `Win Rate,${result.metrics.winRate.toFixed(2)}%\n`;
    csv += `Profit Factor,${result.metrics.profitFactor.toFixed(2)}\n`;
    csv += `Total PnL,${result.metrics.totalPnlPercent.toFixed(2)}%\n`;
    csv += `Max Drawdown,${result.metrics.maxDrawdownPercent.toFixed(2)}%\n`;
    csv += `Sharpe Ratio,${(result.metrics.sharpeRatio || 0).toFixed(2)}\n`;

    const finalEquity = result.config.initialCapital + result.metrics.totalPnl;
    csv += `Final Equity,${finalEquity.toFixed(2)}\n`;

    await fs.writeFile(outputPath, csv, 'utf-8');
  }

  async exportOptimizationToCSV(summary: OptimizationSummary, outputPath: string): Promise<void> {
    let csv = 'Rank,';

    const firstResult = summary.topResults[0];
    if (firstResult) {
      const paramNames = Object.keys(firstResult.params);
      csv += paramNames.join(',') + ',';
    }

    csv += 'Trades,Win Rate (%),Profit Factor,Total PnL (%),Max DD (%),Sharpe Ratio\n';

    summary.topResults.forEach((result, index) => {
      const row = [
        index + 1,
        ...Object.values(result.params),
        result.metrics.totalTrades,
        result.metrics.winRate.toFixed(2),
        result.metrics.profitFactor.toFixed(2),
        result.metrics.totalPnlPercent.toFixed(2),
        result.metrics.maxDrawdownPercent.toFixed(2),
        (result.metrics.sharpeRatio || 0).toFixed(2),
      ];
      csv += row.join(',') + '\n';
    });

    csv += '\nStatistics\n';
    csv += `Total Combinations,${summary.totalCombinations}\n`;
    csv += `Average Win Rate,${summary.statistics.average.winRate.toFixed(2)}%\n`;
    csv += `Average PnL,${summary.statistics.average.totalPnlPercent.toFixed(2)}%\n`;
    csv += `Average Profit Factor,${summary.statistics.average.profitFactor.toFixed(2)}\n`;
    csv += `Average Sharpe,${summary.statistics.average.sharpeRatio.toFixed(2)}\n`;

    await fs.writeFile(outputPath, csv, 'utf-8');
  }

  async saveWalkForward(
    strategy: string,
    symbol: string,
    interval: string,
    result: any
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${strategy}_${symbol}_${interval}_wf_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'walkforward', filename);

    await fs.mkdir(path.join(this.baseDir, 'walkforward'), { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

    return filepath;
  }

  async listWalkForward(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'walkforward'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'walkforward', f));
    } catch {
      return [];
    }
  }

  async saveMonteCarlo(
    strategy: string,
    symbol: string,
    interval: string,
    result: any
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${strategy}_${symbol}_${interval}_mc_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'montecarlo', filename);

    await fs.mkdir(path.join(this.baseDir, 'montecarlo'), { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

    return filepath;
  }

  async listMonteCarlo(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'montecarlo'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'montecarlo', f));
    } catch {
      return [];
    }
  }

  async saveSensitivity(
    strategy: string,
    symbol: string,
    interval: string,
    result: any
  ): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${strategy}_${symbol}_${interval}_sensitivity_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'sensitivity', filename);

    await fs.mkdir(path.join(this.baseDir, 'sensitivity'), { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

    return filepath;
  }

  async listSensitivity(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'sensitivity'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'sensitivity', f));
    } catch {
      return [];
    }
  }

  async saveRobustnessValidation(result: any): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `robustness_validation_${timestamp}.json`;
    const filepath = path.join(this.baseDir, 'robustness', filename);

    await fs.mkdir(path.join(this.baseDir, 'robustness'), { recursive: true });

    await fs.writeFile(filepath, JSON.stringify(result, null, 2), 'utf-8');

    return filepath;
  }

  async listRobustnessValidations(): Promise<string[]> {
    try {
      const files = await fs.readdir(path.join(this.baseDir, 'robustness'));
      return files.filter(f => f.endsWith('.json')).map(f => path.join(this.baseDir, 'robustness', f));
    } catch {
      return [];
    }
  }

  compareResults(results: Array<SavedBacktestResult | OptimizationSummary>): any {
    return results.map(result => {
      if (result.type === 'validation') {
        const validationResult = result as SavedBacktestResult;
        return {
          type: 'validation',
          strategy: validationResult.strategy,
          symbol: validationResult.symbol,
          interval: validationResult.interval,
          period: `${validationResult.period.start} → ${validationResult.period.end}`,
          trades: validationResult.metrics.totalTrades,
          winRate: validationResult.metrics.winRate,
          profitFactor: validationResult.metrics.profitFactor,
          totalPnl: validationResult.metrics.totalPnlPercent,
          maxDrawdown: validationResult.metrics.maxDrawdownPercent,
          sharpeRatio: validationResult.metrics.sharpeRatio || 0,
        };
      } else {
        const optimizationResult = result as OptimizationSummary;
        const best = optimizationResult.topResults[0];
        return {
          type: 'optimization',
          strategy: optimizationResult.strategy,
          symbol: optimizationResult.symbol,
          interval: optimizationResult.interval,
          period: `${optimizationResult.period.start} → ${optimizationResult.period.end}`,
          combinations: optimizationResult.totalCombinations,
          bestWinRate: best?.metrics.winRate || 0,
          bestProfitFactor: best?.metrics.profitFactor || 0,
          bestPnl: best?.metrics.totalPnlPercent || 0,
          avgWinRate: optimizationResult.statistics.average.winRate,
          avgPnl: optimizationResult.statistics.average.totalPnlPercent,
        };
      }
    });
  }
}
