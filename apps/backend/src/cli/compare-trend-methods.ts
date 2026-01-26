import 'dotenv/config';
import {
  detectTrendByEMA,
  detectTrendByADX,
  detectTrendBySuperTrend,
  detectTrendCombined,
  type TrendMethod,
  type TrendDetectionResult,
} from '@marketmind/indicators';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, MultiWatcherBacktestConfig } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  DEFAULT_BACKTEST_PARAMS,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
} from './shared-backtest-config';

interface TrendMethodConfig {
  name: string;
  method: TrendMethod;
  description: string;
}

interface ComparisonResult {
  method: string;
  description: string;
  timeframe: string;
  pnl: number;
  pnlPercent: number;
  trades: number;
  winRate: number;
  profitFactor: number;
  maxDrawdown: number;
  longPnl: number;
  shortPnl: number;
}

const TREND_METHODS: TrendMethodConfig[] = [
  { name: 'None', method: 'ema', description: 'No trend filter (baseline)' },
  { name: 'EMA21', method: 'ema', description: 'EMA 21 (price above/below)' },
  { name: 'ADX14', method: 'adx', description: 'ADX 14 with DI+/DI-' },
  { name: 'SuperTrend', method: 'supertrend', description: 'SuperTrend (10, 3)' },
  { name: 'Combined', method: 'combined', description: 'EMA + ADX + RSI combined' },
];

const TIMEFRAMES = ['1h', '4h'];

const parseCliArgs = () => {
  const symbolArg = process.argv.find(arg => arg.startsWith('--symbol='));
  const startDateArg = process.argv.find(arg => arg.startsWith('--start='));
  const endDateArg = process.argv.find(arg => arg.startsWith('--end='));

  return {
    symbol: symbolArg ? symbolArg.split('=')[1]! : 'BTCUSDT',
    startDate: startDateArg ? startDateArg.split('=')[1]! : '2025-01-01',
    endDate: endDateArg ? endDateArg.split('=')[1]! : '2026-01-01',
  };
};

const createBaseConfig = (useTrendFilter: boolean): Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate'> => ({
  initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
  exposureMultiplier: DEFAULT_BACKTEST_PARAMS.exposureMultiplier,
  minRiskRewardRatio: 1.0,
  setupTypes: [...ENABLED_SETUPS],
  useSharedExposure: true,
  marketType: 'FUTURES',
  leverage: DEFAULT_BACKTEST_PARAMS.leverage,
  useCooldown: true,
  cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,
  useTrendFilter,
  trendFilterPeriod: 21,
  useMtfFilter: false,
  useMarketRegimeFilter: false,
  useMomentumTimingFilter: false,
  useVolumeFilter: false,
  useStochasticFilter: false,
  useAdxFilter: false,
  useFundingFilter: false,
  useBtcCorrelationFilter: false,
  useConfluenceScoring: false,
  tpCalculationMode: 'fibonacci',
  fibonacciTargetLevel: 'auto',
  fibonacciTargetLevelLong: '2',
  fibonacciTargetLevelShort: '1.272',
});

const logSection = (title: string) => {
  console.log('\n' + '═'.repeat(80));
  console.log(`  ${title}`);
  console.log('═'.repeat(80));
};

