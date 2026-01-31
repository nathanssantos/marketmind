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

interface TestConfig {
  name: string;
  config: Partial<MultiWatcherBacktestConfig>;
  category: 'baseline' | 'fibonacci' | 'filter' | 'combination';
}

interface TestResult {
  name: string;
  category: string;
  pnl: number;
  pnlPct: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  longPnl: number;
  shortPnl: number;
  longTrades: number;
  shortTrades: number;
}

interface StrategyStats {
  setupType: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgPnl: number;
  profitFactor: number;
  longTrades: number;
  shortTrades: number;
  longPnl: number;
  shortPnl: number;
}

const FILTER_KEYS = [
  'useMtfFilter',
  'useMarketRegimeFilter',
  'useTrendFilter',
  'useDirectionFilter',
  'useMomentumTimingFilter',
  'useStochasticFilter',
  'useAdxFilter',
  'useVolumeFilter',
  'useFundingFilter',
  'useBtcCorrelationFilter',
] as const;

const FILTER_NAMES: Record<typeof FILTER_KEYS[number], string> = {
  useMtfFilter: 'MTF',
  useMarketRegimeFilter: 'MarketRegime',
  useTrendFilter: 'TrendEMA',
  useDirectionFilter: 'Direction',
  useMomentumTimingFilter: 'MomentumTiming',
  useStochasticFilter: 'Stochastic',
  useAdxFilter: 'ADX',
  useVolumeFilter: 'Volume',
  useFundingFilter: 'Funding',
  useBtcCorrelationFilter: 'BtcCorrelation',
};

const calculateStrategyStats = (trades: Array<{ setupType?: string; side: 'LONG' | 'SHORT'; pnl?: number; netPnl?: number }>): StrategyStats[] => {
  const statsMap = new Map<string, StrategyStats>();

  for (const trade of trades) {
    const setupType = trade.setupType || 'unknown';
    const pnl = trade.netPnl ?? trade.pnl ?? 0;

    if (!statsMap.has(setupType)) {
      statsMap.set(setupType, {
        setupType,
        trades: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        pnl: 0,
        avgPnl: 0,
        profitFactor: 0,
        longTrades: 0,
        shortTrades: 0,
        longPnl: 0,
        shortPnl: 0,
      });
    }

    const stats = statsMap.get(setupType)!;
    stats.trades++;
    stats.pnl += pnl;

    if (pnl > 0) stats.wins++;
    else if (pnl < 0) stats.losses++;

    if (trade.side === 'LONG') {
      stats.longTrades++;
      stats.longPnl += pnl;
    } else {
      stats.shortTrades++;
      stats.shortPnl += pnl;
    }
  }

  for (const stats of statsMap.values()) {
    stats.winRate = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
    stats.avgPnl = stats.trades > 0 ? stats.pnl / stats.trades : 0;

    const totalWinPnl = trades
      .filter(t => t.setupType === stats.setupType && (t.netPnl ?? t.pnl ?? 0) > 0)
      .reduce((sum, t) => sum + (t.netPnl ?? t.pnl ?? 0), 0);
    const totalLossPnl = Math.abs(trades
      .filter(t => t.setupType === stats.setupType && (t.netPnl ?? t.pnl ?? 0) < 0)
      .reduce((sum, t) => sum + (t.netPnl ?? t.pnl ?? 0), 0));

    stats.profitFactor = totalLossPnl > 0 ? totalWinPnl / totalLossPnl : totalWinPnl > 0 ? Infinity : 0;
  }

  return Array.from(statsMap.values()).sort((a, b) => b.pnl - a.pnl);
};

const createAllFiltersOff = (): Partial<MultiWatcherBacktestConfig> => {
  const config: Partial<MultiWatcherBacktestConfig> = {};
  for (const key of FILTER_KEYS) {
    (config as Record<string, boolean>)[key] = false;
  }
  return config;
};

