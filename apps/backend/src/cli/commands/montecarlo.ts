import chalk from 'chalk';
import ora from 'ora';
import type { BacktestConfig, Interval } from '@marketmind/types';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { MonteCarloSimulator, type MonteCarloConfig } from '../../services/backtesting/MonteCarloSimulator';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { ResultManager } from '../../services/backtesting/ResultManager';
import {
  validateSymbol,
  validateInterval,
  validateDateRange,
  validateStrategy,
  validateCapital,
  validatePercentage,
  ValidationError,
} from '../utils/validators';

interface MonteCarloOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  minConfidence?: string;
  maxPosition: string;
  commission: string;
  useAlgorithmicLevels: boolean;
  onlyWithTrend: boolean;
  simulations: string;
  confidenceLevel: string;
  verbose: boolean;
}

export async function montecarloCommand(options: MonteCarloOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    // Validate inputs
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);

    const capital = validateCapital(options.capital);
    const maxPosition = validatePercentage(options.maxPosition, 'Max position', 1, 100);
    const commission = validatePercentage(options.commission, 'Commission', 0, 10);
    const numSimulations = parseInt(options.simulations);
    const confidenceLevel = parseFloat(options.confidenceLevel);

    // Validate Monte Carlo specific options
    if (numSimulations < 100 || numSimulations > 100000) {
      throw new ValidationError('Number of simulations must be between 100 and 100,000');
    }

    if (confidenceLevel < 0.8 || confidenceLevel > 0.99) {
      throw new ValidationError('Confidence level must be between 0.8 and 0.99');
    }

    // Validate optional parameters
    let minConfidence: number | undefined;
    if (options.minConfidence) {
      minConfidence = validatePercentage(options.minConfidence, 'Min confidence', 0, 100);
    }

    logger.header(`MONTE CARLO SIMULATION - ${options.strategy.toUpperCase()}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Simulations': numSimulations.toLocaleString(),
      'Confidence Level': `${(confidenceLevel * 100).toFixed(0)}%`,
    });

    // Create backtest config
    const config: BacktestConfig = {
      symbol: options.symbol,
      interval: options.interval,
      startDate: options.start,
      endDate: options.end,
      initialCapital: capital,
      setupTypes: [options.strategy],
      maxPositionSize: maxPosition,
      commission: commission / 100,
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.onlyWithTrend,
    };

    if (minConfidence !== undefined) {
      config.minConfidence = minConfidence;
    }

    // Fetch historical data
    const dataSpinner = ora({
      text: chalk.cyan('Fetching historical data...'),
      color: 'cyan',
    }).start();

    const klines = await fetchHistoricalKlinesFromAPI(
      options.symbol,
      options.interval as Interval,
      new Date(options.start),
      new Date(options.end)
    );

    dataSpinner.succeed(chalk.green(`Fetched ${klines.length} candles`));
    console.log('');

    // Run initial backtest
    const backtestSpinner = ora({
      text: chalk.cyan('Running initial backtest...'),
      color: 'cyan',
    }).start();

    const engine = new BacktestEngine();
    const backtestResult = await engine.run(config, klines);

    if (backtestResult.status === 'FAILED') {
      backtestSpinner.fail(chalk.red('Backtest failed'));
      throw new Error('Initial backtest failed');
    }

    backtestSpinner.succeed(chalk.green(`Backtest completed: ${backtestResult.trades.length} trades`));
    console.log('');

    if (backtestResult.trades.length < 10) {
      throw new ValidationError('Insufficient trades for Monte Carlo simulation (minimum 10 required)');
    }

    // Run Monte Carlo simulation
    const mcSpinner = ora({
      text: chalk.cyan(`Running ${numSimulations.toLocaleString()} Monte Carlo simulations...`),
      color: 'cyan',
    }).start();

    const startTime = Date.now();

    const mcConfig: MonteCarloConfig = {
      numSimulations,
      confidenceLevel,
    };

    const mcResult = MonteCarloSimulator.simulate(
      backtestResult.trades,
      capital,
      mcConfig
    );

    const duration = (Date.now() - startTime) / 1000;

    mcSpinner.succeed(chalk.green(`Completed ${numSimulations.toLocaleString()} simulations in ${duration.toFixed(1)}s`));
    console.log('');

    // Display results
    displayResults(backtestResult, mcResult, confidenceLevel, logger, options.verbose);

    // Save results
    console.log('');
    const saveSpinner = ora({
      text: chalk.cyan('Saving Monte Carlo results...'),
      color: 'cyan',
    }).start();

    const resultManager = new ResultManager();
    const result = {
      type: 'montecarlo' as const,
      strategy: options.strategy,
      symbol: options.symbol,
      interval: options.interval,
      config,
      initialBacktest: {
        totalTrades: backtestResult.trades.length,
        winRate: backtestResult.metrics.winRate,
        profitFactor: backtestResult.metrics.profitFactor,
        sharpeRatio: backtestResult.metrics.sharpeRatio,
        maxDrawdown: backtestResult.metrics.maxDrawdownPercent,
        totalReturn: backtestResult.metrics.totalPnlPercent,
      },
      monteCarloConfig: mcConfig,
      statistics: mcResult.statistics,
      confidenceIntervals: mcResult.confidenceIntervals,
      probabilities: mcResult.probabilities,
      worstCase: {
        finalEquity: mcResult.worstCase.finalEquity,
        maxDrawdown: mcResult.worstCase.maxDrawdown * 100,
        sharpeRatio: mcResult.worstCase.sharpeRatio,
        totalReturn: mcResult.worstCase.totalReturn * 100,
      },
      bestCase: {
        finalEquity: mcResult.bestCase.finalEquity,
        maxDrawdown: mcResult.bestCase.maxDrawdown * 100,
        sharpeRatio: mcResult.bestCase.sharpeRatio,
        totalReturn: mcResult.bestCase.totalReturn * 100,
      },
      medianCase: {
        finalEquity: mcResult.medianCase.finalEquity,
        maxDrawdown: mcResult.medianCase.maxDrawdown * 100,
        sharpeRatio: mcResult.medianCase.sharpeRatio,
        totalReturn: mcResult.medianCase.totalReturn * 100,
      },
      timestamp: new Date().toISOString(),
    };

    const savedPath = await resultManager.saveMonteCarlo(
      options.strategy,
      options.symbol,
      options.interval,
      result
    );

    saveSpinner.succeed(chalk.green(`Results saved to: ${savedPath}`));
    console.log('');

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Monte Carlo simulation failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

/**
 * Display Monte Carlo simulation results
 */
function displayResults(
  backtestResult: any,
  mcResult: any,
  confidenceLevel: number,
  _logger: BacktestLogger,
  _verbose: boolean
) {
  // Display original backtest results
  console.log(chalk.cyan.bold('ORIGINAL BACKTEST:'));
  console.log('');
  console.log(chalk.white(`  Total Trades: ${backtestResult.trades.length}`));
  console.log(chalk.white(`  Win Rate: ${backtestResult.metrics.winRate.toFixed(1)}%`));
  console.log(chalk.white(`  Profit Factor: ${backtestResult.metrics.profitFactor.toFixed(2)}`));
  console.log(chalk.white(`  Sharpe Ratio: ${(backtestResult.metrics.sharpeRatio || 0).toFixed(2)}`));
  console.log(chalk.white(`  Max Drawdown: ${backtestResult.metrics.maxDrawdownPercent.toFixed(2)}%`));
  console.log(chalk.white(`  Total Return: ${backtestResult.metrics.totalPnlPercent.toFixed(2)}%`));
  console.log('');

  // Display Monte Carlo statistics
  console.log(chalk.cyan.bold('MONTE CARLO STATISTICS:'));
  console.log('');

  console.log(chalk.white.bold('  Final Equity:'));
  console.log(chalk.gray(`    Mean: $${mcResult.statistics.meanFinalEquity.toFixed(2)}`));
  console.log(chalk.gray(`    Median: $${mcResult.statistics.medianFinalEquity.toFixed(2)}`));
  console.log(chalk.gray(`    Std Dev: $${mcResult.statistics.stdDevFinalEquity.toFixed(2)}`));
  console.log('');

  console.log(chalk.white.bold('  Total Return:'));
  console.log(chalk.gray(`    Mean: ${(mcResult.statistics.meanTotalReturn * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Median: ${(mcResult.statistics.medianTotalReturn * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.white.bold('  Max Drawdown:'));
  console.log(chalk.gray(`    Mean: ${(mcResult.statistics.meanMaxDrawdown * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Median: ${(mcResult.statistics.medianMaxDrawdown * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.white.bold('  Sharpe Ratio:'));
  console.log(chalk.gray(`    Mean: ${mcResult.statistics.meanSharpeRatio.toFixed(2)}`));
  console.log(chalk.gray(`    Median: ${mcResult.statistics.medianSharpeRatio.toFixed(2)}`));
  console.log('');

  // Display confidence intervals
  const ciPercent = (confidenceLevel * 100).toFixed(0);
  console.log(chalk.cyan.bold(`${ciPercent}% CONFIDENCE INTERVALS:`));
  console.log('');

  console.log(chalk.white.bold('  Final Equity:'));
  console.log(chalk.gray(`    Lower: $${mcResult.confidenceIntervals.finalEquity.lower.toFixed(2)}`));
  console.log(chalk.gray(`    Upper: $${mcResult.confidenceIntervals.finalEquity.upper.toFixed(2)}`));
  console.log('');

  console.log(chalk.white.bold('  Total Return:'));
  console.log(chalk.gray(`    Lower: ${(mcResult.confidenceIntervals.totalReturn.lower * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Upper: ${(mcResult.confidenceIntervals.totalReturn.upper * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.white.bold('  Max Drawdown:'));
  console.log(chalk.gray(`    Lower: ${(mcResult.confidenceIntervals.maxDrawdown.lower * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Upper: ${(mcResult.confidenceIntervals.maxDrawdown.upper * 100).toFixed(2)}%`));
  console.log('');

  // Display probabilities
  console.log(chalk.cyan.bold('PROBABILITIES:'));
  console.log('');

  const profitProb = mcResult.probabilities.profitableProbability * 100;
  const profitColor = profitProb >= 70 ? chalk.green : profitProb >= 50 ? chalk.yellow : chalk.red;
  console.log(profitColor(`  Profitable: ${profitProb.toFixed(1)}%`));

  console.log('');
  console.log(chalk.white('  Return exceeds:'));
  console.log(chalk.gray(`    10%: ${(mcResult.probabilities.returnExceeds10Percent * 100).toFixed(1)}%`));
  console.log(chalk.gray(`    20%: ${(mcResult.probabilities.returnExceeds20Percent * 100).toFixed(1)}%`));
  console.log(chalk.gray(`    50%: ${(mcResult.probabilities.returnExceeds50Percent * 100).toFixed(1)}%`));

  console.log('');
  console.log(chalk.white('  Drawdown exceeds:'));
  console.log(chalk.gray(`    10%: ${(mcResult.probabilities.drawdownExceeds10Percent * 100).toFixed(1)}%`));
  console.log(chalk.gray(`    20%: ${(mcResult.probabilities.drawdownExceeds20Percent * 100).toFixed(1)}%`));
  console.log(chalk.gray(`    30%: ${(mcResult.probabilities.drawdownExceeds30Percent * 100).toFixed(1)}%`));
  console.log('');

  // Display best/worst/median cases
  console.log(chalk.cyan.bold('SCENARIOS:'));
  console.log('');

  console.log(chalk.red.bold('  Worst Case (5th percentile):'));
  console.log(chalk.gray(`    Final Equity: $${mcResult.worstCase.finalEquity.toFixed(2)}`));
  console.log(chalk.gray(`    Total Return: ${(mcResult.worstCase.totalReturn * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Max Drawdown: ${(mcResult.worstCase.maxDrawdown * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.white.bold('  Median Case (50th percentile):'));
  console.log(chalk.gray(`    Final Equity: $${mcResult.medianCase.finalEquity.toFixed(2)}`));
  console.log(chalk.gray(`    Total Return: ${(mcResult.medianCase.totalReturn * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Max Drawdown: ${(mcResult.medianCase.maxDrawdown * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.green.bold('  Best Case (95th percentile):'));
  console.log(chalk.gray(`    Final Equity: $${mcResult.bestCase.finalEquity.toFixed(2)}`));
  console.log(chalk.gray(`    Total Return: ${(mcResult.bestCase.totalReturn * 100).toFixed(2)}%`));
  console.log(chalk.gray(`    Max Drawdown: ${(mcResult.bestCase.maxDrawdown * 100).toFixed(2)}%`));
  console.log('');

  // Interpretation
  interpretResults(mcResult);
}

/**
 * Interpret and provide feedback on Monte Carlo results
 */
function interpretResults(mcResult: any) {
  console.log(chalk.cyan.bold('INTERPRETATION:'));
  console.log('');

  const insights: string[] = [];

  // Probability of profit
  const profitProb = mcResult.probabilities.profitableProbability;
  if (profitProb >= 0.7) {
    insights.push('✓ High probability of profitability (>70%)');
  } else if (profitProb >= 0.5) {
    insights.push('⚠ Moderate probability of profitability (50-70%)');
  } else {
    insights.push('✗ Low probability of profitability (<50%)');
  }

  // Return consistency
  const returnStdDev = Math.abs(
    mcResult.confidenceIntervals.totalReturn.upper - mcResult.confidenceIntervals.totalReturn.lower
  );
  if (returnStdDev < 0.2) {
    insights.push('✓ Consistent returns across simulations');
  } else if (returnStdDev < 0.5) {
    insights.push('⚠ Moderate variability in returns');
  } else {
    insights.push('✗ High variability in returns - risky strategy');
  }

  // Drawdown risk
  const dd20Prob = mcResult.probabilities.drawdownExceeds20Percent;
  if (dd20Prob < 0.1) {
    insights.push('✓ Low risk of significant drawdowns');
  } else if (dd20Prob < 0.3) {
    insights.push('⚠ Moderate drawdown risk');
  } else {
    insights.push('✗ High risk of significant drawdowns (>20%)');
  }

  // Worst case analysis
  const worstCaseReturn = mcResult.worstCase.totalReturn;
  if (worstCaseReturn > -0.1) {
    insights.push('✓ Worst case is manageable (<10% loss)');
  } else if (worstCaseReturn > -0.2) {
    insights.push('⚠ Worst case shows moderate losses (10-20%)');
  } else {
    insights.push('✗ Worst case shows significant losses (>20%)');
  }

  for (const insight of insights) {
    console.log(chalk.gray(`  ${insight}`));
  }
  console.log('');

  // Final recommendation
  console.log(chalk.cyan.bold('RECOMMENDATION:'));
  console.log('');

  const isExcellent =
    profitProb >= 0.7 &&
    returnStdDev < 0.3 &&
    dd20Prob < 0.2 &&
    worstCaseReturn > -0.15;

  const isGood =
    profitProb >= 0.6 &&
    returnStdDev < 0.5 &&
    dd20Prob < 0.3 &&
    worstCaseReturn > -0.25;

  if (isExcellent) {
    console.log(chalk.green.bold('✓ EXCELLENT STATISTICAL PROPERTIES'));
    console.log(chalk.white('Strategy shows strong statistical edge with acceptable risk.'));
    console.log(chalk.white('Monte Carlo confirms robustness. Ready for live trading.'));
  } else if (isGood) {
    console.log(chalk.green.bold('✓ GOOD STATISTICAL PROPERTIES'));
    console.log(chalk.white('Strategy shows positive statistical edge.'));
    console.log(chalk.white('Consider reducing position size or improving risk management.'));
  } else {
    console.log(chalk.yellow.bold('⚠ MARGINAL STATISTICAL PROPERTIES'));
    console.log(chalk.white('Strategy shows high variability and risk.'));
    console.log(chalk.white('Not recommended without further optimization or risk reduction.'));
  }
  console.log('');
}