async function runComparison() {
  const args = parseCliArgs();

  console.log('');
  logSection('TREND METHOD COMPARISON');
  console.log(`  Symbol: ${args.symbol}`);
  console.log(`  Period: ${args.startDate} to ${args.endDate}`);
  console.log(`  Timeframes: ${TIMEFRAMES.join(', ')}`);
  console.log(`  Methods: ${TREND_METHODS.map(m => m.name).join(', ')}`);
  console.log(`  Capital: $${formatCurrency(DEFAULT_BACKTEST_PARAMS.initialCapital)}`);
  console.log(`  Leverage: ${DEFAULT_BACKTEST_PARAMS.leverage}x`);

  const results: ComparisonResult[] = [];
  let testIndex = 0;
  const totalTests = TIMEFRAMES.length * TREND_METHODS.length;

  for (const timeframe of TIMEFRAMES) {
    logSection(`TIMEFRAME: ${timeframe}`);

    for (const methodConfig of TREND_METHODS) {
      testIndex++;
      const percent = ((testIndex / totalTests) * 100).toFixed(1);
      console.log(`[${testIndex}/${totalTests}] (${percent}%) Testing: ${methodConfig.name}`);
      console.log(`   Description: ${methodConfig.description}`);

      const useTrendFilter = methodConfig.name !== 'None';
      const useAdxFilter = methodConfig.method === 'adx';

      const watchers: WatcherConfig[] = [{
        symbol: args.symbol,
        interval: timeframe,
        marketType: 'FUTURES',
        setupTypes: [...ENABLED_SETUPS],
      }];

      const config: MultiWatcherBacktestConfig = {
        ...createBaseConfig(useTrendFilter && methodConfig.method === 'ema'),
        useAdxFilter: useAdxFilter,
        watchers,
        startDate: args.startDate,
        endDate: args.endDate,
      };

      try {
        const engine = new MultiWatcherBacktestEngine(config);
        const result = await engine.run();

        const longTrades = result.trades.filter(t => t.side === 'LONG');
        const shortTrades = result.trades.filter(t => t.side === 'SHORT');
        const longMetrics = calculateDirectionalMetrics(longTrades);
        const shortMetrics = calculateDirectionalMetrics(shortTrades);

        results.push({
          method: methodConfig.name,
          description: methodConfig.description,
          timeframe,
          pnl: result.metrics.totalPnl,
          pnlPercent: result.metrics.totalPnlPercent,
          trades: result.metrics.totalTrades,
          winRate: result.metrics.winRate,
          profitFactor: result.metrics.profitFactor,
          maxDrawdown: result.metrics.maxDrawdownPercent,
          longPnl: longMetrics.pnl,
          shortPnl: shortMetrics.pnl,
        });

        console.log(`   ✓ P&L: $${formatCurrency(result.metrics.totalPnl)} | WR: ${formatPercent(result.metrics.winRate)} | Trades: ${result.metrics.totalTrades}`);
      } catch (error) {
        console.error(`   ✗ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  printResults(results);
  process.exit(0);
}

function printResults(results: ComparisonResult[]) {
  logSection('COMPARISON RESULTS');
  console.log('');
  console.log('Method        Timeframe  P&L         P&L%    Trades   WR%     PF    MaxDD   LONG P&L    SHORT P&L');
  console.log('─'.repeat(110));

  for (const r of results) {
    const methodStr = r.method.padEnd(12);
    const tfStr = r.timeframe.padEnd(9);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(10);
    const pnlPctStr = formatPercent(r.pnlPercent).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(7);
    const pfStr = r.profitFactor === Infinity ? '  ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longStr = `$${formatCurrency(r.longPnl)}`.padStart(10);
    const shortStr = `$${formatCurrency(r.shortPnl)}`.padStart(10);

    console.log(`${methodStr}  ${tfStr}  ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr} ${longStr} ${shortStr}`);
  }

  console.log('─'.repeat(110));

  logSection('BEST METHOD BY TIMEFRAME');
  console.log('');

  for (const tf of TIMEFRAMES) {
    const tfResults = results.filter(r => r.timeframe === tf);
    const sorted = tfResults.sort((a, b) => b.pnl - a.pnl);
    const best = sorted[0];
    const baseline = tfResults.find(r => r.method === 'None');

    if (best && baseline) {
      const improvement = best.pnl - baseline.pnl;
      console.log(`  ${tf}:`);
      console.log(`    Best: ${best.method} with $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPercent)})`);
      console.log(`    Baseline (None): $${formatCurrency(baseline.pnl)}`);
      console.log(`    Improvement: ${improvement >= 0 ? '+' : ''}$${formatCurrency(improvement)}`);
      console.log('');
    }
  }

  logSection('RECOMMENDATION');
  console.log('');

  const sorted = [...results].sort((a, b) => b.pnl - a.pnl);
  const best = sorted[0];

  if (best) {
    console.log(`  Recommended trend filter: ${best.method}`);
    console.log(`  Description: ${best.description}`);
    console.log(`  Best timeframe: ${best.timeframe}`);
    console.log(`  Expected P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPercent)})`);
  }

  console.log('\n' + '═'.repeat(80));
}

runComparison().catch(console.error);
