import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { writeFileSync, mkdirSync, readdirSync, readFileSync } from 'fs';
import { TRADING_DEFAULTS, BACKTEST_DEFAULTS, FILTER_DEFAULTS } from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

const STRATEGIES_DIR = resolve(__dirname, '../strategies/builtin');
const TIMEFRAMES = ['1h', '4h'];

const BASE_CONFIG = {
  symbol: 'BTCUSDT',
  startDate: '2025-01-24',
  endDate: '2026-01-24',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatioLong: FILTER_DEFAULTS.minRiskRewardRatioLong,
  minRiskRewardRatioShort: FILTER_DEFAULTS.minRiskRewardRatioShort,
  maxFibonacciEntryProgressPercent: FILTER_DEFAULTS.maxFibonacciEntryProgressPercent,
  useAlgorithmicLevels: true,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciTargetLevelLong: FILTER_DEFAULTS.fibonacciTargetLevelLong,
  fibonacciTargetLevelShort: FILTER_DEFAULTS.fibonacciTargetLevelShort,
  useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
  useStochasticFilter: FILTER_DEFAULTS.useStochasticFilter,
  useMomentumTimingFilter: FILTER_DEFAULTS.useMomentumTimingFilter,
  useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
  useMtfFilter: FILTER_DEFAULTS.useMtfFilter,
  useBtcCorrelationFilter: FILTER_DEFAULTS.useBtcCorrelationFilter,
  useMarketRegimeFilter: FILTER_DEFAULTS.useMarketRegimeFilter,
  useDirectionFilter: FILTER_DEFAULTS.useDirectionFilter,
  enableLongInBearMarket: FILTER_DEFAULTS.enableLongInBearMarket,
  enableShortInBullMarket: FILTER_DEFAULTS.enableShortInBullMarket,
  useVolumeFilter: FILTER_DEFAULTS.useVolumeFilter,
  useFundingFilter: FILTER_DEFAULTS.useFundingFilter,
  useConfluenceScoring: FILTER_DEFAULTS.useConfluenceScoring,
  confluenceMinScore: FILTER_DEFAULTS.confluenceMinScore,
  simulateFundingRates: true,
  simulateLiquidation: true,
  useCooldown: FILTER_DEFAULTS.useCooldown,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
};

interface StrategyResult {
  strategyName: string;
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

interface StrategySummary {
  strategyName: string;
  results: StrategyResult[];
  avgPnl: number;
  avgSharpe: number;
  avgWinRate: number;
  avgLongPnl: number;
  avgShortPnl: number;
  totalTrades: number;
  avgMaxDrawdown: number;
  avgProfitFactor: number;
}

const OUTPUT_DIR = `/tmp/106-setups-backtest-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

const formatNumber = (num: number, decimals = 2): string => num.toFixed(decimals);

const loadStrategies = (): string[] => {
  const files = readdirSync(STRATEGIES_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => f.replace('.json', ''));
};

const runBacktest = async (strategyName: string, interval: string): Promise<StrategyResult | null> => {
  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      ...BASE_CONFIG,
      interval,
      setupTypes: [strategyName],
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
      strategyName,
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
    console.error(`Error running backtest for ${strategyName}/${interval}:`, error);
    return null;
  }
};

const generateReport = (summaries: StrategySummary[]): void => {
  const sortedByPnl = [...summaries].sort((a, b) => b.avgPnl - a.avgPnl);
  const sortedBySharpe = [...summaries].sort((a, b) => b.avgSharpe - a.avgSharpe);
  const sortedByWinRate = [...summaries].sort((a, b) => b.avgWinRate - a.avgWinRate);

  let report = '';
  report += '='.repeat(160) + '\n';
  report += '106 SETUPS BACKTEST - OPTIMIZED FIBONACCI CONFIG\n';
  report += '='.repeat(160) + '\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}\n`;
  report += `Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType}\n`;
  report += `Fibonacci Config: Long=${BASE_CONFIG.fibonacciTargetLevelLong} | Short=${BASE_CONFIG.fibonacciTargetLevelShort}\n`;
  report += `Direction Filter: ${BASE_CONFIG.useDirectionFilter ? 'ENABLED' : 'DISABLED'}\n`;
  report += `Timeframes: ${TIMEFRAMES.join(', ')}\n`;
  report += `Total Strategies Tested: ${summaries.length}\n`;
  report += '='.repeat(160) + '\n\n';

