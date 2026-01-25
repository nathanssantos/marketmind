import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import { TRADING_DEFAULTS, BACKTEST_DEFAULTS } from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

type FibLevel = '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';

interface FibCombo {
  name: string;
  fibLong: FibLevel;
  fibShort: FibLevel;
}

const TOP_5_COMBOS: FibCombo[] = [
  { name: 'Best-1Y', fibLong: '1', fibShort: '1.272' },
  { name: 'Conservative-Aggressive', fibLong: '1', fibShort: '2' },
  { name: 'Phase1-Original', fibLong: '2', fibShort: '1.272' },
  { name: 'Balanced', fibLong: '1.272', fibShort: '1.272' },
  { name: 'Aggressive', fibLong: '2', fibShort: '2' },
];

const TIMEFRAMES = ['1h', '4h'];

const TOP_STRATEGIES = [
  'chaikin-money-flow',
  'connors-rsi2-original',
  'fibonacci-retracement',
  'golden-cross-sma',
  'keltner-breakout-optimized',
  'momentum-breakout-2025',
  'rsi-oversold-bounce',
];

const BASE_CONFIG = {
  symbol: 'BTCUSDT',
  startDate: '2023-01-24',
  endDate: '2026-01-24',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatioLong: 1.0,
  minRiskRewardRatioShort: 0.8,
  maxFibonacciEntryProgressPercent: 61.8,
  useAlgorithmicLevels: true,
  useTrendFilter: false,
  tpCalculationMode: 'fibonacci' as const,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,
  useMtfFilter: false,
  useBtcCorrelationFilter: false,
  useMarketRegimeFilter: true,
  useVolumeFilter: false,
  useFundingFilter: true,
  useConfluenceScoring: true,
  confluenceMinScore: 60,
  simulateFundingRates: true,
  simulateLiquidation: true,
  useCooldown: true,
  cooldownMinutes: TRADING_DEFAULTS.COOLDOWN_MINUTES,
};

interface ValidationResult {
  combo: FibCombo;
  interval: string;
  totalTrades: number;
  longTrades: number;
  shortTrades: number;
  winRate: number;
  longWinRate: number;
  shortWinRate: number;
  totalPnlPercent: number;
  longPnlPercent: number;
  shortPnlPercent: number;
  sharpeRatio: number;
  profitFactor: number;
  maxDrawdown: number;
}

interface ComboSummary {
  combo: FibCombo;
  results: ValidationResult[];
  avgPnl: number;
  avgSharpe: number;
  avgLongPnl: number;
  avgShortPnl: number;
  totalTrades: number;
  avgMaxDrawdown: number;
}

