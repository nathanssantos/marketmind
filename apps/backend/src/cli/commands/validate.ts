import type { BacktestConfig } from '@marketmind/types';
import chalk from 'chalk';
import ora from 'ora';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { BacktestLogger, LogLevel } from '../utils/logger';
import {
    validateCapital,
    validateDateRange,
    validateInterval,
    validatePercentage,
    validateRiskReward,
    validateStrategy,
    validateSymbol,
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
  maxConcurrent: string;
  maxExposure: string;
  positionMethod: string;
  riskPerTrade: string;
  kellyFraction: string;
  commission: string;
  useAlgorithmicLevels: boolean;
  withTrend: boolean;
  trailingStop: boolean;
  useMlFilter: boolean;
  useAdxFilter: boolean;
  optimized: boolean;
  verbose: boolean;
  useMarketContext: boolean;
  useCooldown: boolean;
  cooldownMinutes: string;
  dailyLossLimit: string;
  onlyLong: boolean;
  trendPeriod: string;
}

export async function validateCommand(options: ValidateOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);

    const capital = validateCapital(options.capital);
    const stopLoss = options.stopLoss
      ? validatePercentage(options.stopLoss, 'Stop loss', 0.1, 50)
      : undefined;
    const takeProfit = options.takeProfit
      ? validatePercentage(options.takeProfit, 'Take profit', 0.1, 100)
      : undefined;
    const minConfidence = options.minConfidence
      ? validatePercentage(options.minConfidence, 'Min confidence', 0, 100)
      : undefined;
    const maxPosition = options.maxPosition
      ? validatePercentage(options.maxPosition, 'Max position', 1, 100)
      : undefined;
    const riskPerTrade = options.riskPerTrade
      ? validatePercentage(options.riskPerTrade, 'Risk per trade', 0.1, 10)
      : undefined;
    const kellyFraction = parseFloat(options.kellyFraction);
    const commission = options.commission
      ? validatePercentage(options.commission, 'Commission', 0, 10)
      : undefined;

    const validMethods = ['fixed-fractional', 'risk-based', 'kelly', 'volatility-based'];
    if (!validMethods.includes(options.positionMethod)) {
      throw new ValidationError('Position sizing method', options.positionMethod, validMethods.join(', '));
    }

    if (isNaN(kellyFraction) || kellyFraction <= 0 || kellyFraction > 1) {
      throw new ValidationError('Kelly fraction', options.kellyFraction, '0 < fraction <= 1');
    }

    if (!options.useAlgorithmicLevels) {
      validateRiskReward(stopLoss, takeProfit);
    }

    const modeLabel = options.optimized ? ' [OPTIMIZED]' : '';
    logger.header(`BACKTEST VALIDATION - ${options.strategy.toUpperCase()}${modeLabel}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Capital': `$${capital.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      ...(options.optimized ? { 'Mode': 'Using strategy optimizedParams' } : {}),
    });

    const maxConcurrent = options.maxConcurrent ? parseInt(options.maxConcurrent, 10) : undefined;
    const maxExposure = options.maxExposure ? parseFloat(options.maxExposure) / 100 : undefined;

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
      maxConcurrentPositions: maxConcurrent,
      maxTotalExposure: maxExposure,
      positionSizingMethod: options.positionMethod as 'fixed-fractional' | 'risk-based' | 'kelly' | 'volatility-based',
      riskPerTrade: riskPerTrade,
      kellyFraction: kellyFraction,
      commission: commission / 100,
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.withTrend ?? false,
      useTrailingStop: options.trailingStop ?? false,
      useMlFilter: options.useMlFilter ?? false,
      useAdxFilter: options.useAdxFilter ?? true,
      useOptimizedSettings: options.optimized,
      useMarketContextFilter: options.useMarketContext ?? false,
      useCooldown: options.useCooldown ?? false,
      cooldownMinutes: options.cooldownMinutes ? parseInt(options.cooldownMinutes, 10) : undefined,
      dailyLossLimit: options.dailyLossLimit ? parseFloat(options.dailyLossLimit) : undefined,
      onlyLong: options.onlyLong ?? false,
      trendFilterPeriod: options.trendPeriod ? parseInt(options.trendPeriod, 10) : undefined,
    };

    const engine = new BacktestEngine();

    const spinner = ora({
      text: chalk.cyan('Fetching historical data...'),
      color: 'cyan',
    }).start();

    try {
      const result = await engine.run(config);

      spinner.stop();

      if (options.verbose && result.trades.length > 0) {
        logger.trades(result.trades, 5);
      }

      logger.metrics(result.metrics);

      const finalEquity = config.initialCapital + result.metrics.totalPnl;
      const returnPercent = result.metrics.totalPnlPercent;
      const duration = (result.duration / 1000).toFixed(2);

      console.log(chalk.gray(`✓ Backtest completed in ${duration}s`));
      console.log(
        chalk.gray(`✓ Final equity: `) +
          (finalEquity > config.initialCapital ? chalk.green : chalk.red)(`$${finalEquity.toFixed(2)}`) +
          chalk.gray(` (${returnPercent >= 0 ? '+' : ''}${returnPercent.toFixed(2)}%)`)
      );

      console.log('');
      interpretResults(result.metrics, logger);

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

function interpretResults(metrics: any, _logger: BacktestLogger) {
  const warnings: string[] = [];
  const successes: string[] = [];

  if (metrics.winRate >= 60) {
    successes.push(`Excellent win rate (${metrics.winRate.toFixed(1)}%)`);
  } else if (metrics.winRate >= 50) {
    successes.push(`Good win rate (${metrics.winRate.toFixed(1)}%)`);
  } else if (metrics.winRate >= 40) {
    warnings.push(`Low win rate (${metrics.winRate.toFixed(1)}%) - consider tighter entry filters`);
  } else {
    warnings.push(`Very low win rate (${metrics.winRate.toFixed(1)}%) - strategy may need revision`);
  }

  if (metrics.profitFactor >= 2.0) {
    successes.push(`Excellent profit factor (${metrics.profitFactor.toFixed(2)})`);
  } else if (metrics.profitFactor >= 1.5) {
    successes.push(`Good profit factor (${metrics.profitFactor.toFixed(2)})`);
  } else if (metrics.profitFactor >= 1.0) {
    warnings.push(`Marginal profit factor (${metrics.profitFactor.toFixed(2)}) - needs optimization`);
  } else {
    warnings.push(`Negative profit factor (${metrics.profitFactor.toFixed(2)}) - strategy loses money`);
  }

  if (metrics.sharpeRatio >= 2.0) {
    successes.push(`Excellent Sharpe ratio (${metrics.sharpeRatio.toFixed(2)})`);
  } else if (metrics.sharpeRatio >= 1.0) {
    successes.push(`Acceptable Sharpe ratio (${metrics.sharpeRatio.toFixed(2)})`);
  } else {
    warnings.push(`Low Sharpe ratio (${metrics.sharpeRatio.toFixed(2)}) - high volatility vs returns`);
  }

  if (metrics.maxDrawdownPercent < 10) {
    successes.push(`Low max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
  } else if (metrics.maxDrawdownPercent < 20) {
    successes.push(`Acceptable max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%)`);
  } else if (metrics.maxDrawdownPercent < 30) {
    warnings.push(`High max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%) - risky for live trading`);
  } else {
    warnings.push(`Very high max drawdown (${metrics.maxDrawdownPercent.toFixed(2)}%) - not recommended for live`);
  }

  if (metrics.totalTrades < 30) {
    warnings.push(`Low sample size (${metrics.totalTrades} trades) - results may not be statistically significant`);
  } else if (metrics.totalTrades >= 50) {
    successes.push(`Good sample size (${metrics.totalTrades} trades)`);
  }

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
