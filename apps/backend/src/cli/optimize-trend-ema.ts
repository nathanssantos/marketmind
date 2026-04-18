import 'dotenv/config';

process.env.LOG_LEVEL = 'error';

import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, MultiWatcherBacktestConfig } from '@marketmind/types';
import { TRADING_DEFAULTS } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  DEFAULT_BACKTEST_PARAMS,
  formatCurrency,
  formatPercent,
  parseCliArgs,
} from './shared-backtest-config';

interface TestResult {
  period: number;
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

const TREND_EMA_PERIODS = [9, 21, 50, 70, 100, 150, 200];

async function runOptimization() {
  console.log('> TREND EMA PERIOD OPTIMIZATION');
  console.log('=================================\n');

  const { symbol, interval, startDate, endDate } = parseCliArgs();

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
  console.log(`> TrendEMA periods to test: ${TREND_EMA_PERIODS.join(', ')}\n`);

  const baseConfig: Omit<MultiWatcherBacktestConfig, 'watchers' | 'startDate' | 'endDate' | 'trendFilterPeriod'> = {
    initialCapital: DEFAULT_BACKTEST_PARAMS.initialCapital,
    positionSizePercent: DEFAULT_BACKTEST_PARAMS.positionSizePercent,
    minRiskRewardRatio: TRADING_DEFAULTS.MIN_RISK_REWARD_RATIO,
    setupTypes: [...ENABLED_SETUPS],
    useSharedExposure: true,
    marketType: DEFAULT_BACKTEST_PARAMS.marketType,
    leverage: DEFAULT_BACKTEST_PARAMS.leverage,
    useCooldown: true,
    cooldownMinutes: DEFAULT_BACKTEST_PARAMS.cooldownMinutes,
    useTrendFilter: true,
    tpCalculationMode: 'fibonacci',
    fibonacciTargetLevelLong: '1.618',
    fibonacciTargetLevelShort: '1.272',
  };

  const results: TestResult[] = [];

  for (const period of TREND_EMA_PERIODS) {
    console.log(`\n~ Testing TrendEMA period: ${period}...`);

    const engine = new MultiWatcherBacktestEngine({
      ...baseConfig,
      trendFilterPeriod: period,
      watchers,
      startDate,
      endDate,
      silent: true,
    });

    const result = await engine.run();

    const longTrades = result.trades.filter(t => t.side === 'LONG');
    const shortTrades = result.trades.filter(t => t.side === 'SHORT');
    const longPnl = longTrades.reduce((sum, t) => sum + (t.netPnl ?? t.pnl ?? 0), 0);
    const shortPnl = shortTrades.reduce((sum, t) => sum + (t.netPnl ?? t.pnl ?? 0), 0);

    results.push({
      period,
      pnl: result.metrics.totalPnl,
      pnlPct: result.metrics.totalPnlPercent,
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      profitFactor: result.metrics.profitFactor,
      maxDrawdown: result.metrics.maxDrawdownPercent,
      longPnl,
      shortPnl,
      longTrades: longTrades.length,
      shortTrades: shortTrades.length,
    });

    console.log(`   P&L: $${formatCurrency(result.metrics.totalPnl)} | Trades: ${result.metrics.totalTrades} | WR: ${formatPercent(result.metrics.winRate)}`);
  }

  console.log('\n\n═'.repeat(120));
  console.log('> TREND EMA PERIOD COMPARISON');
  console.log(`${'═'.repeat(120)  }\n`);

  console.log('Rank  Period    P&L          P&L%    Trades   WinRate    PF    MaxDD    LONG P&L (n)    SHORT P&L (n)');
  console.log('─'.repeat(120));

  const sortedResults = [...results].sort((a, b) => b.pnl - a.pnl);

  for (let i = 0; i < sortedResults.length; i++) {
    const r = sortedResults[i]!;
    const rank = `#${i + 1}`.padEnd(5);
    const periodStr = String(r.period).padEnd(8);
    const pnlStr = `$${formatCurrency(r.pnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.pnlPct).padStart(8);
    const tradesStr = String(r.trades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pfStr = r.profitFactor === Infinity ? '    ∞' : r.profitFactor.toFixed(2).padStart(5);
    const ddStr = formatPercent(r.maxDrawdown).padStart(7);
    const longStr = `$${formatCurrency(r.longPnl)} (${r.longTrades})`.padStart(14);
    const shortStr = `$${formatCurrency(r.shortPnl)} (${r.shortTrades})`.padStart(14);

    const marker = i === 0 ? '>' : i < 3 ? '#2' : '  ';

    console.log(`${marker}${rank}${periodStr} ${pnlStr} ${pnlPctStr} ${tradesStr} ${wrStr} ${pfStr} ${ddStr}  ${longStr}  ${shortStr}`);
  }

  console.log('─'.repeat(120));

  const best = sortedResults[0]!;
  console.log(`\n> BEST TREND EMA PERIOD: ${best.period}`);
  console.log(`   P&L: $${formatCurrency(best.pnl)} (${formatPercent(best.pnlPct)})`);
  console.log(`   WR: ${formatPercent(best.winRate)} | PF: ${best.profitFactor.toFixed(2)} | MaxDD: ${formatPercent(best.maxDrawdown)}`);

  process.exit(0);
}

runOptimization().catch(console.error);
