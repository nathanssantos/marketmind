import chalk from 'chalk';
import Table from 'cli-table3';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { validateFilePath, ValidationError } from '../utils/validators';

interface CompareOptions {
  files: string[];
  verbose: boolean;
}

export async function compareCommand(files: string[], options: CompareOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    if (!files || files.length === 0) {
      throw new ValidationError('No result files specified. Usage: compare <file1> <file2> ...');
    }

    if (files.length < 2) {
      throw new ValidationError('At least 2 result files are required for comparison');
    }

    for (const file of files) {
      await validateFilePath(file);
    }

    logger.header(`BACKTEST COMPARISON`, {
      'Files': files.length.toString(),
    });

    const resultManager = new ResultManager();
    const results = [];

    for (const file of files) {
      try {
        const result = await resultManager.load(file);
        results.push(result);
      } catch (error) {
        logger.warn(`Failed to load ${file}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (results.length === 0) {
      logger.error('No valid results to compare');
      return;
    }

    const comparison = resultManager.compareResults(results);

    displayComparisonTable(comparison);

    console.log('');
    displayBestPerformers(comparison);

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Comparison failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

function displayComparisonTable(comparison: any[]) {
  const hasValidation = comparison.some(c => c.type === 'validation');
  const hasOptimization = comparison.some(c => c.type === 'optimization');

  if (hasValidation && !hasOptimization) {
    const table = new Table({
      head: [
        chalk.cyan('Strategy'),
        chalk.cyan('Symbol'),
        chalk.cyan('Interval'),
        chalk.cyan('Period'),
        chalk.cyan('Trades'),
        chalk.cyan('Win %'),
        chalk.cyan('PF'),
        chalk.cyan('PnL %'),
        chalk.cyan('DD %'),
        chalk.cyan('Sharpe'),
      ],
      colWidths: [12, 10, 10, 25, 8, 8, 7, 9, 8, 8],
    });

    for (const result of comparison) {
      if (result.type === 'validation') {
        table.push([
          result.strategy,
          result.symbol,
          result.interval,
          result.period,
          result.trades.toString(),
          formatNumber(result.winRate, 1),
          formatNumber(result.profitFactor, 2),
          formatPnL(result.totalPnl),
          formatNumber(result.maxDrawdown, 2),
          formatNumber(result.sharpeRatio, 2),
        ]);
      }
    }

    console.log(table.toString());

  } else if (hasOptimization && !hasValidation) {
    const table = new Table({
      head: [
        chalk.cyan('Strategy'),
        chalk.cyan('Symbol'),
        chalk.cyan('Int.'),
        chalk.cyan('Period'),
        chalk.cyan('Combs'),
        chalk.cyan('Best WR'),
        chalk.cyan('Best PF'),
        chalk.cyan('Best PnL'),
        chalk.cyan('Avg WR'),
        chalk.cyan('Avg PnL'),
      ],
      colWidths: [12, 10, 6, 25, 7, 9, 8, 10, 8, 9],
    });

    for (const result of comparison) {
      if (result.type === 'optimization') {
        table.push([
          result.strategy,
          result.symbol,
          result.interval,
          result.period,
          result.combinations.toString(),
          formatNumber(result.bestWinRate, 1),
          formatNumber(result.bestProfitFactor, 2),
          formatPnL(result.bestPnl),
          formatNumber(result.avgWinRate, 1),
          formatPnL(result.avgPnl),
        ]);
      }
    }

    console.log(table.toString());

  } else {
    console.log(chalk.yellow.bold('⚠ Mixed result types detected (validation + optimization)'));
    console.log(chalk.gray('Displaying simplified comparison:'));
    console.log('');

    const table = new Table({
      head: [
        chalk.cyan('Type'),
        chalk.cyan('Strategy'),
        chalk.cyan('Symbol'),
        chalk.cyan('Interval'),
        chalk.cyan('Period'),
      ],
      colWidths: [15, 12, 10, 10, 25],
    });

    for (const result of comparison) {
      table.push([
        result.type,
        result.strategy,
        result.symbol,
        result.interval,
        result.period,
      ]);
    }

    console.log(table.toString());
  }
}

function displayBestPerformers(comparison: any[]) {
  const validationResults = comparison.filter(c => c.type === 'validation');
  const optimizationResults = comparison.filter(c => c.type === 'optimization');

  if (validationResults.length > 0) {
    console.log(chalk.cyan.bold('BEST VALIDATION RESULTS:'));
    console.log('');

    const bestPnL = [...validationResults].sort((a, b) => b.totalPnl - a.totalPnl)[0];
    console.log(chalk.green('✓ Highest PnL:'));
    console.log(chalk.gray(`  ${bestPnL.strategy} (${bestPnL.symbol} ${bestPnL.interval}): ${formatPnL(bestPnL.totalPnl)}%`));
    console.log('');

    const bestWinRate = [...validationResults].sort((a, b) => b.winRate - a.winRate)[0];
    console.log(chalk.green('✓ Highest Win Rate:'));
    console.log(chalk.gray(`  ${bestWinRate.strategy} (${bestWinRate.symbol} ${bestWinRate.interval}): ${formatNumber(bestWinRate.winRate, 1)}%`));
    console.log('');

    const bestPF = [...validationResults].sort((a, b) => b.profitFactor - a.profitFactor)[0];
    console.log(chalk.green('✓ Highest Profit Factor:'));
    console.log(chalk.gray(`  ${bestPF.strategy} (${bestPF.symbol} ${bestPF.interval}): ${formatNumber(bestPF.profitFactor, 2)}`));
    console.log('');

    const bestSharpe = [...validationResults].sort((a, b) => b.sharpeRatio - a.sharpeRatio)[0];
    console.log(chalk.green('✓ Highest Sharpe Ratio:'));
    console.log(chalk.gray(`  ${bestSharpe.strategy} (${bestSharpe.symbol} ${bestSharpe.interval}): ${formatNumber(bestSharpe.sharpeRatio, 2)}`));
    console.log('');
  }

  if (optimizationResults.length > 0) {
    console.log(chalk.cyan.bold('BEST OPTIMIZATION RESULTS:'));
    console.log('');

    const bestOptPnL = [...optimizationResults].sort((a, b) => b.bestPnl - a.bestPnl)[0];
    console.log(chalk.green('✓ Highest Optimized PnL:'));
    console.log(chalk.gray(`  ${bestOptPnL.strategy} (${bestOptPnL.symbol} ${bestOptPnL.interval}): ${formatPnL(bestOptPnL.bestPnl)}%`));
    console.log('');

    const bestAvgPnL = [...optimizationResults].sort((a, b) => b.avgPnl - a.avgPnl)[0];
    console.log(chalk.green('✓ Highest Average PnL:'));
    console.log(chalk.gray(`  ${bestAvgPnL.strategy} (${bestAvgPnL.symbol} ${bestAvgPnL.interval}): ${formatPnL(bestAvgPnL.avgPnl)}%`));
    console.log('');
  }
}

function formatNumber(value: number, decimals: number): string {
  return value.toFixed(decimals);
}

function formatPnL(value: number): string {
  const formatted = value.toFixed(2);
  if (value > 0) {
    return chalk.green(`+${formatted}`);
  } else if (value < 0) {
    return chalk.red(formatted);
  } else {
    return chalk.gray(formatted);
  }
}
