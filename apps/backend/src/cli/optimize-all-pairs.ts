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
  filters: string[];
}

interface TestResult {
  name: string;
  filters: string[];
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
  useMarketRegimeFilter: 'Regime',
  useTrendFilter: 'TrendEMA',
  useDirectionFilter: 'Direction',
  useMomentumTimingFilter: 'Momentum',
  useStochasticFilter: 'Stochastic',
  useAdxFilter: 'ADX',
  useVolumeFilter: 'Volume',
  useFundingFilter: 'Funding',
  useBtcCorrelationFilter: 'BtcCorr',
};

const createAllFiltersOff = (): Partial<MultiWatcherBacktestConfig> => {
  const config: Partial<MultiWatcherBacktestConfig> = {};
  for (const key of FILTER_KEYS) {
    (config as Record<string, boolean>)[key] = false;
  }
  return config;
};

const generateAllPairCombinations = (): TestConfig[] => {
  const configs: TestConfig[] = [];
  const allFiltersOff = createAllFiltersOff();

  configs.push({
    name: 'Baseline (no filters)',
    config: { ...allFiltersOff, tpCalculationMode: 'default' },
    filters: [],
  });

  configs.push({
    name: 'Baseline + Fib',
    config: {
      ...allFiltersOff,
      tpCalculationMode: 'fibonacci',
      fibonacciTargetLevelLong: '1.618',
      fibonacciTargetLevelShort: '1.272',
    },
    filters: ['Fib'],
  });

  for (let i = 0; i < FILTER_KEYS.length; i++) {
    const key1 = FILTER_KEYS[i]!;
    const name1 = FILTER_NAMES[key1];

    configs.push({
      name: `${name1} + Fib`,
      config: {
        ...allFiltersOff,
        [key1]: true,
        tpCalculationMode: 'fibonacci',
        fibonacciTargetLevelLong: '1.618',
        fibonacciTargetLevelShort: '1.272',
      },
      filters: [name1, 'Fib'],
    });

    for (let j = i + 1; j < FILTER_KEYS.length; j++) {
      const key2 = FILTER_KEYS[j]!;
      const name2 = FILTER_NAMES[key2];

      configs.push({
        name: `${name1} + ${name2}`,
        config: {
          ...allFiltersOff,
          [key1]: true,
          [key2]: true,
          tpCalculationMode: 'default',
        },
        filters: [name1, name2],
      });

      configs.push({
        name: `${name1} + ${name2} + Fib`,
        config: {
          ...allFiltersOff,
          [key1]: true,
          [key2]: true,
          tpCalculationMode: 'fibonacci',
          fibonacciTargetLevelLong: '1.618',
          fibonacciTargetLevelShort: '1.272',
        },
        filters: [name1, name2, 'Fib'],
      });
    }
  }

  return configs;
};

const printProgress = (current: number, total: number, startTime: number) => {
  const percent = (current / total) * 100;
  const elapsed = (Date.now() - startTime) / 1000;
  const eta = current > 0 ? ((elapsed / current) * (total - current)) : 0;
  const barLength = 30;
  const filled = Math.round((current / total) * barLength);
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);
  process.stdout.write(`\r~ [${bar}] ${current}/${total} (${percent.toFixed(0)}%) ETA: ${eta.toFixed(0)}s    `);
};

