import chalk from 'chalk';
// @ts-expect-error - cli-progress doesn't have types
import cliProgress from 'cli-progress';
import type { BacktestConfig, Interval } from '@marketmind/types';
import {
  OPTIMIZED_STRATEGY_CONFIGS,
  getOptimizedConfigsByTier,
  type OptimizedStrategyConfig,
} from '@marketmind/ml';
import { ResultManager } from '../../services/backtesting/ResultManager';
import {
  WalkForwardOptimizer,
  type WalkForwardConfig,
  type ParameterRange,
  type WalkForwardResult,
} from '../../services/backtesting/WalkForwardOptimizer';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import { BacktestLogger, LogLevel } from '../utils/logger';
import { ValidationError } from '../utils/validators';

interface ValidateRobustOptions {
  tier?: string;
  strategy?: string;
  symbol?: string;
  interval?: string;
  start: string;
  end: string;
  capital: string;
  trainingMonths: string;
  testingMonths: string;
  stepMonths: string;
  parallel: string;
  output?: string;
  verbose: boolean;
}

interface RobustnessResult {
  config: OptimizedStrategyConfig;
  walkForwardResult: WalkForwardResult | null;
  error?: string;
  isRobust: boolean;
  degradation: number;
  avgOOSSharpe: number;
  avgOOSWinRate: number;
  avgOOSProfitFactor: number;
  totalOOSTrades: number;
  duration: number;
}

interface RobustnessSummary {
  totalConfigs: number;
  robustConfigs: number;
  nonRobustConfigs: number;
  failedConfigs: number;
  robustnessRate: number;
  results: RobustnessResult[];
  tier1Summary: TierSummary;
  tier2Summary: TierSummary;
  tier3Summary: TierSummary;
  timestamp: string;
}

interface TierSummary {
  total: number;
  robust: number;
  robustnessRate: number;
  avgDegradation: number;
  avgOOSSharpe: number;
}

export async function validateRobustCommand(options: ValidateRobustOptions) {
  const logger = new BacktestLogger(options.verbose ? LogLevel.VERBOSE : LogLevel.INFO);

  try {
    const capital = parseFloat(options.capital);
    const trainingMonths = parseInt(options.trainingMonths);
    const testingMonths = parseInt(options.testingMonths);
    const stepMonths = parseInt(options.stepMonths);

    if (isNaN(capital) || capital <= 0) {
      throw new ValidationError('Capital must be a positive number');
    }

    let configsToValidate: OptimizedStrategyConfig[] = [];

    if (options.tier) {
      const tier = parseInt(options.tier) as 1 | 2 | 3;
      if (![1, 2, 3].includes(tier)) {
        throw new ValidationError('Tier must be 1, 2, or 3');
      }
      configsToValidate = getOptimizedConfigsByTier(tier);
    } else {
      configsToValidate = [...OPTIMIZED_STRATEGY_CONFIGS];
    }

    if (options.strategy) {
      configsToValidate = configsToValidate.filter(
        (c) => c.strategy === options.strategy
      );
    }
    if (options.symbol) {
      configsToValidate = configsToValidate.filter(
        (c) => c.symbol === options.symbol
      );
    }
    if (options.interval) {
      configsToValidate = configsToValidate.filter(
        (c) => c.interval === options.interval
      );
    }

    if (configsToValidate.length === 0) {
      throw new ValidationError('No configurations match the specified filters');
    }

    const tierCounts = {
      1: configsToValidate.filter((c) => c.tier === 1).length,
      2: configsToValidate.filter((c) => c.tier === 2).length,
      3: configsToValidate.filter((c) => c.tier === 3).length,
    };

    logger.header('ROBUSTNESS VALIDATION - WALK-FORWARD ANALYSIS', {
      'Configurations': configsToValidate.length.toString(),
      'Tier 1': tierCounts[1].toString(),
      'Tier 2': tierCounts[2].toString(),
      'Tier 3': tierCounts[3].toString(),
      'Period': `${options.start} → ${options.end}`,
      'Training Window': `${trainingMonths} months`,
      'Testing Window': `${testingMonths} months`,
      'Step': `${stepMonths} months`,
    });

    const wfConfig: WalkForwardConfig = {
      trainingWindowMonths: trainingMonths,
      testingWindowMonths: testingMonths,
      stepMonths: stepMonths,
      minWindowCount: 3,
    };

    const parameterRanges: ParameterRange[] = [
      { name: 'minConfidence', min: 3, max: 10, step: 1 },
    ];

    const results: RobustnessResult[] = [];
    const startTime = Date.now();

    const progressBar = new cliProgress.SingleBar({
      format:
        chalk.cyan('Progress |') +
        chalk.yellow('{bar}') +
        chalk.cyan('| {percentage}% | {value}/{total} | {config} | ETA: {eta}s'),
      barCompleteChar: '\u2588',
      barIncompleteChar: '\u2591',
      hideCursor: true,
    });

    progressBar.start(configsToValidate.length, 0, { config: '' });

    for (let i = 0; i < configsToValidate.length; i++) {
      const config = configsToValidate[i]!;
      const configName = `${config.strategy}/${config.symbol}/${config.interval}`;
      progressBar.update(i, { config: configName });

      const result = await validateSingleConfig(
        config,
        options.start,
        options.end,
        capital,
        wfConfig,
        parameterRanges,
        options.verbose
      );
      results.push(result);

      progressBar.update(i + 1, { config: configName });
    }

    progressBar.stop();

    const totalDuration = (Date.now() - startTime) / 1000;

    console.log('');
    logger.success(`Completed robustness validation in ${totalDuration.toFixed(1)}s`);
    console.log('');

    const summary = generateSummary(results);
    displaySummary(summary, options.verbose);

    const resultManager = new ResultManager();
    const savedPath = await resultManager.saveRobustnessValidation(summary);

    console.log('');
    logger.success(`Results saved to: ${savedPath}`);
    console.log('');

    displayRecommendations(summary);

  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error(`Validation failed: ${error.message}`);
      process.exit(1);
    } else if (error instanceof Error) {
      logger.error(`Robustness validation failed: ${error.message}`);
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }
}