const generateTestConfigs = (): TestConfig[] => {
  const configs: TestConfig[] = [];
  const allFiltersOff = createAllFiltersOff();

  configs.push({
    name: '🔵 Baseline: No Filters, No Fib',
    config: { ...allFiltersOff, tpCalculationMode: 'default' },
    category: 'baseline',
  });

  configs.push({
    name: '🔵 Baseline: No Filters, With Fib (L=1.618, S=1.272)',
    config: {
      ...allFiltersOff,
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevel: 'auto',
      fibonacciTargetLevelLong: '1.618',
      fibonacciTargetLevelShort: '1.272',
    },
    category: 'fibonacci',
  });

  for (const filterKey of FILTER_KEYS) {
    const filterName = FILTER_NAMES[filterKey];

    configs.push({
      name: `🟡 ${filterName} only (no Fib)`,
      config: { ...allFiltersOff, [filterKey]: true, tpCalculationMode: 'default' },
      category: 'filter',
    });

    configs.push({
      name: `🟢 ${filterName} only (with Fib)`,
      config: {
        ...allFiltersOff,
        [filterKey]: true,
        tpCalculationMode: 'fibonacci',
        fibonacciTargetLevelLong: '1.618',
        fibonacciTargetLevelShort: '1.272',
      },
      category: 'filter',
    });
  }

  const bestCombos = [
    { name: 'MTF + MomentumTiming', keys: ['useMtfFilter', 'useMomentumTimingFilter'] },
    { name: 'MTF + Volume', keys: ['useMtfFilter', 'useVolumeFilter'] },
    { name: 'MTF + MarketRegime', keys: ['useMtfFilter', 'useMarketRegimeFilter'] },
    { name: 'MomentumTiming + Volume', keys: ['useMomentumTimingFilter', 'useVolumeFilter'] },
    { name: 'MomentumTiming + MarketRegime', keys: ['useMomentumTimingFilter', 'useMarketRegimeFilter'] },
    { name: 'BtcCorrelation + MomentumTiming', keys: ['useBtcCorrelationFilter', 'useMomentumTimingFilter'] },
    { name: 'TrendEMA + Volume', keys: ['useTrendFilter', 'useVolumeFilter'] },
    { name: 'ADX + MomentumTiming', keys: ['useAdxFilter', 'useMomentumTimingFilter'] },
    { name: 'MTF + MomentumTiming + Volume', keys: ['useMtfFilter', 'useMomentumTimingFilter', 'useVolumeFilter'] },
    { name: 'MTF + MomentumTiming + MarketRegime', keys: ['useMtfFilter', 'useMomentumTimingFilter', 'useMarketRegimeFilter'] },
  ];

  for (const combo of bestCombos) {
    const comboConfig = { ...allFiltersOff };
    for (const key of combo.keys) {
      (comboConfig as Record<string, boolean>)[key] = true;
    }

    configs.push({
      name: `🟡 ${combo.name} (no Fib)`,
      config: { ...comboConfig, tpCalculationMode: 'default' },
      category: 'combination',
    });

    configs.push({
      name: `🟢 ${combo.name} (with Fib)`,
      config: {
        ...comboConfig,
        tpCalculationMode: 'fibonacci',
        fibonacciTargetLevelLong: '1.618',
        fibonacciTargetLevelShort: '1.272',
      },
      category: 'combination',
    });
  }

  configs.push({
    name: '🔴 ALL Filters ON (no Fib)',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: true,
      useDirectionFilter: true,
      useMomentumTimingFilter: true,
      useStochasticFilter: true,
      useAdxFilter: true,
      useVolumeFilter: true,
      useFundingFilter: true,
      useBtcCorrelationFilter: true,
      tpCalculationMode: 'default',
    },
    category: 'combination',
  });

  configs.push({
    name: '🔴 ALL Filters ON (with Fib)',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: true,
      useDirectionFilter: true,
      useMomentumTimingFilter: true,
      useStochasticFilter: true,
      useAdxFilter: true,
      useVolumeFilter: true,
      useFundingFilter: true,
      useBtcCorrelationFilter: true,
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevelLong: '1.618',
      fibonacciTargetLevelShort: '1.272',
    },
    category: 'combination',
  });

  return configs;
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
  console.log('🔬 MASTER OPTIMIZATION: Filters + Fibonacci');
  console.log('===========================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const configs = generateTestConfigs();

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
  console.log(`🔍 Tests to run: ${configs.length}`);
  console.log(`   • Baseline: 3 configs`);
  console.log(`   • Single filters: ${FILTER_KEYS.length * 2} configs (with/without Fib)`);
  console.log(`   • Combinations: ${configs.filter(c => c.category === 'combination').length} configs\n`);

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate'> = {
    initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
    exposureMultiplier: DEFAULT_BACKTEST_PARAMS.exposureMultiplier,
    minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
    setupTypes: [...ENABLED_SETUPS],
    useSharedExposure: true,
    marketType: DEFAULT_BACKTEST_PARAMS.marketType,
    leverage: DEFAULT_BACKTEST_PARAMS.leverage,
    useCooldown: true,
    cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,
    trendFilterPeriod: FILTER_DEFAULTS.trendFilterPeriod,
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
  let bestTrades: Array<{ setupType?: string; side: 'LONG' | 'SHORT'; pnl?: number; netPnl?: number }> = [];
  let bestPnl = -Infinity;
  let diagnosticsPrinted = false;

  for (let i = 0; i < configs.length; i++) {
    const testConfig = configs[i]!;
    printProgress(i, configs.length, startTime);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      ...testConfig.config,
      watchers,
      startDate,
      endDate,
      silent: true,
    });

    const result = await engine.run();

    if (!diagnosticsPrinted && i === 0) {
      diagnosticsPrinted = true;
      console.log('\n\n📊 DIAGNOSTIC: Setup Detection (Baseline - No Filters)');
      console.log('═'.repeat(80));
      for (const stats of result.watcherStats) {
        console.log(`\n📌 ${stats.symbol}@${stats.interval}:`);
        console.log(`   Setups Detected: ${stats.totalSetups}`);
        console.log(`   Trades Executed: ${stats.tradesExecuted}`);
        console.log(`   Trades Skipped:  ${stats.tradesSkipped}`);
        if (Object.keys(stats.skippedReasons).length > 0) {
          console.log('   Skip Reasons:');
          for (const [reason, count] of Object.entries(stats.skippedReasons)) {
            console.log(`     • ${reason}: ${count}`);
          }
        }
      }

      const setupsByStrategy = new Map<string, number>();
      for (const trade of result.trades) {
        const setupType = trade.setupType || 'unknown';
        setupsByStrategy.set(setupType, (setupsByStrategy.get(setupType) || 0) + 1);
      }

      console.log('\n📈 TRADES BY STRATEGY:');
      const sortedStrategies = Array.from(setupsByStrategy.entries()).sort((a, b) => b[1] - a[1]);
      for (const [strategy, count] of sortedStrategies) {
        console.log(`   • ${strategy}: ${count} trades`);
      }

      console.log('\n═'.repeat(80) + '\n');
    }

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    if (result.metrics.totalPnl > bestPnl) {
      bestPnl = result.metrics.totalPnl;
      bestTrades = result.trades;
    }

    results.push({
      name: testConfig.name,
      category: testConfig.category,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl: longMetrics.pnl,
      shortPnl: shortMetrics.pnl,
      longTrades: longMetrics.trades,
      shortTrades: shortMetrics.trades,
    });
  }

  printProgress(configs.length, configs.length, startTime);
  console.log('\n');

  printResults(results);

  const strategyStats = calculateStrategyStats(bestTrades);
  printStrategyStats(strategyStats);

  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = `${outputDir}/master-optimization-${symbol}-${interval}-${new Date().toISOString().split('T')[0]}.json`;
  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  const outputData = {
    config: { symbol, interval, startDate, endDate },
    summary: generateSummary(results),
    allResults: sortedResults,
    strategyStats,
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  process.exit(0);
}