  const profitableStrategies = sortedByPnl.filter((s) => s.avgPnl > 0);
  const positiveSharpeLongPnl = sortedByPnl.filter((s) => s.avgSharpe > 0 && s.avgLongPnl > 0);

  report += `📊 SUMMARY STATISTICS\n`;
  report += `-`.repeat(80) + '\n';
  report += `Total strategies: ${summaries.length}\n`;
  report += `Profitable (PnL > 0): ${profitableStrategies.length} (${((profitableStrategies.length / summaries.length) * 100).toFixed(1)}%)\n`;
  report += `Positive Sharpe + Long PnL > 0: ${positiveSharpeLongPnl.length}\n\n`;

  report += '🏆 TOP 20 BY PNL\n';
  report += '-'.repeat(160) + '\n';
  report += 'Rank | Strategy                              | Avg PnL %  | Sharpe | Win Rate | Long PnL % | Short PnL % | Max DD % | Trades | PF\n';
  report += '-'.repeat(160) + '\n';

  sortedByPnl.slice(0, 20).forEach((s, i) => {
    const pnlSign = s.avgPnl >= 0 ? '+' : '';
    const longSign = s.avgLongPnl >= 0 ? '+' : '';
    const shortSign = s.avgShortPnl >= 0 ? '+' : '';

    report += `${(i + 1).toString().padStart(4)} | ${s.strategyName.padEnd(37)} | ${pnlSign}${formatNumber(s.avgPnl).padStart(9)}% | ${formatNumber(s.avgSharpe).padStart(6)} | ${formatNumber(s.avgWinRate).padStart(7)}% | ${longSign}${formatNumber(s.avgLongPnl).padStart(9)}% | ${shortSign}${formatNumber(s.avgShortPnl).padStart(10)}% | ${formatNumber(s.avgMaxDrawdown).padStart(7)}% | ${s.totalTrades.toString().padStart(6)} | ${formatNumber(s.avgProfitFactor).padStart(5)}\n`;
  });

  report += '\n🎯 TOP 20 BY SHARPE RATIO\n';
  report += '-'.repeat(160) + '\n';
  report += 'Rank | Strategy                              | Sharpe | Avg PnL %  | Win Rate | Long PnL % | Short PnL % | Max DD % | Trades\n';
  report += '-'.repeat(160) + '\n';

  sortedBySharpe.slice(0, 20).forEach((s, i) => {
    const pnlSign = s.avgPnl >= 0 ? '+' : '';
    const longSign = s.avgLongPnl >= 0 ? '+' : '';
    const shortSign = s.avgShortPnl >= 0 ? '+' : '';

    report += `${(i + 1).toString().padStart(4)} | ${s.strategyName.padEnd(37)} | ${formatNumber(s.avgSharpe).padStart(6)} | ${pnlSign}${formatNumber(s.avgPnl).padStart(9)}% | ${formatNumber(s.avgWinRate).padStart(7)}% | ${longSign}${formatNumber(s.avgLongPnl).padStart(9)}% | ${shortSign}${formatNumber(s.avgShortPnl).padStart(10)}% | ${formatNumber(s.avgMaxDrawdown).padStart(7)}% | ${s.totalTrades.toString().padStart(6)}\n`;
  });

  report += '\n📈 TOP 20 BY WIN RATE\n';
  report += '-'.repeat(160) + '\n';
  report += 'Rank | Strategy                              | Win Rate | Avg PnL %  | Sharpe | Long PnL % | Short PnL % | Max DD % | Trades\n';
  report += '-'.repeat(160) + '\n';

  sortedByWinRate.slice(0, 20).forEach((s, i) => {
    const pnlSign = s.avgPnl >= 0 ? '+' : '';
    const longSign = s.avgLongPnl >= 0 ? '+' : '';
    const shortSign = s.avgShortPnl >= 0 ? '+' : '';

    report += `${(i + 1).toString().padStart(4)} | ${s.strategyName.padEnd(37)} | ${formatNumber(s.avgWinRate).padStart(7)}% | ${pnlSign}${formatNumber(s.avgPnl).padStart(9)}% | ${formatNumber(s.avgSharpe).padStart(6)} | ${longSign}${formatNumber(s.avgLongPnl).padStart(9)}% | ${shortSign}${formatNumber(s.avgShortPnl).padStart(10)}% | ${formatNumber(s.avgMaxDrawdown).padStart(7)}% | ${s.totalTrades.toString().padStart(6)}\n`;
  });

