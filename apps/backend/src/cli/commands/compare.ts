import chalk from 'chalk';
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

    displayComparisonLines(comparison);

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

function displayComparisonLines(comparison: any[]) {
  const hasValidation = comparison.some(c => c.type === 'validation');
  const hasOptimization = comparison.some(c => c.type === 'optimization');

  if (hasValidation && !hasOptimization) {
    for (const result of comparison) {
      if (result.type === 'validation') {
        console.log(
          `  ${chalk.white(result.strategy.padEnd(10))} ${chalk.white(result.symbol.padEnd(10))} ${result.interval.padEnd(4)} ` +
          `${chalk.gray(result.period)} ` +
          `${result.trades.toString().padStart(4)} trades ` +
          `WR=${formatNumber(result.winRate, 1)}% ` +
          `PF=${formatNumber(result.profitFactor, 2)} ` +
          `PnL=${formatPnL(result.totalPnl)}% ` +
          `DD=${formatNumber(result.maxDrawdown, 2)}% ` +
          `Sharpe=${formatNumber(result.sharpeRatio, 2)}`
        );
      }
    }

  } else if (hasOptimization && !hasValidation) {
    for (const result of comparison) {
      if (result.type === 'optimization') {
        console.log(
          `  ${chalk.white(result.strategy.padEnd(10))} ${chalk.white(result.symbol.padEnd(10))} ${result.interval.padEnd(4)} ` +
          `${chalk.gray(result.period)} ` +
          `${result.combinations} combs ` +
          `bestWR=${formatNumber(result.bestWinRate, 1)}% ` +
          `bestPF=${formatNumber(result.bestProfitFactor, 2)} ` +
          `bestPnL=${formatPnL(result.bestPnl)}% ` +
          `avgWR=${formatNumber(result.avgWinRate, 1)}% ` +
          `avgPnL=${formatPnL(result.avgPnl)}%`
        );
      }
    }

  } else {
    console.log(chalk.yellow.bold('! Mixed result types detected (validation + optimization)'));
    console.log(chalk.gray('Displaying simplified comparison:'));
    console.log('');

    for (const result of comparison) {
      console.log(
        `  ${chalk.gray(result.type.padEnd(12))} ${chalk.white(result.strategy.padEnd(10))} ` +
        `${chalk.white(result.symbol.padEnd(10))} ${result.interval.padEnd(4)} ${chalk.gray(result.period)}`
      );
    }
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
  if (value > 0) return chalk.green(`+${formatted}`);
  if (value < 0) return chalk.red(formatted);
  return chalk.gray(formatted);
}
