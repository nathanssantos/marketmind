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

const FIB_LEVELS: FibLevel[] = ['1', '1.272', '1.382', '1.5', '1.618', '2', '2.272', '2.618'];

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
  startDate: '2025-01-24',
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

interface FibResult {
  fibLong: FibLevel;
  fibShort: FibLevel;
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
}

interface FibComboResult {
  fibLong: FibLevel;
  fibShort: FibLevel;
  results: FibResult[];
  avgPnl: number;
  avgSharpe: number;
  totalTrades: number;
}

const OUTPUT_DIR = `/tmp/fibonacci-optimization-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

const formatNumber = (num: number, decimals = 2): string => num.toFixed(decimals);

const runFibBacktest = async (
  fibLong: FibLevel,
  fibShort: FibLevel,
  interval: string
): Promise<FibResult | null> => {
  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      ...BASE_CONFIG,
      interval,
      setupTypes: TOP_STRATEGIES,
      fibonacciTargetLevelLong: fibLong,
      fibonacciTargetLevelShort: fibShort,
    });

    const metrics = result.metrics;
    const trades = result.trades || [];

    const longTrades = trades.filter((t) => t.direction === 'LONG');
    const shortTrades = trades.filter((t) => t.direction === 'SHORT');

    const longWins = longTrades.filter((t) => (t.pnlPercent ?? 0) > 0).length;
    const shortWins = shortTrades.filter((t) => (t.pnlPercent ?? 0) > 0).length;

    const longPnl = longTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);

    return {
      fibLong,
      fibShort,
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
    };
  } catch {
    return null;
  }
};

const generateReport = (combos: FibComboResult[]): void => {
  combos.sort((a, b) => b.avgPnl - a.avgPnl);

  let summary = '';
  summary += '='.repeat(140) + '\n';
  summary += 'FIBONACCI TARGET OPTIMIZATION RESULTS\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}\n`;
  summary += `Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType}\n`;
  summary += `Strategies: ${TOP_STRATEGIES.length}\n`;
  summary += `Fib Levels Tested: ${FIB_LEVELS.length} (${FIB_LEVELS.join(', ')})\n`;
  summary += `Total Combinations: ${FIB_LEVELS.length * FIB_LEVELS.length} = ${combos.length}\n`;
  summary += '='.repeat(140) + '\n\n';

  summary += 'RANKING BY AVERAGE PNL (Fib Long / Fib Short)\n';
  summary += '-'.repeat(140) + '\n';
  summary += 'Rank | Fib Long | Fib Short | Avg PnL %  | Avg Sharpe | Total Trades | Long PnL % | Short PnL %\n';
  summary += '-'.repeat(140) + '\n';

  combos.slice(0, 30).forEach((c, i) => {
    const avgLongPnl = c.results.reduce((sum, r) => sum + r.longPnlPercent, 0) / c.results.length;
    const avgShortPnl = c.results.reduce((sum, r) => sum + r.shortPnlPercent, 0) / c.results.length;
    const pnlSign = c.avgPnl >= 0 ? '+' : '';

    summary += `${(i + 1).toString().padStart(4)} | ${c.fibLong.padEnd(8)} | ${c.fibShort.padEnd(9)} | ${pnlSign}${formatNumber(c.avgPnl).padStart(9)}% | ${formatNumber(c.avgSharpe).padStart(10)} | ${c.totalTrades.toString().padStart(12)} | ${formatNumber(avgLongPnl).padStart(10)}% | ${formatNumber(avgShortPnl).padStart(11)}%\n`;
  });

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'BEST FIBONACCI LEVELS BY DIRECTION\n';
  summary += '-'.repeat(80) + '\n';

  const longAnalysis = new Map<FibLevel, { totalPnl: number; count: number }>();
  const shortAnalysis = new Map<FibLevel, { totalPnl: number; count: number }>();

  for (const combo of combos) {
    for (const r of combo.results) {
      if (!longAnalysis.has(r.fibLong)) longAnalysis.set(r.fibLong, { totalPnl: 0, count: 0 });
      const longStats = longAnalysis.get(r.fibLong)!;
      longStats.totalPnl += r.longPnlPercent;
      longStats.count++;

      if (!shortAnalysis.has(r.fibShort)) shortAnalysis.set(r.fibShort, { totalPnl: 0, count: 0 });
      const shortStats = shortAnalysis.get(r.fibShort)!;
      shortStats.totalPnl += r.shortPnlPercent;
      shortStats.count++;
    }
  }

  const longRanking = [...longAnalysis.entries()]
    .map(([level, stats]) => ({ level, avgPnl: stats.totalPnl / stats.count }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  const shortRanking = [...shortAnalysis.entries()]
    .map(([level, stats]) => ({ level, avgPnl: stats.totalPnl / stats.count }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  summary += '\nBest Fib Levels for LONG positions:\n';
  longRanking.forEach((l, i) => {
    summary += `  ${i + 1}. Fib ${l.level}: ${formatNumber(l.avgPnl)}% avg PnL\n`;
  });

  summary += '\nBest Fib Levels for SHORT positions:\n';
  shortRanking.forEach((s, i) => {
    summary += `  ${i + 1}. Fib ${s.level}: ${formatNumber(s.avgPnl)}% avg PnL\n`;
  });

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'OPTIMAL CONFIGURATION\n';
  summary += '-'.repeat(80) + '\n';

  const best = combos[0];
  if (best) {
    summary += `\n🏆 RECOMMENDED SETTINGS:\n`;
    summary += `   Fibonacci Target Long:  ${best.fibLong} (${(parseFloat(best.fibLong) * 100).toFixed(1)}%)\n`;
    summary += `   Fibonacci Target Short: ${best.fibShort} (${(parseFloat(best.fibShort) * 100).toFixed(1)}%)\n`;
    summary += `   Average PnL: ${formatNumber(best.avgPnl)}%\n`;
    summary += `   Average Sharpe: ${formatNumber(best.avgSharpe)}\n`;
  }

  summary += '\nBest Fib Level per Direction (independent analysis):\n';
  summary += `   LONG:  ${longRanking[0]?.level} (${formatNumber(longRanking[0]?.avgPnl ?? 0)}% avg)\n`;
  summary += `   SHORT: ${shortRanking[0]?.level} (${formatNumber(shortRanking[0]?.avgPnl ?? 0)}% avg)\n`;

  writeFileSync(`${OUTPUT_DIR}/summary.txt`, summary);
  console.log(`\nSummary written to: ${OUTPUT_DIR}/summary.txt`);

  let csv = 'Fib Long,Fib Short,Interval,Trades,Long Trades,Short Trades,Win Rate,Long WR,Short WR,PnL %,Long PnL %,Short PnL %,Sharpe,PF\n';
  for (const combo of combos) {
    for (const r of combo.results) {
      csv += `${r.fibLong},${r.fibShort},${r.interval},${r.totalTrades},${r.longTrades},${r.shortTrades},${formatNumber(r.winRate)},${formatNumber(r.longWinRate)},${formatNumber(r.shortWinRate)},${formatNumber(r.totalPnlPercent)},${formatNumber(r.longPnlPercent)},${formatNumber(r.shortPnlPercent)},${formatNumber(r.sharpeRatio)},${formatNumber(r.profitFactor)}\n`;
    }
  }
  writeFileSync(`${OUTPUT_DIR}/full-results.csv`, csv);

  const optimalConfig = {
    generatedAt: new Date().toISOString(),
    recommended: {
      fibLong: best?.fibLong,
      fibShort: best?.fibShort,
      avgPnl: best?.avgPnl,
      avgSharpe: best?.avgSharpe,
    },
    bestByDirection: {
      long: longRanking[0],
      short: shortRanking[0],
    },
    topCombinations: combos.slice(0, 10).map((c) => ({
      fibLong: c.fibLong,
      fibShort: c.fibShort,
      avgPnl: c.avgPnl,
      avgSharpe: c.avgSharpe,
    })),
  };
  writeFileSync(`${OUTPUT_DIR}/optimal-fib-config.json`, JSON.stringify(optimalConfig, null, 2));

  console.log('\n' + summary);
};

const main = async (): Promise<void> => {
  const totalCombos = FIB_LEVELS.length * FIB_LEVELS.length;
  const totalBacktests = totalCombos * TIMEFRAMES.length;

  console.log('='.repeat(80));
  console.log('FIBONACCI TARGET OPTIMIZATION');
  console.log('='.repeat(80));
  console.log(`Fib Levels: ${FIB_LEVELS.length} (${FIB_LEVELS.join(', ')})`);
  console.log(`Combinations (Long × Short): ${totalCombos}`);
  console.log(`Timeframes: ${TIMEFRAMES.length} (${TIMEFRAMES.join(', ')})`);
  console.log(`Total backtests: ${totalBacktests}`);
  console.log(`Strategies: ${TOP_STRATEGIES.join(', ')}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(80));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const combos: FibComboResult[] = [];
  const startTime = Date.now();
  let processed = 0;

  for (const fibLong of FIB_LEVELS) {
    for (const fibShort of FIB_LEVELS) {
      const comboName = `L=${fibLong}/S=${fibShort}`;
      console.log(`\n[${combos.length + 1}/${totalCombos}] Testing ${comboName}`);

      const results: FibResult[] = [];
      const logFile = `${OUTPUT_DIR}/${fibLong}-${fibShort}.log`;
      appendFileSync(logFile, `Combo: ${comboName}\n${'='.repeat(60)}\n`);

      for (const interval of TIMEFRAMES) {
        const result = await runFibBacktest(fibLong, fibShort, interval);
        processed++;

        const progress = ((processed / totalBacktests) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

        if (result) {
          results.push(result);
          const logLine = `  ${interval}: ${result.totalTrades}T (L:${result.longTrades}/S:${result.shortTrades}), PnL=${formatNumber(result.totalPnlPercent)}% (L:${formatNumber(result.longPnlPercent)}%/S:${formatNumber(result.shortPnlPercent)}%)`;
          console.log(`  [${progress}%] ${interval}: ${result.totalTrades}T, ${formatNumber(result.totalPnlPercent)}% (${elapsed}m)`);
          appendFileSync(logFile, logLine + '\n');
        } else {
          console.log(`  [${progress}%] ${interval}: FAILED`);
          appendFileSync(logFile, `  ${interval}: FAILED\n`);
        }
      }

      if (results.length > 0) {
        const avgPnl = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.length;
        const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
        const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);

        combos.push({ fibLong, fibShort, results, avgPnl, avgSharpe, totalTrades });
        console.log(`  ✅ ${comboName}: Avg PnL=${formatNumber(avgPnl)}%, Sharpe=${formatNumber(avgSharpe)}`);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETED in ${elapsed} minutes`);
  console.log('='.repeat(80));

  if (combos.length > 0) {
    generateReport(combos);
  }

  await db.$client.end();
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
