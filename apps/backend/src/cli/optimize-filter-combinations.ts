import 'dotenv/config';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, MultiWatcherBacktestConfig } from '@marketmind/types';
import { TRADING_DEFAULTS, FILTER_DEFAULTS } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  DEFAULT_BACKTEST_PARAMS,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
} from './shared-backtest-config';

interface FilterCombination {
  name: string;
  config: Partial<MultiWatcherBacktestConfig>;
}

const generateFilterCombinations = (): FilterCombination[] => {
  const combinations: FilterCombination[] = [];

  const directionFilters = [
    { name: 'MTF', key: 'useMtfFilter' },
    { name: 'MarketRegime', key: 'useMarketRegimeFilter' },
    { name: 'TrendEMA', key: 'useTrendFilter' },
  ];

  const entryFilters = [
    { name: 'MomentumTiming', key: 'useMomentumTimingFilter' },
    { name: 'Stochastic', key: 'useStochasticFilter' },
    { name: 'ADX', key: 'useAdxFilter' },
    { name: 'Volume', key: 'useVolumeFilter' },
  ];

  const marketFilters = [
    { name: 'Funding', key: 'useFundingFilter' },
  ];

  combinations.push({
    name: 'Baseline (no filters)',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'All filters ON',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: true,
      useMomentumTimingFilter: true,
      useStochasticFilter: true,
      useAdxFilter: true,
      useVolumeFilter: true,
      useFundingFilter: true,
    },
  });

  for (const filter of [...directionFilters, ...entryFilters, ...marketFilters]) {
    combinations.push({
      name: `Only ${filter.name}`,
      config: {
        useMtfFilter: false,
        useMarketRegimeFilter: false,
        useTrendFilter: false,
        useMomentumTimingFilter: false,
        useStochasticFilter: false,
        useAdxFilter: false,
        useVolumeFilter: false,
        useFundingFilter: false,
        [filter.key]: true,
      },
    });
  }

  combinations.push({
    name: 'MomentumTiming + Volume',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MomentumTiming + MarketRegime',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MomentumTiming + Volume + MarketRegime',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + MomentumTiming',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + Volume',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + MarketRegime',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + MomentumTiming + Volume',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + MomentumTiming + MarketRegime',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + Volume + MarketRegime',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'MTF + MomentumTiming + Volume + MarketRegime',
    config: {
      useMtfFilter: true,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'ADX + MomentumTiming',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: true,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'Stochastic + MomentumTiming',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: true,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'TrendEMA + MomentumTiming',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: true,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'TrendEMA + Volume',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: true,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'TrendEMA + MarketRegime',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: true,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: false,
    },
  });

  combinations.push({
    name: 'Funding + Volume',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: true,
    },
  });

  combinations.push({
    name: 'Funding + MomentumTiming',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: true,
    },
  });

  combinations.push({
    name: 'Volume + MarketRegime + Funding',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: false,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: true,
    },
  });

  combinations.push({
    name: 'MomentumTiming + Volume + Funding',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: false,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: true,
    },
  });

  combinations.push({
    name: 'MomentumTiming + MarketRegime + Funding',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: false,
      useFundingFilter: true,
    },
  });

  combinations.push({
    name: 'MomentumTiming + Volume + MarketRegime + Funding',
    config: {
      useMtfFilter: false,
      useMarketRegimeFilter: true,
      useTrendFilter: false,
      useMomentumTimingFilter: true,
      useStochasticFilter: false,
      useAdxFilter: false,
      useVolumeFilter: true,
      useFundingFilter: true,
    },
  });

  return combinations;
};

const parseCliArgs = () => {
  const symbolArg = process.argv.find(arg => arg.startsWith('--symbol='));
  const intervalArg = process.argv.find(arg => arg.startsWith('--interval='));
  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));

  return {
    symbol: symbolArg ? symbolArg.split('=')[1]! : 'BTCUSDT',
    interval: intervalArg ? intervalArg.split('=')[1]! : '4h',
    startDate: startDateArg ? startDateArg.split('=')[1]! : '2025-01-01',
    endDate: endDateArg ? endDateArg.split('=')[1]! : '2026-01-01',
  };
};

