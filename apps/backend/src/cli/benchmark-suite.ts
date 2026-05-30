import { BacktestEngine } from '../services/backtesting/BacktestEngine';

interface BenchmarkResult {
  strategy: string;
  winRate: number;
  profitFactor: number;
  sharpeRatio: number;
  totalPnl: number;
  trades: number;
  maxDrawdown: number;
}

interface Benchmark {
  name: string;
  expectedWinRate: number;
  expectedPF: number;
  source: string;
}

const BENCHMARKS: Record<string, Benchmark> = {
  'connors-rsi2-original': {
    name: 'Connors RSI2',
    expectedWinRate: 75,
    expectedPF: 2.08,
    source: 'QuantifiedStrategies.com (S&P 500)',
  },
  'ema-crossover': {
    name: 'EMA Crossover',
    expectedWinRate: 50,
    expectedPF: 2.0,
    source: 'Grayscale Research (BTC)',
  },
  'nr7-breakout': {
    name: 'NR7 Breakout',
    expectedWinRate: 57,
    expectedPF: 2.35,
    source: 'QuantifiedStrategies.com (S&P 500)',
  },
  'williams-r-reversal': {
    name: 'Williams %R',
    expectedWinRate: 81,
    expectedPF: 2.0,
    source: 'QuantifiedStrategies.com (S&P 500)',
  },
  'ibs-mean-reversion': {
    name: 'IBS Mean Reversion',
    expectedWinRate: 65,
    expectedPF: 1.5,
    source: 'Research (general)',
  },
};

async function runBenchmark(
  strategy: string,
  symbol: string,
  interval: string,
  startDate: Date,
  endDate: Date
): Promise<BenchmarkResult | null> {
  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      symbol,
      interval: interval,
      startDate: startDate.toISOString().split('T')[0] as string,
      endDate: endDate.toISOString().split('T')[0] as string,
      initialCapital: 1000,
      setupTypes: [strategy],
    });

    return {
      strategy,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      sharpeRatio: result.metrics.sharpeRatio ?? 0,
      totalPnl: result.metrics.totalPnl,
      trades: result.metrics.totalTrades,
      maxDrawdown: result.metrics.maxDrawdownPercent,
    };
  } catch (error) {
    console.error(`Error running ${strategy}:`, error);
    return null;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║              BENCHMARK SUITE - MarketMind Backtesting                  ║');
  console.log('║              Validation Against Industry Benchmarks                    ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const symbol = 'BTCUSDT';
  const interval = '1d';
  const startDate = new Date('2020-01-01');
  const endDate = new Date('2024-10-01');

  console.log(`Configuration:`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  Interval: ${interval}`);
  console.log(`  Period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
  console.log(`  Capital: $1,000\n`);

  const strategies = Object.keys(BENCHMARKS);
  const results: BenchmarkResult[] = [];

  for (const strategy of strategies) {
    const benchmarkDef = BENCHMARKS[strategy];
    if (!benchmarkDef) continue;
    console.log(`\n━━━ Testing ${benchmarkDef.name} (${strategy}) ━━━`);
    const result = await runBenchmark(strategy, symbol, interval, startDate, endDate);
    if (result) {
      results.push(result);
      console.log(`  Trades: ${result.trades}`);
      console.log(`  Win Rate: ${result.winRate.toFixed(2)}%`);
      console.log(`  Profit Factor: ${result.profitFactor.toFixed(2)}`);
      console.log(`  Sharpe Ratio: ${result.sharpeRatio.toFixed(2)}`);
      console.log(`  Total PnL: ${result.totalPnl.toFixed(2)} USDT`);
    }
  }

  console.log('\n\n╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║                      COMPARISON WITH BENCHMARKS                        ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  console.log('Tolerances: Win Rate ±5%, Profit Factor ±0.5\n');

  console.log('┌─────────────────────┬───────────┬───────────┬────────────┬───────────┬────────────┐');
  console.log('│ Strategy            │ Trades    │ WR Actual │ WR Expected│ PF Actual │ PF Expected│');
  console.log('├─────────────────────┼───────────┼───────────┼────────────┼───────────┼────────────┤');

  for (const result of results) {
    const bench = BENCHMARKS[result.strategy];
    if (!bench) continue;
    const stratName = bench.name.padEnd(19);
    const trades = result.trades.toString().padStart(9);
    const wrActual = `${result.winRate.toFixed(1)}%`.padStart(9);
    const wrExpected = `${bench.expectedWinRate}%`.padStart(10);
    const pfActual = result.profitFactor.toFixed(2).padStart(9);
    const pfExpected = bench.expectedPF.toFixed(2).padStart(10);

    console.log(`│ ${stratName} │${trades} │${wrActual} │${wrExpected} │${pfActual} │${pfExpected} │`);
  }

  console.log('└─────────────────────┴───────────┴───────────┴────────────┴───────────┴────────────┘');

  console.log('\n\n═══ RESULTS ANALYSIS ═══\n');

  let passedWR = 0;
  let passedPF = 0;

  for (const result of results) {
    const bench = BENCHMARKS[result.strategy];
    if (!bench) continue;
    const wrDiff = Math.abs(result.winRate - bench.expectedWinRate);
    const pfDiff = Math.abs(result.profitFactor - bench.expectedPF);

    const wrStatus = wrDiff <= 5 ? '✓' : '!️';
    const pfStatus = pfDiff <= 0.5 ? '✓' : '!️';

    if (wrDiff <= 5) passedWR++;
    if (pfDiff <= 0.5) passedPF++;

    console.log(`${bench.name}:`);
    console.log(`  ${wrStatus} Win Rate: ${result.winRate.toFixed(1)}% (expected ${bench.expectedWinRate}%, diff ${wrDiff.toFixed(1)}%)`);
    console.log(`  ${pfStatus} Profit Factor: ${result.profitFactor.toFixed(2)} (expected ${bench.expectedPF}, diff ${pfDiff.toFixed(2)})`);
    console.log(`  Source: ${bench.source}`);
    console.log('');
  }

  console.log('\n═══ FINAL SUMMARY ═══\n');
  console.log(`Strategies tested: ${results.length}`);
  console.log(`Win Rate within tolerance: ${passedWR}/${results.length}`);
  console.log(`Profit Factor within tolerance: ${passedPF}/${results.length}`);

  const overallPass = passedWR >= results.length * 0.6 && passedPF >= results.length * 0.6;
  console.log(`\n${overallPass ? '✓ VALIDATION PASSED' : '! SOME BENCHMARKS OUTSIDE TOLERANCE'}`);

  if (overallPass) {
    console.log('\nThe MarketMind backtesting system produces results');
    console.log('consistent with known industry benchmarks.');
  } else {
    console.log('\nSome strategies show significant differences.');
    console.log('This may be due to:');
    console.log('  - Differences in the tested asset (BTCUSDT vs S&P 500)');
    console.log('  - Differences in entry/exit rules');
    console.log('  - Different market conditions');
  }
}

main().catch(console.error);
