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
      interval: interval as any,
      startDate,
      endDate,
      initialCapital: 1000,
      strategies: [],
      riskPerTrade: 0.02,
      dynamicStrategies: [strategy],
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

function formatComparison(actual: number, expected: number, tolerance: number): string {
  const diff = actual - expected;
  const within = Math.abs(diff) <= tolerance;
  const sign = diff >= 0 ? '+' : '';
  return within ? `✅ ${sign}${diff.toFixed(2)}` : `❌ ${sign}${diff.toFixed(2)}`;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════════╗');
  console.log('║              BENCHMARK SUITE - MarketMind Backtesting                  ║');
  console.log('║              Validação contra Benchmarks da Indústria                  ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  const symbol = 'BTCUSDT';
  const interval = '1d';
  const startDate = new Date('2020-01-01');
  const endDate = new Date('2024-10-01');

  console.log(`Configuração:`);
  console.log(`  Symbol: ${symbol}`);
  console.log(`  Interval: ${interval}`);
  console.log(`  Period: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
  console.log(`  Capital: $1,000\n`);

  const strategies = Object.keys(BENCHMARKS);
  const results: BenchmarkResult[] = [];

  for (const strategy of strategies) {
    console.log(`\n━━━ Testing ${BENCHMARKS[strategy].name} (${strategy}) ━━━`);
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
  console.log('║                      COMPARAÇÃO COM BENCHMARKS                         ║');
  console.log('╚════════════════════════════════════════════════════════════════════════╝\n');

  console.log('Tolerâncias: Win Rate ±5%, Profit Factor ±0.5\n');

  console.log('┌─────────────────────┬───────────┬───────────┬────────────┬───────────┬────────────┐');
  console.log('│ Strategy            │ Trades    │ WR Actual │ WR Expected│ PF Actual │ PF Expected│');
  console.log('├─────────────────────┼───────────┼───────────┼────────────┼───────────┼────────────┤');

  for (const result of results) {
    const bench = BENCHMARKS[result.strategy];
    const stratName = bench.name.padEnd(19);
    const trades = result.trades.toString().padStart(9);
    const wrActual = `${result.winRate.toFixed(1)}%`.padStart(9);
    const wrExpected = `${bench.expectedWinRate}%`.padStart(10);
    const pfActual = result.profitFactor.toFixed(2).padStart(9);
    const pfExpected = bench.expectedPF.toFixed(2).padStart(10);

    console.log(`│ ${stratName} │${trades} │${wrActual} │${wrExpected} │${pfActual} │${pfExpected} │`);
  }

  console.log('└─────────────────────┴───────────┴───────────┴────────────┴───────────┴────────────┘');

  console.log('\n\n═══ ANÁLISE DE RESULTADOS ═══\n');

  let passedWR = 0;
  let passedPF = 0;

  for (const result of results) {
    const bench = BENCHMARKS[result.strategy];
    const wrDiff = Math.abs(result.winRate - bench.expectedWinRate);
    const pfDiff = Math.abs(result.profitFactor - bench.expectedPF);

    const wrStatus = wrDiff <= 5 ? '✅' : '⚠️';
    const pfStatus = pfDiff <= 0.5 ? '✅' : '⚠️';

    if (wrDiff <= 5) passedWR++;
    if (pfDiff <= 0.5) passedPF++;

    console.log(`${bench.name}:`);
    console.log(`  ${wrStatus} Win Rate: ${result.winRate.toFixed(1)}% (expected ${bench.expectedWinRate}%, diff ${wrDiff.toFixed(1)}%)`);
    console.log(`  ${pfStatus} Profit Factor: ${result.profitFactor.toFixed(2)} (expected ${bench.expectedPF}, diff ${pfDiff.toFixed(2)})`);
    console.log(`  Source: ${bench.source}`);
    console.log('');
  }

  console.log('\n═══ RESUMO FINAL ═══\n');
  console.log(`Estratégias testadas: ${results.length}`);
  console.log(`Win Rate dentro da tolerância: ${passedWR}/${results.length}`);
  console.log(`Profit Factor dentro da tolerância: ${passedPF}/${results.length}`);

  const overallPass = passedWR >= results.length * 0.6 && passedPF >= results.length * 0.6;
  console.log(`\n${overallPass ? '✅ VALIDAÇÃO APROVADA' : '⚠️ ALGUNS BENCHMARKS FORA DA TOLERÂNCIA'}`);

  if (overallPass) {
    console.log('\nO sistema de backtesting MarketMind produz resultados');
    console.log('consistentes com benchmarks conhecidos da indústria.');
  } else {
    console.log('\nAlgumas estratégias apresentam diferenças significativas.');
    console.log('Isso pode ser devido a:');
    console.log('  - Diferenças no ativo testado (BTCUSDT vs S&P 500)');
    console.log('  - Diferenças nas regras de entrada/saída');
    console.log('  - Condições de mercado diferentes');
  }
}

main().catch(console.error);
