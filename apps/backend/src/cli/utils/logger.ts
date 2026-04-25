import chalk from 'chalk';
import type { BacktestMetrics, BacktestTrade } from '@marketmind/types';

export enum LogLevel {
  SILENT = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  VERBOSE = 4,
  DEBUG = 5,
}

export class BacktestLogger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  setLevel(level: LogLevel) {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return this.level >= level;
  }

  private timestamp(): string {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(chalk.red(`[${this.timestamp()}] ✗ ${message}`), ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow(`[${this.timestamp()}] ! ${message}`), ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.cyan(`[${this.timestamp()}] ${message}`), ...args);
    }
  }

  success(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.green(`[${this.timestamp()}] ✓ ${message}`), ...args);
    }
  }

  verbose(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(chalk.gray(`[${this.timestamp()}] ${message}`), ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(chalk.magenta(`[${this.timestamp()}] [DEBUG] ${message}`), ...args);
    }
  }

  header(title: string, details?: Record<string, string>) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    console.log('');
    console.log(chalk.cyan(`--- ${title} ---`));

    if (details) {
      for (const [key, value] of Object.entries(details)) {
        console.log(chalk.gray(`  ${key}: ${value}`));
      }
    }

    console.log('');
  }

  separator() {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.log(chalk.gray('---'));
  }

  metrics(metrics: BacktestMetrics) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('BACKTEST RESULTS');

    const formatPercent = (value: number) => {
      const color = value > 0 ? chalk.green : value < 0 ? chalk.red : chalk.white;
      return color(`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`);
    };

    const formatNumber = (value: number, decimals: number = 2) => {
      const formatted = value.toFixed(decimals);
      const color = value > 0 ? chalk.green : value < 0 ? chalk.red : chalk.white;
      return color(formatted);
    };

    const pad = (label: string) => label.padEnd(22);

    console.log(`  ${pad('total trades')}${chalk.white(metrics.totalTrades.toString())}`);
    console.log(`  ${pad('winning')}${chalk.green(metrics.winningTrades.toString())} · losing ${chalk.red(metrics.losingTrades.toString())}`);
    console.log(`  ${pad('win rate')}${formatPercent(metrics.winRate)}`);
    console.log('');
    console.log(`  ${pad('total pnl')}${formatNumber(metrics.totalPnl, 2)} USDT`);
    console.log(`  ${pad('total pnl %')}${formatPercent(metrics.totalPnlPercent)}`);
    console.log(`  ${pad('avg pnl/trade')}${formatNumber(metrics.avgPnl, 2)} USDT`);
    console.log('');
    console.log(`  ${pad('profit factor')}${chalk.white(metrics.profitFactor.toFixed(2))}`);
    console.log(`  ${pad('sharpe ratio')}${chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A')}`);
    console.log('');
    console.log(`  ${pad('max drawdown')}${chalk.red(`-${metrics.maxDrawdown.toFixed(2)} USDT`)}`);
    console.log(`  ${pad('max drawdown %')}${chalk.red(`-${metrics.maxDrawdownPercent.toFixed(2)}%`)}`);
    console.log('');
    console.log(`  ${pad('avg trade duration')}${chalk.white(`${(metrics.avgTradeDuration / 60).toFixed(1)}h`)}`);
    console.log(`  ${pad('total commission')}${chalk.white(`${metrics.totalCommission.toFixed(2)} USDT`)}`);
    console.log('');
  }

  trades(trades: BacktestTrade[], limit: number = 5) {
    if (!this.shouldLog(LogLevel.VERBOSE)) return;

    const displayTrades = trades.slice(0, limit);

    console.log(chalk.cyan(`\n  trades (showing ${displayTrades.length} of ${trades.length}):`));
    this.separator();

    for (const [index, trade] of displayTrades.entries()) {
      const isWin = (trade.netPnl ?? 0) > 0;
      const pnlColor = isWin ? chalk.green : chalk.red;
      const symbol = isWin ? '✓' : '✗';

      console.log(chalk.white(`  #${index + 1} ${trade.side} @ $${trade.entryPrice.toFixed(2)} (${trade.entryTime})`));
      console.log(chalk.gray(`    SL: $${trade.stopLoss?.toFixed(2) ?? 'N/A'} · TP: $${trade.takeProfit?.toFixed(2) ?? 'N/A'}`));
      console.log(
        chalk.gray(`    Exit: $${trade.exitPrice?.toFixed(2) ?? 'N/A'} @ ${trade.exitTime ?? 'N/A'} (${trade.exitReason ?? 'N/A'})`)
      );
      console.log(
        pnlColor(`    PnL: ${(trade.netPnl ?? 0) >= 0 ? '+' : ''}$${(trade.netPnl ?? 0).toFixed(2)} (${(trade.pnlPercent ?? 0) >= 0 ? '+' : ''}${(trade.pnlPercent ?? 0).toFixed(2)}%) ${symbol}`)
      );
      this.separator();
    }

    if (trades.length > limit) {
      console.log(chalk.gray(`  ... and ${trades.length - limit} more trades\n`));
    }
  }

  optimizationResults(
    results: Array<{
      params: { stopLossPercent?: number; takeProfitPercent?: number; minConfidence?: number };
      metrics: BacktestMetrics;
    }>,
    top: number = 10,
  ) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('TOP OPTIMIZATION RESULTS');

    const displayResults = results.slice(0, top);

    for (const [index, result] of displayResults.entries()) {
      const { params, metrics } = result;

      const winRateColor = metrics.winRate >= 60 ? chalk.green : metrics.winRate >= 50 ? chalk.yellow : chalk.red;
      const pnlColor = metrics.totalPnlPercent > 0 ? chalk.green : chalk.red;
      const pfColor = metrics.profitFactor >= 2 ? chalk.green : metrics.profitFactor >= 1.5 ? chalk.yellow : chalk.red;

      console.log(
        `  #${(index + 1).toString().padStart(2)} ` +
        `SL=${chalk.white(params.stopLossPercent?.toFixed(1) ?? 'N/A')}% ` +
        `TP=${chalk.white(params.takeProfitPercent?.toFixed(0) ?? 'N/A')}% ` +
        `MC=${chalk.white(params.minConfidence?.toString() ?? 'N/A')} ` +
        `${chalk.white(metrics.totalTrades.toString())} trades ` +
        `WR=${winRateColor(metrics.winRate.toFixed(1))}% ` +
        `PnL=${pnlColor(metrics.totalPnlPercent.toFixed(1))}% ` +
        `PF=${pfColor(metrics.profitFactor.toFixed(2))} ` +
        `Sharpe=${chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A')}`
      );
    }

    console.log('');

    const best = results[0];
    if (best) {
      console.log(
        chalk.green('  ✓ BEST: ') +
          chalk.white(
            `SL=${best.params.stopLossPercent}%, TP=${best.params.takeProfitPercent}%, MC=${best.params.minConfidence} -> ` +
              `PnL=${best.metrics.totalPnlPercent.toFixed(2)}%, WR=${best.metrics.winRate.toFixed(1)}%, PF=${best.metrics.profitFactor.toFixed(2)}`
          )
      );
      console.log('');
    }
  }

  comparison(results: Array<{ name: string; metrics: BacktestMetrics }>) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('BACKTEST COMPARISON');

    for (const result of results) {
      const { name, metrics } = result;

      const winRateColor = metrics.winRate >= 60 ? chalk.green : metrics.winRate >= 50 ? chalk.yellow : chalk.red;
      const pnlColor = metrics.totalPnlPercent > 0 ? chalk.green : chalk.red;
      const pfColor = metrics.profitFactor >= 2 ? chalk.green : metrics.profitFactor >= 1.5 ? chalk.yellow : chalk.red;

      console.log(
        `  ${chalk.white(name.padEnd(16))} ` +
        `${chalk.white(metrics.totalTrades.toString().padStart(4))} trades ` +
        `WR=${winRateColor(metrics.winRate.toFixed(1).padStart(5))}% ` +
        `PnL=${pnlColor((metrics.totalPnlPercent >= 0 ? '+' : '') + metrics.totalPnlPercent.toFixed(2))}% ` +
        `PF=${pfColor(metrics.profitFactor.toFixed(2))} ` +
        `Sharpe=${chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A')} ` +
        `DD=${chalk.red(metrics.maxDrawdownPercent.toFixed(2))}%`
      );
    }

    console.log('');
  }
}

export const logger = new BacktestLogger();
