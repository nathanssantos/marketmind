import chalk from 'chalk';
import ora from 'ora';
import type { BacktestConfig, Interval } from '@marketmind/types';
// @ts-expect-error - cli-progress doesn't have types
import cliProgress from 'cli-progress';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { WalkForwardOptimizer, type ParameterRange, type WalkForwardConfig } from '../../services/backtesting/WalkForwardOptimizer';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import { BacktestLogger, LogLevel } from '../utils/logger';
import {
    validateCapital,
    validateDateRange,
    validateInterval,
    validateParameterGrid,
    validatePercentage,
    validateStrategy,
    validateSymbol,
    ValidationError,
} from '../utils/validators';

interface WalkForwardOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  param: string[];
  minConfidence?: string;
  maxPosition: string;
  commission: string;
  useAlgorithmicLevels: boolean;
  withTrend: boolean;
  trainingMonths: string;
  testingMonths: string;
  stepMonths: string;
  verbose: boolean;
}

export async function walkforwardCommand(options: WalkForwardOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);
    validateParameterGrid(options.param);

    const capital = validateCapital(options.capital);
    const commission = validatePercentage(options.commission, 'Commission', 0, 10);
    const trainingMonths = parseInt(options.trainingMonths);
    const testingMonths = parseInt(options.testingMonths);
    const stepMonths = parseInt(options.stepMonths);

    if (trainingMonths < 1 || trainingMonths > 24) {
      throw new ValidationError('Training window must be between 1 and 24 months');
    }
    if (testingMonths < 1 || testingMonths > 12) {
      throw new ValidationError('Testing window must be between 1 and 12 months');
    }
    if (stepMonths < 1 || stepMonths > 12) {
      throw new ValidationError('Step must be between 1 and 12 months');
    }

    let minConfidence: number | undefined;
    if (options.minConfidence) {
      minConfidence = validatePercentage(options.minConfidence, 'Min confidence', 0, 100);
    }

    const parameterRanges: ParameterRange[] = [];

    for (const paramStr of options.param) {
      const [name, valuesStr] = paramStr.split('=');

      if (!name || !valuesStr) {
        throw new ValidationError(`Invalid parameter format: ${paramStr}. Expected format: name=val1,val2,val3`);
      }

      const values = valuesStr.split(',').map(Number);

      if (values.length < 2) {
        throw new ValidationError(`Parameter ${name} must have at least 2 values for walk-forward analysis`);
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const step = values.length === 2 ? max - min : values[1]! - values[0]!;

      parameterRanges.push({ name, min, max, step });
    }

    const paramSummary = parameterRanges
      .map((r) => `${r.name}=[${r.min}:${r.step}:${r.max}]`)
      .join(' ');

    logger.header(`WALK-FORWARD ANALYSIS - ${options.strategy.toUpperCase()}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Training Window': `${trainingMonths} months`,
      'Testing Window': `${testingMonths} months`,
      'Step': `${stepMonths} months`,
      'Parameters': paramSummary,
    });

    const baseConfig: BacktestConfig = {
      symbol: options.symbol,
      interval: options.interval,
      startDate: options.start,
      endDate: options.end,
      initialCapital: capital,
      setupTypes: [options.strategy],
      commission: commission / 100,
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.withTrend,
    };

    if (minConfidence !== undefined) {
      baseConfig.minConfidence = minConfidence;
    }

    const wfConfig: WalkForwardConfig = {
      trainingWindowMonths: trainingMonths,
      testingWindowMonths: testingMonths,
      stepMonths: stepMonths,
      minWindowCount: 3,
    };

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

    const windowSpinner = ora({
      text: chalk.cyan('Creating walk-forward windows...'),
      color: 'cyan',
    }).start();

    let windows;
    try {
      windows = WalkForwardOptimizer.createWindows(klines, wfConfig);
      windowSpinner.succeed(chalk.green(`Created ${windows.length} walk-forward windows`));
      console.log('');
    } catch (error) {
      windowSpinner.fail(chalk.red((error as Error).message));
      throw error;
    }

    if (options.verbose) {
      console.log(chalk.cyan.bold('WINDOWS:'));
      for (const window of windows) {
        const trainStart = new Date(window.trainingStart).toISOString().split('T')[0];
        const trainEnd = new Date(window.trainingEnd).toISOString().split('T')[0];
        const testStart = new Date(window.testingStart).toISOString().split('T')[0];
        const testEnd = new Date(window.testingEnd).toISOString().split('T')[0];

        console.log(chalk.gray(`  Window ${window.windowIndex + 1}:`));
        console.log(chalk.gray(`    Training: ${trainStart} → ${trainEnd} (${window.trainingKlines.length} candles)`));
        console.log(chalk.gray(`    Testing:  ${testStart} → ${testEnd} (${window.testingKlines.length} candles)`));
      }
      console.log('');
    }

    console.log(chalk.cyan('Running walk-forward analysis...'));
    console.log('');

    const startTime = Date.now();
    let currentWindow = 0;

    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('Progress |') + chalk.yellow('{bar}') + chalk.cyan('| {percentage}% | Window {value}/{total} | ETA: {eta}s'),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(windows.length, 0);

    for (const window of windows) {
      const optimizationResult = await WalkForwardOptimizer.optimizeWindow(
        window,
        baseConfig,
        parameterRanges
      );
      window.optimizationResult = optimizationResult;

      const testResult = await WalkForwardOptimizer.testWindow(
        window,
        baseConfig,
        optimizationResult.parameters
      );
      window.testResult = testResult;

      currentWindow++;
      progressBar.update(currentWindow);
    }

    progressBar.stop();

    const duration = (Date.now() - startTime) / 1000;

    console.log('');
    logger.success(`Completed walk-forward analysis in ${duration.toFixed(1)}s`);
    console.log('');

    const aggregatedMetrics = (WalkForwardOptimizer as any).calculateAggregatedMetrics(windows);
    const degradation = (WalkForwardOptimizer as any).calculateDegradation(windows);
    const isRobust = degradation <= 0.3;

    displayResults(windows, aggregatedMetrics, degradation, isRobust, options.verbose);

    console.log('');
    const saveSpinner = ora({
      text: chalk.cyan('Saving walk-forward results...'),
      color: 'cyan',
    }).start();

    const resultManager = new ResultManager();
    const result = {
      type: 'walkforward' as const,
      strategy: options.strategy,
      symbol: options.symbol,
      interval: options.interval,
      config: baseConfig,
      wfConfig,
      windows: windows.map((w) => ({
        windowIndex: w.windowIndex,
        trainingPeriod: {
          start: new Date(w.trainingStart).toISOString(),
          end: new Date(w.trainingEnd).toISOString(),
        },
        testingPeriod: {
          start: new Date(w.testingStart).toISOString(),
          end: new Date(w.testingEnd).toISOString(),
        },
        optimizedParams: w.optimizationResult?.parameters,
        inSampleMetrics: {
          sharpeRatio: w.optimizationResult?.sharpeRatio,
          profitFactor: w.optimizationResult?.profitFactor,
          maxDrawdown: w.optimizationResult?.maxDrawdown,
        },
        outOfSampleMetrics: {
          totalTrades: w.testResult?.trades.length || 0,
          winRate: w.testResult?.metrics.winRate || 0,
          profitFactor: w.testResult?.metrics.profitFactor || 0,
          sharpeRatio: w.testResult?.metrics.sharpeRatio || 0,
          maxDrawdown: w.testResult?.metrics.maxDrawdown || 0,
          totalPnlPercent: w.testResult?.metrics.totalPnlPercent || 0,
        },
      })),
      aggregatedMetrics,
      degradation,
      isRobust,
      timestamp: new Date().toISOString(),
    };

    const savedPath = await resultManager.saveWalkForward(
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
      logger.error(`Walk-forward analysis failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

function displayResults(
  windows: any[],
  aggregatedMetrics: any,
  degradation: number,
  isRobust: boolean,
  verbose: boolean
) {
  if (verbose) {
    console.log(chalk.cyan.bold('WINDOW RESULTS:'));
    console.log('');

    for (const window of windows) {
      const inSample = window.optimizationResult;
      const outOfSample = window.testResult?.metrics;

      console.log(chalk.white.bold(`Window ${window.windowIndex + 1}:`));

      console.log(chalk.gray('  In-Sample (Training):'));
      console.log(chalk.gray(`    Best Params: ${JSON.stringify(inSample?.parameters || {})}`));
      console.log(chalk.gray(`    Sharpe Ratio: ${(inSample?.sharpeRatio || 0).toFixed(2)}`));
      console.log(chalk.gray(`    Profit Factor: ${(inSample?.profitFactor || 0).toFixed(2)}`));
      console.log(chalk.gray(`    Max Drawdown: ${((inSample?.maxDrawdown || 0) * 100).toFixed(2)}%`));

      console.log(chalk.gray('  Out-of-Sample (Testing):'));
      console.log(chalk.gray(`    Trades: ${window.testResult?.trades.length || 0}`));
      console.log(chalk.gray(`    Win Rate: ${(outOfSample?.winRate || 0).toFixed(1)}%`));
      console.log(chalk.gray(`    Profit Factor: ${(outOfSample?.profitFactor || 0).toFixed(2)}`));
      console.log(chalk.gray(`    Sharpe Ratio: ${(outOfSample?.sharpeRatio || 0).toFixed(2)}`));
      console.log(chalk.gray(`    Total PnL: ${(outOfSample?.totalPnlPercent || 0).toFixed(2)}%`));
      console.log(chalk.gray(`    Max Drawdown: ${(outOfSample?.maxDrawdownPercent || 0).toFixed(2)}%`));
      console.log('');
    }
  }

  console.log(chalk.cyan.bold('AGGREGATED METRICS:'));
  console.log('');

  console.log(chalk.white.bold('Performance:'));
  console.log(chalk.gray(`  Total Trades: ${aggregatedMetrics.totalTrades}`));
  console.log(chalk.gray(`  Overall Win Rate: ${(aggregatedMetrics.overallWinRate * 100).toFixed(1)}%`));
  console.log(chalk.gray(`  Overall Profit Factor: ${aggregatedMetrics.overallProfitFactor.toFixed(2)}`));
  console.log(chalk.gray(`  Overall Max Drawdown: ${(aggregatedMetrics.overallMaxDrawdown * 100).toFixed(2)}%`));
  console.log('');

  console.log(chalk.white.bold('Sharpe Ratio Analysis:'));
  console.log(chalk.gray(`  Avg In-Sample Sharpe: ${aggregatedMetrics.avgInSampleSharpe.toFixed(2)}`));
  console.log(chalk.gray(`  Avg Out-of-Sample Sharpe: ${aggregatedMetrics.avgOutOfSampleSharpe.toFixed(2)}`));
  console.log(chalk.gray(`  Degradation: ${(degradation * 100).toFixed(1)}%`));
  console.log('');

  console.log(chalk.white.bold('Robustness Assessment:'));

  const degradationColor = degradation <= 0.3 ? chalk.green : chalk.red;
  console.log(degradationColor(`  Degradation: ${(degradation * 100).toFixed(1)}% (threshold: 30%)`));

  if (isRobust) {
    console.log(chalk.green.bold('  ✓ Strategy is ROBUST'));
    console.log(chalk.gray('    Performance degradation is acceptable (<30%)'));
  } else {
    console.log(chalk.red.bold('  ✗ Strategy is NOT ROBUST'));
    console.log(chalk.gray('    Performance degradation exceeds threshold (>30%)'));
  }
  console.log('');

  interpretResults(aggregatedMetrics, degradation, isRobust);
}

function interpretResults(
  metrics: any,
  degradation: number,
  isRobust: boolean
) {
  console.log(chalk.cyan.bold('INTERPRETATION:'));
  console.log('');

  const insights: string[] = [];

  if (degradation < 0.15) {
    insights.push('✓ Excellent stability - minimal performance degradation');
  } else if (degradation < 0.3) {
    insights.push('⚠ Acceptable stability - moderate performance degradation');
  } else {
    insights.push('✗ Poor stability - significant overfitting detected');
  }

  if (metrics.overallWinRate >= 0.55) {
    insights.push('✓ Strong win rate across all periods');
  } else if (metrics.overallWinRate >= 0.45) {
    insights.push('⚠ Moderate win rate - consider position sizing optimization');
  } else {
    insights.push('✗ Low win rate - strategy may not be viable');
  }

  if (metrics.overallProfitFactor >= 2.0) {
    insights.push('✓ Excellent profit factor');
  } else if (metrics.overallProfitFactor >= 1.5) {
    insights.push('⚠ Acceptable profit factor');
  } else {
    insights.push('✗ Poor profit factor - risk/reward needs improvement');
  }

  if (metrics.totalTrades >= 30) {
    insights.push('✓ Sufficient trade sample for statistical validity');
  } else {
    insights.push('⚠ Limited trades - results may lack statistical significance');
  }

  for (const insight of insights) {
    console.log(chalk.gray(`  ${insight}`));
  }
  console.log('');

  console.log(chalk.cyan.bold('RECOMMENDATION:'));
  console.log('');

  const isExcellent =
    isRobust &&
    degradation < 0.15 &&
    metrics.overallWinRate >= 0.55 &&
    metrics.overallProfitFactor >= 2.0 &&
    metrics.totalTrades >= 30;

  const isGood =
    isRobust &&
    degradation < 0.3 &&
    metrics.overallWinRate >= 0.45 &&
    metrics.overallProfitFactor >= 1.5 &&
    metrics.totalTrades >= 20;

  if (isExcellent) {
    console.log(chalk.green.bold('✓ EXCELLENT RESULTS'));
    console.log(chalk.white('Strategy shows strong robustness and consistent performance.'));
    console.log(chalk.white('Ready for live trading with proper risk management.'));
  } else if (isGood) {
    console.log(chalk.green.bold('✓ GOOD RESULTS'));
    console.log(chalk.white('Strategy shows acceptable robustness.'));
    console.log(chalk.white('Consider additional validation on recent out-of-sample data.'));
  } else if (isRobust) {
    console.log(chalk.yellow.bold('⚠ MARGINAL RESULTS'));
    console.log(chalk.white('Strategy is robust but performance metrics need improvement.'));
    console.log(chalk.white('Continue parameter optimization or try different strategy.'));
  } else {
    console.log(chalk.red.bold('✗ POOR RESULTS'));
    console.log(chalk.white('Strategy shows signs of overfitting.'));
    console.log(chalk.white('Not recommended for live trading. Try different parameters or strategy.'));
  }
  console.log('');
}