const OUTPUT_DIR = `/tmp/fibonacci-validation-3years-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

const formatNumber = (num: number, decimals = 2): string => num.toFixed(decimals);

const runBacktest = async (combo: FibCombo, interval: string): Promise<ValidationResult | null> => {
  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      ...BASE_CONFIG,
      interval,
      setupTypes: TOP_STRATEGIES,
      fibonacciTargetLevelLong: combo.fibLong,
      fibonacciTargetLevelShort: combo.fibShort,
    });

    const metrics = result.metrics;
    const trades = result.trades || [];

    const longTrades = trades.filter((t) => t.side === 'LONG');
    const shortTrades = trades.filter((t) => t.side === 'SHORT');

    const longWins = longTrades.filter((t) => (t.pnlPercent ?? 0) > 0).length;
    const shortWins = shortTrades.filter((t) => (t.pnlPercent ?? 0) > 0).length;

    const longPnl = longTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);

    return {
      combo,
      interval,
      totalTrades: metrics.totalTrades,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
      winRate: metrics.winRate,
      longWinRate: longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0,
      shortWinRate: shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0,
      totalPnlPercent: metrics.totalPnlPercent,
      longPnlPercent: longPnl,
      shortPnlPercent: shortPnl,
      sharpeRatio: metrics.sharpeRatio ?? 0,
      profitFactor: metrics.profitFactor,
      maxDrawdown: metrics.maxDrawdownPercent ?? 0,
    };
  } catch (error) {
    console.error(`Error running backtest for ${combo.name}/${interval}:`, error);
    return null;
  }
};

const generateReport = (summaries: ComboSummary[]): void => {
  summaries.sort((a, b) => b.avgPnl - a.avgPnl);

  let report = '';
  report += '='.repeat(140) + '\n';
  report += 'FIBONACCI VALIDATION - 3 YEARS (Bull + Bear + Sideways)\n';
  report += '='.repeat(140) + '\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate} (3 years)\n`;
  report += `Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType}\n`;
  report += `Strategies: ${TOP_STRATEGIES.length}\n`;
  report += `Timeframes: ${TIMEFRAMES.join(', ')}\n`;
  report += `Combos Tested: ${TOP_5_COMBOS.length}\n`;
  report += '='.repeat(140) + '\n\n';

  report += 'RANKING BY AVERAGE PNL (3 Years)\n';
  report += '-'.repeat(140) + '\n';
  report += 'Rank | Name                    | Fib L/S    | Avg PnL %  | Sharpe | Long PnL % | Short PnL % | Max DD % | Trades\n';
  report += '-'.repeat(140) + '\n';

  summaries.forEach((s, i) => {
    const pnlSign = s.avgPnl >= 0 ? '+' : '';
    const longSign = s.avgLongPnl >= 0 ? '+' : '';
    const shortSign = s.avgShortPnl >= 0 ? '+' : '';

    report += `${(i + 1).toString().padStart(4)} | ${s.combo.name.padEnd(23)} | ${s.combo.fibLong}/${s.combo.fibShort.padEnd(5)} | ${pnlSign}${formatNumber(s.avgPnl).padStart(9)}% | ${formatNumber(s.avgSharpe).padStart(6)} | ${longSign}${formatNumber(s.avgLongPnl).padStart(9)}% | ${shortSign}${formatNumber(s.avgShortPnl).padStart(10)}% | ${formatNumber(s.avgMaxDrawdown).padStart(7)}% | ${s.totalTrades.toString().padStart(6)}\n`;
  });

  report += '\n' + '='.repeat(140) + '\n';
  report += 'DETAILED RESULTS BY TIMEFRAME\n';
  report += '-'.repeat(140) + '\n\n';

  for (const summary of summaries) {
    report += `📊 ${summary.combo.name} (Fib L=${summary.combo.fibLong}, S=${summary.combo.fibShort})\n`;
    report += '-'.repeat(80) + '\n';

    for (const r of summary.results) {
      const pnlSign = r.totalPnlPercent >= 0 ? '+' : '';
      report += `  ${r.interval}: ${r.totalTrades} trades (L:${r.longTrades}/S:${r.shortTrades})\n`;
      report += `        PnL: ${pnlSign}${formatNumber(r.totalPnlPercent)}% | Long: ${formatNumber(r.longPnlPercent)}% | Short: ${formatNumber(r.shortPnlPercent)}%\n`;
      report += `        WR: ${formatNumber(r.winRate)}% | Sharpe: ${formatNumber(r.sharpeRatio)} | Max DD: ${formatNumber(r.maxDrawdown)}%\n`;
    }
    report += '\n';
  }

  report += '='.repeat(140) + '\n';
  report += 'COMPARISON: 1-YEAR vs 3-YEAR RESULTS\n';
  report += '-'.repeat(140) + '\n\n';

  report += '1-Year Results (2025-01-24 to 2026-01-24 - Bearish period):\n';
  report += '  Best combo: L=1/S=1.272 (+13.65% PnL, 2.14 Sharpe)\n';
  report += '  LONG always negative (best: -9.05% with Fib 1)\n';
  report += '  SHORT always positive (best: +139.55% with Fib 2)\n\n';

  const best = summaries[0];
  if (best) {
    report += '3-Year Results (2023-01-24 to 2026-01-24 - Mixed market):\n';
    report += `  Best combo: ${best.combo.name} (L=${best.combo.fibLong}/S=${best.combo.fibShort})\n`;
    report += `  Avg PnL: ${formatNumber(best.avgPnl)}% | Sharpe: ${formatNumber(best.avgSharpe)}\n`;
    report += `  Long PnL: ${formatNumber(best.avgLongPnl)}% | Short PnL: ${formatNumber(best.avgShortPnl)}%\n`;
  }

  report += '\n' + '='.repeat(140) + '\n';
  report += 'RECOMMENDATION\n';
  report += '-'.repeat(140) + '\n\n';

  if (best) {
    const isLongPositive = best.avgLongPnl > 0;
    const isShortPositive = best.avgShortPnl > 0;

    report += `🏆 RECOMMENDED CONFIGURATION (3-Year Validation):\n\n`;
    report += `   fibonacciTargetLevelLong:  '${best.combo.fibLong}'\n`;
    report += `   fibonacciTargetLevelShort: '${best.combo.fibShort}'\n\n`;

    if (isLongPositive && isShortPositive) {
      report += `   ✅ Both LONG and SHORT profitable over 3 years\n`;
    } else if (isLongPositive) {
      report += `   ⚠️ Only LONG profitable (consider disabling SHORT in bearish conditions)\n`;
    } else if (isShortPositive) {
      report += `   ⚠️ Only SHORT profitable (consider disabling LONG in bearish conditions)\n`;
    } else {
      report += `   ⚠️ Both directions negative - review strategy configuration\n`;
    }

    const phase1Original = summaries.find((s) => s.combo.name === 'Phase1-Original');
    if (phase1Original && best.combo.name !== 'Phase1-Original') {
      const improvement = best.avgPnl - phase1Original.avgPnl;
      report += `\n   vs Phase 1 Original (L=2/S=1.272): ${improvement >= 0 ? '+' : ''}${formatNumber(improvement)}% improvement\n`;
    }
  }

  writeFileSync(`${OUTPUT_DIR}/validation-report.txt`, report);
  console.log(`\nReport written to: ${OUTPUT_DIR}/validation-report.txt`);

  let csv = 'Combo,Fib Long,Fib Short,Interval,Trades,Long Trades,Short Trades,Win Rate,Long WR,Short WR,PnL %,Long PnL %,Short PnL %,Sharpe,PF,Max DD %\n';
  for (const summary of summaries) {
    for (const r of summary.results) {
      csv += `${r.combo.name},${r.combo.fibLong},${r.combo.fibShort},${r.interval},${r.totalTrades},${r.longTrades},${r.shortTrades},${formatNumber(r.winRate)},${formatNumber(r.longWinRate)},${formatNumber(r.shortWinRate)},${formatNumber(r.totalPnlPercent)},${formatNumber(r.longPnlPercent)},${formatNumber(r.shortPnlPercent)},${formatNumber(r.sharpeRatio)},${formatNumber(r.profitFactor)},${formatNumber(r.maxDrawdown)}\n`;
    }
  }
  writeFileSync(`${OUTPUT_DIR}/validation-results.csv`, csv);

  const configJson = {
    generatedAt: new Date().toISOString(),
    period: { start: BASE_CONFIG.startDate, end: BASE_CONFIG.endDate, years: 3 },
    recommended: best
      ? {
          name: best.combo.name,
          fibLong: best.combo.fibLong,
          fibShort: best.combo.fibShort,
          avgPnl: best.avgPnl,
          avgSharpe: best.avgSharpe,
          avgLongPnl: best.avgLongPnl,
          avgShortPnl: best.avgShortPnl,
        }
      : null,
    ranking: summaries.map((s) => ({
      name: s.combo.name,
      fibLong: s.combo.fibLong,
      fibShort: s.combo.fibShort,
      avgPnl: s.avgPnl,
      avgSharpe: s.avgSharpe,
      avgLongPnl: s.avgLongPnl,
      avgShortPnl: s.avgShortPnl,
    })),
  };
  writeFileSync(`${OUTPUT_DIR}/recommended-config.json`, JSON.stringify(configJson, null, 2));

  console.log('\n' + report);
};

