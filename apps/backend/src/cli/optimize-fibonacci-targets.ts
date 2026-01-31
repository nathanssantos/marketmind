import 'dotenv/config';

process.env.LOG_LEVEL = 'error';

import * as fs from 'fs';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, MultiWatcherBacktestConfig } from '@marketmind/types';
import { TRADING_DEFAULTS, FILTER_DEFAULTS } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  DEFAULT_BACKTEST_PARAMS,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
  parseCliArgs,
} from './shared-backtest-config';

type FibonacciLevel = 'auto' | '1' | '1.272' | '1.382' | '1.5' | '1.618' | '2' | '2.272' | '2.618';
type TpMode = 'default' | 'fibonacci';

interface FibonacciConfig {
  tpMode: TpMode;
  longLevel: FibonacciLevel;
  shortLevel: FibonacciLevel;
}

interface TestResult {
  name: string;
  tpMode: TpMode;
  longLevel: FibonacciLevel;
  shortLevel: FibonacciLevel;
  pnl: number;
  pnlPct: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  longPnl: number;
  longTrades: number;
  longWinRate: number;
  shortPnl: number;
  shortTrades: number;
  shortWinRate: number;
  avgWin: number;
  avgLoss: number;
}

const FIBONACCI_LEVELS: FibonacciLevel[] = ['auto', '1', '1.272', '1.382', '1.5', '1.618', '2', '2.272', '2.618'];
const TP_MODES: TpMode[] = ['default', 'fibonacci'];

const generateFibonacciCombinations = (): FibonacciConfig[] => {
  const combinations: FibonacciConfig[] = [];

  combinations.push({ tpMode: 'default', longLevel: 'auto', shortLevel: 'auto' });

  for (const longLevel of FIBONACCI_LEVELS) {
    for (const shortLevel of FIBONACCI_LEVELS) {
      combinations.push({ tpMode: 'fibonacci', longLevel, shortLevel });
    }
  }

  return combinations;
};

const formatConfigName = (config: FibonacciConfig): string => {
  if (config.tpMode === 'default') return 'TP: Default (no Fib)';
  return `Fib: L=${config.longLevel} S=${config.shortLevel}`;
};