async function runOptimization() {
  console.log('🔬 Filter Combination Optimization');
  console.log('===================================\n');

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
  console.log(`🎯 Fibonacci Targets: LONG=1.618 (161.8%), SHORT=1.272 (127.2%)`);
  console.log(`📋 Testing ${combinations.length} filter combinations\n`);

  console.log('📋 CONFIGURAÇÃO BASE:');
  console.log(`   • Capital: $${formatCurrency(DEFAULT_BACKTEST_PARAMS.initialCapital)}`);
  console.log(`   • Leverage: ${DEFAULT_BACKTEST_PARAMS.leverage}x`);
  console.log(`   • Setups: ${ENABLED_SETUPS.length} estratégias`);
  console.log(`   • TP Mode: Fibonacci`);
  console.log(`   • Cooldown: ${DEFAULT_BACKTEST_PARAMS.cooldownMinutes} min`);
  console.log(`   • Volume Filter Config: OBV LONG=off, SHORT=on\n`);

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
    useBtcCorrelationFilter: false,
    useConfluenceScoring: false,
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

  const results: Array<{
    name: string;
    pnl: number;
    pnlPct: number;
    trades: number;
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    longPnl: number;
    shortPnl: number;
    filters: string;
  }> = [];

  for (let i = 0; i < combinations.length; i++) {
    const combination = combinations[i]!;
    console.log(`⏳ [${i + 1}/${combinations.length}] Testing: ${combination.name}...`);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      ...combination.config,
      watchers,
      startDate,
      endDate,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    const activeFilters: string[] = [];
    if (combination.config.useMtfFilter) activeFilters.push('MTF');
    if (combination.config.useMarketRegimeFilter) activeFilters.push('Regime');
    if (combination.config.useTrendFilter) activeFilters.push('Trend');
    if (combination.config.useMomentumTimingFilter) activeFilters.push('Momentum');
    if (combination.config.useStochasticFilter) activeFilters.push('Stoch');
    if (combination.config.useAdxFilter) activeFilters.push('ADX');
    if (combination.config.useVolumeFilter) activeFilters.push('Volume');
    if (combination.config.useFundingFilter) activeFilters.push('Funding');

    results.push({
      name: combination.name,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl: longMetrics.pnl,
      shortPnl: shortMetrics.pnl,
      filters: activeFilters.length > 0 ? activeFilters.join('+') : 'NONE',
    });

    console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
  }

  console.log('\n' + '═'.repeat(130));
  console.log('📊 RESULTS SORTED BY P&L');
  console.log('═'.repeat(130) + '\n');

  console.log('Rank  Combination                                    P&L          P&L%    Trades   WinRate    PF    MaxDD    LONG P&L    SHORT P&L');
  console.log('─'.repeat(130));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = r.name.padEnd(45);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longPnlStr = `$${formatCurrency(r.longPnl)}`.padStart(11);
    const shortPnlStr = `$${formatCurrency(r.shortPnl)}`.padStart(11);

    const marker = i === 0 ? '🏆' : i < 3 ? '🥈' : i < 5 ? '🥉' : '  ';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${longPnlStr} ${shortPnlStr}`);
  }

  console.log('─'.repeat(130));

  console.log('\n' + '═'.repeat(130));
  console.log('📈 TOP 5 BY PROFIT FACTOR (min 10 trades)');
  console.log('═'.repeat(130) + '\n');

  const sortedByPF = [...results]
    .filter(r => r.trades >= 10 && r.profitFactor !== Infinity)
    .sort((a, b) => b.profitFactor - a.profitFactor)
    .slice(0, 5);

  for (const r of sortedByPF) {
    console.log(`   ${r.name}: PF=${r.profitFactor.toFixed(2)} | P&L=$${formatCurrency(r.pnl)} | WR=${formatPercent(r.winRate)} | Trades=${r.trades}`);
  }

  console.log('\n' + '═'.repeat(130));
  console.log('📉 TOP 5 BY LOWEST MAX DRAWDOWN (min 10 trades)');
  console.log('═'.repeat(130) + '\n');

  const sortedByDD = [...results]
    .filter(r => r.trades >= 10)
    .sort((a, b) => a.maxDrawdown - b.maxDrawdown)
    .slice(0, 5);

  for (const r of sortedByDD) {
    console.log(`   ${r.name}: MaxDD=${formatPercent(r.maxDrawdown)} | P&L=$${formatCurrency(r.pnl)} | WR=${formatPercent(r.winRate)} | Trades=${r.trades}`);
  }

  console.log('\n' + '═'.repeat(130));
  console.log('🏆 OPTIMIZATION SUMMARY');
  console.log('═'.repeat(130) + '\n');

  const best = sortedResults[0]!;
  const baseline = results.find(r => r.name === 'Baseline (no filters)')!;

  console.log(`🥇 BEST COMBINATION: ${best.name}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);
  console.log(`   Win Rate: ${formatPercent(best.winRate)} | Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`   Max Drawdown: ${formatPercent(best.maxDrawdown)} | Trades: ${best.trades}`);
  console.log(`   LONG: $${formatCurrency(best.longPnl)} | SHORT: $${formatCurrency(best.shortPnl)}`);

  if (best.name !== 'Baseline (no filters)') {
    const improvement = best.pnl - baseline.pnl;
    console.log(`   vs Baseline: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
  }

  const profitable = results.filter(r => r.pnl > 0).length;
  console.log(`\n📌 STATISTICS:`);
  console.log(`   • Profitable combinations: ${profitable}/${results.length}`);
  console.log(`   • Average P&L: $${formatCurrency(results.reduce((sum, r) => sum + r.pnl, 0) / results.length)}`);

  const filterEffectiveness: Record<string, { total: number; profitable: number; avgPnl: number }> = {};

  for (const r of results) {
    const filters = r.filters.split('+');
    for (const f of filters) {
      if (!filterEffectiveness[f]) {
        filterEffectiveness[f] = { total: 0, profitable: 0, avgPnl: 0 };
      }
      filterEffectiveness[f].total++;
      if (r.pnl > 0) filterEffectiveness[f].profitable++;
      filterEffectiveness[f].avgPnl += r.pnl;
    }
  }

  console.log(`\n📊 FILTER EFFECTIVENESS (when active):`);
  for (const [filter, stats] of Object.entries(filterEffectiveness)) {
    if (filter !== 'NONE') {
      const avgPnl = stats.avgPnl / stats.total;
      console.log(`   • ${filter}: ${stats.profitable}/${stats.total} profitable (${formatPercent((stats.profitable / stats.total) * 100)}), Avg P&L: $${formatCurrency(avgPnl)}`);
    }
  }

  process.exit(0);
}

runOptimization().catch(console.error);