  report += '\n' + '='.repeat(160) + '\n';
  report += '🎖️ RECOMMENDED SETUPS (Criteria: PnL > 5%, Sharpe > 1.0, Win Rate > 50%)\n';
  report += '-'.repeat(160) + '\n\n';

  const recommended = sortedByPnl.filter(
    (s) => s.avgPnl > 5 && s.avgSharpe > 1.0 && s.avgWinRate > 50
  );

  if (recommended.length === 0) {
    const relaxed = sortedByPnl.filter((s) => s.avgPnl > 0 && s.avgSharpe > 0);
    report += `No strategies meet strict criteria. Relaxed criteria (PnL > 0, Sharpe > 0):\n\n`;
    relaxed.slice(0, 20).forEach((s, i) => {
      report += `${i + 1}. ${s.strategyName}: PnL=${formatNumber(s.avgPnl)}%, Sharpe=${formatNumber(s.avgSharpe)}, WR=${formatNumber(s.avgWinRate)}%\n`;
    });
  } else {
    recommended.forEach((s, i) => {
      report += `${i + 1}. ${s.strategyName}\n`;
      report += `   PnL: ${formatNumber(s.avgPnl)}% | Sharpe: ${formatNumber(s.avgSharpe)} | Win Rate: ${formatNumber(s.avgWinRate)}%\n`;
      report += `   Long PnL: ${formatNumber(s.avgLongPnl)}% | Short PnL: ${formatNumber(s.avgShortPnl)}%\n`;
      report += `   Max Drawdown: ${formatNumber(s.avgMaxDrawdown)}% | Profit Factor: ${formatNumber(s.avgProfitFactor)}\n\n`;
    });
  }

  report += '\n' + '='.repeat(160) + '\n';
  report += 'BOTTOM 10 (WORST PERFORMERS)\n';
  report += '-'.repeat(160) + '\n';

  sortedByPnl.slice(-10).reverse().forEach((s, i) => {
    report += `${i + 1}. ${s.strategyName}: PnL=${formatNumber(s.avgPnl)}%, Sharpe=${formatNumber(s.avgSharpe)}, Trades=${s.totalTrades}\n`;
  });

  writeFileSync(`${OUTPUT_DIR}/backtest-report.txt`, report);
  console.log(`\nReport written to: ${OUTPUT_DIR}/backtest-report.txt`);

  let csv = 'Strategy,Interval,Trades,Long Trades,Short Trades,Win Rate,Long WR,Short WR,PnL %,Long PnL %,Short PnL %,Sharpe,PF,Max DD %\n';
  for (const summary of summaries) {
    for (const r of summary.results) {
      csv += `${r.strategyName},${r.interval},${r.totalTrades},${r.longTrades},${r.shortTrades},${formatNumber(r.winRate)},${formatNumber(r.longWinRate)},${formatNumber(r.shortWinRate)},${formatNumber(r.totalPnlPercent)},${formatNumber(r.longPnlPercent)},${formatNumber(r.shortPnlPercent)},${formatNumber(r.sharpeRatio)},${formatNumber(r.profitFactor)},${formatNumber(r.maxDrawdown)}\n`;
    }
  }
  writeFileSync(`${OUTPUT_DIR}/detailed-results.csv`, csv);

  let summaryCsv = 'Strategy,Avg PnL %,Avg Sharpe,Avg Win Rate,Avg Long PnL %,Avg Short PnL %,Total Trades,Avg Max DD %,Avg PF\n';
  for (const s of sortedByPnl) {
    summaryCsv += `${s.strategyName},${formatNumber(s.avgPnl)},${formatNumber(s.avgSharpe)},${formatNumber(s.avgWinRate)},${formatNumber(s.avgLongPnl)},${formatNumber(s.avgShortPnl)},${s.totalTrades},${formatNumber(s.avgMaxDrawdown)},${formatNumber(s.avgProfitFactor)}\n`;
  }
  writeFileSync(`${OUTPUT_DIR}/summary-by-pnl.csv`, summaryCsv);