async function validateSingleConfig(
  config: OptimizedStrategyConfig,
  startDate: string,
  endDate: string,
  capital: number,
  wfConfig: WalkForwardConfig,
  parameterRanges: ParameterRange[],
  _verbose: boolean
): Promise<RobustnessResult> {
  const startTime = Date.now();

  try {
    const klines = await fetchHistoricalKlinesFromAPI(
      config.symbol,
      config.interval as Interval,
      new Date(startDate),
      new Date(endDate)
    );

    if (klines.length < 100) {
      return {
        config,
        walkForwardResult: null,
        error: `Insufficient data: ${klines.length} candles`,
        isRobust: false,
        degradation: 1,
        avgOOSSharpe: 0,
        avgOOSWinRate: 0,
        avgOOSProfitFactor: 0,
        totalOOSTrades: 0,
        duration: (Date.now() - startTime) / 1000,
      };
    }

    const baseConfig: BacktestConfig = {
      symbol: config.symbol,
      interval: config.interval,
      startDate,
      endDate,
      initialCapital: capital,
      setupTypes: [config.strategy],
      minConfidence: config.mlThreshold,
      useAlgorithmicLevels: true,
    };

    const wfResult = await WalkForwardOptimizer.run(
      klines,
      baseConfig,
      parameterRanges,
      wfConfig
    );

    return {
      config,
      walkForwardResult: wfResult,
      isRobust: wfResult.isRobust,
      degradation: wfResult.aggregatedMetrics.degradation,
      avgOOSSharpe: wfResult.aggregatedMetrics.avgOutOfSampleSharpe,
      avgOOSWinRate: wfResult.aggregatedMetrics.overallWinRate * 100,
      avgOOSProfitFactor: wfResult.aggregatedMetrics.overallProfitFactor,
      totalOOSTrades: wfResult.aggregatedMetrics.totalTrades,
      duration: (Date.now() - startTime) / 1000,
    };
  } catch (error) {
    return {
      config,
      walkForwardResult: null,
      error: error instanceof Error ? error.message : 'Unknown error',
      isRobust: false,
      degradation: 1,
      avgOOSSharpe: 0,
      avgOOSWinRate: 0,
      avgOOSProfitFactor: 0,
      totalOOSTrades: 0,
      duration: (Date.now() - startTime) / 1000,
    };
  }
}

