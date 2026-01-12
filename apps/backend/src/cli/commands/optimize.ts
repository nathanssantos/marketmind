import chalk from 'chalk';
import ora from 'ora';
import type { BacktestConfig, Interval } from '@marketmind/types';
// @ts-expect-error - cli-progress doesn't have types
import cliProgress from 'cli-progress';
import { BacktestOptimizer } from '../../services/backtesting/BacktestOptimizer';
import { ParameterGenerator } from '../../services/backtesting/ParameterGenerator';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import { BacktestLogger, LogLevel } from '../utils/logger';
import {
    validateCapital,
    validateDateRange,
    validateGridSearchSize,
    validateInterval,
    validateParallelWorkers,
    validateParameterGrid,
    validatePercentage,
    validateRiskReward,
    validateStrategy,
    validateSymbol,
    ValidationError,
} from '../utils/validators';

interface OptimizeOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  stopLoss: string;
  takeProfit: string;
  param: string[];
  minConfidence?: string;
  maxPosition: string;
  maxConcurrent?: string;
  maxExposure?: string;
  trailingStop: boolean;
  positionMethod: string;
  riskPerTrade: string;
  kellyFraction: string;
  commission: string;
  useAlgorithmicLevels: boolean;
  withTrend: boolean;
  preset?: string;
  sortBy: string;
  top: string;
  parallel: string;
  minWinRate?: string;
  minProfitFactor?: string;
  verbose: boolean;
}

const OPTIMIZATION_PRESETS: Record<string, Record<string, number[]>> = {
  conservative: {
    trailingATRMultiplier: [2, 2.5, 3],
    breakEvenAfterR: [1, 1.5],
    maxPositionSize: [10, 20, 30],
    maxConcurrentPositions: [3, 5],
    maxTotalExposure: [30, 50],
  },
  balanced: {
    trailingATRMultiplier: [2.5, 3, 3.5, 4],
    breakEvenAfterR: [1.5, 2],
    maxPositionSize: [30, 50, 70],
    maxConcurrentPositions: [1, 2, 3],
    maxTotalExposure: [50, 70],
  },
  aggressive: {
    trailingATRMultiplier: [3, 4, 5],
    breakEvenAfterR: [2, 2.5, 3],
    maxPositionSize: [60, 80, 100],
    maxConcurrentPositions: [1, 2],
    maxTotalExposure: [70, 90],
  },
  trendfollowing: {
    trailingATRMultiplier: [4, 5, 6],
    breakEvenAfterR: [2, 3],
    maxPositionSize: [70, 80, 90],
    maxConcurrentPositions: [1],
    maxTotalExposure: [80, 90],
  },
};

