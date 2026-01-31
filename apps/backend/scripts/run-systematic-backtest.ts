import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { writeFileSync, mkdirSync, appendFileSync } from 'fs';
import {
  BACKTEST_TIMEFRAMES,
  TRADING_DEFAULTS,
  BACKTEST_DEFAULTS,
} from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

type FibLevel = 'auto' | '1' | '1.272' | '1.618' | '2' | '2.618';

interface BacktestConfigVariation {
  name: string;
  rrLong: number;
  rrShort: number;
  fibLong: FibLevel;
  fibShort: FibLevel;
  entryLimit: number;
}

const CONFIGS: BacktestConfigVariation[] = [
  { name: 'entry-23', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 23.6 },
  { name: 'entry-38', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 38.2 },
  { name: 'entry-50', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 50.0 },
  { name: 'entry-62', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 61.8 },
  { name: 'entry-79', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'entry-89', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 88.6 },

  { name: 'rr-baseline', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-equal', rrLong: 1.0, rrShort: 1.0, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-strict', rrLong: 1.5, rrShort: 1.2, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-very-strict', rrLong: 2.0, rrShort: 1.5, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-permissive', rrLong: 0.5, rrShort: 0.5, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-short-bias', rrLong: 1.5, rrShort: 0.5, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'rr-long-bias', rrLong: 0.5, rrShort: 1.5, fibLong: '2', fibShort: '1.272', entryLimit: 78.6 },

  { name: 'fib-conservative', rrLong: 1.0, rrShort: 0.8, fibLong: '1.618', fibShort: '1', entryLimit: 78.6 },
  { name: 'fib-aggressive', rrLong: 1.0, rrShort: 0.8, fibLong: '2.618', fibShort: '1.618', entryLimit: 78.6 },
  { name: 'fib-equal-1', rrLong: 1.0, rrShort: 0.8, fibLong: '1', fibShort: '1', entryLimit: 78.6 },
  { name: 'fib-equal-1618', rrLong: 1.0, rrShort: 0.8, fibLong: '1.618', fibShort: '1.618', entryLimit: 78.6 },
  { name: 'fib-short-quick', rrLong: 1.0, rrShort: 0.8, fibLong: '2', fibShort: '1', entryLimit: 78.6 },
  { name: 'fib-long-extended', rrLong: 1.0, rrShort: 0.8, fibLong: '2.618', fibShort: '1.272', entryLimit: 78.6 },

  { name: 'scalper', rrLong: 0.5, rrShort: 0.5, fibLong: '1.618', fibShort: '1', entryLimit: 50.0 },
  { name: 'day-trader', rrLong: 1.0, rrShort: 0.8, fibLong: '1.618', fibShort: '1.272', entryLimit: 61.8 },
  { name: 'swing', rrLong: 1.5, rrShort: 1.0, fibLong: '2.618', fibShort: '1.618', entryLimit: 38.2 },
  { name: 'momentum', rrLong: 0.8, rrShort: 0.5, fibLong: '2', fibShort: '1', entryLimit: 78.6 },
  { name: 'reversal', rrLong: 1.5, rrShort: 1.5, fibLong: '1.618', fibShort: '1.618', entryLimit: 38.2 },
  { name: 'breakout', rrLong: 1.0, rrShort: 1.0, fibLong: '2.618', fibShort: '2', entryLimit: 23.6 },
];

const TIMEFRAMES = BACKTEST_TIMEFRAMES.filter(tf => ['30m', '1h', '2h', '4h', '1d'].includes(tf));

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
  startDate: '2025-01-24',
  endDate: '2026-01-24',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  setupTypes: SETUPS,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
  useAlgorithmicLevels: true,
  useTrendFilter: true,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciTargetLevel: '2' as const,
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

interface TimeframeResult {
  interval: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
}

interface ConfigResult {
  config: BacktestConfigVariation;
  timeframes: TimeframeResult[];
  avgPnl: number;
  avgSharpe: number;
  totalTrades: number;
  bestTimeframe: string;
  bestPnl: number;
}

const OUTPUT_DIR = `/tmp/systematic-backtest-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;

const formatNumber = (num: number, decimals = 2): string => num.toFixed(decimals);

const runConfigBacktest = async (config: BacktestConfigVariation): Promise<ConfigResult> => {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`CONFIG: ${config.name}`);
  console.log(`R:R LONG=${config.rrLong}, SHORT=${config.rrShort} | Fib LONG=${config.fibLong}, SHORT=${config.fibShort} | Entry=${config.entryLimit}%`);
  console.log('='.repeat(80));

  const timeframes: TimeframeResult[] = [];
  const logFile = `${OUTPUT_DIR}/${config.name}.log`;

  const logToFile = (message: string) => {
    appendFileSync(logFile, message + '\n');
  };

  logToFile(`CONFIG: ${config.name}`);
  logToFile(`R:R LONG=${config.rrLong}, SHORT=${config.rrShort} | Fib LONG=${config.fibLong}, SHORT=${config.fibShort} | Entry=${config.entryLimit}%`);
  logToFile('');

  for (const interval of TIMEFRAMES) {
    try {
      const engine = new BacktestEngine();
      const result = await engine.run({
        ...BASE_CONFIG,
        interval,
        minRiskRewardRatioLong: config.rrLong,
        minRiskRewardRatioShort: config.rrShort,
        fibonacciTargetLevelLong: config.fibLong,
        fibonacciTargetLevelShort: config.fibShort,
        maxFibonacciEntryProgressPercent: config.entryLimit,
      });

      const metrics = result.metrics;
      const tfResult: TimeframeResult = {
        interval,
        totalTrades: metrics.totalTrades,
        winRate: metrics.winRate,
        totalPnlPercent: metrics.totalPnlPercent,
        profitFactor: metrics.profitFactor,
        maxDrawdownPercent: metrics.maxDrawdownPercent,
        sharpeRatio: metrics.sharpeRatio ?? 0,
      };

      timeframes.push(tfResult);

      const logMsg = `  ${interval}: ${tfResult.totalTrades} trades, ${formatNumber(tfResult.totalPnlPercent)}% PnL, ${formatNumber(tfResult.winRate)}% WR, Sharpe ${formatNumber(tfResult.sharpeRatio)}`;
      console.log(logMsg);
      logToFile(logMsg);
    } catch (error) {
      console.error(`  ${interval}: FAILED - ${error instanceof Error ? error.message : error}`);
      logToFile(`  ${interval}: FAILED`);
    }
  }

  const avgPnl = timeframes.length > 0
    ? timeframes.reduce((sum, t) => sum + t.totalPnlPercent, 0) / timeframes.length
    : 0;
  const avgSharpe = timeframes.length > 0
    ? timeframes.reduce((sum, t) => sum + t.sharpeRatio, 0) / timeframes.length
    : 0;
  const totalTrades = timeframes.reduce((sum, t) => sum + t.totalTrades, 0);
  const best = timeframes.length > 0
    ? timeframes.reduce((a, b) => a.totalPnlPercent > b.totalPnlPercent ? a : b)
    : { interval: 'N/A', totalPnlPercent: 0 };

  logToFile('');
  logToFile(`SUMMARY: Avg PnL=${formatNumber(avgPnl)}%, Avg Sharpe=${formatNumber(avgSharpe)}, Total Trades=${totalTrades}, Best=${best.interval} (${formatNumber(best.totalPnlPercent)}%)`);

  return {
    config,
    timeframes,
    avgPnl,
    avgSharpe,
    totalTrades,
    bestTimeframe: best.interval,
    bestPnl: best.totalPnlPercent,
  };
};

const generateSummary = (results: ConfigResult[]): void => {
  const summaryFile = `${OUTPUT_DIR}/summary.txt`;
  const csvFile = `${OUTPUT_DIR}/summary.csv`;

  const sortedByPnl = [...results].sort((a, b) => b.avgPnl - a.avgPnl);
  const sortedBySharpe = [...results].sort((a, b) => b.avgSharpe - a.avgSharpe);

  let summary = '';
  summary += '='.repeat(120) + '\n';
  summary += 'SYSTEMATIC BACKTEST RESULTS\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}\n`;
  summary += `Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType} | Leverage: ${BASE_CONFIG.leverage}x\n`;
  summary += '='.repeat(120) + '\n\n';

  summary += 'RANKING BY AVERAGE PNL\n';
  summary += '-'.repeat(120) + '\n';
  summary += 'Rank | Config            | Avg PnL %  | Avg Sharpe | Total Trades | Best TF   | Best PnL %\n';
  summary += '-'.repeat(120) + '\n';

  sortedByPnl.forEach((r, i) => {
    const pnlColor = r.avgPnl >= 0 ? '+' : '';
    summary += `${(i + 1).toString().padStart(4)} | ${r.config.name.padEnd(17)} | ${pnlColor}${formatNumber(r.avgPnl).padStart(9)}% | ${formatNumber(r.avgSharpe).padStart(10)} | ${r.totalTrades.toString().padStart(12)} | ${r.bestTimeframe.padEnd(9)} | ${formatNumber(r.bestPnl).padStart(9)}%\n`;
  });

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'TOP 5 BY SHARPE RATIO\n';
  summary += '-'.repeat(80) + '\n';

  sortedBySharpe.slice(0, 5).forEach((r, i) => {
    summary += `${i + 1}. ${r.config.name}: Sharpe ${formatNumber(r.avgSharpe)}, PnL ${formatNumber(r.avgPnl)}%\n`;
  });

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'TOP 5 BY PNL\n';
  summary += '-'.repeat(80) + '\n';

  sortedByPnl.slice(0, 5).forEach((r, i) => {
    summary += `${i + 1}. ${r.config.name}: PnL ${formatNumber(r.avgPnl)}%, Sharpe ${formatNumber(r.avgSharpe)}\n`;
  });

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'CONFIGURATION DETAILS\n';
  summary += '-'.repeat(120) + '\n';

  sortedByPnl.forEach((r) => {
    const c = r.config;
    summary += `${c.name}: R:R L=${c.rrLong}/S=${c.rrShort}, Fib L=${c.fibLong}/S=${c.fibShort}, Entry=${c.entryLimit}%\n`;
  });

  writeFileSync(summaryFile, summary);
  console.log(`\nSummary written to: ${summaryFile}`);

  let csv = 'Config,R:R Long,R:R Short,Fib Long,Fib Short,Entry Limit,Avg PnL %,Avg Sharpe,Total Trades,Best TF,Best PnL %\n';
  sortedByPnl.forEach((r) => {
    const c = r.config;
    csv += `${c.name},${c.rrLong},${c.rrShort},${c.fibLong},${c.fibShort},${c.entryLimit},${formatNumber(r.avgPnl)},${formatNumber(r.avgSharpe)},${r.totalTrades},${r.bestTimeframe},${formatNumber(r.bestPnl)}\n`;
  });

  writeFileSync(csvFile, csv);
  console.log(`CSV written to: ${csvFile}`);

  console.log('\n' + summary);
};

const main = async (): Promise<void> => {
  console.log('='.repeat(80));
  console.log('SYSTEMATIC BACKTEST RUNNER');
  console.log('='.repeat(80));
  console.log(`Total configurations: ${CONFIGS.length}`);
  console.log(`Timeframes per config: ${TIMEFRAMES.length}`);
  console.log(`Total backtests: ${CONFIGS.length * TIMEFRAMES.length}`);
  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log('='.repeat(80));

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const results: ConfigResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < CONFIGS.length; i++) {
    const config = CONFIGS[i]!;
    console.log(`\n[${i + 1}/${CONFIGS.length}] Running ${config.name}...`);

    try {
      const result = await runConfigBacktest(config);
      results.push(result);
      console.log(`\n✅ Completed ${config.name}: Avg PnL=${formatNumber(result.avgPnl)}%, Avg Sharpe=${formatNumber(result.avgSharpe)}`);
    } catch (error) {
      console.error(`\n❌ Failed ${config.name}:`, error instanceof Error ? error.message : error);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETED in ${elapsed} minutes`);
  console.log('='.repeat(80));

  if (results.length > 0) {
    generateSummary(results);
  }

  await db.$client.end();
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
