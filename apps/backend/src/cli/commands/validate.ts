import chalk from 'chalk';
import ora from 'ora';
import type { BacktestConfig } from '@marketmind/types';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { ResultManager } from '../../services/backtesting/ResultManager';
import {
  validateSymbol,
  validateInterval,
  validateDateRange,
  validateStrategy,
  validateCapital,
  validatePercentage,
  validateRiskReward,
  ValidationError,
} from '../utils/validators';

interface ValidateOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  stopLoss: string;
  takeProfit: string;
  minConfidence: string;
  maxPosition: string;
  commission: string;
  useAlgorithmicLevels: boolean;
  onlyWithTrend: boolean;
  verbose: boolean;
}

export async function validateCommand(options: ValidateOptions) {
  // Initialize logger
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    // Validate all inputs
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);

    const capital = validateCapital(options.capital);
    const stopLoss = validatePercentage(options.stopLoss, 'Stop loss', 0.1, 50);
    const takeProfit = validatePercentage(options.takeProfit, 'Take profit', 0.1, 100);
    const minConfidence = validatePercentage(options.minConfidence, 'Min confidence', 0, 100);
    const maxPosition = validatePercentage(options.maxPosition, 'Max position', 1, 100);
    const commission = validatePercentage(options.commission, 'Commission', 0, 10);

    // Validate risk/reward ratio
    if (!options.useAlgorithmicLevels) {
      validateRiskReward(stopLoss, takeProfit);
    }

    // Display header
    logger.header(`BACKTEST VALIDATION - ${options.strategy.toUpperCase()}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Capital': `$${capital.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
    });

    // Parse configuration
    const config: BacktestConfig = {
      symbol: options.symbol,
      interval: options.interval,
      startDate: options.start,
      endDate: options.end,
      initialCapital: capital,
      setupTypes: [options.strategy],
      minConfidence: minConfidence,
      stopLossPercent: stopLoss,
      takeProfitPercent: takeProfit,
      maxPositionSize: maxPosition,
      commission: commission / 100, // Convert from % to decimal
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.onlyWithTrend,
    };

    // Create backtest engine
    const engine = new BacktestEngine();

    // Run backtest with spinner
    const spinner = ora({
      text: chalk.cyan('Fetching historical data...'),
      color: 'cyan',
    }).start();

    try {
      // Run the backtest
      const result = await engine.run(config);

      spinner.stop();

      // Display results
      if (options.verbose && result.trades.length > 0) {
        logger.trades(result.trades, 5);
      }

      logger.metrics(result.metrics);

      // Display summary
      const finalEquity = config.initialCapital + result.metrics.totalPnl;
      const returnPercent = result.metrics.totalPnlPercent;
      const duration = (result.duration / 1000).toFixed(2);

      console.log(chalk.gray(`✓ Backtest completed in ${duration}s`));
      console.log(
        chalk.gray(`✓ Final equity: `) +
          (finalEquity > config.initialCapital ? chalk.green : chalk.red)(`$${finalEquity.toFixed(2)}`) +
          chalk.gray(` (${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%)`)
      );

      // Interpretation
      console.log('');
      interpretResults(result.metrics, logger);

      // Save result
      console.log('');
      const saveSpinner = ora({
        text: chalk.cyan('Saving result...'),
        color: 'cyan',
      }).start();

      const resultManager = new ResultManager();
      const savedPath = await resultManager.saveValidation(
        options.strategy,
        options.symbol,
        options.interval,
        config,
        result
      );

      saveSpinner.succeed(chalk.green(`Result saved to: ${savedPath}`));
      console.log('');

    } catch (error) {
      spinner.stop();
      throw error;
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Backtest failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

/**
 * Interpret and provide feedback on backtest results
 */
function interpretResults(metrics: any, _logger: BacktestLogger) {
  const warnings: string[] = [];
  const successes: string[] = [];

  // Analyze win rate
  if (metrics.winRate >= 60) {
    successes.push(`Excellent win rate (${metrics.winRate.toFixed(1)}%)`);
  } else if (metrics.winRate >= 50) {
    successes.push(`Good win rate (${metrics.winRate.toFixed(1)}%)`);
  } else if (metrics.winRate >= 40) {
    warnings.push(`Low win rate (${metrics.winRate.toFixed(1)}%) - consider tighter entry filters`);
  } else {
    warnings.push(`Very low win rate (${metrics.winRate.toFixed(1)}%) - strategy may need revision`);
  }

  // Analyze profit factor
  if (metrics.profitFactor >= 2.0) {
    successes.push(`Excellent profit factor (${metrics.profitFactor.toFixed(2)})`);
  } else if (metrics.profitFactor >= 1.5) {
    successes.push(`Good profit factor (${metrics.profitFactor.toFixed(2)})`);
  } else if (metrics.profitFactor >= 1.0) {
    warnings.push(`Marginal profit factor (${metrics.profitFactor.toFixed(2)}) - needs optimization`);
  } else {
    warnings.push(`Negative profit factor (${metrics.profitFactor.toFixed(2)}) - strategy loses money`);
  }

  // Analyze Sharpe ratio
  if (metrics.sharpeRatio >= 2.0) {
    successes.push(`Excellent Sharpe ratio (${metrics.sharpeRatio.toFixed(2)})`);
  } else if (metrics.sharpeRatio >= 1.0) {
    successes.push(`Acceptable Sharpe ratio (${metrics.sharpeRatio.toFixed(2)})`);
  } else {
    warnings.push(`Low Sharpe ratio (${metrics.sharpeRatio.toFixed(2)}) - high volatility vs returns`);
  }

  // Analyze drawdown
  if (metrics.maxDrawdownPercent < 10) {
    successes.push(`Low max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
  } else if (metrics.maxDrawdownPercent < 20) {
    successes.push(`Acceptable max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
  } else if (metrics.maxDrawdownPercent < 30) {
    warnings.push(`High max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%) - risky for live trading`);
  } else {
    warnings.push(`Very high max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%) - not recommended for live`);
  }

  // Analyze trade count
  if (metrics.totalTrades < 30) {
    warnings.push(`Low sample size (${metrics.totalTrades} trades) - results may not be statistically significant`);
  } else if (metrics.totalTrades >= 50) {
    successes.push(`Good sample size (${metrics.totalTrades} trades)`);
  }

  // Display interpretation
  console.log(chalk.cyan.bold('INTERPRETATION:'));
  console.log('');

  if (successes.length > 0) {
    console.log(chalk.green.bold('✓ Positives:'));
    for (const success of successes) {
      console.log(chalk.green(`  • ${success}`));
    }
    console.log('');
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold('⚠ Areas for Improvement:'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`  • ${warning}`));
    }
    console.log('');
  }

  // Overall recommendation
  const isGood =
    metrics.winRate >= 50 &&
    metrics.profitFactor >= 1.5 &&
    metrics.maxDrawdownPercent < 25 &&
    metrics.totalPnlPercent > 0;

  if (isGood) {
    console.log(chalk.green.bold('✓ RECOMMENDATION: ') + chalk.white('Strategy shows promise! Consider parameter optimization.'));
  } else {
    console.log(chalk.yellow.bold('⚠ RECOMMENDATION: ') + chalk.white('Strategy needs optimization before live trading.'));
  }
  console.log('');
}
