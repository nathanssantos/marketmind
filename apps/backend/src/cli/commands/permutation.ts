import chalk from 'chalk';
import {
  OPTIMIZED_STRATEGY_CONFIGS,
  getOptimizedConfigsByTier,
  type OptimizedStrategyConfig,
} from '@marketmind/ml';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { PermutationTest, type PermutationTestResult } from '../../services/backtesting/PermutationTest';
import { ResultManager } from '../../services/backtesting/ResultManager';
import { fetchHistoricalKlinesFromAPI } from '../../services/binance-historical';
import type { BacktestConfig, Interval } from '@marketmind/types';

interface PermutationTestOptions {
  tier?: string;
  strategy?: string;
  symbol?: string;
  interval?: string;
  start: string;
  end: string;
  capital: string;
  permutations: string;
  confidence: string;
  output?: string;
  verbose: boolean;
}

interface ConfigResult {
  config: OptimizedStrategyConfig;
  permutationResults: Record<string, PermutationTestResult>;
  trades: number;
  error?: string;
}

interface PermutationSummary {
  totalConfigs: number;
  significantConfigs: number;
  nonSignificantConfigs: number;
  failedConfigs: number;
  significanceRate: number;
  results: ConfigResult[];
  tierBreakdown: Record<number, { total: number; significant: number; rate: number }>;
}

