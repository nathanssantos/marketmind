/**
 * Sensitivity Analysis CLI Command
 *
 * Analyzes parameter sensitivity to detect over-optimization and identify robust parameter regions.
 */

import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import type { Kline, TimeInterval } from '@marketmind/types';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { ParameterSensitivityAnalyzer, type ParameterRange, type SensitivityAnalysis } from '../../services/backtesting/ParameterSensitivityAnalyzer';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import {
  validateSymbol,
  validateInterval,
  validateDateRange,
  validatePercentage,
  validateNumeric,
  ValidationError,
} from '../utils/validators';

interface SensitivityOptions {
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
  onlyWithTrend: boolean;
  metric: string;
  verbose: boolean;
}

export async function sensitivityCommand(options: SensitivityOptions): Promise<void> {
  try {
    console.log('');
    console.log(chalk.cyan.bold('═'.repeat(80)));
    console.log(chalk.cyan.bold('           PARAMETER SENSITIVITY ANALYSIS'));
    console.log(chalk.cyan.bold('═'.repeat(80)));
    console.log('');

    // Validate inputs
    const symbol = validateSymbol(options.symbol);
    const interval = validateInterval(options.interval);
    const { startDate, endDate } = validateDateRange(options.start, options.end);
    const capital = validateNumeric(options.capital, 'Capital', 100, 1000000);
    const maxPositionSize = validatePercentage(options.maxPosition, 'Max position');
    const commission = validatePercentage(options.commission, 'Commission') / 100;

    let minConfidence: number | undefined;
    if (options.minConfidence) {
      minConfidence = validatePercentage(options.minConfidence, 'Min confidence', 0, 100);
    }

    // Validate metric
    const validMetrics = ['sharpeRatio', 'totalReturn', 'profitFactor', 'winRate'];
    if (!validMetrics.includes(options.metric)) {
      throw new ValidationError(`Invalid metric: ${options.metric}. Must be one of: ${validMetrics.join(', ')}`);
    }
    const metric = options.metric as 'sharpeRatio' | 'totalReturn' | 'profitFactor' | 'winRate';

    // Parse parameter ranges from --param flags
    const parameterRanges: ParameterRange[] = [];

    for (const paramStr of options.param) {
      const [name, valuesStr] = paramStr.split('=');

      if (!name || !valuesStr) {
        throw new ValidationError(`Invalid parameter format: ${paramStr}. Expected format: name=val1,val2,val3`);
      }

      const values = valuesStr.split(',').map(Number);

      if (values.length < 3) {
        throw new ValidationError(`Parameter ${name} must have at least 3 values for sensitivity analysis`);
      }

      const min = Math.min(...values);
      const max = Math.max(...values);
      const step = values.length === 2 ? max - min : values[1]! - values[0]!;

      parameterRanges.push({ name, min, max, step });
    }

    const paramSummary = parameterRanges
      .map((r) => `${r.name}=[${r.min}:${r.step}:${r.max}]`)
      .join(' ');

    const totalCombinations = parameterRanges.reduce(
      (total, range) => total * (Math.floor((range.max - range.min) / range.step) + 1),
      1
    );

    // Display configuration
    console.log(chalk.gray('Configuration:'));
    console.log(chalk.gray(`  Strategy:        ${options.strategy.toUpperCase()}`));
    console.log(chalk.gray(`  Symbol:          ${symbol}`));
    console.log(chalk.gray(`  Interval:        ${interval}`));
    console.log(chalk.gray(`  Period:          ${startDate} → ${endDate}`));
    console.log(chalk.gray(`  Capital:         $${capital.toLocaleString()}`));
    console.log(chalk.gray(`  Parameters:      ${paramSummary}`));
    console.log(chalk.gray(`  Combinations:    ${totalCombinations}`));
    console.log(chalk.gray(`  Metric:          ${metric}`));
    console.log('');

    if (totalCombinations > 100) {
      console.log(chalk.yellow(`⚠ Warning: Testing ${totalCombinations} combinations may take a long time.`));
      console.log('');
    }

    // Fetch historical data
    const fetchSpinner = ora({
      text: chalk.cyan('Fetching historical data from Binance...'),
      color: 'cyan',
    }).start();

    const klines: Kline[] = await fetchHistoricalKlinesFromAPI(
      symbol,
      interval as TimeInterval,
      new Date(startDate),
      new Date(endDate)
    );

    fetchSpinner.succeed(chalk.green(`✓ Fetched ${klines.length.toLocaleString()} candles`));
    console.log('');

    // Create base config
    const baseConfig = {
      symbol,
      interval,
      startDate,
      endDate,
      initialCapital: capital,
      commission,
      setupTypes: [options.strategy],
      minConfidence,
      maxPositionSize,
      useAlgorithmicLevels: options.useAlgorithmicLevels,
      onlyWithTrend: options.onlyWithTrend,
    };

    // Create backtest runner
    const engine = new BacktestEngine();
    const backtestRunner = async (config: any) => {
      return await engine.run(config, klines);
    };

    // Run sensitivity analysis
    const analysisSpinner = ora({
      text: chalk.cyan(`Running ${totalCombinations} backtests...`),
      color: 'cyan',
    }).start();

    const startTime = Date.now();

    const result = await ParameterSensitivityAnalyzer.analyze(
      {
        baseConfig: baseConfig as any,
        parametersToTest: parameterRanges,
        metric,
      },
      backtestRunner
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    const avgTime = ((Date.now() - startTime) / totalCombinations / 1000).toFixed(1);

    analysisSpinner.succeed(
      chalk.green(`✓ Completed ${totalCombinations} backtests in ${duration}s (avg ${avgTime}s each)`)
    );
    console.log('');

    // Display results
    displayResults(result, metric, options.verbose);

    // Save results
    console.log('');
    const saveSpinner = ora({
      text: chalk.cyan('Saving sensitivity analysis results...'),
      color: 'cyan',
    }).start();

    const resultManager = new ResultManager();
    const filepath = await resultManager.saveSensitivity(
      options.strategy,
      symbol,
      interval,
      result
    );

    saveSpinner.succeed(chalk.green(`✓ Results saved to: ${chalk.cyan(filepath)}`));
    console.log('');
  } catch (error) {
    console.error('');
    if (error instanceof ValidationError) {
      console.error(chalk.red('✗ Validation Error:'), error.message);
    } else if (error instanceof Error) {
      console.error(chalk.red('✗ Error:'), error.message);
      if (options.verbose) {
        console.error(chalk.gray(error.stack));
      }
    }
    process.exit(1);
  }
}

/**
 * Display sensitivity analysis results
 */
function displayResults(
  result: any,
  metric: string,
  verbose: boolean
) {
  // Display parameter analyses
  console.log(chalk.cyan.bold('PARAMETER SENSITIVITY ANALYSIS:'));
  console.log('');

  for (const analysis of result.parameterAnalyses) {
    displayParameterAnalysis(analysis, metric, verbose);
  }

  // Display overall assessment
  console.log('');
  console.log(chalk.cyan.bold('OVERALL ASSESSMENT:'));
  console.log('');

  const robustnessColor =
    result.robustnessScore >= 80 ? 'green' :
    result.robustnessScore >= 60 ? 'yellow' :
    'red';

  console.log(chalk.gray(`  Robustness Score: ${chalk[robustnessColor].bold(result.robustnessScore.toFixed(1))} / 100`));
  console.log('');

  // Best vs Worst
  console.log(chalk.cyan.bold('BEST VS WORST PARAMETERS:'));
  console.log('');

  const bestTable = new Table({
    head: [chalk.cyan('Parameter'), chalk.green('Best Value'), chalk.red('Worst Value')],
    style: { head: [] },
  });

  for (const paramName of Object.keys(result.bestParameters)) {
    bestTable.push([
      paramName,
      result.bestParameters[paramName]?.toFixed(2) || 'N/A',
      result.worstParameters[paramName]?.toFixed(2) || 'N/A',
    ]);
  }

  console.log(bestTable.toString());
  console.log('');

  // Interpretation
  interpretResults(result);
}

/**
 * Display single parameter analysis
 */
function displayParameterAnalysis(
  analysis: SensitivityAnalysis,
  metric: string,
  verbose: boolean
) {
  const sensitivityColor =
    analysis.sensitivity === 'LOW' ? 'green' :
    analysis.sensitivity === 'MEDIUM' ? 'yellow' :
    analysis.sensitivity === 'HIGH' ? 'magenta' :
    'red';

  console.log(chalk.bold(`${analysis.parameterName}:`));
  console.log(chalk.gray(`  Sensitivity:       ${chalk[sensitivityColor](analysis.sensitivity)}`));
  console.log(chalk.gray(`  Max Deviation:     ${(analysis.maxDeviation * 100).toFixed(1)}%`));
  console.log(chalk.gray(`  Avg Deviation:     ${(analysis.avgDeviation * 100).toFixed(1)}%`));
  console.log(chalk.gray(`  Recommended Range: [${analysis.recommendedRange.min.toFixed(2)}, ${analysis.recommendedRange.max.toFixed(2)}]`));

  // Check for over-optimization
  const overOptCheck = ParameterSensitivityAnalyzer.detectOverOptimization(analysis);
  if (overOptCheck.isOverOptimized) {
    console.log(chalk.red(`  ⚠ OVER-OPTIMIZED: ${overOptCheck.reason}`));
  } else {
    console.log(chalk.green(`  ✓ ${overOptCheck.reason}`));
  }

  // Find optimal plateau
  const plateau = ParameterSensitivityAnalyzer.findOptimalPlateau(analysis);
  if (plateau) {
    console.log(chalk.gray(`  Optimal Plateau:   [${plateau.start.toFixed(2)}, ${plateau.end.toFixed(2)}] (avg ${metric}: ${plateau.avgMetric.toFixed(2)})`));
  }

  // Show detailed results if verbose
  if (verbose && analysis.results.length > 0) {
    console.log('');
    console.log(chalk.gray('  Detailed Results:'));

    const table = new Table({
      head: [chalk.cyan('Value'), chalk.cyan(metric), chalk.cyan('Change %')],
      style: { head: [] },
    });

    for (const result of analysis.results) {
      const changeColor = result.percentageChange >= 0 ? 'green' : 'red';
      table.push([
        result.parameterValue.toFixed(2),
        result.metricValue.toFixed(3),
        chalk[changeColor](`${result.percentageChange >= 0 ? '+' : ''}${(result.percentageChange * 100).toFixed(1)}%`),
      ]);
    }

    console.log(table.toString());
  }

  console.log('');
}

/**
 * Interpret and provide feedback
 */
function interpretResults(result: any) {
  console.log(chalk.cyan.bold('INTERPRETATION:'));
  console.log('');

  const insights: string[] = [];
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Analyze robustness score
  if (result.robustnessScore >= 80) {
    insights.push('Excellent overall robustness - strategy is not over-optimized');
  } else if (result.robustnessScore >= 60) {
    insights.push('Good robustness - acceptable parameter stability');
    recommendations.push('Consider testing with walk-forward analysis to confirm');
  } else {
    warnings.push('Low robustness score - strategy may be over-optimized');
    recommendations.push('Review parameters with HIGH or CRITICAL sensitivity');
    recommendations.push('Consider wider parameter ranges or different parameters');
  }

  // Analyze individual parameters
  const criticalParams = result.parameterAnalyses.filter((a: any) => a.sensitivity === 'CRITICAL');
  const highParams = result.parameterAnalyses.filter((a: any) => a.sensitivity === 'HIGH');
  const lowParams = result.parameterAnalyses.filter((a: any) => a.sensitivity === 'LOW');

  if (criticalParams.length > 0) {
    warnings.push(`${criticalParams.length} parameter(s) show CRITICAL sensitivity`);
    recommendations.push(`Avoid using these parameters: ${criticalParams.map((p: any) => p.parameterName).join(', ')}`);
  }

  if (highParams.length > 0 && criticalParams.length === 0) {
    warnings.push(`${highParams.length} parameter(s) show HIGH sensitivity`);
    recommendations.push(`Use caution with: ${highParams.map((p: any) => p.parameterName).join(', ')}`);
  }

  if (lowParams.length === result.parameterAnalyses.length) {
    insights.push('All parameters show low sensitivity - excellent stability');
  }

  // Display insights
  if (insights.length > 0) {
    console.log(chalk.green.bold('✓ INSIGHTS:'));
    for (const insight of insights) {
      console.log(chalk.green(`  • ${insight}`));
    }
    console.log('');
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log(chalk.yellow.bold('⚠ WARNINGS:'));
    for (const warning of warnings) {
      console.log(chalk.yellow(`  • ${warning}`));
    }
    console.log('');
  }

  // Display recommendations
  if (recommendations.length > 0) {
    console.log(chalk.cyan.bold('💡 RECOMMENDATIONS:'));
    for (const recommendation of recommendations) {
      console.log(chalk.cyan(`  • ${recommendation}`));
    }
    console.log('');
  }

  // Final verdict
  console.log(chalk.bold('VERDICT:'));
  if (result.robustnessScore >= 80) {
    console.log(chalk.green('  ✓ Strategy parameters are robust and production-ready'));
  } else if (result.robustnessScore >= 60) {
    console.log(chalk.yellow('  ⚠ Strategy shows acceptable robustness but requires validation'));
    console.log(chalk.gray('    Run walk-forward analysis before live trading'));
  } else {
    console.log(chalk.red('  ✗ Strategy is over-optimized and NOT recommended for live trading'));
    console.log(chalk.gray('    Re-optimize with different parameters or broader ranges'));
  }
  console.log('');
}