function generateSummary(results: TestResult[]) {
  const baseline = results.find(r => r.name.includes('No Filters, No Fib'))!;
  const baselineFib = results.find(r => r.name.includes('No Filters, With Fib'))!;

  const fibAddsValue = baselineFib.pnl > baseline.pnl;

  const singleFiltersNoFib = results.filter(r =>
    r.category === 'filter' && r.name.includes('(no Fib)')
  );

  const filtersWithValue = singleFiltersNoFib
    .filter(r => r.pnl > baseline.pnl)
    .map(r => ({ name: r.name.replace('🟡 ', '').replace(' only (no Fib)', ''), pnl: r.pnl, improvement: r.pnl - baseline.pnl }));

  const filtersWithoutValue = singleFiltersNoFib
    .filter(r => r.pnl <= baseline.pnl)
    .map(r => ({ name: r.name.replace('🟡 ', '').replace(' only (no Fib)', ''), pnl: r.pnl, degradation: baseline.pnl - r.pnl }));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);
  const best = sortedResults[0]!;
  const worst = sortedResults[sortedResults.length - 1]!;

  return {
    fibonacciAddsValue: fibAddsValue,
    fibonacciImprovement: baselineFib.pnl - baseline.pnl,
    filtersWithValue,
    filtersWithoutValue,
    bestConfiguration: { name: best.name, pnl: best.pnl, vsBaseline: best.pnl - baseline.pnl },
    worstConfiguration: { name: worst.name, pnl: worst.pnl, vsBaseline: worst.pnl - baseline.pnl },
    baselinePnl: baseline.pnl,
    baselineFibPnl: baselineFib.pnl,
  };
}

