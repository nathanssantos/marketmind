import chalk from 'chalk';
import ora from 'ora';
// @ts-expect-error - cli-progress doesn't have types
import cliProgress from 'cli-progress';
import type { BacktestConfig, Interval } from '@marketmind/types';
import { FullSystemOptimizer, OPTIMIZATION_PRESETS } from '../../services/backtesting/FullSystemOptimizer';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import { BacktestLogger, LogLevel } from '../utils/logger';
import {
  validateCapital,
  validateDateRange,
  validateInterval,
  validateParallelWorkers,
  validateStrategy,
  validateSymbol,
  ValidationError,
} from '../utils/validators';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

interface OptimizeFullSystemOptions {
  strategy: string;
  symbol: string;
  interval: string;
  start: string;
  end: string;
  capital: string;
  preset: string;
  parallel: string;
  top: string;
  minTrades: string;
  output?: string;
  verbose: boolean;
}

export async function optimizeFullSystemCommand(options: OptimizeFullSystemOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    validateStrategy(options.strategy);
    validateSymbol(options.symbol);
    validateInterval(options.interval);
    validateDateRange(options.start, options.end);

    const capital = validateCapital(options.capital);
    const parallelWorkers = validateParallelWorkers(options.parallel);
    const topN = parseInt(options.top, 10);
    const minTrades = parseInt(options.minTrades, 10);

    const presetName = options.preset.toLowerCase();
    const preset = OPTIMIZATION_PRESETS[presetName];

    if (!preset) {
      throw new ValidationError(`Invalid preset "${options.preset}". Valid options: ${Object.keys(OPTIMIZATION_PRESETS).join(', ')}`);
    }

    const optimizer = new FullSystemOptimizer();
    const totalCombinations = optimizer.countCombinations(preset);

    logger.header(`FULL SYSTEM OPTIMIZATION - ${options.strategy.toUpperCase()}`, {
      'Symbol': options.symbol,
      'Interval': options.interval,
      'Period': `${options.start} → ${options.end}`,
      'Preset': presetName,
      'Combinations': totalCombinations.toString(),
      'Walk-Forward': preset.walkForward ? 'enabled' : 'disabled',
      'Parallel Workers': parallelWorkers.toString(),
    });

    console.log('');
    console.log(chalk.gray('Parameter grid:'));
    console.log(chalk.gray(`  ML Thresholds: [${preset.mlThresholds.join(', ')}]`));
    console.log(chalk.gray(`  Pyramiding profitThreshold: [${preset.pyramiding.profitThreshold.join(', ')}]`));
    console.log(chalk.gray(`  Pyramiding scaleFactor: [${preset.pyramiding.scaleFactor.join(', ')}]`));
    console.log(chalk.gray(`  Pyramiding maxEntries: [${preset.pyramiding.maxEntries.join(', ')}]`));
    console.log(chalk.gray(`  Trailing minDistance: [${preset.trailingStop.minTrailingDistancePercent.join(', ')}]`));
    console.log('');

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

    const baseConfig: BacktestConfig = {
      symbol: options.symbol,
      interval: options.interval,
      startDate: options.start,
      endDate: options.end,
      initialCapital: capital,
      setupTypes: [options.strategy],
      useAlgorithmicLevels: true,
    };

    const progressBar = new cliProgress.SingleBar({
      format: chalk.cyan('Optimizing |') + chalk.yellow('{bar}') + chalk.cyan('| {percentage}% | {value}/{total} | Best: {best}'),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(totalCombinations, 0, { best: 'N/A' });

    const startTime = Date.now();

    const result = await optimizer.optimize(baseConfig, klines, preset, {
      parallelWorkers,
      minTrades,
      onProgress: (current, _total, currentBest) => {
        const bestStr = currentBest
          ? `${(currentBest.metrics.totalPnlPercent).toFixed(1)}% PnL`
          : 'N/A';
        progressBar.update(current, { best: bestStr });
      },
    });

    progressBar.stop();

    const duration = (Date.now() - startTime) / 1000;
    const avgTime = duration / totalCombinations;

    console.log('');
    logger.success(`Completed ${result.completedCombinations}/${result.totalCombinations} backtests in ${duration.toFixed(1)}s (avg ${avgTime.toFixed(2)}s/backtest)`);
    console.log('');

    if (result.results.length === 0) {
      logger.warn('No valid results found');
      return;
    }

    const topResults = result.results.slice(0, topN);

    console.log(chalk.cyan.bold(`TOP ${topN} RESULTS:`));
    console.log('');

    for (let i = 0; i < topResults.length; i++) {
      const r = topResults[i]!;
      const m = r.metrics;
      const wfStatus = r.walkForwardValidated === true
        ? chalk.green('✓ robust')
        : r.walkForwardValidated === false
          ? chalk.red('✗ overfit')
          : chalk.gray('not validated');

      console.log(`${chalk.white.bold(`#${i + 1}`)  } ${  wfStatus}`);
      console.log(chalk.gray(`  ML Threshold: ${(r.params.mlThreshold * 100).toFixed(0)}%`));
      console.log(chalk.gray(`  Pyramiding: profitThr=${r.params.pyramiding.profitThreshold}, scale=${r.params.pyramiding.scaleFactor}, max=${r.params.pyramiding.maxEntries}`));
      console.log(chalk.gray(`  Trailing: minDist=${r.params.trailingStop.minTrailingDistancePercent}`));
      console.log(chalk.gray(`  Metrics: WR=${m.winRate.toFixed(1)}%, PF=${m.profitFactor.toFixed(2)}, PnL=${m.totalPnlPercent.toFixed(1)}%, DD=${m.maxDrawdownPercent.toFixed(1)}%, Sharpe=${(m.sharpeRatio ?? 0).toFixed(2)}, Trades=${m.totalTrades}`));

      if (r.degradationPercent !== undefined) {
        console.log(chalk.gray(`  Degradation: ${r.degradationPercent.toFixed(1)}%`));
      }
      console.log('');
    }

    const best = result.bestResult;
    if (best) {
      console.log(chalk.cyan.bold('BEST CONFIGURATION:'));
      console.log('');
      console.log(chalk.white.bold('ML Threshold:'), `${(best.params.mlThreshold * 100).toFixed(0)}%`);
      console.log(chalk.white.bold('Pyramiding:'));
      console.log(chalk.gray(`  profitThreshold: ${best.params.pyramiding.profitThreshold}`));
      console.log(chalk.gray(`  scaleFactor: ${best.params.pyramiding.scaleFactor}`));
      console.log(chalk.gray(`  maxEntries: ${best.params.pyramiding.maxEntries}`));
      console.log(chalk.white.bold('Trailing Stop:'));
      console.log(chalk.gray(`  minTrailingDistancePercent: ${best.params.trailingStop.minTrailingDistancePercent}`));
      console.log('');

      const m = best.metrics;
      console.log(chalk.white.bold('Performance:'));
      console.log(chalk.gray(`  Win Rate: ${m.winRate.toFixed(1)}%`));
      console.log(chalk.gray(`  Profit Factor: ${m.profitFactor.toFixed(2)}`));
      console.log(chalk.gray(`  Total PnL: ${m.totalPnlPercent.toFixed(2)}%`));
      console.log(chalk.gray(`  Sharpe Ratio: ${(m.sharpeRatio ?? 0).toFixed(2)}`));
      console.log(chalk.gray(`  Max Drawdown: ${m.maxDrawdownPercent.toFixed(2)}%`));
      console.log(chalk.gray(`  Total Trades: ${m.totalTrades}`));
      console.log('');

      if (best.walkForwardValidated === true) {
        console.log(chalk.green.bold('✓ WALK-FORWARD VALIDATED:') + chalk.white(' Strategy is robust'));
      } else if (best.walkForwardValidated === false) {
        console.log(chalk.yellow.bold('! WALK-FORWARD WARNING:') + chalk.white(' Strategy may be overfit'));
      }
      console.log('');
    }

    if (options.output) {
      const outputDir = options.output;
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      const resultsPath = join(outputDir, 'optimization_results.json');
      writeFileSync(resultsPath, JSON.stringify(result, null, 2));
      logger.info(`Results saved to: ${resultsPath}`);

      if (best) {
        const bestParamsPath = join(outputDir, 'best_params.json');
        writeFileSync(bestParamsPath, JSON.stringify({
          mlThreshold: best.params.mlThreshold,
          pyramiding: best.params.pyramiding,
          trailingStop: best.params.trailingStop,
          metrics: best.metrics,
        }, null, 2));
        logger.info(`Best params saved to: ${bestParamsPath}`);
      }

      if (result.walkForwardResults && result.walkForwardResults.length > 0) {
        const wfPath = join(outputDir, 'walkforward_results.json');
        writeFileSync(wfPath, JSON.stringify(result.walkForwardResults, null, 2));
        logger.info(`Walk-forward results saved to: ${wfPath}`);
      }

      console.log('');
    }

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