export async function permutationCommand(options: PermutationTestOptions): Promise<void> {
  const {
    tier,
    strategy,
    symbol,
    interval,
    start,
    end,
    capital,
    permutations,
    confidence,
    output,
    verbose,
  } = options;

  const initialCapital = parseFloat(capital);
  const numPermutations = parseInt(permutations, 10);
  const confidenceLevel = parseFloat(confidence);

  let configs: OptimizedStrategyConfig[] = [...OPTIMIZED_STRATEGY_CONFIGS];

  if (tier) {
    const tierNum = parseInt(tier, 10) as 1 | 2 | 3;
    configs = getOptimizedConfigsByTier(tierNum);
  }

  if (strategy) {
    configs = configs.filter((c) => c.strategy === strategy);
  }

  if (symbol) {
    configs = configs.filter((c) => c.symbol === symbol);
  }

  if (interval) {
    configs = configs.filter((c) => c.interval === interval);
  }

  if (configs.length === 0) {
    console.log(chalk.yellow('No configurations found matching the filters.'));
    return;
  }

  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║       MONTE CARLO PERMUTATION TEST - STATISTICAL SIGNIFICANCE   ║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan(`║ Configurations: ${configs.length.toString().padEnd(46)}║`));
  console.log(chalk.cyan(`║ Tier 1: ${configs.filter((c) => c.tier === 1).length.toString().padEnd(54)}║`));
  console.log(chalk.cyan(`║ Tier 2: ${configs.filter((c) => c.tier === 2).length.toString().padEnd(54)}║`));
  console.log(chalk.cyan(`║ Tier 3: ${configs.filter((c) => c.tier === 3).length.toString().padEnd(54)}║`));
  console.log(chalk.cyan(`║ Period: ${start} → ${end}`.padEnd(65) + '║'));
  console.log(chalk.cyan(`║ Permutations: ${numPermutations}`.padEnd(65) + '║'));
  console.log(chalk.cyan(`║ Confidence Level: ${(confidenceLevel * 100).toFixed(0)}%`.padEnd(65) + '║'));
  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝\n'));

  const resultManager = new ResultManager();
  const results: ConfigResult[] = [];
  const tierBreakdown: Record<number, { total: number; significant: number; rate: number }> = {
    1: { total: 0, significant: 0, rate: 0 },
    2: { total: 0, significant: 0, rate: 0 },
    3: { total: 0, significant: 0, rate: 0 },
  };

  for (let i = 0; i < configs.length; i++) {
    const config = configs[i];
    if (!config) continue;

    const configStr = `${config.strategy}/${config.symbol}/${config.interval}`;
    process.stdout.write(
      chalk.gray(`[${i + 1}/${configs.length}] Testing ${configStr}... `)
    );

    try {
      const klines = await fetchHistoricalKlinesFromAPI(
        config.symbol,
        config.interval as Interval,
        new Date(start),
        new Date(end)
      );

      const backtestConfig: BacktestConfig = {
        symbol: config.symbol,
        interval: config.interval as Interval,
        startDate: start,
        endDate: end,
        initialCapital,
        setupTypes: [config.strategy],
        minConfidence: config.mlThreshold,
        useAlgorithmicLevels: true,
        commission: 0.001,
      };

      const engine = new BacktestEngine();
      const backtestResult = await engine.run(backtestConfig, klines);

      if (backtestResult.status === 'FAILED' || backtestResult.trades.length < 10) {
        throw new Error(
          backtestResult.status === 'FAILED'
            ? 'Backtest failed'
            : `Insufficient trades (${backtestResult.trades.length})`
        );
      }

      const permutationResults = PermutationTest.runMultipleMetrics(
        backtestResult.trades,
        initialCapital,
        numPermutations,
        confidenceLevel
      );

      const sharpeResult = permutationResults['sharpe'];
      const isSignificant = sharpeResult?.isSignificant ?? false;
      const pValue = sharpeResult?.pValue ?? 1;
      const percentile = sharpeResult?.percentile ?? 0;

      const tier = config.tier;
      if (tierBreakdown[tier]) {
        tierBreakdown[tier].total++;
        if (isSignificant) {
          tierBreakdown[tier].significant++;
        }
      }

      const status = isSignificant ? chalk.green('✓ SIGNIFICANT') : chalk.red('✗ NOT SIGNIFICANT');
      console.log(
        `${status} | p=${pValue.toFixed(3)} | ${percentile.toFixed(1)}th percentile | ${backtestResult.trades.length} trades`
      );

      if (verbose && sharpeResult) {
        console.log(
          chalk.gray(
            `    Actual Sharpe: ${sharpeResult.actualMetric.toFixed(2)} | ` +
              `Permuted Mean: ${sharpeResult.statistics.mean.toFixed(2)} ± ${sharpeResult.statistics.stdDev.toFixed(2)}`
          )
        );
        const returnResult = permutationResults['totalReturn'];
        const pfResult = permutationResults['profitFactor'];
        if (returnResult && pfResult) {
          console.log(
            chalk.gray(
              `    Return: ${returnResult.isSignificant ? '✓' : '✗'} (p=${returnResult.pValue.toFixed(3)}) | ` +
                `PF: ${pfResult.isSignificant ? '✓' : '✗'} (p=${pfResult.pValue.toFixed(3)})`
            )
          );
        }
      }

      results.push({
        config,
        permutationResults,
        trades: backtestResult.trades.length,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.log(chalk.yellow(`⚠ SKIPPED: ${errorMsg}`));
      results.push({
        config,
        permutationResults: {},
        trades: 0,
        error: errorMsg,
      });
    }
  }

  for (const tier of [1, 2, 3]) {
    const data = tierBreakdown[tier];
    if (data && data.total > 0) {
      data.rate = (data.significant / data.total) * 100;
    }
  }

  const successfulResults = results.filter((r) => !r.error);
  const significantResults = successfulResults.filter(
    (r) => r.permutationResults['sharpe']?.isSignificant
  );

  const summary: PermutationSummary = {
    totalConfigs: configs.length,
    significantConfigs: significantResults.length,
    nonSignificantConfigs: successfulResults.length - significantResults.length,
    failedConfigs: results.filter((r) => r.error).length,
    significanceRate: (significantResults.length / Math.max(successfulResults.length, 1)) * 100,
    results,
    tierBreakdown,
  };

  console.log(chalk.cyan.bold('\n╔════════════════════════════════════════════════════════════════╗'));
  console.log(chalk.cyan.bold('║                    PERMUTATION TEST SUMMARY                     ║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan(`║ Total Configurations: ${summary.totalConfigs.toString().padEnd(41)}║`));
  console.log(chalk.green(`║ Statistically Significant: ${summary.significantConfigs.toString().padEnd(36)}║`));
  console.log(chalk.red(`║ Not Significant: ${summary.nonSignificantConfigs.toString().padEnd(46)}║`));
  console.log(chalk.yellow(`║ Failed/Skipped: ${summary.failedConfigs.toString().padEnd(47)}║`));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan(`║ Significance Rate: ${summary.significanceRate.toFixed(1)}%`.padEnd(65) + '║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════════╣'));
  console.log(chalk.cyan.bold('║                        TIER BREAKDOWN                           ║'));
  console.log(chalk.cyan.bold('╠════════════════════════════════════════════════════════════════╣'));

  for (const tier of [1, 2, 3]) {
    const data = tierBreakdown[tier];
    if (data && data.total > 0) {
      console.log(
        chalk.cyan(
          `║ Tier ${tier}: ${data.significant}/${data.total} significant (${data.rate.toFixed(1)}%)`.padEnd(65) + '║'
        )
      );
    }
  }

  console.log(chalk.cyan.bold('╚════════════════════════════════════════════════════════════════╝'));

  if (significantResults.length > 0) {
    console.log(chalk.green.bold('\n✓ SIGNIFICANT STRATEGIES (p < 0.05):'));
    for (const r of significantResults) {
      const sharpeResult = r.permutationResults['sharpe'];
      if (sharpeResult) {
        console.log(
          chalk.green(
            `  • ${r.config.strategy}/${r.config.symbol}/${r.config.interval} ` +
              `(Sharpe: ${sharpeResult.actualMetric.toFixed(2)}, p=${sharpeResult.pValue.toFixed(3)}, ${sharpeResult.percentile.toFixed(1)}th percentile)`
          )
        );
      }
    }
  }

  const notSignificant = successfulResults.filter(
    (r) => !r.permutationResults['sharpe']?.isSignificant
  );
  if (notSignificant.length > 0) {
    console.log(chalk.red.bold('\n✗ NOT SIGNIFICANT (may be random):'));
    for (const r of notSignificant) {
      const sharpeResult = r.permutationResults['sharpe'];
      if (sharpeResult) {
        console.log(
          chalk.red(
            `  • ${r.config.strategy}/${r.config.symbol}/${r.config.interval} ` +
              `(p=${sharpeResult.pValue.toFixed(3)})`
          )
        );
      }
    }
  }

  if (output) {
    const summaryForSave = {
      timestamp: new Date().toISOString(),
      period: { start, end },
      config: { permutations: numPermutations, confidenceLevel },
      summary: {
        totalConfigs: summary.totalConfigs,
        significantConfigs: summary.significantConfigs,
        nonSignificantConfigs: summary.nonSignificantConfigs,
        failedConfigs: summary.failedConfigs,
        significanceRate: summary.significanceRate,
        tierBreakdown: summary.tierBreakdown,
      },
      results: summary.results.map((r) => ({
        strategy: r.config.strategy,
        symbol: r.config.symbol,
        interval: r.config.interval,
        tier: r.config.tier,
        trades: r.trades,
        error: r.error,
        sharpe: r.permutationResults['sharpe']
          ? {
              actual: r.permutationResults['sharpe'].actualMetric,
              pValue: r.permutationResults['sharpe'].pValue,
              percentile: r.permutationResults['sharpe'].percentile,
              isSignificant: r.permutationResults['sharpe'].isSignificant,
            }
          : null,
        totalReturn: r.permutationResults['totalReturn']
          ? {
              actual: r.permutationResults['totalReturn'].actualMetric,
              pValue: r.permutationResults['totalReturn'].pValue,
              isSignificant: r.permutationResults['totalReturn'].isSignificant,
            }
          : null,
        profitFactor: r.permutationResults['profitFactor']
          ? {
              actual: r.permutationResults['profitFactor'].actualMetric,
              pValue: r.permutationResults['profitFactor'].pValue,
              isSignificant: r.permutationResults['profitFactor'].isSignificant,
            }
          : null,
      })),
    };

    await resultManager.saveRobustnessValidation(summaryForSave);
    console.log(chalk.gray(`\nResults saved to: ${output}`));
  }
}