function generateSummary(results: RobustnessResult[]): RobustnessSummary {
  const robustConfigs = results.filter((r) => r.isRobust && !r.error).length;
  const nonRobustConfigs = results.filter((r) => !r.isRobust && !r.error).length;
  const failedConfigs = results.filter((r) => r.error).length;

  const calculateTierSummary = (tier: 1 | 2 | 3): TierSummary => {
    const tierResults = results.filter((r) => r.config.tier === tier && !r.error);
    const robust = tierResults.filter((r) => r.isRobust).length;

    return {
      total: results.filter((r) => r.config.tier === tier).length,
      robust,
      robustnessRate: tierResults.length > 0 ? (robust / tierResults.length) * 100 : 0,
      avgDegradation:
        tierResults.length > 0
          ? tierResults.reduce((sum, r) => sum + r.degradation, 0) / tierResults.length
          : 0,
      avgOOSSharpe:
        tierResults.length > 0
          ? tierResults.reduce((sum, r) => sum + r.avgOOSSharpe, 0) / tierResults.length
          : 0,
    };
  };

  return {
    totalConfigs: results.length,
    robustConfigs,
    nonRobustConfigs,
    failedConfigs,
    robustnessRate: results.length > 0 ? (robustConfigs / (results.length - failedConfigs)) * 100 : 0,
    results,
    tier1Summary: calculateTierSummary(1),
    tier2Summary: calculateTierSummary(2),
    tier3Summary: calculateTierSummary(3),
    timestamp: new Date().toISOString(),
  };
}

function displaySummary(summary: RobustnessSummary, _verbose: boolean) {
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('                    ROBUSTNESS VALIDATION SUMMARY              '));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log('');

  console.log(chalk.white.bold('Overall Results:'));
  console.log(chalk.gray(`  Total Configurations: ${summary.totalConfigs}`));
  console.log(chalk.green(`  Robust (≤30% degradation): ${summary.robustConfigs}`));
  console.log(chalk.red(`  Not Robust (>30% degradation): ${summary.nonRobustConfigs}`));
  console.log(chalk.yellow(`  Failed/Insufficient Data: ${summary.failedConfigs}`));
  console.log(
    summary.robustnessRate >= 50
      ? chalk.green(`  Robustness Rate: ${summary.robustnessRate.toFixed(1)}%`)
      : chalk.red(`  Robustness Rate: ${summary.robustnessRate.toFixed(1)}%`)
  );
  console.log('');

  console.log(chalk.white.bold('By Tier:'));
  displayTierSummary('Tier 1 (Sharpe > 5)', summary.tier1Summary);
  displayTierSummary('Tier 2 (Sharpe 2-5)', summary.tier2Summary);
  displayTierSummary('Tier 3 (Sharpe 1-2)', summary.tier3Summary);

  console.log('');
  console.log(chalk.cyan.bold('───────────────────────────────────────────────────────────────'));
  console.log(chalk.white.bold('Individual Results:'));
  console.log('');

  const sortedResults = [...summary.results].sort((a, b) => {
    if (a.config.tier !== b.config.tier) return a.config.tier - b.config.tier;
    return a.degradation - b.degradation;
  });

  console.log(
    chalk.gray(
      '  Strategy                           Symbol    TF    Tier  Deg%   OOS Sharpe  Robust'
    )
  );
  console.log(chalk.gray('  ' + '─'.repeat(90)));

  for (const result of sortedResults) {
    const strategy = result.config.strategy.padEnd(35);
    const symbol = result.config.symbol.padEnd(10);
    const interval = result.config.interval.padEnd(6);
    const tier = `T${result.config.tier}`.padEnd(6);
    const degradation = result.error
      ? chalk.yellow('N/A'.padStart(6))
      : result.degradation <= 0.3
        ? chalk.green(`${(result.degradation * 100).toFixed(1)}%`.padStart(6))
        : chalk.red(`${(result.degradation * 100).toFixed(1)}%`.padStart(6));
    const oosSharpe = result.error
      ? chalk.yellow('N/A'.padStart(12))
      : chalk.white(result.avgOOSSharpe.toFixed(2).padStart(12));
    const robust = result.error
      ? chalk.yellow('ERR')
      : result.isRobust
        ? chalk.green('✓ YES')
        : chalk.red('✗ NO');

    console.log(`  ${strategy}${symbol}${interval}${tier}${degradation}${oosSharpe}  ${robust}`);
  }

  if (_verbose) {
    console.log('');
    console.log(chalk.cyan.bold('───────────────────────────────────────────────────────────────'));
    console.log(chalk.white.bold('Detailed Window Analysis:'));
    console.log('');

    for (const result of sortedResults) {
      if (!result.walkForwardResult) continue;

      console.log(
        chalk.white.bold(
          `${result.config.strategy} / ${result.config.symbol} / ${result.config.interval}`
        )
      );

      for (const window of result.walkForwardResult.windows) {
        const trainStart = new Date(window.trainingStart).toISOString().split('T')[0];
        const trainEnd = new Date(window.trainingEnd).toISOString().split('T')[0];
        const testStart = new Date(window.testingStart).toISOString().split('T')[0];
        const testEnd = new Date(window.testingEnd).toISOString().split('T')[0];
        const inSample = window.optimizationResult?.sharpeRatio ?? 0;
        const outSample = window.testResult?.metrics.sharpeRatio ?? 0;

        console.log(
          chalk.gray(
            `  Window ${window.windowIndex + 1}: Train ${trainStart}→${trainEnd} | ` +
              `Test ${testStart}→${testEnd} | IS: ${inSample.toFixed(2)} → OOS: ${outSample.toFixed(2)}`
          )
        );
      }
      console.log('');
    }
  }
}