const printProgress = (current: number, total: number, startTime: number) => {
  const percent = (current / total) * 100;
  const elapsed = (Date.now() - startTime) / 1000;
  const eta = current > 0 ? ((elapsed / current) * (total - current)) : 0;
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r⏳ [${bar}] ${current}/${total} (${percent.toFixed(0)}%) ETA: ${eta.toFixed(0)}s    `);
};

async function runOptimization() {
  console.log('🎯 Fibonacci Target Level Optimization');
  console.log('======================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const combinations = generateFibonacciCombinations();

  const watchers: WatcherConfig[] = [
    {
      symbol,
      interval,
      marketType: 'FUTURES',
      setupTypes: [...ENABLED_SETUPS],
    },
  ];

  console.log(`📊 Symbol: ${symbol}@${interval} (FUTURES)`);
  console.log(`📅 Period: ${startDate} to ${endDate}`);
  console.log(`🔍 TP Modes: ${TP_MODES.join(', ')}`);
  console.log(`📏 Fibonacci Levels: ${FIBONACCI_LEVELS.join(', ')}`);
  console.log(`📋 Combinations to test: ${combinations.length} (1 default + ${FIBONACCI_LEVELS.length}² fibonacci)\n`);

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate' | 'tpCalculationMode' | 'fibonacciTargetLevelLong' | 'fibonacciTargetLevelShort'> = {
    initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
    exposureMultiplier: DEFAULT_BACKTEST_PARAMS.exposureMultiplier,
    minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
    setupTypes: [...ENABLED_SETUPS],
    useSharedExposure: true,
    marketType: DEFAULT_BACKTEST_PARAMS.marketType,
    leverage: DEFAULT_BACKTEST_PARAMS.leverage,
    useCooldown: true,
    cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,
    trendFilterPeriod: 21,
    useTrendFilter: false,
    useMtfFilter: false,
    useMarketRegimeFilter: false,
    useMomentumTimingFilter: false,
    useVolumeFilter: false,
    useStochasticFilter: false,
    useAdxFilter: false,
    useFundingFilter: false,
    useBtcCorrelationFilter: true,
    useConfluenceScoring: false,
    volumeFilterConfig: {
      longConfig: {
        useObvCheck: FILTER_DEFAULTS.useObvCheckLong,
        obvLookback: FILTER_DEFAULTS.volumeFilterObvLookbackLong,
      },
      shortConfig: {
        useObvCheck: FILTER_DEFAULTS.useObvCheckShort,
        obvLookback: FILTER_DEFAULTS.volumeFilterObvLookbackShort,
      },
    },
  };

  const results: TestResult[] = [];
  const startTime = Date.now();

  for (let i = 0; i < combinations.length; i++) {
    const config = combinations[i]!;
    printProgress(i, combinations.length, startTime);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      watchers,
      startDate,
      endDate,
      tpCalculationMode: config.tpMode,
      fibonacciTargetLevel: 'auto',
      fibonacciTargetLevelLong: config.longLevel,
      fibonacciTargetLevelShort: config.shortLevel,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      name: formatConfigName(config),
      tpMode: config.tpMode,
      longLevel: config.longLevel,
      shortLevel: config.shortLevel,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl: longMetrics.pnl,
      longTrades: longMetrics.trades,
      longWinRate: longMetrics.winRate,
      shortPnl: shortMetrics.pnl,
      shortTrades: shortMetrics.trades,
      shortWinRate: shortMetrics.winRate,
      avgWin: result.metrics.avgWin,
      avgLoss: result.metrics.avgLoss,
    });
  }

  printProgress(combinations.length, combinations.length, startTime);
  console.log('\n');

  printResultsTables(results);

  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = `${outputDir}/fibonacci-optimization-${symbol}-${interval}-${new Date().toISOString().split('T')[0]}.json`;
  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);
  const baseline = results.find(r => r.tpMode === 'default')!;
  const best = sortedResults[0]!;

  const outputData = {
    config: { symbol, interval, startDate, endDate },
    baseline,
    best,
    allResults: sortedResults,
    analysis: {
      bestLongLevel: findBestLongLevel(results),
      bestShortLevel: findBestShortLevel(results),
      fibonacciVsDefault: {
        bestFibPnl: best.tpMode === 'fibonacci' ? best.pnl : sortedResults.find(r => r.tpMode === 'fibonacci')?.pnl ?? 0,
        defaultPnl: baseline.pnl,
        fibonacciBetter: best.tpMode === 'fibonacci' || (sortedResults.find(r => r.tpMode === 'fibonacci')?.pnl ?? 0) > baseline.pnl,
      },
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  process.exit(0);
}

function findBestLongLevel(results: TestResult[]): { level: FibonacciLevel; avgPnl: number } {
  const fibResults = results.filter(r => r.tpMode === 'fibonacci');
  const levelPnls = new Map<FibonacciLevel, number[]>();

  for (const r of fibResults) {
    if (!levelPnls.has(r.longLevel)) levelPnls.set(r.longLevel, []);
    levelPnls.get(r.longLevel)!.push(r.pnl);
  }

  let bestLevel: FibonacciLevel = 'auto';
  let bestAvg = -Infinity;

  for (const [level, pnls] of levelPnls) {
    const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestLevel = level;
    }
  }

  return { level: bestLevel, avgPnl: bestAvg };
}

function findBestShortLevel(results: TestResult[]): { level: FibonacciLevel; avgPnl: number } {
  const fibResults = results.filter(r => r.tpMode === 'fibonacci');
  const levelPnls = new Map<FibonacciLevel, number[]>();

  for (const r of fibResults) {
    if (!levelPnls.has(r.shortLevel)) levelPnls.set(r.shortLevel, []);
    levelPnls.get(r.shortLevel)!.push(r.pnl);
  }

  let bestLevel: FibonacciLevel = 'auto';
  let bestAvg = -Infinity;

  for (const [level, pnls] of levelPnls) {
    const avg = pnls.reduce((a, b) => a + b, 0) / pnls.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestLevel = level;
    }
  }

  return { level: bestLevel, avgPnl: bestAvg };
}

function printResultsTables(results: TestResult[]) {
  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);
  const baseline = results.find(r => r.tpMode === 'default')!;

  console.log('═'.repeat(150));
  console.log('📊 TOP 20 FIBONACCI CONFIGURATIONS (by P&L)');
  console.log('═'.repeat(150) + '\n');

  console.log('Rank  Configuration                   P&L          P&L%    Trades   WinRate    PF    MaxDD    AvgWin    AvgLoss    LONG P&L    SHORT P&L');
  console.log('─'.repeat(150));

  for (let i = 0; i < Math.min(20, sortedResults.length); i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = r.name.padEnd(32);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const avgWinStr = `$${formatCurrency(r.avgWin)}`.padStart(9);
    const avgLossStr = `$${formatCurrency(r.avgLoss)}`.padStart(9);
    const longPnlStr = `$${formatCurrency(r.longPnl)}`.padStart(11);
    const shortPnlStr = `$${formatCurrency(r.shortPnl)}`.padStart(11);

    const marker = i === 0 ? '🏆' : i < 3 ? '🥈' : i < 5 ? '🥉' : '  ';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${avgWinStr} ${avgLossStr} ${longPnlStr} ${shortPnlStr}`);
  }

  console.log('─'.repeat(150));

  console.log('\n' + '═'.repeat(120));
  console.log('📈 BEST LONG LEVELS (averaged across all SHORT levels)');
  console.log('═'.repeat(120) + '\n');

  const longLevelStats = new Map<FibonacciLevel, { pnls: number[]; trades: number[]; winRates: number[] }>();

  for (const r of results.filter(r => r.tpMode === 'fibonacci')) {
    if (!longLevelStats.has(r.longLevel)) {
      longLevelStats.set(r.longLevel, { pnls: [], trades: [], winRates: [] });
    }
    const stats = longLevelStats.get(r.longLevel)!;
    stats.pnls.push(r.pnl);
    stats.trades.push(r.trades);
    stats.winRates.push(r.winRate);
  }

  console.log('LONG Level    Avg P&L       Min P&L      Max P&L    Avg Trades   Avg WinRate   Value vs Default');
  console.log('─'.repeat(100));

  const longLevelSorted = [...longLevelStats.entries()]
    .map(([level, stats]) => ({
      level,
      avgPnl: stats.pnls.reduce((a, b) => a + b, 0) / stats.pnls.length,
      minPnl: Math.min(...stats.pnls),
      maxPnl: Math.max(...stats.pnls),
      avgTrades: stats.trades.reduce((a, b) => a + b, 0) / stats.trades.length,
      avgWinRate: stats.winRates.reduce((a, b) => a + b, 0) / stats.winRates.length,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  for (const stats of longLevelSorted) {
    const levelStr = stats.level.padEnd(12);
    const avgPnlStr = `$${formatCurrency(stats.avgPnl)}`.padStart(12);
    const minPnlStr = `$${formatCurrency(stats.minPnl)}`.padStart(12);
    const maxPnlStr = `$${formatCurrency(stats.maxPnl)}`.padStart(10);
    const avgTradesStr = stats.avgTrades.toFixed(0).padStart(10);
    const avgWrStr = formatPercent(stats.avgWinRate).padStart(12);
    const diffPnl = stats.avgPnl - baseline.pnl;
    const valueStr = `${diffPnl >= 0 ? '+' : ''}$${formatCurrency(diffPnl)}`.padStart(16);

    const marker = longLevelSorted[0] === stats ? '🏆' : '  ';
    console.log(`${marker}${levelStr} ${avgPnlStr} ${minPnlStr} ${maxPnlStr} ${avgTradesStr} ${avgWrStr} ${valueStr}`);
  }

  console.log('─'.repeat(100));

  console.log('\n' + '═'.repeat(120));
  console.log('📉 BEST SHORT LEVELS (averaged across all LONG levels)');
  console.log('═'.repeat(120) + '\n');

  const shortLevelStats = new Map<FibonacciLevel, { pnls: number[]; trades: number[]; winRates: number[] }>();

  for (const r of results.filter(r => r.tpMode === 'fibonacci')) {
    if (!shortLevelStats.has(r.shortLevel)) {
      shortLevelStats.set(r.shortLevel, { pnls: [], trades: [], winRates: [] });
    }
    const stats = shortLevelStats.get(r.shortLevel)!;
    stats.pnls.push(r.pnl);
    stats.trades.push(r.trades);
    stats.winRates.push(r.winRate);
  }

  console.log('SHORT Level   Avg P&L       Min P&L      Max P&L    Avg Trades   Avg WinRate   Value vs Default');
  console.log('─'.repeat(100));

  const shortLevelSorted = [...shortLevelStats.entries()]
    .map(([level, stats]) => ({
      level,
      avgPnl: stats.pnls.reduce((a, b) => a + b, 0) / stats.pnls.length,
      minPnl: Math.min(...stats.pnls),
      maxPnl: Math.max(...stats.pnls),
      avgTrades: stats.trades.reduce((a, b) => a + b, 0) / stats.trades.length,
      avgWinRate: stats.winRates.reduce((a, b) => a + b, 0) / stats.winRates.length,
    }))
    .sort((a, b) => b.avgPnl - a.avgPnl);

  for (const stats of shortLevelSorted) {
    const levelStr = stats.level.padEnd(12);
    const avgPnlStr = `$${formatCurrency(stats.avgPnl)}`.padStart(12);
    const minPnlStr = `$${formatCurrency(stats.minPnl)}`.padStart(12);
    const maxPnlStr = `$${formatCurrency(stats.maxPnl)}`.padStart(10);
    const avgTradesStr = stats.avgTrades.toFixed(0).padStart(10);
    const avgWrStr = formatPercent(stats.avgWinRate).padStart(12);
    const diffPnl = stats.avgPnl - baseline.pnl;
    const valueStr = `${diffPnl >= 0 ? '+' : ''}$${formatCurrency(diffPnl)}`.padStart(16);

    const marker = shortLevelSorted[0] === stats ? '🏆' : '  ';
    console.log(`${marker}${levelStr} ${avgPnlStr} ${minPnlStr} ${maxPnlStr} ${avgTradesStr} ${avgWrStr} ${valueStr}`);
  }

  console.log('─'.repeat(100));

  console.log('\n' + '═'.repeat(120));
  console.log('🎯 SUMMARY: FIBONACCI vs DEFAULT TP');
  console.log('═'.repeat(120) + '\n');

  const fibResults = results.filter(r => r.tpMode === 'fibonacci');
  const bestFib = [...fibResults].sort((a, b) => b.pnl - a.pnl)[0]!;
  const avgFibPnl = fibResults.reduce((sum, r) => sum + r.pnl, 0) / fibResults.length;
  const profitableFib = fibResults.filter(r => r.pnl > 0).length;

  console.log(`📌 Default TP (no Fibonacci):`);
  console.log(`   P&L: $${formatCurrency(baseline.pnl)} | WR: ${formatPercent(baseline.winRate)} | PF: ${baseline.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(baseline.maxDrawdown)}`);
  console.log(`   Trades: ${baseline.trades} | LONG: $${formatCurrency(baseline.longPnl)} | SHORT: $${formatCurrency(baseline.shortPnl)}`);

  console.log(`\n🏆 Best Fibonacci Config:`);
  console.log(`   ${bestFib.name}`);
  console.log(`   P&L: $${formatCurrency(bestFib.pnl)} | WR: ${formatPercent(bestFib.winRate)} | PF: ${bestFib.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(bestFib.maxDrawdown)}`);
  console.log(`   Trades: ${bestFib.trades} | LONG: $${formatCurrency(bestFib.longPnl)} | SHORT: $${formatCurrency(bestFib.shortPnl)}`);
  console.log(`   vs Default: ${bestFib.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(bestFib.pnl - baseline.pnl)}`);

  console.log(`\n📊 Statistics:`);
  console.log(`   • Best LONG level: ${longLevelSorted[0]?.level} (avg P&L: $${formatCurrency(longLevelSorted[0]?.avgPnl ?? 0)})`);
  console.log(`   • Best SHORT level: ${shortLevelSorted[0]?.level} (avg P&L: $${formatCurrency(shortLevelSorted[0]?.avgPnl ?? 0)})`);
  console.log(`   • Profitable Fib configs: ${profitableFib}/${fibResults.length} (${formatPercent((profitableFib / fibResults.length) * 100)})`);
  console.log(`   • Average Fib P&L: $${formatCurrency(avgFibPnl)}`);
  console.log(`   • Fibonacci adds value: ${bestFib.pnl > baseline.pnl ? '✅ YES' : '❌ NO'}`);

  if (bestFib.pnl > baseline.pnl) {
    console.log(`\n💡 RECOMMENDATION: Use Fibonacci TP with LONG=${bestFib.longLevel}, SHORT=${bestFib.shortLevel}`);
  } else {
    console.log(`\n💡 RECOMMENDATION: Keep using default TP mode (Fibonacci doesn't add value for this config)`);
  }
}

runOptimization().catch(console.error);
