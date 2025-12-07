import chalk from 'chalk';
import Table from 'cli-table3';
import type { BacktestMetrics, BacktestResult, BacktestTrade } from '@marketmind/types';

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

  error(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(chalk.red(`[${this.timestamp()}] ✗ ${message}`), ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(chalk.yellow(`[${this.timestamp()}] ⚠ ${message}`), ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.cyan(`[${this.timestamp()}] ${message}`), ...args);
    }
  }

  success(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(chalk.green(`[${this.timestamp()}] ✓ ${message}`), ...args);
    }
  }

  verbose(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      console.log(chalk.gray(`[${this.timestamp()}] ${message}`), ...args);
    }
  }

  debug(message: string, ...args: any[]) {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(chalk.magenta(`[${this.timestamp()}] [DEBUG] ${message}`), ...args);
    }
  }

  /**
   * Print a header box
   */
  header(title: string, details?: Record<string, string>) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const width = 64;
    const topLine = '╔' + '═'.repeat(width) + '╗';
    const bottomLine = '╚' + '═'.repeat(width) + '╝';
    const middleLine = '╠' + '═'.repeat(width) + '╣';

    console.log(chalk.cyan(topLine));
    console.log(chalk.cyan('║' + this.centerText(title, width) + '║'));

    if (details) {
      console.log(chalk.cyan(middleLine));
      for (const [key, value] of Object.entries(details)) {
        const line = `${key}: ${value}`;
        console.log(chalk.cyan('║ ') + this.padRight(line, width - 2) + chalk.cyan(' ║'));
      }
    }

    console.log(chalk.cyan(bottomLine));
    console.log('');
  }

  /**
   * Print a separator line
   */
  separator() {
    if (!this.shouldLog(LogLevel.INFO)) return;
    console.log(chalk.gray('─'.repeat(64)));
  }

  /**
   * Print backtest metrics in a table
   */
  metrics(metrics: BacktestMetrics) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('BACKTEST RESULTS');

    const table = new Table({
      style: { head: ['cyan'], border: ['cyan'] },
      colWidths: [30, 34],
    });

    const formatPercent = (value: number) => {
      const color = value > 0 ? chalk.green : value < 0 ? chalk.red : chalk.white;
      return color(`${value >= 0 ? '+' : ''}${value.toFixed(2)}%`);
    };

    const formatNumber = (value: number, decimals: number = 2) => {
      const formatted = value.toFixed(decimals);
      const color = value > 0 ? chalk.green : value < 0 ? chalk.red : chalk.white;
      return color(formatted);
    };

    table.push(
      ['Total Trades', chalk.white(metrics.totalTrades.toString())],
      ['Winning Trades', chalk.green(metrics.winningTrades.toString())],
      ['Losing Trades', chalk.red(metrics.losingTrades.toString())],
      ['Win Rate', formatPercent(metrics.winRate)],
      ['', ''],
      ['Total PnL', formatNumber(metrics.totalPnl, 2) + ' USDT'],
      ['Total PnL %', formatPercent(metrics.totalPnlPercent)],
      ['Avg PnL per Trade', formatNumber(metrics.avgPnl, 2) + ' USDT'],
      ['', ''],
      ['Profit Factor', chalk.white(metrics.profitFactor.toFixed(2))],
      ['Sharpe Ratio', chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A')],
      ['', ''],
      ['Max Drawdown', chalk.red(`-${metrics.maxDrawdown.toFixed(2)} USDT`)],
      ['Max Drawdown %', chalk.red(`-${metrics.maxDrawdownPercent.toFixed(2)}%`)],
      ['', ''],
      ['Avg Trade Duration', chalk.white(`${(metrics.avgTradeDuration / 60).toFixed(1)}h`)],
      ['Total Commission', chalk.white(`${metrics.totalCommission.toFixed(2)} USDT`)],
    );

    console.log(table.toString());
    console.log('');
  }

  /**
   * Print individual trades
   */
  trades(trades: BacktestTrade[], limit: number = 5) {
    if (!this.shouldLog(LogLevel.VERBOSE)) return;

    const displayTrades = trades.slice(0, limit);

    console.log(chalk.cyan(`\nTRADES (showing ${displayTrades.length} of ${trades.length}):`));
    this.separator();

    for (const [index, trade] of displayTrades.entries()) {
      const isWin = (trade.netPnl ?? 0) > 0;
      const pnlColor = isWin ? chalk.green : chalk.red;
      const symbol = isWin ? '✓' : '✗';

      console.log(chalk.white(`#${index + 1} - ${trade.side} @ $${trade.entryPrice.toFixed(2)} (${trade.entryTime})`));
      console.log(chalk.gray(`  SL: $${trade.stopLoss?.toFixed(2) ?? 'N/A'} | TP: $${trade.takeProfit?.toFixed(2) ?? 'N/A'}`));
      console.log(
        chalk.gray(`  Exit: $${trade.exitPrice?.toFixed(2) ?? 'N/A'} @ ${trade.exitTime ?? 'N/A'} (${trade.exitReason ?? 'N/A'})`)
      );
      console.log(
        pnlColor(`  Net PnL: ${(trade.netPnl ?? 0) >= 0 ? '+' : ''}$${(trade.netPnl ?? 0).toFixed(2)} (${(trade.pnlPercent ?? 0) >= 0 ? '+' : ''}${(trade.pnlPercent ?? 0).toFixed(2)}%) ${symbol}`)
      );
      this.separator();
    }

    if (trades.length > limit) {
      console.log(chalk.gray(`... and ${trades.length - limit} more trades\n`));
    }
  }

  /**
   * Print optimization results in a table
   */
  optimizationResults(results: Array<{ params: any; metrics: BacktestMetrics }>, top: number = 10) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('TOP OPTIMIZATION RESULTS');

    const table = new Table({
      head: [
        chalk.cyan('#'),
        chalk.cyan('SL%'),
        chalk.cyan('TP%'),
        chalk.cyan('MC'),
        chalk.cyan('Trades'),
        chalk.cyan('Win%'),
        chalk.cyan('PnL%'),
        chalk.cyan('PF'),
        chalk.cyan('Sharpe'),
      ],
      style: { head: [], border: ['cyan'] },
    });

    const displayResults = results.slice(0, top);

    for (const [index, result] of displayResults.entries()) {
      const { params, metrics } = result;

      const winRateColor = metrics.winRate >= 60 ? chalk.green : metrics.winRate >= 50 ? chalk.yellow : chalk.red;
      const pnlColor = metrics.totalPnlPercent > 0 ? chalk.green : chalk.red;
      const pfColor = metrics.profitFactor >= 2 ? chalk.green : metrics.profitFactor >= 1.5 ? chalk.yellow : chalk.red;

      table.push([
        chalk.white((index + 1).toString()),
        chalk.white(params.stopLossPercent?.toFixed(1) ?? 'N/A'),
        chalk.white(params.takeProfitPercent?.toFixed(0) ?? 'N/A'),
        chalk.white(params.minConfidence?.toString() ?? 'N/A'),
        chalk.white(metrics.totalTrades.toString()),
        winRateColor(metrics.winRate.toFixed(1)),
        pnlColor(metrics.totalPnlPercent.toFixed(1)),
        pfColor(metrics.profitFactor.toFixed(2)),
        chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A'),
      ]);
    }

    console.log(table.toString());
    console.log('');

    // Highlight best
    const best = results[0];
    if (best) {
      console.log(
        chalk.green('✓ BEST: ') +
          chalk.white(
            `SL=${best.params.stopLossPercent}%, TP=${best.params.takeProfitPercent}%, MC=${best.params.minConfidence} → ` +
              `PnL=${best.metrics.totalPnlPercent.toFixed(2)}%, WR=${best.metrics.winRate.toFixed(1)}%, PF=${best.metrics.profitFactor.toFixed(2)}`
          )
      );
      console.log('');
    }
  }

  /**
   * Print comparison table for multiple backtests
   */
  comparison(results: Array<{ name: string; metrics: BacktestMetrics }>) {
    if (!this.shouldLog(LogLevel.INFO)) return;

    this.header('BACKTEST COMPARISON');

    const table = new Table({
      head: [
        chalk.cyan('Strategy'),
        chalk.cyan('Trades'),
        chalk.cyan('Win%'),
        chalk.cyan('PnL%'),
        chalk.cyan('PF'),
        chalk.cyan('Sharpe'),
        chalk.cyan('MaxDD%'),
      ],
      style: { head: [], border: ['cyan'] },
    });

    for (const result of results) {
      const { name, metrics } = result;

      const winRateColor = metrics.winRate >= 60 ? chalk.green : metrics.winRate >= 50 ? chalk.yellow : chalk.red;
      const pnlColor = metrics.totalPnlPercent > 0 ? chalk.green : chalk.red;
      const pfColor = metrics.profitFactor >= 2 ? chalk.green : metrics.profitFactor >= 1.5 ? chalk.yellow : chalk.red;

      table.push([
        chalk.white(name),
        chalk.white(metrics.totalTrades.toString()),
        winRateColor(metrics.winRate.toFixed(1)),
        pnlColor((metrics.totalPnlPercent >= 0 ? '+' : '') + metrics.totalPnlPercent.toFixed(2)),
        pfColor(metrics.profitFactor.toFixed(2)),
        chalk.white(metrics.sharpeRatio?.toFixed(2) ?? 'N/A'),
        chalk.red(metrics.maxDrawdownPercent.toFixed(2)),
      ]);
    }

    console.log(table.toString());
    console.log('');
  }

  // Helper methods
  private centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPad = Math.floor(padding / 2);
    const rightPad = padding - leftPad;
    return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
  }

  private padRight(text: string, width: number): string {
    return text + ' '.repeat(Math.max(0, width - text.length));
  }
}

// Export a default instance
export const logger = new BacktestLogger();
