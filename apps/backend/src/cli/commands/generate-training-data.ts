import type { BacktestConfig, BacktestResult, Interval, Kline, TradingSetup } from '@marketmind/types';
import { DatasetBuilder } from '@marketmind/ml';
import chalk from 'chalk';
import { mkdir, writeFile } from 'fs/promises';
import ora from 'ora';
import { dirname, resolve } from 'path';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { validateDateRange, validateInterval, validateSymbol, ValidationError } from '../utils/validators';

interface GenerateTrainingDataOptions {
  symbols: string;
  intervals: string;
  start: string;
  end: string;
  strategies?: string;
  output: string;
  minTrades: string;
  verbose: boolean;
}

const DEFAULT_TOP_STRATEGIES = [
  'keltner-breakout-optimized',
  'bollinger-breakout-crypto',
  'larry-williams-9-1',
  'williams-momentum',
  'larry-williams-9-3',
  'tema-momentum',
  'elder-ray-crypto',
  'ppo-momentum',
  'parabolic-sar-crypto',
  'supertrend-follow',
];

export async function generateTrainingDataCommand(options: GenerateTrainingDataOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    const symbols = options.symbols.split(',').map((s) => s.trim().toUpperCase());
    const intervals = options.intervals.split(',').map((i) => i.trim()) as Interval[];
    const strategies = options.strategies
      ? options.strategies.split(',').map((s) => s.trim())
      : DEFAULT_TOP_STRATEGIES;
    const minTrades = parseInt(options.minTrades, 10) || 5;

    for (const symbol of symbols) {
      validateSymbol(symbol);
    }
    for (const interval of intervals) {
      validateInterval(interval);
    }
    validateDateRange(options.start, options.end);

    logger.header('GENERATE ML TRAINING DATA', {
      Symbols: symbols.join(', '),
      Intervals: intervals.join(', '),
      Period: `${options.start} → ${options.end}`,
      Strategies: `${strategies.length} strategies`,
      Output: options.output,
    });

    const engine = new BacktestEngine();
    const datasetBuilder = new DatasetBuilder();

    interface CollectedResult {
      trades: BacktestResult['trades'];
      setupDetections: TradingSetup[];
      klines: Kline[];
    }

    const allResults: Map<string, CollectedResult> = new Map();

    let totalCombinations = symbols.length * intervals.length * strategies.length;
    let completedCombinations = 0;
    let totalSetups = 0;
    let totalTrades = 0;

    console.log(chalk.cyan(`\nProcessing ${totalCombinations} combinations...\n`));

    for (const symbol of symbols) {
      for (const interval of intervals) {
        for (const strategy of strategies) {
          const key = `${symbol}:${interval}:${strategy}`;
          const spinner = ora({
            text: chalk.cyan(`[${++completedCombinations}/${totalCombinations}] ${key}`),
            color: 'cyan',
          }).start();

          try {
            const config: BacktestConfig = {
              symbol,
              interval,
              startDate: options.start,
              endDate: options.end,
              initialCapital: 1000,
              setupTypes: [strategy],
              useOptimizedSettings: true,
            };

            const result = await engine.run(config);

            if (result.trades.length >= minTrades) {
              const backtestKey = `${symbol}:${interval}`;

              const existingResult = allResults.get(backtestKey);
              if (existingResult) {
                existingResult.trades.push(...result.trades);
                existingResult.setupDetections.push(...(result.setupDetections ?? []));
              } else {
                allResults.set(backtestKey, {
                  trades: result.trades,
                  setupDetections: result.setupDetections ?? [],
                  klines: result.klines ?? [],
                });
              }

              totalSetups += result.setupDetections?.length ?? 0;
              totalTrades += result.trades.length;

              spinner.succeed(
                chalk.green(
                  `${key}: ${result.trades.length} trades, ${result.setupDetections?.length ?? 0} setups`
                )
              );
            } else {
              spinner.warn(
                chalk.yellow(`${key}: Only ${result.trades.length} trades (min: ${minTrades})`)
              );
            }
          } catch (error) {
            spinner.fail(
              chalk.red(`${key}: ${error instanceof Error ? error.message : 'Unknown error'}`)
            );
          }
        }
      }
    }

    console.log(chalk.cyan(`\nBuilding dataset from ${allResults.size} symbol/interval combinations...`));
    console.log(chalk.gray(`Total setups: ${totalSetups}, Total trades: ${totalTrades}`));

    const backtestResultsMap = new Map<
      string,
      { trades: CollectedResult['trades']; setupDetections: TradingSetup[] }
    >();
    const klinesMap = new Map<string, Kline[]>();

    for (const [key, result] of allResults) {
      backtestResultsMap.set(key, {
        trades: result.trades,
        setupDetections: result.setupDetections,
      });
      klinesMap.set(key, result.klines);
    }

    const dataset = datasetBuilder.buildFromBacktests(backtestResultsMap, klinesMap);

    if (dataset.features.length === 0) {
      throw new Error('No training samples generated. Check if strategies are producing valid setups with outcomes.');
    }

    console.log(chalk.cyan('\nDataset Statistics:'));
    console.log(chalk.gray(`  Total samples: ${dataset.metadata.totalSamples}`));
    console.log(chalk.gray(`  Positive (wins): ${dataset.metadata.positiveCount}`));
    console.log(chalk.gray(`  Negative (losses): ${dataset.metadata.negativeCount}`));
    console.log(
      chalk.gray(
        `  Win rate: ${((dataset.metadata.positiveCount / dataset.metadata.totalSamples) * 100).toFixed(2)}%`
      )
    );
    console.log(chalk.gray(`  Features: ${dataset.featureNames.length}`));

    console.log(chalk.cyan('\nSymbol Distribution:'));
    for (const [symbol, count] of Object.entries(dataset.metadata.symbolDistribution)) {
      console.log(chalk.gray(`  ${symbol}: ${count} samples`));
    }

    console.log(chalk.cyan('\nSetup Type Distribution:'));
    for (const [type, count] of Object.entries(dataset.metadata.setupTypeDistribution)) {
      console.log(chalk.gray(`  ${type}: ${count} samples`));
    }

    const outputDir = dirname(resolve(options.output));
    await mkdir(outputDir, { recursive: true });

    const csvContent = datasetBuilder.toCSV(dataset);
    await writeFile(options.output, csvContent, 'utf-8');

    const jsonOutput = options.output.replace('.csv', '.json');
    const jsonContent = JSON.stringify(datasetBuilder.toJSON(dataset), null, 2);
    await writeFile(jsonOutput, jsonContent, 'utf-8');

    const configOutput = options.output.replace('.csv', '-config.json');
    const configContent = JSON.stringify(
      {
        model_type: 'xgboost',
        version: '1.0.0',
        feature_names: dataset.featureNames,
        n_estimators: 500,
        max_depth: 6,
        learning_rate: 0.1,
        subsample: 0.8,
        colsample_bytree: 0.8,
        cv_splits: 5,
        dataset_info: {
          total_samples: dataset.metadata.totalSamples,
          positive_count: dataset.metadata.positiveCount,
          negative_count: dataset.metadata.negativeCount,
          feature_count: dataset.featureNames.length,
          symbols: symbols,
          intervals: intervals,
          strategies: strategies,
          date_range: { start: options.start, end: options.end },
        },
      },
      null,
      2
    );
    await writeFile(configOutput, configContent, 'utf-8');

    console.log(chalk.green('\n✓ Training data generated successfully!'));
    console.log(chalk.gray(`  CSV: ${options.output}`));
    console.log(chalk.gray(`  JSON: ${jsonOutput}`));
    console.log(chalk.gray(`  Config: ${configOutput}`));

    console.log(chalk.cyan('\nNext steps:'));
    console.log(chalk.gray('  1. cd packages/ml'));
    console.log(chalk.gray('  2. pip install xgboost lightgbm scikit-learn onnx skl2onnx pandas numpy'));
    console.log(
      chalk.gray(
        `  3. python scripts/train_setup_classifier.py --config ${configOutput} --data ${options.output} --output models/setup-classifier-v1.onnx`
      )
    );
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Generation failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}
