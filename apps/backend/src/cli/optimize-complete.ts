import 'dotenv/config';
import { FILTER_DEFAULTS } from '@marketmind/types';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, MultiWatcherBacktestConfig } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  DEFAULT_BACKTEST_PARAMS,
  VOLUME_FILTER_CONFIG,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
} from './shared-backtest-config';

interface FilterCombination {
  name: string;
  filters: Partial<MultiWatcherBacktestConfig>;
}

interface OptimizationResult {
  rank: number;
  timeframe: string;
  filterComboName: string;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  longPnl: number;
  shortPnl: number;
  filteredStats: Record<string, number>;
}

const TIMEFRAMES = ['30m', '1h', '2h', '4h', '6h', '8h'];

const FILTER_COMBINATIONS: FilterCombination[] = [
  { name: 'Baseline (none)', filters: {
    useTrendFilter: false,
    useMtfFilter: false,
    useMarketRegimeFilter: false,
    useMomentumTimingFilter: false,
    useVolumeFilter: false,
    useStochasticFilter: false,
    useAdxFilter: false,
    useFundingFilter: false,
    useConfluenceScoring: false,
    useChoppinessFilter: false,
    useSessionFilter: false,
    useBollingerSqueezeFilter: false,
    useVwapFilter: false,
    useSuperTrendFilter: false,
  }},
  { name: 'TrendEMA only', filters: { useTrendFilter: true, trendFilterPeriod: 21 }},
  { name: 'MTF only', filters: { useMtfFilter: true }},
  { name: 'MarketRegime only', filters: { useMarketRegimeFilter: true }},
  { name: 'MomentumTiming only', filters: { useMomentumTimingFilter: true }},
  { name: 'Volume only', filters: { useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'Stochastic only', filters: { useStochasticFilter: true }},
  { name: 'ADX only', filters: { useAdxFilter: true }},
  { name: 'Funding only', filters: { useFundingFilter: true }},
  { name: 'Choppiness only', filters: { useChoppinessFilter: true, choppinessThresholdHigh: 61.8, choppinessThresholdLow: 38.2 }},
  { name: 'Session only (13-16 UTC)', filters: { useSessionFilter: true, sessionStartUtc: 13, sessionEndUtc: 16 }},
  { name: 'BollingerSqueeze only', filters: { useBollingerSqueezeFilter: true }},
  { name: 'VWAP only', filters: { useVwapFilter: true }},
  { name: 'SuperTrend only', filters: { useSuperTrendFilter: true }},
  { name: 'TrendEMA + MTF', filters: { useTrendFilter: true, useMtfFilter: true }},
  { name: 'TrendEMA + MarketRegime', filters: { useTrendFilter: true, useMarketRegimeFilter: true }},
  { name: 'TrendEMA + Volume', filters: { useTrendFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'TrendEMA + Choppiness', filters: { useTrendFilter: true, useChoppinessFilter: true }},
  { name: 'MTF + MarketRegime', filters: { useMtfFilter: true, useMarketRegimeFilter: true }},
  { name: 'MTF + Volume', filters: { useMtfFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'MTF + MomentumTiming', filters: { useMtfFilter: true, useMomentumTimingFilter: true }},
  { name: 'MarketRegime + Volume', filters: { useMarketRegimeFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'TrendEMA + MTF + MarketRegime', filters: { useTrendFilter: true, useMtfFilter: true, useMarketRegimeFilter: true }},
  { name: 'TrendEMA + MTF + Volume', filters: { useTrendFilter: true, useMtfFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'TrendEMA + MarketRegime + Volume', filters: { useTrendFilter: true, useMarketRegimeFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'MTF + MarketRegime + Volume', filters: { useMtfFilter: true, useMarketRegimeFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'All Basic Filters', filters: { useTrendFilter: true, useMtfFilter: true, useMarketRegimeFilter: true, useVolumeFilter: true, useMomentumTimingFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'Choppiness + VWAP', filters: { useChoppinessFilter: true, useVwapFilter: true }},
  { name: 'SuperTrend + Volume', filters: { useSuperTrendFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'Session + Choppiness', filters: { useSessionFilter: true, useChoppinessFilter: true }},
  { name: 'TrendEMA + Choppiness + Volume', filters: { useTrendFilter: true, useChoppinessFilter: true, useVolumeFilter: true, volumeFilterConfig: VOLUME_FILTER_CONFIG }},
  { name: 'SuperTrend + Choppiness', filters: { useSuperTrendFilter: true, useChoppinessFilter: true }},
];

const parseCliArgs = () => {
  const symbolArg = process.argv.find(arg => arg.startsWith('--symbol='));
  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));
  const timeframesArg = process.argv.find(arg => arg.startsWith('--timeframes='));
  const validateOnly = process.argv.includes('--validate-only');

  return {
    symbol: symbolArg ? symbolArg.split('=')[1]! : 'BTCUSDT',
    startDate: startDateArg ? startDateArg.split('=')[1]! : '2025-01-01',
    endDate: endDateArg ? endDateArg.split('=')[1]! : '2026-01-01',
    timeframes: timeframesArg ? timeframesArg.split('=')[1]!.split(',') : TIMEFRAMES,
    validateOnly,
  };
};

const createBaseConfig = (): Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate'> => ({
  initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
  exposureMultiplier: DEFAULT_BACKTEST_PARAMS.exposureMultiplier,
  minRiskRewardRatio: 1.0,
  setupTypes: [...ENABLED_SETUPS],
  useSharedExposure: true,
  marketType: 'FUTURES',
  leverage: DEFAULT_BACKTEST_PARAMS.leverage,
  useCooldown: true,
  cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,
  useTrendFilter: false,
  useMtfFilter: false,
  useMarketRegimeFilter: false,
  useMomentumTimingFilter: false,
  useVolumeFilter: false,
  useStochasticFilter: false,
  useAdxFilter: false,
  useFundingFilter: false,
  useBtcCorrelationFilter: false,
  useConfluenceScoring: false,
  trendFilterPeriod: FILTER_DEFAULTS.trendFilterPeriod,
  tpCalculationMode: 'fibonacci',
  fibonacciTargetLevel: 'auto',
  fibonacciTargetLevelLong: '2',
  fibonacciTargetLevelShort: '1.272',
  useChoppinessFilter: false,
  choppinessThresholdHigh: 61.8,
  choppinessThresholdLow: 38.2,
  choppinessPeriod: 14,
  useSessionFilter: false,
  sessionStartUtc: 13,
  sessionEndUtc: 16,
  useBollingerSqueezeFilter: false,
  bollingerSqueezeThreshold: 0.1,
  useSuperTrendFilter: false,
  superTrendPeriod: 10,
  superTrendMultiplier: 3.0,
  useVwapFilter: false,
});

const logSection = (title: string) => {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${title}`);
  console.log('═'.repeat(80));
};

const logProgress = (current: number, total: number, name: string) => {
  const percent = ((current / total) * 100).toFixed(1);
  console.log(`[${current}/${total}] (${percent}%) Testing: ${name}`);
};

async function runOptimization() {
  const args = parseCliArgs();

  console.log('');
  logSection('MARKETMIND COMPLETE OPTIMIZATION');
  console.log(`  Symbol: ${args.symbol}`);
  console.log(`  Period: ${args.startDate} to ${args.endDate}`);
  console.log(`  Timeframes: ${args.timeframes.join(', ')}`);
  console.log(`  Filter Combinations: ${FILTER_COMBINATIONS.length}`);
  console.log(`  Total Tests: ${args.timeframes.length * FILTER_COMBINATIONS.length}`);
  console.log(`  Capital: $${formatCurrency(DEFAULT_BACKTEST_PARAMS.initialCapital)}`);
  console.log(`  Leverage: ${DEFAULT_BACKTEST_PARAMS.leverage}x`);
  console.log(`  Setups: ${ENABLED_SETUPS.length}`);

  const results: OptimizationResult[] = [];
  let testIndex = 0;
  const totalTests = args.timeframes.length * FILTER_COMBINATIONS.length;

  for (const timeframe of args.timeframes) {
    logSection(`TIMEFRAME: ${timeframe}`);

    const watchers: WatcherConfig[] = [{
      symbol: args.symbol,
      interval: timeframe,
      marketType: 'FUTURES',
      setupTypes: [...ENABLED_SETUPS],
    }];

    for (const combo of FILTER_COMBINATIONS) {
      testIndex++;
      logProgress(testIndex, totalTests, `${timeframe} | ${combo.name}`);

      const config: MultiWatcherBacktestConfig = {
        ...createBaseConfig(),
        ...combo.filters,
        watchers,
        startDate: args.startDate,
        endDate: args.endDate,
      };

      console.log(`   Filters enabled: ${getEnabledFiltersString(config)}`);

      try {
        const engine = new MultiWatcherBacktestEngine(config);
        const result = await engine.run();

        const longTrades = result.trades.filter(t => t.side === 'LONG');
        const shortTrades = result.trades.filter(t => t.side === 'SHORT');
        const longMetrics = calculateDirectionalMetrics(longTrades);
        const shortMetrics = calculateDirectionalMetrics(shortTrades);

        const filteredStats = extractFilteredStats(result.watcherStats);

        results.push({
          rank: 0,
          timeframe,
          filterComboName: combo.name,
          pnl: result.metrics.totalPnl,
          pnlPercent: result.metrics.totalPnlPercent,
          trades: result.metrics.totalTrades,
          winRate: result.metrics.winRate,
          profitFactor: result.metrics.profitFactor,
          maxDrawdown: result.metrics.maxDrawdownPercent,
          longPnl: longMetrics.pnl,
          shortPnl: shortMetrics.pnl,
          filteredStats,
        });

        console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
        console.log(`     LONG: $${formatCurrency(longMetrics.pnl)} | SHORT: $${formatCurrency(shortMetrics.pnl)}`);

        if (Object.keys(filteredStats).length > 0) {
          const filterSummary = Object.entries(filteredStats)
            .filter(([, count]) => count > 0)
            .map(([name, count]) => `${name}=${count}`)
            .join(', ');
          if (filterSummary) {
            console.log(`     Filtered: ${filterSummary}`);
          }
        }
      } catch (error) {
        console.error(`   ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  printResults(results);
  printRecommendation(results);

  process.exit(0);
}

function getEnabledFiltersString(config: MultiWatcherBacktestConfig): string {
  const enabled: string[] = [];
  if (config.useTrendFilter) enabled.push('TrendEMA');
  if (config.useMtfFilter) enabled.push('MTF');
  if (config.useMarketRegimeFilter) enabled.push('MarketRegime');
  if (config.useMomentumTimingFilter) enabled.push('MomentumTiming');
  if (config.useVolumeFilter) enabled.push('Volume');
  if (config.useStochasticFilter) enabled.push('Stochastic');
  if (config.useAdxFilter) enabled.push('ADX');
  if (config.useFundingFilter) enabled.push('Funding');
  if (config.useConfluenceScoring) enabled.push('Confluence');
  if (config.useChoppinessFilter) enabled.push('Choppiness');
  if (config.useSessionFilter) enabled.push('Session');
  if (config.useBollingerSqueezeFilter) enabled.push('BollingerSqueeze');
  if (config.useVwapFilter) enabled.push('VWAP');
  if (config.useSuperTrendFilter) enabled.push('SuperTrend');
  return enabled.length > 0 ? enabled.join(', ') : 'none';
}

function extractFilteredStats(watcherStats: Array<{ tradesSkipped: number; skippedReasons?: Record<string, number> }>): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const ws of watcherStats) {
    if (ws.skippedReasons) {
      for (const [key, value] of Object.entries(ws.skippedReasons)) {
        const cleanKey = key.replace('skipped', '');
        stats[cleanKey] = (stats[cleanKey] ?? 0) + value;
      }
    }
  }
  return stats;
}

function printResults(results: OptimizationResult[]) {
  const sorted = [...results].sort((a, b) => b.pnl - a.pnl);
  sorted.forEach((r, i) => { r.rank = i + 1; });

  logSection('TOP 20 BEST CONFIGURATIONS');
  console.log('');
  console.log('Rank  Timeframe  Config                              P&L         P&L%    Trades   WR%     PF    MaxDD');
  console.log('─'.repeat(110));

  for (const r of sorted.slice(0, 20)) {
    const rankStr = `#${r.rank}`.padStart(4);
    const tfStr = r.timeframe.padEnd(9);
    const nameStr = r.filterComboName.slice(0, 30).padEnd(30);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPercent).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(7);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);

    console.log(`${rankStr}  ${tfStr}  ${nameStr}  ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr}`);
  }

  console.log('─'.repeat(110));

  logSection('BEST BY TIMEFRAME');
  console.log('');

  for (const tf of [...new Set(results.map(r => r.timeframe))]) {
    const tfResults = sorted.filter(r => r.timeframe === tf);
    const best = tfResults[0];
    if (best) {
      console.log(`  ${tf.padEnd(5)}: ${best.filterComboName.padEnd(30)} P&L: $${formatCurrency(best.pnl)} | WR: ${formatPercent(best.winRate)} | Trades: ${best.trades}`);
    }
  }

  logSection('LONG vs SHORT ANALYSIS');
  console.log('');
  console.log('Config                              LONG P&L     SHORT P&L    Better Direction');
  console.log('─'.repeat(90));

  const topConfigs = sorted.slice(0, 10);
  for (const r of topConfigs) {
    const nameStr = r.filterComboName.slice(0, 30).padEnd(30);
    const longStr = `$${formatCurrency(r.longPnl)}`.padStart(12);
    const shortStr = `$${formatCurrency(r.shortPnl)}`.padStart(12);
    const better = r.longPnl > r.shortPnl ? 'LONG' : r.shortPnl > r.longPnl ? 'SHORT' : 'EQUAL';
    console.log(`  ${nameStr}  ${longStr}   ${shortStr}   ${better}`);
  }

  console.log('─'.repeat(90));
}

function printRecommendation(results: OptimizationResult[]) {
  const sorted = [...results].sort((a, b) => b.pnl - a.pnl);
  const best = sorted[0];

  if (!best) {
    console.log('\nNo results to analyze.');
    return;
  }

  logSection('RECOMMENDED CONFIGURATION FOR PRODUCTION');
  console.log('');
  console.log(`  Timeframe: ${best.timeframe}`);
  console.log(`  Filters: ${best.filterComboName}`);
  console.log('');
  console.log('  Expected Performance:');
  console.log(`    P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPercent)})`);
  console.log(`    Win Rate: ${formatPercent(best.winRate)}`);
  console.log(`    Profit Factor: ${best.profitFactor.toFixed(2)}`);
  console.log(`    Max Drawdown: ${formatPercent(best.maxDrawdown)}`);
  console.log(`    Total Trades: ${best.trades}`);
  console.log('');
  console.log('  Directional Performance:');
  console.log(`    LONG: $${formatCurrency(best.longPnl)}`);
  console.log(`    SHORT: $${formatCurrency(best.shortPnl)}`);

  const baseline = results.find(r => r.filterComboName === 'Baseline (none)' && r.timeframe === best.timeframe);
  if (baseline && baseline.pnl !== best.pnl) {
    const improvement = best.pnl - baseline.pnl;
    console.log('');
    console.log(`  vs Baseline (no filters):`);
    console.log(`    Improvement: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
  }

  console.log('');
  console.log('  Config to apply in auto-trading:');
  console.log(`    interval: '${best.timeframe}'`);

  const configLines = getFilterConfigFromName(best.filterComboName);
  for (const line of configLines) {
    console.log(`    ${line}`);
  }

  console.log('\n' + '═'.repeat(80));
}

function getFilterConfigFromName(name: string): string[] {
  const combo = FILTER_COMBINATIONS.find(c => c.name === name);
  if (!combo) return ['// Unknown configuration'];

  const lines: string[] = [];
  const filters = combo.filters;

  if (filters.useTrendFilter) lines.push('useTrendFilter: true,');
  if (filters.useMtfFilter) lines.push('useMtfFilter: true,');
  if (filters.useMarketRegimeFilter) lines.push('useMarketRegimeFilter: true,');
  if (filters.useMomentumTimingFilter) lines.push('useMomentumTimingFilter: true,');
  if (filters.useVolumeFilter) lines.push('useVolumeFilter: true,');
  if (filters.useStochasticFilter) lines.push('useStochasticFilter: true,');
  if (filters.useAdxFilter) lines.push('useAdxFilter: true,');
  if (filters.useFundingFilter) lines.push('useFundingFilter: true,');
  if (filters.useConfluenceScoring) lines.push('useConfluenceScoring: true,');
  if (filters.useChoppinessFilter) lines.push('useChoppinessFilter: true,');
  if (filters.useSessionFilter) lines.push('useSessionFilter: true,');
  if (filters.useBollingerSqueezeFilter) lines.push('useBollingerSqueezeFilter: true,');
  if (filters.useVwapFilter) lines.push('useVwapFilter: true,');
  if (filters.useSuperTrendFilter) lines.push('useSuperTrendFilter: true,');

  if (lines.length === 0) {
    lines.push('// All filters disabled (baseline)');
  }

  return lines;
}

runOptimization().catch(console.error);