function printResults(results: TestResult[]) {
  const baseline = results.find(r => r.name.includes('No Filters, No Fib'))!;
  const baselineFib = results.find(r => r.name.includes('No Filters, With Fib'))!;

  console.log('═'.repeat(160));
  console.log('📊 ALL RESULTS SORTED BY P&L');
  console.log('═'.repeat(160) + '\n');

  console.log('Rank  Configuration                                                    P&L          P&L%    Trades   WinRate    PF    MaxDD    LONG P&L    SHORT P&L   vs Baseline');
  console.log('─'.repeat(160));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = r.name.substring(0, 60).padEnd(60);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longPnlStr = `$${formatCurrency(r.longPnl)}`.padStart(11);
    const shortPnlStr = `$${formatCurrency(r.shortPnl)}`.padStart(11);
    const diffPnl = r.pnl - baseline.pnl;
    const diffStr = `${diffPnl >= 0 ? '+' : ''}$${formatCurrency(diffPnl)}`.padStart(12);

    const marker = i === 0 ? '🏆' : i < 3 ? '🥈' : i < 5 ? '🥉' : '  ';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${longPnlStr} ${shortPnlStr} ${diffStr}`);
  }

  console.log('─'.repeat(160));

  console.log('\n' + '═'.repeat(100));
  console.log('🎯 FIBONACCI ANALYSIS: Does it add value?');
  console.log('═'.repeat(100) + '\n');

  console.log(`📌 Without Fibonacci: P&L=$${formatCurrency(baseline.pnl)} | WR=${formatPercent(baseline.winRate)} | MaxDD=${formatPercent(baseline.maxDrawdown)}`);
  console.log(`📌 With Fibonacci:    P&L=$${formatCurrency(baselineFib.pnl)} | WR=${formatPercent(baselineFib.winRate)} | MaxDD=${formatPercent(baselineFib.maxDrawdown)}`);
  console.log('');
  const fibDiff = baselineFib.pnl - baseline.pnl;
  console.log(`   Difference: ${fibDiff >= 0 ? '+' : ''}$${formatCurrency(fibDiff)}`);
  console.log(`   Fibonacci adds value: ${fibDiff > 0 ? '✅ YES' : '❌ NO'}`);

  const withFibResults = results.filter(r => r.name.includes('(with Fib)'));
  const noFibResults = results.filter(r => r.name.includes('(no Fib)'));

  let fibBetter = 0;
  let noFibBetter = 0;

  for (const noFibResult of noFibResults) {
    const baseName = noFibResult.name.replace(' (no Fib)', '').replace('🟡 ', '').replace('🟢 ', '').replace('🔴 ', '');
    const withFibResult = withFibResults.find(r => r.name.includes(baseName));
    if (withFibResult) {
      if (withFibResult.pnl > noFibResult.pnl) fibBetter++;
      else noFibBetter++;
    }
  }

  console.log(`\n   Across all configs: Fib better in ${fibBetter}/${fibBetter + noFibBetter} cases (${formatPercent((fibBetter / (fibBetter + noFibBetter)) * 100)})`);

  console.log('\n' + '═'.repeat(100));
  console.log('🔍 INDIVIDUAL FILTER VALUE (comparing to baseline, no Fib)');
  console.log('═'.repeat(100) + '\n');

  const singleFiltersNoFib = results.filter(r =>
    r.category === 'filter' && r.name.includes('(no Fib)')
  );
  const sortedFilters = [...singleFiltersNoFib].sort((a, b) => b.pnl - a.pnl);

  console.log('Filter           P&L        vs Baseline    Trades   WinRate    PF    MaxDD    Adds Value?');
  console.log('─'.repeat(100));

  for (const r of sortedFilters) {
    const filterName = r.name.replace('🟡 ', '').replace(' only (no Fib)', '').padEnd(16);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(10);
    const diffPnl = r.pnl - baseline.pnl;
    const diffStr = `${diffPnl >= 0 ? '+' : ''}$${formatCurrency(diffPnl)}`.padStart(14);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);

    const valueAdded = diffPnl > 0 && r.maxDrawdown <= baseline.maxDrawdown * 1.1 ? '✅ YES' :
                       diffPnl > 0 ? '⚠️ MAYBE' : '❌ NO';

    console.log(`${filterName} ${pnlStr} ${diffStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr}    ${valueAdded}`);
  }

  console.log('─'.repeat(100));

  console.log('\n' + '═'.repeat(100));
  console.log('🏆 SUMMARY & RECOMMENDATIONS');
  console.log('═'.repeat(100) + '\n');

  const best = sortedResults[0]!;

  console.log('📌 BASELINE (no filters, no Fib):');
  console.log(`   P&L: $${formatCurrency(baseline.pnl)} | WR: ${formatPercent(baseline.winRate)} | MaxDD: ${formatPercent(baseline.maxDrawdown)}`);

  console.log('\n🏆 BEST CONFIGURATION:');
  console.log(`   ${best.name}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);
  console.log(`   vs Baseline: ${best.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(best.pnl - baseline.pnl)}`);
  console.log(`   WR: ${formatPercent(best.winRate)} | PF: ${best.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(best.maxDrawdown)}`);
  console.log(`   LONG: $${formatCurrency(best.longPnl)} (${best.longTrades} trades) | SHORT: $${formatCurrency(best.shortPnl)} (${best.shortTrades} trades)`);

  const filtersWithValue = sortedFilters.filter(r => r.pnl > baseline.pnl);

  console.log('\n📊 STATISTICS:');
  console.log(`   • Fibonacci adds value: ${fibDiff > 0 ? '✅ YES' : '❌ NO'} (${fibDiff >= 0 ? '+' : ''}$${formatCurrency(fibDiff)})`);
  console.log(`   • Filters that add value: ${filtersWithValue.length}/${sortedFilters.length}`);
  if (filtersWithValue.length > 0) {
    console.log(`     ${filtersWithValue.map(r => r.name.replace('🟡 ', '').replace(' only (no Fib)', '')).join(', ')}`);
  }

  console.log('\n💡 RECOMMENDATION:');
  if (best.pnl > baseline.pnl) {
    console.log(`   Use: ${best.name.replace('🏆 ', '').replace('🟡 ', '').replace('🟢 ', '').replace('🔴 ', '')}`);
    console.log(`   Expected improvement: +$${formatCurrency(best.pnl - baseline.pnl)} vs baseline`);
  } else {
    console.log('   Keep using baseline configuration (no filters)');
  }
}