function displayTierSummary(name: string, summary: TierSummary) {
  const color = summary.robustnessRate >= 50 ? chalk.green : chalk.yellow;
  console.log(
    chalk.gray(
      `  ${name}: ${summary.robust}/${summary.total} robust (${color(summary.robustnessRate.toFixed(1) + '%')}) | ` +
        `Avg Degradation: ${(summary.avgDegradation * 100).toFixed(1)}% | ` +
        `Avg OOS Sharpe: ${summary.avgOOSSharpe.toFixed(2)}`
    )
  );
}

function displayRecommendations(summary: RobustnessSummary) {
  console.log('');
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('                         RECOMMENDATIONS                        '));
  console.log(chalk.cyan.bold('═══════════════════════════════════════════════════════════════'));
  console.log('');

  const robustTier1 = summary.results.filter(
    (r) => r.config.tier === 1 && r.isRobust && !r.error
  );
  const robustTier2 = summary.results.filter(
    (r) => r.config.tier === 2 && r.isRobust && !r.error
  );

  if (robustTier1.length > 0) {
    console.log(chalk.green.bold('✓ RECOMMENDED FOR LIVE TRADING (Tier 1 + Robust):'));
    for (const r of robustTier1.sort((a, b) => a.degradation - b.degradation)) {
      console.log(
        chalk.white(
          `  • ${r.config.strategy} / ${r.config.symbol} / ${r.config.interval} ` +
            `(Deg: ${(r.degradation * 100).toFixed(1)}%, OOS Sharpe: ${r.avgOOSSharpe.toFixed(2)})`
        )
      );
    }
    console.log('');
  }

  if (robustTier2.length > 0) {
    console.log(chalk.yellow.bold('⚠ CONSIDER WITH CAUTION (Tier 2 + Robust):'));
    for (const r of robustTier2.sort((a, b) => a.degradation - b.degradation).slice(0, 5)) {
      console.log(
        chalk.white(
          `  • ${r.config.strategy} / ${r.config.symbol} / ${r.config.interval} ` +
            `(Deg: ${(r.degradation * 100).toFixed(1)}%, OOS Sharpe: ${r.avgOOSSharpe.toFixed(2)})`
        )
      );
    }
    console.log('');
  }

  const overfit = summary.results
    .filter((r) => !r.isRobust && !r.error)
    .sort((a, b) => b.degradation - a.degradation);

  if (overfit.length > 0) {
    console.log(chalk.red.bold('✗ NOT RECOMMENDED (Likely Overfit):'));
    for (const r of overfit.slice(0, 5)) {
      console.log(
        chalk.gray(
          `  • ${r.config.strategy} / ${r.config.symbol} / ${r.config.interval} ` +
            `(Deg: ${(r.degradation * 100).toFixed(1)}%)`
        )
      );
    }
    console.log('');
  }

  console.log(chalk.cyan.bold('───────────────────────────────────────────────────────────────'));
  console.log(chalk.white.bold('Interpretation Guide:'));
  console.log(chalk.gray('  • Degradation ≤15%: Excellent stability, minimal overfitting'));
  console.log(chalk.gray('  • Degradation 15-30%: Acceptable, strategy is robust'));
  console.log(chalk.gray('  • Degradation >30%: High overfitting risk, not recommended'));
  console.log(chalk.gray('  • OOS Sharpe >2: Strong out-of-sample performance'));
  console.log(chalk.gray('  • OOS Sharpe 1-2: Moderate out-of-sample performance'));
  console.log(chalk.gray('  • OOS Sharpe <1: Weak out-of-sample performance'));
  console.log('');
}