const main = async (): Promise<void> => {
  const totalBacktests = TOP_5_COMBOS.length * TIMEFRAMES.length;

  console.log('='.repeat(80));
  console.log('FIBONACCI VALIDATION - 3 YEARS');
  console.log('='.repeat(80));
  console.log(`Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}`);
  console.log(`Combos: ${TOP_5_COMBOS.length}`);
  console.log(`Timeframes: ${TIMEFRAMES.length} (${TIMEFRAMES.join(', ')})`);
  console.log(`Total backtests: ${totalBacktests}`);
  console.log(`Strategies: ${TOP_STRATEGIES.join(', ')}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(80));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const summaries: ComboSummary[] = [];
  const startTime = Date.now();
  let processed = 0;

  for (const combo of TOP_5_COMBOS) {
    console.log(`\n[${summaries.length + 1}/${TOP_5_COMBOS.length}] Testing ${combo.name} (L=${combo.fibLong}/S=${combo.fibShort})`);

    const results: ValidationResult[] = [];
    const logFile = `${OUTPUT_DIR}/${combo.name}.log`;
    appendFileSync(logFile, `Combo: ${combo.name} (L=${combo.fibLong}/S=${combo.fibShort})\n${'='.repeat(60)}\n`);

    for (const interval of TIMEFRAMES) {
      const result = await runBacktest(combo, interval);
      processed++;

      const progress = ((processed / totalBacktests) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

      if (result) {
        results.push(result);
        const logLine = `  ${interval}: ${result.totalTrades}T (L:${result.longTrades}/S:${result.shortTrades}), PnL=${formatNumber(result.totalPnlPercent)}% (L:${formatNumber(result.longPnlPercent)}%/S:${formatNumber(result.shortPnlPercent)}%)`;
        console.log(`  [${progress}%] ${interval}: ${result.totalTrades}T, ${formatNumber(result.totalPnlPercent)}% PnL, Sharpe=${formatNumber(result.sharpeRatio)} (${elapsed}m)`);
        appendFileSync(logFile, logLine + '\n');
      } else {
        console.log(`  [${progress}%] ${interval}: FAILED`);
        appendFileSync(logFile, `  ${interval}: FAILED\n`);
      }
    }

    if (results.length > 0) {
      const avgPnl = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.length;
      const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
      const avgLongPnl = results.reduce((sum, r) => sum + r.longPnlPercent, 0) / results.length;
      const avgShortPnl = results.reduce((sum, r) => sum + r.shortPnlPercent, 0) / results.length;
      const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
      const avgMaxDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;

      summaries.push({
        combo,
        results,
        avgPnl,
        avgSharpe,
        avgLongPnl,
        avgShortPnl,
        totalTrades,
        avgMaxDrawdown,
      });
      console.log(`  ✅ ${combo.name}: Avg PnL=${formatNumber(avgPnl)}%, Sharpe=${formatNumber(avgSharpe)}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETED in ${elapsed} minutes`);
  console.log('='.repeat(80));

  if (summaries.length > 0) {
    generateReport(summaries);
  }

  await db.$client.end();
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