async function runOptimization() {
  console.log('> ALL FILTER PAIR COMBINATIONS OPTIMIZER');
  console.log('==========================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();
  const configs = generateAllPairCombinations();

  const watchers: WatcherConfig[] = [
    {
      symbol,
      interval,
      marketType: 'FUTURES',
      setupTypes: [...ENABLED_SETUPS],
    },
  ];

  console.log(`> Symbol: ${symbol}@${interval} (FUTURES)`);
  console.log(`# Period: ${startDate} to ${endDate}`);
  console.log(`> Tests to run: ${configs.length}`);
  console.log(`   • Baseline: 2 configs`);
  console.log(`   • Single filter + Fib: ${FILTER_KEYS.length} configs`);
  console.log(`   • All pairs (with/without Fib): ${FILTER_KEYS.length * (FILTER_KEYS.length - 1)} configs\n`);

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate'> = {
    initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
    positionSizePercent: DEFAULT_BACKTEST_PARAMS.positionSizePercent,
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

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longMetrics = calculateDirectionalMetrics(longTrades);
    const shortMetrics = calculateDirectionalMetrics(shortTrades);

    results.push({
      name: testConfig.name,
      filters: testConfig.filters,
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

  const outputDir = './output';
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const outputFile = `${outputDir}/all-pairs-optimization-${symbol}-${interval}-${new Date().toISOString().split('T')[0]}.json`;
  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  fs.writeFileSync(outputFile, JSON.stringify({
    config: { symbol, interval, startDate, endDate },
    allResults: sortedResults,
    timestamp: new Date().toISOString(),
  }, null, 2));

  console.log(`\n> Results saved to: ${outputFile}`);
  process.exit(0);
}

function printResults(results: TestResult[]) {
  const baseline = results.find(r => r.name === 'Baseline (no filters)')!;

  console.log('═'.repeat(140));
  console.log('> ALL PAIR COMBINATIONS SORTED BY P&L');
  console.log(`${'═'.repeat(140)  }\n`);

  console.log('Rank  Combination                                      P&L          P&L%    Trades   WinRate    PF    MaxDD    LONG P&L    SHORT P&L   vs Base');
  console.log('─'.repeat(140));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const nameStr = r.name.substring(0, 45).padEnd(45);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longPnlStr = `$${formatCurrency(r.longPnl)}`.padStart(11);
    const shortPnlStr = `$${formatCurrency(r.shortPnl)}`.padStart(11);
    const diffPnl = r.pnl - baseline.pnl;
    const diffStr = `${diffPnl >= 0 ? '+' : ''}$${formatCurrency(diffPnl)}`.padStart(10);

    const marker = i === 0 ? '>' : i < 3 ? '#2' : i < 5 ? '#3' : '  ';

    console.log(`${marker}${rank}${nameStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${longPnlStr} ${shortPnlStr} ${diffStr}`);
  }

  console.log('─'.repeat(140));

  const trendAdxResult = sortedResults.find(r => r.filters.includes('TrendEMA') && r.filters.includes('ADX') && !r.filters.includes('Fib'));
  const trendAdxFibResult = sortedResults.find(r => r.filters.includes('TrendEMA') && r.filters.includes('ADX') && r.filters.includes('Fib'));

  console.log(`\n${  '═'.repeat(80)}`);
  console.log('> TRENDEMA + ADX ANALYSIS');
  console.log(`${'═'.repeat(80)  }\n`);

  if (trendAdxResult) {
    console.log(`> TrendEMA + ADX (no Fib):`);
    console.log(`   P&L: $${formatCurrency(trendAdxResult.pnl)} | WR: ${formatPercent(trendAdxResult.winRate)} | PF: ${trendAdxResult.profitFactor.toFixed(2)}`);
    console.log(`   vs Baseline: ${trendAdxResult.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(trendAdxResult.pnl - baseline.pnl)}`);
  }

  if (trendAdxFibResult) {
    console.log(`\n> TrendEMA + ADX (with Fib):`);
    console.log(`   P&L: $${formatCurrency(trendAdxFibResult.pnl)} | WR: ${formatPercent(trendAdxFibResult.winRate)} | PF: ${trendAdxFibResult.profitFactor.toFixed(2)}`);
    console.log(`   vs Baseline: ${trendAdxFibResult.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(trendAdxFibResult.pnl - baseline.pnl)}`);
  }

  const best = sortedResults[0]!;
  console.log(`\n${  '═'.repeat(80)}`);
  console.log('> BEST COMBINATION');
  console.log(`${'═'.repeat(80)  }\n`);

  console.log(`   ${best.name}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);
  console.log(`   vs Baseline: ${best.pnl - baseline.pnl >= 0 ? '+' : ''}$${formatCurrency(best.pnl - baseline.pnl)}`);
  console.log(`   WR: ${formatPercent(best.winRate)} | PF: ${best.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(best.maxDrawdown)}`);
  console.log(`   LONG: $${formatCurrency(best.longPnl)} (${best.longTrades}) | SHORT: $${formatCurrency(best.shortPnl)} (${best.shortTrades})`);

  const top10 = sortedResults.slice(0, 10);
  console.log('\n> TOP 10 COMBINATIONS:');
  for (let i = 0; i < top10.length; i++) {
    const r = top10[i]!;
    console.log(`   ${i + 1}. ${r.name}: $${formatCurrency(r.pnl)} (${formatPercent(r.winRate)} WR)`);
  }
}

runOptimization().catch(console.error);
