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

interface FilterDef {
  name: string;
  key: keyof MultiWatcherBacktestConfig;
  category: 'direction' | 'entry' | 'market';
}

interface FilterCombination {
  name: string;
  config: Partial<MultiWatcherBacktestConfig>;
  filters: string[];
}

interface TestResult {
  name: string;
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
  filters: string[];
  filterCount: number;
}

const ALL_FILTERS: FilterDef[] = [
  { name: 'MTF', key: 'useMtfFilter', category: 'direction' },
  { name: 'MarketRegime', key: 'useMarketRegimeFilter', category: 'direction' },
  { name: 'TrendEMA', key: 'useTrendFilter', category: 'direction' },
  { name: 'Direction', key: 'useDirectionFilter', category: 'direction' },
  { name: 'MomentumTiming', key: 'useMomentumTimingFilter', category: 'entry' },
  { name: 'Stochastic', key: 'useStochasticFilter', category: 'entry' },
  { name: 'ADX', key: 'useAdxFilter', category: 'entry' },
  { name: 'Volume', key: 'useVolumeFilter', category: 'entry' },
  { name: 'Funding', key: 'useFundingFilter', category: 'market' },
  { name: 'BtcCorrelation', key: 'useBtcCorrelationFilter', category: 'market' },
];

const createBaseFilterConfig = (): Partial<MultiWatcherBacktestConfig> => {
  const config: Partial<MultiWatcherBacktestConfig> = {};
  for (const filter of ALL_FILTERS) {
    (config as Record<string, boolean>)[filter.key] = false;
  }
  return config;
};