function printStrategyStats(stats: StrategyStats[]) {
  console.log('\n' + '═'.repeat(140));
  console.log('📈 RESULTS PER STRATEGY (Best Configuration)');
  console.log('═'.repeat(140) + '\n');

  console.log('Rank  Strategy                              P&L        Trades   WinRate    PF     Avg P&L    LONG P&L (n)      SHORT P&L (n)');
  console.log('─'.repeat(140));

  for (let i = 0; i < stats.length; i++) {
    const s = stats[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = s.setupType.substring(0, 35).padEnd(35);
    const pnlStr = `$${formatCurrency(s.pnl)}`.padStart(10);
    const tradesStr = String(s.trades).padStart(6);
    const wrStr = formatPercent(s.winRate).padStart(8);
    const pfStr = s.profitFactor === Infinity ? '    ∞' : s.profitFactor.toFixed(2).padStart(5);
    const avgPnlStr = `$${formatCurrency(s.avgPnl)}`.padStart(10);
    const longStr = `$${formatCurrency(s.longPnl)} (${s.longTrades})`.padStart(16);
    const shortStr = `$${formatCurrency(s.shortPnl)} (${s.shortTrades})`.padStart(16);

    const marker = s.pnl > 0 ? '✅' : s.pnl < 0 ? '❌' : '➖';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${tradesStr} ${wrStr} ${pfStr} ${avgPnlStr} ${longStr} ${shortStr}`);
  }

  console.log('─'.repeat(140));

  const profitable = stats.filter(s => s.pnl > 0);
  const unprofitable = stats.filter(s => s.pnl < 0);
  const totalPnl = stats.reduce((sum, s) => sum + s.pnl, 0);
  const totalTrades = stats.reduce((sum, s) => sum + s.trades, 0);

  console.log(`\n📊 SUMMARY: ${profitable.length}/${stats.length} profitable strategies | Total P&L: $${formatCurrency(totalPnl)} | Total Trades: ${totalTrades}`);

  if (profitable.length > 0) {
    console.log(`\n✅ TOP PERFORMERS:`);
    for (const s of profitable.slice(0, 5)) {
      console.log(`   • ${s.setupType}: $${formatCurrency(s.pnl)} (${s.trades} trades, ${formatPercent(s.winRate)} WR)`);
    }
  }

  if (unprofitable.length > 0) {
    console.log(`\n❌ UNDERPERFORMERS:`);
    for (const s of unprofitable.slice(-5).reverse()) {
      console.log(`   • ${s.setupType}: $${formatCurrency(s.pnl)} (${s.trades} trades, ${formatPercent(s.winRate)} WR)`);
    }
  }
}

runOptimization().catch(console.error);
