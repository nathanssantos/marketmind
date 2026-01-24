import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import {
  TRADING_DEFAULTS,
  EXIT_CALCULATOR_CONFIG,
  BACKTEST_DEFAULTS,
} from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

interface BacktestResult {
  interval: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
}

const TIMEFRAMES = ['15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'] as const;

const SETUPS = [
  'chaikin-money-flow',
  'chande-momentum-crypto',
  'connors-rsi2-original',
  'fibonacci-retracement',
  'golden-cross-sma',
  'keltner-breakout-optimized',
  'keltner-squeeze',
  'mfi-divergence',
  'momentum-breakout-2025',
  'momentum-rotation',
  'rsi-oversold-bounce',
  'rsi-sma-filter',
];

const BASE_CONFIG = {
  symbol: 'BTCUSDT',
  startDate: '2023-01-23',
  endDate: '2026-01-23',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  setupTypes: SETUPS,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
  useAlgorithmicLevels: true,
  onlyWithTrend: true,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciTargetLevel: '2' as const,
  maxFibonacciEntryProgressPercent: EXIT_CALCULATOR_CONFIG.MAX_FIBONACCI_ENTRY_PROGRESS_PERCENT,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,
  useTrendFilter: false,
  useMtfFilter: true,
  useBtcCorrelationFilter: true,
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

const runBacktest = async (interval: string): Promise<BacktestResult | null> => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running backtest for interval: ${interval}`);
  console.log('='.repeat(60));

  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      ...BASE_CONFIG,
      interval,
    });

    const metrics = result.metrics;

    return {
      interval,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      totalPnlPercent: metrics.totalPnlPercent,
      profitFactor: metrics.profitFactor,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      sharpeRatio: metrics.sharpeRatio ?? 0,
      avgWin: metrics.avgWin,
      avgLoss: metrics.avgLoss,
    };
  } catch (error) {
    console.error(`❌ Failed for ${interval}:`, error instanceof Error ? error.message : error);
    return null;
  }
};

const formatNumber = (num: number, decimals = 2): string => {
  return num.toFixed(decimals);
};

const printResults = (results: BacktestResult[]): void => {
  console.log('\n');
  console.log('='.repeat(130));
  console.log('MULTI-TIMEFRAME BACKTEST - BTCUSDT FUTURES (3 years) - Fibonacci Target Level 2');
  console.log('='.repeat(130));
  console.log(`Setups: ${SETUPS.join(', ')}`);
  console.log(`Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}`);
  console.log(`Leverage: ${BASE_CONFIG.leverage}x | Initial Capital: $${BASE_CONFIG.initialCapital}`);
  console.log(`Entry Limit: ${BASE_CONFIG.maxFibonacciEntryProgressPercent}% | Fib Target: ${BASE_CONFIG.fibonacciTargetLevel}`);
  console.log('='.repeat(130));
  console.log('');

  const headers = ['Interval', 'Trades', 'Win Rate', 'PnL %', 'Profit Factor', 'Max DD %', 'Sharpe', 'Avg Win', 'Avg Loss'];
  const widths = [10, 8, 10, 12, 14, 10, 8, 10, 10];

  console.log(headers.map((h, i) => h.padEnd(widths[i]!)).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));

  for (const r of results) {
    const pnlColor = r.totalPnlPercent >= 0 ? '\x1b[32m' : '\x1b[31m';
    const reset = '\x1b[0m';

    const row = [
      r.interval.padEnd(widths[0]!),
      r.totalTrades.toString().padEnd(widths[1]!),
      `${formatNumber(r.winRate)}%`.padEnd(widths[2]!),
      `${pnlColor}${formatNumber(r.totalPnlPercent)}%${reset}`.padEnd(widths[3]! + 9),
      formatNumber(r.profitFactor).padEnd(widths[4]!),
      `${formatNumber(r.maxDrawdownPercent)}%`.padEnd(widths[5]!),
      formatNumber(r.sharpeRatio).padEnd(widths[6]!),
      `$${formatNumber(r.avgWin)}`.padEnd(widths[7]!),
      `$${formatNumber(r.avgLoss)}`.padEnd(widths[8]!),
    ];
    console.log(row.join(' | '));
  }

  console.log('');
  console.log('='.repeat(130));

  const profitable = results.filter(r => r.totalPnlPercent > 0);
  const unprofitable = results.filter(r => r.totalPnlPercent <= 0);

  console.log(`\nProfitable timeframes (${profitable.length}/${results.length}):`);
  for (const r of profitable.sort((a, b) => b.totalPnlPercent - a.totalPnlPercent)) {
    console.log(`  ${r.interval}: +${formatNumber(r.totalPnlPercent)}% (${r.totalTrades} trades, Sharpe: ${formatNumber(r.sharpeRatio)})`);
  }

  if (unprofitable.length > 0) {
    console.log(`\nUnprofitable timeframes (${unprofitable.length}/${results.length}):`);
    for (const r of unprofitable.sort((a, b) => a.totalPnlPercent - b.totalPnlPercent)) {
      console.log(`  ${r.interval}: ${formatNumber(r.totalPnlPercent)}% (${r.totalTrades} trades)`);
    }
  }

  if (results.length > 0) {
    const best = results.reduce((a, b) => a.totalPnlPercent > b.totalPnlPercent ? a : b);
    const bestSharpe = results.reduce((a, b) => a.sharpeRatio > b.sharpeRatio ? a : b);
    const mostTrades = results.reduce((a, b) => a.totalTrades > b.totalTrades ? a : b);

    console.log(`\nBest PnL: ${best.interval} with ${formatNumber(best.totalPnlPercent)}%`);
    console.log(`Best Sharpe: ${bestSharpe.interval} with ${formatNumber(bestSharpe.sharpeRatio)}`);
    console.log(`Most Trades: ${mostTrades.interval} with ${mostTrades.totalTrades} trades`);

    const avgPnl = results.reduce((sum, r) => sum + r.totalPnlPercent, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length;
    console.log(`\nAverage PnL across all timeframes: ${formatNumber(avgPnl)}%`);
    console.log(`Average Sharpe across all timeframes: ${formatNumber(avgSharpe)}`);
  }

  console.log('='.repeat(130));
};

const main = async (): Promise<void> => {
  console.log('Starting Multi-Timeframe Backtest');
  console.log(`Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType}`);
  console.log(`Testing timeframes: ${TIMEFRAMES.join(', ')}`);
  console.log(`Fibonacci Target Level: ${BASE_CONFIG.fibonacciTargetLevel} (optimized)`);

  const results: BacktestResult[] = [];

  for (const interval of TIMEFRAMES) {
    const result = await runBacktest(interval);
    if (result) {
      results.push(result);
      console.log(`✅ Completed ${interval} - ${result.totalTrades} trades, ${formatNumber(result.totalPnlPercent)}% PnL`);
    }
  }

  if (results.length > 0) {
    printResults(results);
  }

  await db.$client.end();
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