const generateFilterCombinations = (): FilterCombination[] => {
  const combinations: FilterCombination[] = [];
  const baseConfig = createBaseFilterConfig();

  combinations.push({
    name: 'Baseline (no filters)',
    config: { ...baseConfig },
    filters: [],
  });

  for (const filter of ALL_FILTERS) {
    combinations.push({
      name: `Only ${filter.name}`,
      config: { ...baseConfig, [filter.key]: true },
      filters: [filter.name],
    });
  }

  const allFiltersConfig = { ...baseConfig };
  for (const filter of ALL_FILTERS) {
    (allFiltersConfig as Record<string, boolean>)[filter.key] = true;
  }
  combinations.push({
    name: 'All filters ON',
    config: allFiltersConfig,
    filters: ALL_FILTERS.map(f => f.name),
  });

  const keyPairs: [FilterDef, FilterDef][] = [
    [ALL_FILTERS[4]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[6]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[2]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[2]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[6]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[5]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[8]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[8]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[9]!, ALL_FILTERS[4]!],
    [ALL_FILTERS[9]!, ALL_FILTERS[7]!],
  ];

  for (const [f1, f2] of keyPairs) {
    if (f1 && f2) {
      combinations.push({
        name: `${f1.name} + ${f2.name}`,
        config: { ...baseConfig, [f1.key]: true, [f2.key]: true },
        filters: [f1.name, f2.name],
      });
    }
  }

  const keyTriples: [FilterDef, FilterDef, FilterDef][] = [
    [ALL_FILTERS[0]!, ALL_FILTERS[4]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[4]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[7]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[2]!, ALL_FILTERS[4]!, ALL_FILTERS[7]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[8]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[9]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[1]!, ALL_FILTERS[8]!],
  ];

  for (const [f1, f2, f3] of keyTriples) {
    if (f1 && f2 && f3) {
      combinations.push({
        name: `${f1.name} + ${f2.name} + ${f3.name}`,
        config: { ...baseConfig, [f1.key]: true, [f2.key]: true, [f3.key]: true },
        filters: [f1.name, f2.name, f3.name],
      });
    }
  }

  const keyQuads: FilterDef[][] = [
    [ALL_FILTERS[0]!, ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[1]!],
    [ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[1]!, ALL_FILTERS[8]!],
    [ALL_FILTERS[0]!, ALL_FILTERS[4]!, ALL_FILTERS[7]!, ALL_FILTERS[9]!],
  ];

  for (const filters of keyQuads) {
    if (filters.every(f => f)) {
      const config = { ...baseConfig };
      for (const f of filters) {
        (config as Record<string, boolean>)[f.key] = true;
      }
      combinations.push({
        name: filters.map(f => f.name).join(' + '),
        config,
        filters: filters.map(f => f.name),
      });
    }
  }

  return combinations;
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
  console.log('🔬 Filter Combination Optimization v2');
  console.log('=====================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const combinations = generateFilterCombinations();

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
  console.log(`🎯 Fibonacci Targets: LONG=1.618, SHORT=1.272`);
  console.log(`🔍 Filters to test: ${ALL_FILTERS.length}`);
  console.log(`📋 Combinations to test: ${combinations.length}\n`);

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
    trendFilterPeriod: 21,
    tpCalculationMode: 'fibonacci',
    fibonacciTargetLevel: 'auto',
    fibonacciTargetLevelLong: '1.618',
    fibonacciTargetLevelShort: '1.272',
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
    const combination = combinations[i]!;
    printProgress(i, combinations.length, startTime);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      ...combination.config,
      watchers,
      startDate,
      endDate,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      name: combination.name,
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
      filters: combination.filters,
      filterCount: combination.filters.length,
    });
  }

  printProgress(combinations.length, combinations.length, startTime);
  console.log('\n');

  console.log('═'.repeat(140));
  console.log('📊 RESULTS SORTED BY P&L');
  console.log('═'.repeat(140) + '\n');

  console.log('Rank  Combination                                         P&L          P&L%    Trades   WinRate    PF    MaxDD    LONG P&L    SHORT P&L   #Filters');
  console.log('─'.repeat(140));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);
  const baseline = results.find(r => r.name === 'Baseline (no filters)')!;

  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = r.name.substring(0, 50).padEnd(50);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longPnlStr = `$${formatCurrency(r.longPnl)}`.padStart(11);
    const shortPnlStr = `$${formatCurrency(r.shortPnl)}`.padStart(11);
    const filterCountStr = String(r.filterCount).padStart(8);

    const marker = i === 0 ? '🏆' : i < 3 ? '🥈' : i < 5 ? '🥉' : '  ';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${longPnlStr} ${shortPnlStr} ${filterCountStr}`);
  }

  console.log('─'.repeat(140));

  console.log('\n' + '═'.repeat(140));
  console.log('📈 INDIVIDUAL FILTER VALUE (vs Baseline)');
  console.log('═'.repeat(140) + '\n');

  const singleFilterResults = results.filter(r => r.filterCount === 1);
  const sortedSingleFilters = [...singleFilterResults].sort((a, b) => b.pnl - a.pnl);

  console.log('Filter           P&L        vs Baseline    Trades   WinRate    PF    MaxDD    Value Added?');
  console.log('─'.repeat(100));

  for (const r of sortedSingleFilters) {
    const filterName = r.filters[0]?.padEnd(16) ?? 'Unknown';
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

  console.log('\n' + '═'.repeat(140));
  console.log('📉 BEST BY RISK-ADJUSTED METRICS (min 10 trades)');
  console.log('═'.repeat(140) + '\n');

  const qualifiedResults = results.filter(r => r.trades >= 10 && r.profitFactor !== Infinity);

  console.log('Best Profit Factor:');
  const byPF = [...qualifiedResults].sort((a, b) => b.profitFactor - a.profitFactor).slice(0, 3);
  for (const r of byPF) {
    console.log(`   ${r.name}: PF=${r.profitFactor.toFixed(2)} | P&L=$${formatCurrency(r.pnl)} | MaxDD=${formatPercent(r.maxDrawdown)}`);
  }

  console.log('\nLowest Max Drawdown:');
  const byDD = [...qualifiedResults].sort((a, b) => a.maxDrawdown - b.maxDrawdown).slice(0, 3);
  for (const r of byDD) {
    console.log(`   ${r.name}: MaxDD=${formatPercent(r.maxDrawdown)} | P&L=$${formatCurrency(r.pnl)} | PF=${r.profitFactor.toFixed(2)}`);
  }

  console.log('\nBest Sharpe-like (P&L / MaxDD):');
  const bySharpe = [...qualifiedResults]
    .map(r => ({ ...r, sharpe: r.pnl / (r.maxDrawdown || 1) }))
    .sort((a, b) => b.sharpe - a.sharpe)
    .slice(0, 3);
  for (const r of bySharpe) {
    console.log(`   ${r.name}: Ratio=${r.sharpe.toFixed(2)} | P&L=$${formatCurrency(r.pnl)} | MaxDD=${formatPercent(r.maxDrawdown)}`);
  }

  console.log('\n' + '═'.repeat(140));
  console.log('🏆 SUMMARY');
  console.log('═'.repeat(140) + '\n');

  const best = sortedResults[0]!;
  const profitable = results.filter(r => r.pnl > 0).length;

  console.log(`📌 Baseline (no filters): P&L=$${formatCurrency(baseline.pnl)} | WR=${formatPercent(baseline.winRate)} | MaxDD=${formatPercent(baseline.maxDrawdown)}`);
  console.log(`🏆 Best combination: ${best.name}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)}) | vs Baseline: ${best.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(best.pnl - baseline.pnl)}`);
  console.log(`   WR: ${formatPercent(best.winRate)} | PF: ${best.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(best.maxDrawdown)}`);
  console.log(`   LONG: $${formatCurrency(best.longPnl)} (${best.longTrades} trades) | SHORT: $${formatCurrency(best.shortPnl)} (${best.shortTrades} trades)`);

  console.log(`\n📊 Statistics:`);
  console.log(`   • Profitable combinations: ${profitable}/${results.length} (${formatPercent((profitable / results.length) * 100)})`);
  console.log(`   • Average P&L: $${formatCurrency(results.reduce((sum, r) => sum + r.pnl, 0) / results.length)}`);

  const filtersWithValue = sortedSingleFilters.filter(r => r.pnl > baseline.pnl);
  console.log(`   • Filters that add value: ${filtersWithValue.length}/${ALL_FILTERS.length}`);
  if (filtersWithValue.length > 0) {
    console.log(`     ${filtersWithValue.map(r => r.filters[0]).join(', ')}`);
  }

  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = `${outputDir}/filter-optimization-${symbol}-${interval}-${new Date().toISOString().split('T')[0]}.json`;
  const outputData = {
    config: { symbol, interval, startDate, endDate },
    baseline: baseline,
    best: best,
    allResults: sortedResults,
    filterAnalysis: {
      filtersWithValue: filtersWithValue.map(r => ({ filter: r.filters[0], pnl: r.pnl, improvement: r.pnl - baseline.pnl })),
      filtersWithoutValue: sortedSingleFilters.filter(r => r.pnl <= baseline.pnl).map(r => ({ filter: r.filters[0], pnl: r.pnl, degradation: baseline.pnl - r.pnl })),
    },
    timestamp: new Date().toISOString(),
  };

  fs.writeFileSync(outputFile, JSON.stringify(outputData, null, 2));
  console.log(`\n💾 Results saved to: ${outputFile}`);

  process.exit(0);
}

runOptimization().catch(console.error);
