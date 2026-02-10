import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config as dotenvConfig } from 'dotenv';
import { writeFileSync, mkdirSync, appendFileSync, readdirSync, readFileSync, existsSync } from 'fs';
import { BACKTEST_TIMEFRAMES, TRADING_DEFAULTS, BACKTEST_DEFAULTS } from '@marketmind/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../.env') });

const { BacktestEngine } = await import('../src/services/backtesting/BacktestEngine.js');
const { db } = await import('../src/db/index.js');

type FibLevel = 'auto' | '1' | '1.272' | '1.618' | '2' | '2.618';

interface ConfigVariation {
  name: string;
  rrLong: number;
  rrShort: number;
  fibLong: FibLevel;
  fibShort: FibLevel;
  entryLimit: number;
}

const TOP_CONFIGS: ConfigVariation[] = [
  { name: 'entry-23', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 23.6 },
  { name: 'entry-38', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 38.2 },
  { name: 'entry-50', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 50.0 },
  { name: 'entry-62', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 61.8 },
  { name: 'entry-79', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'entry-89', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 88.6 },
  { name: 'entry-100', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 100.0 },
  { name: 'rr-equal-1', rrLong: 1.0, rrShort: 1.0, fibLong: '1.618', fibShort: '1.272', entryLimit: 100.0 },
  { name: 'rr-strict', rrLong: 1.5, rrShort: 1.2, fibLong: '1.618', fibShort: '1.272', entryLimit: 100.0 },
  { name: 'rr-permissive', rrLong: 0.5, rrShort: 0.5, fibLong: '1.618', fibShort: '1.272', entryLimit: 100.0 },
  { name: 'fib-conservative', rrLong: 0.75, rrShort: 0.75, fibLong: '1.272', fibShort: '1', entryLimit: 100.0 },
  { name: 'fib-default-2', rrLong: 0.75, rrShort: 0.75, fibLong: '2', fibShort: '1.272', entryLimit: 100.0 },
  { name: 'fib-aggressive', rrLong: 0.75, rrShort: 0.75, fibLong: '2.618', fibShort: '1.618', entryLimit: 100.0 },
  { name: 'fib-equal-1618', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.618', entryLimit: 100.0 },
  { name: 'scalper', rrLong: 0.5, rrShort: 0.5, fibLong: '1', fibShort: '1', entryLimit: 50.0 },
  { name: 'day-trader', rrLong: 0.75, rrShort: 0.75, fibLong: '1.618', fibShort: '1.272', entryLimit: 78.6 },
  { name: 'swing', rrLong: 1.5, rrShort: 1.0, fibLong: '2.618', fibShort: '1.618', entryLimit: 38.2 },
  { name: 'momentum', rrLong: 0.75, rrShort: 0.5, fibLong: '1.618', fibShort: '1', entryLimit: 100.0 },
];

const TIMEFRAMES = BACKTEST_TIMEFRAMES.filter(tf => ['15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d'].includes(tf));

const STRATEGIES_DIR = resolve(__dirname, '../strategies/builtin');

const loadAllStrategies = (): string[] => {
  const files = readdirSync(STRATEGIES_DIR).filter((f) => f.endsWith('.json'));
  return files.map((f) => basename(f, '.json'));
};

const BASE_CONFIG = {
  symbol: 'BTCUSDT',
  startDate: '2025-01-24',
  endDate: '2026-01-24',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  marginType: 'CROSSED' as const,
  minConfidence: BACKTEST_DEFAULTS.MIN_CONFIDENCE,
  minRiskRewardRatio: 0.75,
  useAlgorithmicLevels: true,
  useTrendFilter: false,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciTargetLevelLong: '1.618' as const,
  fibonacciTargetLevelShort: '1.272' as const,
  fibonacciSwingRange: 'nearest' as const,
  maxFibonacciEntryProgressPercent: 100,
  useStochasticFilter: false,
  useMomentumTimingFilter: true,
  useAdxFilter: false,
  useMtfFilter: false,
  useBtcCorrelationFilter: true,
  useMarketRegimeFilter: false,
  useVolumeFilter: true,
  useFundingFilter: false,
  useConfluenceScoring: false,
  confluenceMinScore: 60,
  simulateFundingRates: true,
  simulateLiquidation: true,
  useCooldown: true,
  cooldownMinutes: TRADING_DEFAULTS.COOLDOWN_MINUTES,
  positionSizePercent: 10,
};

interface BacktestResult {
  strategy: string;
  config: string;
  interval: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  avgTradePercent: number;
}

interface StrategyRanking {
  strategy: string;
  avgPnl: number;
  avgSharpe: number;
  totalTrades: number;
  bestConfig: string;
  bestTimeframe: string;
  bestPnl: number;
}

const OUTPUT_DIR = `/tmp/full-optimization-nearest-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
const PROGRESS_FILE = `${OUTPUT_DIR}/progress.json`;

const formatNumber = (num: number, decimals = 2): string => num.toFixed(decimals);

const loadProgress = (): Set<string> => {
  if (existsSync(PROGRESS_FILE)) {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    return new Set(data.completed || []);
  }
  return new Set();
};

const saveProgress = (completed: Set<string>): void => {
  writeFileSync(PROGRESS_FILE, JSON.stringify({ completed: [...completed] }, null, 2));
};

const runSingleBacktest = async (
  strategy: string,
  config: ConfigVariation,
  interval: string
): Promise<BacktestResult | null> => {
  try {
    const engine = new BacktestEngine();
    const result = await engine.run({
      ...BASE_CONFIG,
      interval,
      setupTypes: [strategy],
      minRiskRewardRatioLong: config.rrLong,
      minRiskRewardRatioShort: config.rrShort,
      fibonacciTargetLevelLong: config.fibLong,
      fibonacciTargetLevelShort: config.fibShort,
      maxFibonacciEntryProgressPercent: config.entryLimit,
      silent: true,
    });

    const metrics = result.metrics;
    return {
      strategy,
      config: config.name,
      interval,
      totalTrades: metrics.totalTrades,
      winRate: metrics.winRate,
      totalPnlPercent: metrics.totalPnlPercent,
      profitFactor: metrics.profitFactor,
      maxDrawdownPercent: metrics.maxDrawdownPercent,
      sharpeRatio: metrics.sharpeRatio ?? 0,
      avgTradePercent: metrics.totalTrades > 0 ? metrics.totalPnlPercent / metrics.totalTrades : 0,
    };
  } catch {
    return null;
  }
};

const generateReports = (results: BacktestResult[]): void => {
  const byStrategy = new Map<string, BacktestResult[]>();
  for (const r of results) {
    if (!byStrategy.has(r.strategy)) byStrategy.set(r.strategy, []);
    byStrategy.get(r.strategy)!.push(r);
  }

  const rankings: StrategyRanking[] = [];
  for (const [strategy, strategyResults] of byStrategy) {
    const avgPnl = strategyResults.reduce((sum, r) => sum + r.totalPnlPercent, 0) / strategyResults.length;
    const avgSharpe = strategyResults.reduce((sum, r) => sum + r.sharpeRatio, 0) / strategyResults.length;
    const totalTrades = strategyResults.reduce((sum, r) => sum + r.totalTrades, 0);
    const best = strategyResults.reduce((a, b) => (a.totalPnlPercent > b.totalPnlPercent ? a : b));

    rankings.push({
      strategy,
      avgPnl,
      avgSharpe,
      totalTrades,
      bestConfig: best.config,
      bestTimeframe: best.interval,
      bestPnl: best.totalPnlPercent,
    });
  }

  rankings.sort((a, b) => b.avgPnl - a.avgPnl);

  let summary = '';
  summary += '='.repeat(140) + '\n';
  summary += 'FULL STRATEGY OPTIMIZATION RESULTS\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${BASE_CONFIG.startDate} to ${BASE_CONFIG.endDate}\n`;
  summary += `Symbol: ${BASE_CONFIG.symbol} | Market: ${BASE_CONFIG.marketType} | Fib Swing: nearest | Fib L=${BASE_CONFIG.fibonacciTargetLevelLong} S=${BASE_CONFIG.fibonacciTargetLevelShort}\n`;
  summary += `Strategies: ${byStrategy.size} | Configs: ${TOP_CONFIGS.length} | Timeframes: ${TIMEFRAMES.length}\n`;
  summary += `Total Backtests: ${results.length}\n`;
  summary += '='.repeat(140) + '\n\n';

  summary += 'TOP 20 STRATEGIES BY AVERAGE PNL\n';
  summary += '-'.repeat(140) + '\n';
  summary += 'Rank | Strategy                          | Avg PnL %  | Avg Sharpe | Trades | Best Config  | Best TF | Best PnL %\n';
  summary += '-'.repeat(140) + '\n';

  rankings.slice(0, 20).forEach((r, i) => {
    const pnlSign = r.avgPnl >= 0 ? '+' : '';
    summary += `${(i + 1).toString().padStart(4)} | ${r.strategy.padEnd(33)} | ${pnlSign}${formatNumber(r.avgPnl).padStart(9)}% | ${formatNumber(r.avgSharpe).padStart(10)} | ${r.totalTrades.toString().padStart(6)} | ${r.bestConfig.padEnd(12)} | ${r.bestTimeframe.padEnd(7)} | ${formatNumber(r.bestPnl).padStart(9)}%\n`;
  });

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'TOP 10 BY SHARPE RATIO\n';
  summary += '-'.repeat(80) + '\n';

  const bySharpe = [...rankings].sort((a, b) => b.avgSharpe - a.avgSharpe);
  bySharpe.slice(0, 10).forEach((r, i) => {
    summary += `${i + 1}. ${r.strategy}: Sharpe ${formatNumber(r.avgSharpe)}, PnL ${formatNumber(r.avgPnl)}%\n`;
  });

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'STRATEGIES WITH POSITIVE PNL\n';
  summary += '-'.repeat(80) + '\n';

  const positive = rankings.filter((r) => r.avgPnl > 0);
  summary += `Total: ${positive.length}/${rankings.length} (${formatNumber((positive.length / rankings.length) * 100)}%)\n\n`;

  positive.forEach((r, i) => {
    summary += `${i + 1}. ${r.strategy}: +${formatNumber(r.avgPnl)}% (${r.bestConfig}/${r.bestTimeframe})\n`;
  });

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'OPTIMAL CONFIGURATION RECOMMENDATIONS\n';
  summary += '-'.repeat(80) + '\n';

  const configStats = new Map<string, { totalPnl: number; count: number }>();
  for (const r of results) {
    if (!configStats.has(r.config)) configStats.set(r.config, { totalPnl: 0, count: 0 });
    const stats = configStats.get(r.config)!;
    stats.totalPnl += r.totalPnlPercent;
    stats.count++;
  }

  const configRanking = [...configStats.entries()]
    .map(([name, stats]) => ({ name, avgPnl: stats.totalPnl / stats.count }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  summary += '\nBest Config Overall:\n';
  configRanking.forEach((c, i) => {
    summary += `${i + 1}. ${c.name}: ${formatNumber(c.avgPnl)}% avg PnL\n`;
  });

  const tfStats = new Map<string, { totalPnl: number; count: number }>();
  for (const r of results) {
    if (!tfStats.has(r.interval)) tfStats.set(r.interval, { totalPnl: 0, count: 0 });
    const stats = tfStats.get(r.interval)!;
    stats.totalPnl += r.totalPnlPercent;
    stats.count++;
  }

  const tfRanking = [...tfStats.entries()]
    .map(([name, stats]) => ({ name, avgPnl: stats.totalPnl / stats.count }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  summary += '\nBest Timeframe Overall:\n';
  tfRanking.forEach((t, i) => {
    summary += `${i + 1}. ${t.name}: ${formatNumber(t.avgPnl)}% avg PnL\n`;
  });

  writeFileSync(`${OUTPUT_DIR}/summary.txt`, summary);
  console.log(`\nSummary written to: ${OUTPUT_DIR}/summary.txt`);

  let csv = 'Strategy,Config,Interval,Trades,Win Rate,PnL %,Profit Factor,Max DD %,Sharpe,Avg Trade %\n';
  for (const r of results) {
    csv += `${r.strategy},${r.config},${r.interval},${r.totalTrades},${formatNumber(r.winRate)},${formatNumber(r.totalPnlPercent)},${formatNumber(r.profitFactor)},${formatNumber(r.maxDrawdownPercent)},${formatNumber(r.sharpeRatio)},${formatNumber(r.avgTradePercent)}\n`;
  }
  writeFileSync(`${OUTPUT_DIR}/full-results.csv`, csv);

  const optimalConfig = {
    generatedAt: new Date().toISOString(),
    topStrategies: rankings.slice(0, 10).map((r) => ({
      strategy: r.strategy,
      avgPnl: r.avgPnl,
      avgSharpe: r.avgSharpe,
      recommendedConfig: r.bestConfig,
      recommendedTimeframe: r.bestTimeframe,
    })),
    configRanking: configRanking.map((c) => ({ name: c.name, avgPnl: c.avgPnl })),
    timeframeRanking: tfRanking.map((t) => ({ name: t.name, avgPnl: t.avgPnl })),
  };
  writeFileSync(`${OUTPUT_DIR}/optimal-config.json`, JSON.stringify(optimalConfig, null, 2));

  console.log('\n' + summary);
};

const main = async (): Promise<void> => {
  const strategies = loadAllStrategies();
  const totalBacktests = strategies.length * TOP_CONFIGS.length * TIMEFRAMES.length;

  console.log('='.repeat(80));
  console.log('FULL STRATEGY OPTIMIZATION');
  console.log('='.repeat(80));
  console.log(`Strategies: ${strategies.length}`);
  console.log(`Configs: ${TOP_CONFIGS.length} (${TOP_CONFIGS.map((c) => c.name).join(', ')})`);
  console.log(`Timeframes: ${TIMEFRAMES.length} (${TIMEFRAMES.join(', ')})`);
  console.log(`Total backtests: ${totalBacktests}`);
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log('='.repeat(80));

  mkdirSync(OUTPUT_DIR, { recursive: true });
  mkdirSync(`${OUTPUT_DIR}/by-strategy`, { recursive: true });

  const completed = loadProgress();
  const results: BacktestResult[] = [];
  const startTime = Date.now();
  let processed = 0;

  for (const strategy of strategies) {
    const strategyResults: BacktestResult[] = [];
    const strategyLogFile = `${OUTPUT_DIR}/by-strategy/${strategy}.log`;

    console.log(`\n[${strategies.indexOf(strategy) + 1}/${strategies.length}] ${strategy}`);
    appendFileSync(strategyLogFile, `Strategy: ${strategy}\n${'='.repeat(60)}\n`);

    for (const config of TOP_CONFIGS) {
      for (const interval of TIMEFRAMES) {
        const key = `${strategy}|${config.name}|${interval}`;

        if (completed.has(key)) {
          processed++;
          continue;
        }

        const result = await runSingleBacktest(strategy, config, interval);
        processed++;

        const progress = ((processed / totalBacktests) * 100).toFixed(1);
        const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
        const eta = processed > 0 ? (((Date.now() - startTime) / processed) * (totalBacktests - processed) / 1000 / 60).toFixed(0) : '?';

        if (result) {
          results.push(result);
          strategyResults.push(result);

          const logLine = `  ${config.name}/${interval}: ${result.totalTrades} trades, ${formatNumber(result.totalPnlPercent)}% PnL, Sharpe ${formatNumber(result.sharpeRatio)}`;
          console.log(`  [${progress}%] ${config.name}/${interval}: ${result.totalTrades}T, ${formatNumber(result.totalPnlPercent)}% (ETA: ${eta}m)`);
          appendFileSync(strategyLogFile, logLine + '\n');
        } else {
          console.log(`  [${progress}%] ${config.name}/${interval}: FAILED`);
          appendFileSync(strategyLogFile, `  ${config.name}/${interval}: FAILED\n`);
        }

        completed.add(key);
        if (processed % 10 === 0) saveProgress(completed);
      }
    }

    if (strategyResults.length > 0) {
      const avgPnl = strategyResults.reduce((sum, r) => sum + r.totalPnlPercent, 0) / strategyResults.length;
      const best = strategyResults.reduce((a, b) => (a.totalPnlPercent > b.totalPnlPercent ? a : b));
      console.log(`  ✅ ${strategy}: Avg PnL=${formatNumber(avgPnl)}%, Best=${best.config}/${best.interval} (${formatNumber(best.totalPnlPercent)}%)`);
      appendFileSync(strategyLogFile, `\nSummary: Avg PnL=${formatNumber(avgPnl)}%, Best=${best.config}/${best.interval}\n`);
    }
  }

  saveProgress(completed);

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n${'='.repeat(80)}`);
  console.log(`COMPLETED in ${elapsed} minutes`);
  console.log(`Successful backtests: ${results.length}/${totalBacktests}`);
  console.log('='.repeat(80));

  if (results.length > 0) {
    generateReports(results);
  }

  await db.$client.end();
  process.exit(0);
};

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
