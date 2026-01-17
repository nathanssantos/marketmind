import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import {
  TRADING_DEFAULTS,
  BACKTEST_DEFAULTS,
} from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

interface BacktestResult {
  fibLevel: number;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgWin: number;
  avgLoss: number;
}

const FIBONACCI_LEVELS = [78.6, 85, 88.6, 90, 95, 100];

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

const CONFIG = {
  symbol: 'BTCUSDT',
  interval: '2h',
  startDate: '2024-01-17',
  endDate: '2026-01-17',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: BACKTEST_DEFAULTS.LEVERAGE,
  setupTypes: SETUPS,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
  useAlgorithmicLevels: true,
  onlyWithTrend: true,
  useTrendFilter: true,
  useTrailingStop: true,
  trailingStopATRMultiplier: BACKTEST_DEFAULTS.TRAILING_STOP_ATR_MULTIPLIER,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciTargetLevel: 'auto' as const,
  useMtfFilter: true,
  useMomentumTimingFilter: true,
  useAdxFilter: false,
  useStochasticFilter: false,
  useBtcCorrelationFilter: false,
  useMarketRegimeFilter: true,
  useFundingFilter: true,
  simulateFundingRates: true,
  simulateLiquidation: true,
  useCooldown: true,
  cooldownMinutes: TRADING_DEFAULTS.COOLDOWN_MINUTES,
};

const runBacktest = async (fibLevel: number): Promise<BacktestResult> => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running backtest with Fibonacci entry limit: ${fibLevel}%`);
  console.log('='.repeat(60));

  const engine = new BacktestEngine();
  const result = await engine.run({
    ...CONFIG,
    maxFibonacciEntryProgressPercent: fibLevel,
  });

  const metrics = result.metrics;

  return {
    fibLevel,
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    totalPnlPercent: metrics.totalPnlPercent,
    profitFactor: metrics.profitFactor,
    maxDrawdownPercent: metrics.maxDrawdownPercent,
    sharpeRatio: metrics.sharpeRatio ?? 0,
    avgWin: metrics.avgWin,
    avgLoss: metrics.avgLoss,
  };
};

const formatNumber = (num: number, decimals = 2): string => {
  return num.toFixed(decimals);
};

const printResults = (results: BacktestResult[]): void => {
  console.log('\n');
  console.log('='.repeat(120));
  console.log('FIBONACCI ENTRY LEVEL COMPARISON - BTCUSDT 2H FUTURES (2 years)');
  console.log('='.repeat(120));
  console.log(`Setups: ${SETUPS.join(', ')}`);
  console.log(`Period: ${CONFIG.startDate} to ${CONFIG.endDate}`);
  console.log(`Leverage: ${CONFIG.leverage}x | Initial Capital: $${CONFIG.initialCapital}`);
  console.log('='.repeat(120));
  console.log('');

  const headers = ['Fib Level', 'Trades', 'Win Rate', 'PnL %', 'Profit Factor', 'Max DD %', 'Sharpe', 'Avg Win', 'Avg Loss'];
  const widths = [12, 8, 10, 10, 14, 10, 8, 10, 10];

  console.log(headers.map((h, i) => h.padEnd(widths[i]!)).join(' | '));
  console.log(widths.map(w => '-'.repeat(w)).join('-+-'));

  for (const r of results) {
    const row = [
      `${r.fibLevel}%`.padEnd(widths[0]!),
      r.totalTrades.toString().padEnd(widths[1]!),
      `${formatNumber(r.winRate)}%`.padEnd(widths[2]!),
      `${formatNumber(r.totalPnlPercent)}%`.padEnd(widths[3]!),
      formatNumber(r.profitFactor).padEnd(widths[4]!),
      `${formatNumber(r.maxDrawdownPercent)}%`.padEnd(widths[5]!),
      formatNumber(r.sharpeRatio).padEnd(widths[6]!),
      `$${formatNumber(r.avgWin)}`.padEnd(widths[7]!),
      `$${formatNumber(r.avgLoss)}`.padEnd(widths[8]!),
    ];
    console.log(row.join(' | '));
  }

  console.log('');
  console.log('='.repeat(120));

  const best = results.reduce((a, b) => a.totalPnlPercent > b.totalPnlPercent ? a : b);
  console.log(`Best PnL: ${best.fibLevel}% level with ${formatNumber(best.totalPnlPercent)}% return`);

  const bestSharpe = results.reduce((a, b) => a.sharpeRatio > b.sharpeRatio ? a : b);
  console.log(`Best Sharpe: ${bestSharpe.fibLevel}% level with ${formatNumber(bestSharpe.sharpeRatio)} ratio`);

  const bestPF = results.reduce((a, b) => a.profitFactor > b.profitFactor ? a : b);
  console.log(`Best Profit Factor: ${bestPF.fibLevel}% level with ${formatNumber(bestPF.profitFactor)}`);

  console.log('='.repeat(120));
};

const main = async (): Promise<void> => {
  console.log('Starting Fibonacci Entry Level Comparison Backtest');
  console.log(`Symbol: ${CONFIG.symbol} | Interval: ${CONFIG.interval} | Market: ${CONFIG.marketType}`);
  console.log(`Testing levels: ${FIBONACCI_LEVELS.join('%, ')}%`);

  const results: BacktestResult[] = [];

  for (const fibLevel of FIBONACCI_LEVELS) {
    try {
      const result = await runBacktest(fibLevel);
      results.push(result);
      console.log(`✅ Completed ${fibLevel}% - ${result.totalTrades} trades, ${formatNumber(result.totalPnlPercent)}% PnL`);
    } catch (error) {
      console.error(`❌ Failed for ${fibLevel}%:`, error);
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
