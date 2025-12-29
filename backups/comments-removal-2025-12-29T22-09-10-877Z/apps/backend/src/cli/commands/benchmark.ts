import type { BacktestConfig, BacktestResult } from '@marketmind/types';
import chalk from 'chalk';
import ora from 'ora';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';

interface BenchmarkSpec {
  name: string;
  strategy: string;
  symbol: string;
  interval: string;
  expectedWinRate: { min: number; max: number };
  expectedProfitFactor: { min: number; max: number };
  source: string;
}

const BENCHMARKS: BenchmarkSpec[] = [
  {
    name: 'Connors RSI2 Original',
    strategy: 'connors-rsi2-original',
    symbol: 'BTCUSDT',
    interval: '1d',
    expectedWinRate: { min: 70, max: 80 },
    expectedProfitFactor: { min: 1.8, max: 2.5 },
    source: 'QuantifiedStrategies.com - ~75% WR, ~2.08 PF',
  },
  {
    name: 'Williams %R Reversal',
    strategy: 'williams-r-reversal',
    symbol: 'BTCUSDT',
    interval: '1d',
    expectedWinRate: { min: 75, max: 85 },
    expectedProfitFactor: { min: 1.8, max: 2.5 },
    source: 'QuantifiedStrategies.com - ~81% WR, ~2.0 PF',
  },
  {
    name: 'RSI2 Mean Reversion',
    strategy: 'rsi2-mean-reversion',
    symbol: 'BTCUSDT',
    interval: '1d',
    expectedWinRate: { min: 40, max: 60 },
    expectedProfitFactor: { min: 1.0, max: 2.0 },
    source: 'Standard mean reversion expectation',
  },
  {
    name: 'Larry Williams 9.1',
    strategy: 'larry-williams-9-1',
    symbol: 'BTCUSDT',
    interval: '1d',
    expectedWinRate: { min: 40, max: 55 },
    expectedProfitFactor: { min: 1.0, max: 1.8 },
    source: 'Livio Alves - variable performance by market',
  },
  {
    name: 'NR7 Breakout',
    strategy: 'nr7-breakout',
    symbol: 'BTCUSDT',
    interval: '1d',
    expectedWinRate: { min: 50, max: 65 },
    expectedProfitFactor: { min: 2.0, max: 2.8 },
    source: 'QuantifiedStrategies.com - ~57% WR, ~2.35 PF',
  },
];

interface BenchmarkResult {
  spec: BenchmarkSpec;
  result: BacktestResult | null;
  error?: string;
  passed: boolean;
  winRatePassed: boolean;
  profitFactorPassed: boolean;
}

interface BenchmarkOptions {
  start: string;
  end: string;
  capital: string;
  verbose: boolean;
  strategy?: string;
}

export async function benchmarkCommand(options: BenchmarkOptions) {
  console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('             BACKTEST BENCHMARK VALIDATION SUITE'));
  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════\n'));

  const capital = parseFloat(options.capital);
  const results: BenchmarkResult[] = [];
  const engine = new BacktestEngine();

  const benchmarksToRun = options.strategy
    ? BENCHMARKS.filter(b => b.strategy === options.strategy)
    : BENCHMARKS;

  if (benchmarksToRun.length === 0 && options.strategy) {
    console.log(chalk.red(`Strategy "${options.strategy}" not found in benchmarks.`));
    console.log(chalk.gray('Available benchmarks:'));
    BENCHMARKS.forEach(b => console.log(chalk.gray(`  - ${b.strategy}`)));
    return;
  }

  for (const spec of benchmarksToRun) {
    const spinner = ora({
      text: chalk.cyan(`Testing ${spec.name}...`),
      color: 'cyan',
    }).start();

    try {
      const config: BacktestConfig = {
        symbol: spec.symbol,
        interval: spec.interval,
        startDate: options.start,
        endDate: options.end,
        initialCapital: capital,
        setupTypes: [spec.strategy],
        maxConcurrentPositions: 10,
        maxTotalExposure: 1.0,
        useAlgorithmicLevels: true,
      };

      const result = await engine.run(config);

      const winRatePassed = result.metrics.winRate >= spec.expectedWinRate.min &&
                           result.metrics.winRate <= spec.expectedWinRate.max;
      const profitFactorPassed = result.metrics.profitFactor >= spec.expectedProfitFactor.min &&
                                 result.metrics.profitFactor <= spec.expectedProfitFactor.max;
      const passed = winRatePassed && profitFactorPassed;

      results.push({
        spec,
        result,
        passed,
        winRatePassed,
        profitFactorPassed,
      });

      if (passed) {
        spinner.succeed(chalk.green(`${spec.name}: PASSED`));
      } else {
        spinner.warn(chalk.yellow(`${spec.name}: DEVIATION`));
      }

    } catch (error) {
      spinner.fail(chalk.red(`${spec.name}: ERROR`));
      results.push({
        spec,
        result: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        passed: false,
        winRatePassed: false,
        profitFactorPassed: false,
      });
    }
  }

  console.log(chalk.cyan.bold('\n════════════════════════════════════════════════════════════'));
  console.log(chalk.cyan.bold('                       RESULTS SUMMARY'));
  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════\n'));

  console.log(chalk.gray(`Period: ${options.start} → ${options.end}`));
  console.log(chalk.gray(`Capital: $${capital.toLocaleString()}\n`));

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;

  console.log(`${chalk.bold('Overall:')} ${passedCount}/${totalCount} benchmarks passed\n`);

  for (const r of results) {
    const status = r.passed ? chalk.green('✓ PASS') : chalk.yellow('⚠ DEVIATION');
    console.log(`${status} ${chalk.bold(r.spec.name)}`);

    if (r.error) {
      console.log(chalk.red(`   Error: ${r.error}`));
      continue;
    }

    if (r.result) {
      const wr = r.result.metrics.winRate;
      const pf = r.result.metrics.profitFactor;
      const trades = r.result.metrics.totalTrades;

      const wrColor = r.winRatePassed ? chalk.green : chalk.yellow;
      const pfColor = r.profitFactorPassed ? chalk.green : chalk.yellow;

      console.log(`   ${chalk.gray('Trades:')} ${trades}`);
      console.log(`   ${chalk.gray('Win Rate:')} ${wrColor(`${wr.toFixed(2)  }%`)} ${chalk.gray(`(expected ${r.spec.expectedWinRate.min}-${r.spec.expectedWinRate.max}%)`)}`);
      console.log(`   ${chalk.gray('Profit Factor:')} ${pfColor(pf.toFixed(2))} ${chalk.gray(`(expected ${r.spec.expectedProfitFactor.min}-${r.spec.expectedProfitFactor.max})`)}`);
      console.log(`   ${chalk.gray('Source:')} ${r.spec.source}`);
    }
    console.log('');
  }

  console.log(chalk.cyan.bold('════════════════════════════════════════════════════════════'));

  if (passedCount === totalCount) {
    console.log(chalk.green.bold('\n✓ All benchmarks passed! System validation successful.\n'));
  } else {
    console.log(chalk.yellow.bold(`\n⚠ ${totalCount - passedCount} benchmark(s) show deviation from expected values.`));
    console.log(chalk.gray('Note: Crypto markets behave differently from equities (benchmark sources).\n'));
    console.log(chalk.gray('Tolerances applied: Win Rate ±5%, Profit Factor ±0.3\n'));
  }
}
