import { ENABLED_STRATEGIES } from '@marketmind/types';
import chalk from 'chalk';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { StrategyLoader } from '../../services/setup-detection/dynamic';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TIMEFRAMES = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w'];
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'];

interface BatchResult {
  strategy: string;
  symbol: string;
  interval: string;
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  totalPnlPercent: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
  avgTradeDuration: number;
  status: 'success' | 'error' | 'no_trades';
  errorMessage?: string;
}

interface BatchOptions {
  start: string;
  end: string;
  capital: string;
  parallel: string;
  output?: string;
  strategies?: string;
  symbols?: string;
  intervals?: string;
  verbose: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const runSingleBacktest = async (
  engine: BacktestEngine,
  strategy: string,
  symbol: string,
  interval: string,
  startDate: string,
  endDate: string,
  capital: number
): Promise<BatchResult> => {
  try {
    const result = await engine.run({
      symbol,
      interval,
      startDate,
      endDate,
      initialCapital: capital,
      setupTypes: [strategy],
      useOptimizedSettings: true,
      useAlgorithmicLevels: true,
      useTrailingStop: true,
      onlyWithTrend: false,
      slippagePercent: 0.1,
      minRiskRewardRatio: 1.25,
    });

    if (result.trades.length === 0) {
      return {
        strategy,
        symbol,
        interval,
        totalTrades: 0,
        winRate: 0,
        profitFactor: 0,
        totalPnlPercent: 0,
        sharpeRatio: 0,
        maxDrawdownPercent: 0,
        avgTradeDuration: 0,
        status: 'no_trades',
      };
    }

    return {
      strategy,
      symbol,
      interval,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      totalPnlPercent: result.metrics.totalPnlPercent,
      sharpeRatio: result.metrics.sharpeRatio ?? 0,
      maxDrawdownPercent: result.metrics.maxDrawdownPercent,
      avgTradeDuration: result.metrics.avgTradeDuration,
      status: 'success',
    };
  } catch (error) {
    return {
      strategy,
      symbol,
      interval,
      totalTrades: 0,
      winRate: 0,
      profitFactor: 0,
      totalPnlPercent: 0,
      sharpeRatio: 0,
      maxDrawdownPercent: 0,
      avgTradeDuration: 0,
      status: 'error',
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
};

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
};

const generateCSV = (results: BatchResult[]): string => {
  const headers = [
    'Strategy',
    'Symbol',
    'Interval',
    'Total Trades',
    'Win Rate %',
    'Profit Factor',
    'Total PnL %',
    'Sharpe Ratio',
    'Max Drawdown %',
    'Avg Trade Duration (min)',
    'Status',
    'Error',
  ];

  const rows = results.map((r) => [
    r.strategy,
    r.symbol,
    r.interval,
    r.totalTrades.toString(),
    r.winRate.toFixed(2),
    r.profitFactor.toFixed(2),
    r.totalPnlPercent.toFixed(2),
    r.sharpeRatio.toFixed(2),
    r.maxDrawdownPercent.toFixed(2),
    r.avgTradeDuration.toFixed(2),
    r.status,
    r.errorMessage ?? '',
  ]);

  return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
};

const generateSummary = (results: BatchResult[]): string => {
  const successful = results.filter((r) => r.status === 'success');
  const noTrades = results.filter((r) => r.status === 'no_trades');
  const errors = results.filter((r) => r.status === 'error');

  const byStrategy = new Map<string, BatchResult[]>();
  for (const r of successful) {
    const existing = byStrategy.get(r.strategy) ?? [];
    existing.push(r);
    byStrategy.set(r.strategy, existing);
  }

  const strategyStats = Array.from(byStrategy.entries()).map(([strategy, stratResults]) => {
    const avgWinRate = stratResults.reduce((sum, r) => sum + r.winRate, 0) / stratResults.length;
    const avgPF = stratResults.reduce((sum, r) => sum + r.profitFactor, 0) / stratResults.length;
    const avgPnl = stratResults.reduce((sum, r) => sum + r.totalPnlPercent, 0) / stratResults.length;
    const totalTrades = stratResults.reduce((sum, r) => sum + r.totalTrades, 0);

    return { strategy, avgWinRate, avgPF, avgPnl, totalTrades, count: stratResults.length };
  });

  strategyStats.sort((a, b) => b.avgPnl - a.avgPnl);

  let summary = `\n${  chalk.bold.cyan('═══════════════════════════════════════════════════════════════════')  }\n`;
  summary += `${chalk.bold.cyan('                      BATCH BACKTEST SUMMARY                        ')  }\n`;
  summary += `${chalk.bold.cyan('═══════════════════════════════════════════════════════════════════')  }\n\n`;

  summary += chalk.bold('Test Results:\n');
  summary += `  ${chalk.green('✓')} Successful: ${successful.length}\n`;
  summary += `  ${chalk.yellow('○')} No trades: ${noTrades.length}\n`;
  summary += `  ${chalk.red('✗')} Errors: ${errors.length}\n`;
  summary += `  Total: ${results.length}\n\n`;

  summary += chalk.bold('Strategy Rankings (by Avg PnL%):\n');
  summary += `${'─'.repeat(80)  }\n`;
  summary += `${chalk.gray(
    `${'Strategy'.padEnd(30) +
      'Avg Win%'.padEnd(12) +
      'Avg PF'.padEnd(10) +
      'Avg PnL%'.padEnd(12) +
      'Trades'.padEnd(10) 
      }Tests`
  )  }\n`;
  summary += `${'─'.repeat(80)  }\n`;

  for (const stat of strategyStats) {
    const pnlColor = stat.avgPnl > 0 ? chalk.green : chalk.red;
    const pfColor = stat.avgPF > 1 ? chalk.green : chalk.red;

    summary +=
      `${stat.strategy.padEnd(30) +
      `${stat.avgWinRate.toFixed(1)}%`.padEnd(12) +
      pfColor(`${stat.avgPF.toFixed(2)}`.padEnd(10)) +
      pnlColor(`${stat.avgPnl.toFixed(1)}%`.padEnd(12)) +
      `${stat.totalTrades}`.padEnd(10) 
      }${stat.count}\n`;
  }

  summary += `${'─'.repeat(80)  }\n`;

  if (successful.length > 0) {
    const bestByPnl = successful.reduce((best, r) => (r.totalPnlPercent > best.totalPnlPercent ? r : best));
    const bestByWinRate = successful.reduce((best, r) => (r.winRate > best.winRate ? r : best));
    const bestByPF = successful.reduce((best, r) => (r.profitFactor > best.profitFactor ? r : best));

    summary += `\n${  chalk.bold('Top Performers:\n')}`;
    summary += `  Best PnL%: ${chalk.green(bestByPnl.strategy)} on ${bestByPnl.symbol}/${bestByPnl.interval} → ${chalk.green(`${bestByPnl.totalPnlPercent.toFixed(1)}%`)}\n`;
    summary += `  Best Win Rate: ${chalk.green(bestByWinRate.strategy)} on ${bestByWinRate.symbol}/${bestByWinRate.interval} → ${chalk.green(`${bestByWinRate.winRate.toFixed(1)}%`)}\n`;
    summary += `  Best Profit Factor: ${chalk.green(bestByPF.strategy)} on ${bestByPF.symbol}/${bestByPF.interval} → ${chalk.green(`${bestByPF.profitFactor.toFixed(2)}`)}\n`;
  }

  return summary;
};

export const batchBacktestCommand = async (options: BatchOptions): Promise<void> => {
  const startTime = Date.now();

  console.log(chalk.bold.cyan('\n═══════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('                   BATCH BACKTEST RUNNER                           '));
  console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════════\n'));

  const capital = parseFloat(options.capital);
  const parallelWorkers = parseInt(options.parallel, 10);

  const strategies = options.strategies
    ? options.strategies.split(',').map((s) => s.trim())
    : ENABLED_STRATEGIES;

  const symbols = options.symbols
    ? options.symbols.split(',').map((s) => s.trim())
    : SYMBOLS;

  const intervals = options.intervals
    ? options.intervals.split(',').map((i) => i.trim())
    : TIMEFRAMES;

  const totalCombinations = strategies.length * symbols.length * intervals.length;

  console.log(chalk.bold('Configuration:'));
  console.log(`  Period: ${options.start} to ${options.end}`);
  console.log(`  Capital: $${capital.toLocaleString()}`);
  console.log(`  Parallel workers: ${parallelWorkers}`);
  console.log(`  Strategies: ${strategies.length}`);
  console.log(`  Symbols: ${symbols.join(', ')}`);
  console.log(`  Intervals: ${intervals.join(', ')}`);
  console.log(`  Total combinations: ${chalk.bold(totalCombinations.toString())}`);
  console.log('');

  const strategiesDir = resolve(__dirname, '../../../strategies/builtin');
  const loader = new StrategyLoader([strategiesDir]);
  const allStrategies = await loader.loadAll({ includeUnprofitable: true });
  const availableStrategies = new Set(allStrategies.map((s) => s.id));

  const missingStrategies = strategies.filter((s) => !availableStrategies.has(s));
  if (missingStrategies.length > 0) {
    console.log(chalk.yellow(`Warning: These strategies were not found: ${missingStrategies.join(', ')}`));
  }

  const validStrategies = strategies.filter((s) => availableStrategies.has(s));
  if (validStrategies.length === 0) {
    console.error(chalk.red('No valid strategies found!'));
    process.exit(1);
  }

  const combinations: Array<{ strategy: string; symbol: string; interval: string }> = [];
  for (const strategy of validStrategies) {
    for (const symbol of symbols) {
      for (const interval of intervals) {
        combinations.push({ strategy, symbol, interval });
      }
    }
  }

  console.log(chalk.bold(`Running ${combinations.length} backtests...\n`));

  const results: BatchResult[] = [];
  const engine = new BacktestEngine();
  let completed = 0;

  const processBatch = async (batch: typeof combinations): Promise<BatchResult[]> => {
    return Promise.all(
      batch.map(async ({ strategy, symbol, interval }) => {
        const result = await runSingleBacktest(
          engine,
          strategy,
          symbol,
          interval,
          options.start,
          options.end,
          capital
        );

        completed++;
        const progress = ((completed / combinations.length) * 100).toFixed(1);
        const elapsed = formatDuration(Date.now() - startTime);
        const remaining = completed > 0
          ? formatDuration(((Date.now() - startTime) / completed) * (combinations.length - completed))
          : '?';

        const statusIcon = result.status === 'success'
          ? chalk.green('✓')
          : result.status === 'no_trades'
            ? chalk.yellow('○')
            : chalk.red('✗');

        const pnlStr = result.status === 'success'
          ? (result.totalPnlPercent >= 0 ? chalk.green(`+${result.totalPnlPercent.toFixed(1)}%`) : chalk.red(`${result.totalPnlPercent.toFixed(1)}%`))
          : chalk.gray('N/A');

        console.log(
          `${statusIcon} [${progress}%] ${strategy.padEnd(28)} ${symbol.padEnd(10)} ${interval.padEnd(4)} → ${pnlStr.padEnd(15)} (${result.totalTrades} trades) [${elapsed} / ETA: ${remaining}]`
        );

        return result;
      })
    );
  };

  for (let i = 0; i < combinations.length; i += parallelWorkers) {
    const batch = combinations.slice(i, i + parallelWorkers);
    const batchResults = await processBatch(batch);
    results.push(...batchResults);

    if (i + parallelWorkers < combinations.length) {
      await sleep(100);
    }
  }

  const totalTime = Date.now() - startTime;
  console.log(`\n${chalk.bold('Completed in')} ${formatDuration(totalTime)}`);

  console.log(generateSummary(results));

  if (options.output) {
    const outputDir = dirname(options.output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const csvContent = generateCSV(results);
    const csvPath = options.output.endsWith('.csv') ? options.output : `${options.output}.csv`;
    writeFileSync(csvPath, csvContent);
    console.log(chalk.green(`\n✓ CSV saved to: ${csvPath}`));

    const jsonPath = csvPath.replace('.csv', '.json');
    writeFileSync(jsonPath, JSON.stringify(results, null, 2));
    console.log(chalk.green(`✓ JSON saved to: ${jsonPath}`));
  }
};