export async function optimizeCommand(options: OptimizeOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);

    if (!options.preset && (!options.param || options.param.length === 0)) {
      throw new ValidationError('Parameters: Either --preset or --param is required');
    }

    if (options.param && options.param.length > 0) {
      validateParameterGrid(options.param);
      validateGridSearchSize(options.param);
    }

    const capital = validateCapital(options.capital);
    const stopLoss = options.stopLoss
      ? validatePercentage(options.stopLoss, 'Stop loss', 0.1, 50)
      : undefined;
    const takeProfit = options.takeProfit
      ? validatePercentage(options.takeProfit, 'Take profit', 0.1, 100)
      : undefined;
    const parallelWorkers = validateParallelWorkers(options.parallel);
    const topN = validatePercentage(options.top, 'Top N', 1, 100);
    const commission = options.commission
      ? validatePercentage(options.commission, 'Commission', 0, 10)
      : undefined;

    if (!options.useAlgorithmicLevels) {
      validateRiskReward(stopLoss, takeProfit);
    }

    let minConfidence: number | undefined;
    if (options.minConfidence) {
      minConfidence = validatePercentage(options.minConfidence, 'Min confidence', 0, 100);
    }

    let parameterGrid: Record<string, number[]> = {};

    if (options.preset) {
      const presetName = options.preset.toLowerCase();
      if (!OPTIMIZATION_PRESETS[presetName]) {
        throw new ValidationError(`Preset: "${options.preset}" is not valid. Use: ${Object.keys(OPTIMIZATION_PRESETS).join(', ')}`);
      }
      parameterGrid = { ...OPTIMIZATION_PRESETS[presetName] };
      logger.info(`Using optimization preset: ${presetName}`);
    }

    for (const paramStr of options.param) {
      const [name, valuesStr] = paramStr.split('=');
      if (!name || !valuesStr) continue;
      parameterGrid[name] = ParameterGenerator.parseArray(valuesStr);
    }

    ParameterGenerator.validate(parameterGrid);

    const totalCombinations = ParameterGenerator.countCombinations(parameterGrid);

    const paramSummary = Object.entries(parameterGrid)
      .map(([key, values]) => `${key}=[${values.join(',')}]`)
      .join(' ');

    logger.header(`BACKTEST OPTIMIZATION - ${options.strategy.toUpperCase()}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Parameters': paramSummary,
      'Combinations': totalCombinations.toString(),
      'Parallel Workers': parallelWorkers.toString(),
    });

    const baseConfig: BacktestConfig = {
      symbol: options.symbol,
      interval: options.interval,
      startDate: options.start,
      endDate: options.end,
      initialCapital: capital,
      setupTypes: [options.strategy],
      stopLossPercent: stopLoss,
      takeProfitPercent: takeProfit,
      commission: commission !== undefined ? commission / 100 : undefined,
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.withTrend ?? false,
      useTrailingStop: options.trailingStop ?? false,
    };

    if (minConfidence !== undefined) {
      baseConfig.minConfidence = minConfidence;
    }

    const spinner = ora({
      text: chalk.cyan('Fetching historical data...'),
      color: 'cyan',
    }).start();

    const klines = await fetchHistoricalKlinesFromAPI(
      options.symbol,
      options.interval as Interval,
      new Date(options.start),
      new Date(options.end)
    );

    spinner.succeed(chalk.green(`Fetched ${klines.length} candles`));
    console.log('');

    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('Running backtests |') + chalk.yellow('{bar}') + chalk.cyan('| {percentage}% | {value}/{total} | ETA: {eta}s'),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(totalCombinations, 0);

    const optimizer = new BacktestOptimizer();
    const startTime = Date.now();

    const results = await optimizer.optimize(
      {
        baseConfig,
        parameterGrid,
        parallelWorkers,
        sortBy: options.sortBy as any,
        onProgress: (current, _total) => {
          progressBar.update(current);
        },
      },
      klines
    );

    progressBar.stop();

    const duration = (Date.now() - startTime) / 1000;
    const avgTime = duration / totalCombinations;

    console.log('');
    logger.success(`Completed ${results.length} backtests in ${duration.toFixed(1)}s (avg ${avgTime.toFixed(1)}s/backtest)`);
    console.log('');

    let filteredResults = results;

    if (options.minWinRate || options.minProfitFactor) {
      const beforeCount = filteredResults.length;

      filteredResults = optimizer.filterResults(filteredResults, {
        minWinRate: options.minWinRate ? parseFloat(options.minWinRate) : undefined,
        minProfitFactor: options.minProfitFactor ? parseFloat(options.minProfitFactor) : undefined,
      });

      if (filteredResults.length < beforeCount) {
        logger.info(`Filtered to ${filteredResults.length}/${beforeCount} results meeting criteria`);
        console.log('');
      }
    }

    if (filteredResults.length === 0) {
      logger.warn('No results meet the specified criteria');
      return;
    }

    const topResults = filteredResults.slice(0, topN);

    logger.optimizationResults(
      topResults.map((r) => ({ params: r.params, metrics: r.metrics })),
      topN
    );

    const stats = optimizer.getStatistics(filteredResults);
    if (stats) {
      console.log(chalk.cyan.bold('STATISTICS:'));
      console.log(chalk.gray(`  Total runs: ${stats.totalRuns}`));
      console.log(chalk.gray(`  Avg win rate: ${stats.average.winRate.toFixed(1)}%`));
      console.log(chalk.gray(`  Avg PnL: ${stats.average.totalPnlPercent.toFixed(2)}%`));
      console.log(chalk.gray(`  Avg profit factor: ${stats.average.profitFactor.toFixed(2)}`));
      console.log(chalk.gray(`  Avg Sharpe ratio: ${stats.average.sharpeRatio.toFixed(2)}`));
      console.log('');
    }

    const best = filteredResults[0];
    if (best) {
      interpretResults(best, logger);
    }

    console.log('');
    const saveSpinner = ora({
      text: chalk.cyan('Saving optimization results...'),
      color: 'cyan',
    }).start();

    const resultManager = new ResultManager();
    const savedPath = await resultManager.saveOptimization(
      options.strategy,
      options.symbol,
      options.interval,
      baseConfig,
      topResults.map((r) => ({ params: r.params, metrics: r.metrics })),
      stats
    );

    saveSpinner.succeed(chalk.green(`Results saved to: ${savedPath}`));
    console.log('');

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Optimization failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

function interpretResults(best: any, _logger: BacktestLogger) {
  const m = best.metrics;

  console.log(chalk.cyan.bold('BEST CONFIGURATION:'));
  console.log('');

  console.log(chalk.white.bold('Parameters:'));
  for (const [key, value] of Object.entries(best.params)) {
    console.log(chalk.gray(`  ${key}: ${value}`));
  }
  console.log('');

  console.log(chalk.white.bold('Metrics:'));
  console.log(chalk.gray(`  Win Rate: ${m.winRate.toFixed(1)}%`));
  console.log(chalk.gray(`  Profit Factor: ${m.profitFactor.toFixed(2)}`));
  console.log(chalk.gray(`  Total PnL: ${m.totalPnlPercent.toFixed(2)}%`));
  console.log(chalk.gray(`  Sharpe Ratio: ${(m.sharpeRatio || 0).toFixed(2)}`));
  console.log(chalk.gray(`  Max Drawdown: ${m.maxDrawdownPercent.toFixed(2)}%`));
  console.log(chalk.gray(`  Total Trades: ${m.totalTrades}`));
  console.log('');

  const isExcellent =
    m.winRate >= 60 &&
    m.profitFactor >= 2.0 &&
    m.sharpeRatio >= 1.5 &&
    m.maxDrawdownPercent < 15 &&
    m.totalPnlPercent > 20;

  const isGood =
    m.winRate >= 50 &&
    m.profitFactor >= 1.5 &&
    m.sharpeRatio >= 1.0 &&
    m.maxDrawdownPercent < 25 &&
    m.totalPnlPercent > 10;

  if (isExcellent) {
    console.log(chalk.green.bold('✓ RECOMMENDATION: ') + chalk.white('Excellent results! Ready for live trading with proper risk management.'));
  } else if (isGood) {
    console.log(chalk.green.bold('✓ RECOMMENDATION: ') + chalk.white('Good results! Consider further validation on recent data.'));
  } else {
    console.log(chalk.yellow.bold('⚠ RECOMMENDATION: ') + chalk.white('Marginal results. Continue optimization or try different strategy.'));
  }
  console.log('');
}