  const configJson = {
    generatedAt: new Date().toISOString(),
    period: { start: BASE_CONFIG.startDate, end: BASE_CONFIG.endDate },
    fibonacciConfig: {
      long: BASE_CONFIG.fibonacciTargetLevelLong,
      short: BASE_CONFIG.fibonacciTargetLevelShort,
    },
    directionFilter: BASE_CONFIG.useDirectionFilter,
    totalStrategies: summaries.length,
    profitableStrategies: profitableStrategies.length,
    top20ByPnl: sortedByPnl.slice(0, 20).map((s) => ({
      name: s.strategyName,
      avgPnl: s.avgPnl,
      avgSharpe: s.avgSharpe,
      avgWinRate: s.avgWinRate,
      totalTrades: s.totalTrades,
    })),
    recommended: recommended.map((s) => s.strategyName),
  };
  writeFileSync(`${OUTPUT_DIR}/results-summary.json`, JSON.stringify(configJson, null, 2));

  console.log('\n' + report);
};

const main = async (): Promise<void> => {
  const strategies = loadStrategies();
  const totalBacktests = strategies.length * TIMEFRAMES.length;

  console.log('='.repeat(80));
  console.log('106 SETUPS BACKTEST');
  console.log('='.repeat(80));
  console.log(`Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}`);
  console.log(`Strategies: ${strategies.length}`);
  console.log(`Timeframes: ${TIMEFRAMES.length} (${TIMEFRAMES.join(', ')})`);
  console.log(`Total backtests: ${totalBacktests}`);
  console.log(`Fib Config: Long=${BASE_CONFIG.fibonacciTargetLevelLong} | Short=${BASE_CONFIG.fibonacciTargetLevelShort}`);
  console.log(`Direction Filter: ${BASE_CONFIG.useDirectionFilter ? 'ENABLED' : 'DISABLED'}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(80));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const summaries: StrategySummary[] = [];
  const startTime = Date.now();
  let processed = 0;
  let failed = 0;

  for (const strategyName of strategies) {
    const strategyIndex = strategies.indexOf(strategyName) + 1;
    console.log(`\n[${strategyIndex}/${strategies.length}] Testing ${strategyName}`);

    const results: StrategyResult[] = [];

    for (const interval of TIMEFRAMES) {
      const result = await runBacktest(strategyName, interval);
      processed++;

      const progress = ((processed / totalBacktests) * 100).toFixed(1);
      const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      const remaining = ((Date.now() - startTime) / processed) * (totalBacktests - processed) / 1000 / 60;

      if (result) {
        results.push(result);
        console.log(
          `  [${progress}%] ${interval}: ${result.totalTrades}T, ${formatNumber(result.totalPnlPercent)}% PnL, Sharpe=${formatNumber(result.sharpeRatio)} (${elapsed}m elapsed, ~${remaining.toFixed(0)}m remaining)`
        );
      } else {
        failed++;
        console.log(`  [${progress}%] ${interval}: FAILED`);
      }
    }

    if (results.length > 0) {
      const avgPnl = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.length;
      const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
      const avgWinRate = results.reduce((sum, r) => sum + r.winRate, 0) / results.length;
      const avgLongPnl = results.reduce((sum, r) => sum + r.longPnlPercent, 0) / results.length;
      const avgShortPnl = results.reduce((sum, r) => sum + r.shortPnlPercent, 0) / results.length;
      const totalTrades = results.reduce((sum, r) => sum + r.totalTrades, 0);
      const avgMaxDrawdown = results.reduce((sum, r) => sum + r.maxDrawdown, 0) / results.length;
      const avgProfitFactor = results.reduce((sum, r) => sum + r.profitFactor, 0) / results.length;

      summaries.push({
        strategyName,
        results,
        avgPnl,
        avgSharpe,
        avgWinRate,
        avgLongPnl,
        avgShortPnl,
        totalTrades,
        avgMaxDrawdown,
        avgProfitFactor,
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETED in ${elapsed} minutes`);
  console.log(`Successful: ${processed - failed} | Failed: ${failed}`);
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
