import 'dotenv/config';
import { parseArgs } from 'util';
import { MultiWatcherBacktestEngine } from '../services/backtesting/MultiWatcherBacktestEngine';
import type { WatcherConfig, Interval } from '@marketmind/types';
import {
  ENABLED_SETUPS,
  createBaseConfig,
  formatCurrency,
  formatPercent,
  calculateDirectionalMetrics,
} from './shared-backtest-config';

const DEFAULT_CONFIG = {
  symbol: 'BTCUSDT',
  interval: '12h' as Interval,
  startDate: '2023-01-01',
  endDate: '2026-01-31',
  marketType: 'FUTURES' as const,
};

const PARAM_RANGES = {
  full: {
    entryLevels: [0, 38.2, 50, 61.8, 78.6, 100],
    minRiskReward: [0.5, 0.75, 1.0, 1.5, 2.0],
    minRiskRewardShort: [0.5, 0.75, 1.0, 1.5, 2.0],
  },
  quick: {
    entryLevels: [61.8, 78.6, 100],
    minRiskReward: [0.75, 1.0],
    minRiskRewardShort: [0.75, 1.0],
  },
  medium: {
    entryLevels: [38.2, 61.8, 78.6, 100],
    minRiskReward: [0.5, 0.75, 1.0, 1.5],
    minRiskRewardShort: [0.5, 0.75, 1.0, 1.5],
  },
};

interface OptimizationResult {
  entryLevel: number;
  minRRLong: number;
  minRRShort: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  maxDrawdown: number;
  profitFactor: number;
  sharpeRatio: number;
  longTrades: number;
  longPnl: number;
  longWinRate: number;
  shortTrades: number;
  shortPnl: number;
  shortWinRate: number;
  score: number;
}

const calculateScore = (result: {
  totalPnl: number;
  totalPnlPercent: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
}): number => {
  const pnlScore = result.totalPnlPercent * 2;
  const drawdownPenalty = result.maxDrawdown * 3;
  const winRateScore = result.winRate;
  const pfScore = Math.min(result.profitFactor, 5) * 20;
  const tradeScore = Math.min(result.totalTrades, 50);
  const calmarRatio = result.maxDrawdown > 0 ? result.totalPnlPercent / result.maxDrawdown : 0;
  const calmarScore = Math.min(calmarRatio, 5) * 30;

  return pnlScore - drawdownPenalty + winRateScore + pfScore + tradeScore + calmarScore;
};

const runOptimization = async () => {
  const { values } = parseArgs({
    options: {
      symbol: { type: 'string', default: DEFAULT_CONFIG.symbol },
      interval: { type: 'string', default: DEFAULT_CONFIG.interval },
      start: { type: 'string', default: DEFAULT_CONFIG.startDate },
      end: { type: 'string', default: DEFAULT_CONFIG.endDate },
      'quick-test': { type: 'boolean', default: false },
      mode: { type: 'string', default: 'medium' },
      'top-n': { type: 'string', default: '20' },
      'long-only': { type: 'boolean', default: false },
      verbose: { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    console.log(`
Entry Levels & R:R Optimization

Usage:
  pnpm tsx apps/backend/src/cli/optimize-entry-levels.ts [options]

Options:
  --symbol <symbol>     Symbol to test (default: BTCUSDT)
  --interval <interval> Timeframe (default: 12h - the only profitable one!)
  --start <date>        Start date YYYY-MM-DD (default: 2023-01-01)
  --end <date>          End date YYYY-MM-DD (default: 2026-01-31)
  --mode <mode>         Parameter search mode: quick, medium, full (default: medium)
  --quick-test          Alias for --mode=quick
  --top-n <n>           Show top N results (default: 20)
  --long-only           Only test LONG positions (skip SHORT configs)
  --verbose             Enable verbose logging
  -h, --help            Show this help

Entry Levels to test (Fibonacci):
  - 0%: Very early entry (start of the swing)
  - 38.2%: Standard Fibonacci retracement
  - 50%: Mid-range pullback
  - 61.8%: Golden ratio pullback (current default)
  - 78.6%: Deep pullback
  - 100%: Breakout (price at swing high/low)

R:R Minimum to test:
  - 0.5: Aggressive (needs high win rate)
  - 0.75: Moderate
  - 1.0: Standard (current default)
  - 1.5: Conservative
  - 2.0: Very conservative (needs trailing stop to work)

Example:
  pnpm tsx apps/backend/src/cli/optimize-entry-levels.ts --quick-test --verbose
  pnpm tsx apps/backend/src/cli/optimize-entry-levels.ts --mode=full --long-only
    `);
    process.exit(0);
  }

  const config = {
    ...DEFAULT_CONFIG,
    symbol: values.symbol ?? DEFAULT_CONFIG.symbol,
    interval: (values.interval ?? DEFAULT_CONFIG.interval) as Interval,
    startDate: values.start ?? DEFAULT_CONFIG.startDate,
    endDate: values.end ?? DEFAULT_CONFIG.endDate,
  };

  const topN = parseInt(values['top-n'] ?? '20', 10);
  const quickTest = values['quick-test'] ?? false;
  const mode = quickTest ? 'quick' : (values['mode'] as 'quick' | 'medium' | 'full') ?? 'medium';
  const longOnly = values['long-only'] ?? false;
  const verbose = values.verbose ?? false;

  const ranges = PARAM_RANGES[mode];
  const entryLevels = ranges.entryLevels;
  const minRRLongs = ranges.minRiskReward;
  const minRRShorts = longOnly ? [1.0] : ranges.minRiskRewardShort;

  const totalCombinations = entryLevels.length * minRRLongs.length * minRRShorts.length;

  console.log('========== ENTRY LEVELS & R:R OPTIMIZATION ==========');
  console.log(`Symbol: ${config.symbol} | Interval: ${config.interval} | Period: ${config.startDate} to ${config.endDate}`);
  console.log(`Mode: ${mode} | Long-only: ${longOnly}`);
  console.log(`\nParameters to test:`);
  console.log(`  Entry Levels: ${entryLevels.join('%, ')}%`);
  console.log(`  R:R Min LONG: ${minRRLongs.join(', ')}`);
  console.log(`  R:R Min SHORT: ${minRRShorts.join(', ')}`);
  console.log(`\nTotal combinations: ${totalCombinations}`);
  console.log(`\n${  '='.repeat(60)  }\n`);

  const baseConfig = createBaseConfig();
  const results: OptimizationResult[] = [];
  let processed = 0;
  const startTime = Date.now();

  for (const entryLevel of entryLevels) {
    for (const minRRLong of minRRLongs) {
      for (const minRRShort of minRRShorts) {
        processed++;

        if (verbose) {
          console.log(`[${processed}/${totalCombinations}] Testing: Entry=${entryLevel}% | R:R LONG=${minRRLong} | R:R SHORT=${minRRShort}`);
        }

        const watchers: WatcherConfig[] = [
          {
            symbol: config.symbol,
            interval: config.interval,
            marketType: config.marketType,
            setupTypes: [...ENABLED_SETUPS],
          },
        ];

        const engine = new MultiWatcherBacktestEngine({
          ...baseConfig,
          watchers,
          startDate: config.startDate,
          endDate: config.endDate,
          maxFibonacciEntryProgressPercentLong: entryLevel,
          maxFibonacciEntryProgressPercentShort: entryLevel,
          minRiskRewardRatio: minRRLong,
          minRiskRewardRatioLong: minRRLong,
          minRiskRewardRatioShort: minRRShort,
          onlyLong: longOnly,
          silent: true,
        });

        try {
          const result = await engine.run();

          const longTrades = result.trades.filter(t => t.side === 'LONG');
          const shortTrades = result.trades.filter(t => t.side === 'SHORT');
          const longMetrics = calculateDirectionalMetrics(longTrades);
          const shortMetrics = calculateDirectionalMetrics(shortTrades);

          const optimResult: OptimizationResult = {
            entryLevel,
            minRRLong,
            minRRShort,
            totalTrades: result.metrics.totalTrades,
            winningTrades: result.metrics.winningTrades,
            losingTrades: result.metrics.losingTrades,
            winRate: result.metrics.winRate,
            totalPnl: result.metrics.totalPnl,
            totalPnlPercent: result.metrics.totalPnlPercent,
            maxDrawdown: result.metrics.maxDrawdownPercent,
            profitFactor: result.metrics.profitFactor,
            sharpeRatio: result.metrics.sharpeRatio ?? 0,
            longTrades: longMetrics.trades,
            longPnl: longMetrics.pnl,
            longWinRate: longMetrics.winRate,
            shortTrades: shortMetrics.trades,
            shortPnl: shortMetrics.pnl,
            shortWinRate: shortMetrics.winRate,
            score: 0,
          };

          optimResult.score = calculateScore({
            totalPnl: optimResult.totalPnl,
            totalPnlPercent: optimResult.totalPnlPercent,
            maxDrawdown: optimResult.maxDrawdown,
            winRate: optimResult.winRate,
            profitFactor: optimResult.profitFactor,
            totalTrades: optimResult.totalTrades,
          });

          results.push(optimResult);

          if (!verbose && processed % 5 === 0) {
            const elapsed = (Date.now() - startTime) / 1000;
            const rate = processed / elapsed;
            const remaining = (totalCombinations - processed) / rate;
            console.log(`Progress: ${processed}/${totalCombinations} (${(processed / totalCombinations * 100).toFixed(1)}%) | ETA: ${remaining.toFixed(0)}s`);
          }
        } catch (error) {
          console.error(`Error testing Entry=${entryLevel}% R:R=${minRRLong}/${minRRShort}:`, error);
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score);

  console.log(`\n${  '='.repeat(100)}`);
  console.log('TOP RESULTS BY SCORE');
  console.log(`${'='.repeat(100)  }\n`);

  console.log('Rank  Entry%  R:R(L/S)   Trades   WinRate     P&L         P&L%     MaxDD      PF     Sharpe   Score');
  console.log('-'.repeat(105));

  for (let i = 0; i < Math.min(topN, results.length); i++) {
    const r = results[i]!;
    const rankStr = `#${i + 1}`.padEnd(5);
    const entryStr = `${r.entryLevel}%`.padStart(6);
    const rrStr = `${r.minRRLong}/${r.minRRShort}`.padStart(9);
    const tradesStr = String(r.totalTrades).padStart(6);
    const wrStr = formatPercent(r.winRate).padStart(8);
    const pnlStr = `$${formatCurrency(r.totalPnl)}`.padStart(12);
    const pnlPctStr = formatPercent(r.totalPnlPercent).padStart(8);
    const ddStr = formatPercent(r.maxDrawdown).padStart(8);
    const pfStr = (r.profitFactor === Infinity ? 'Inf' : r.profitFactor.toFixed(2)).padStart(6);
    const sharpeStr = r.sharpeRatio.toFixed(3).padStart(8);
    const scoreStr = r.score.toFixed(1).padStart(8);

    console.log(`${rankStr} ${entryStr} ${rrStr} ${tradesStr} ${wrStr} ${pnlStr} ${pnlPctStr} ${ddStr} ${pfStr} ${sharpeStr} ${scoreStr}`);
  }

  console.log('-'.repeat(105));

  console.log(`\n${  '='.repeat(100)}`);
  console.log('ANALYSIS BY ENTRY LEVEL');
  console.log(`${'='.repeat(100)  }\n`);

  for (const level of entryLevels) {
    const levelResults = results.filter(r => r.entryLevel === level);
    if (levelResults.length === 0) continue;

    const avgPnl = levelResults.reduce((sum, r) => sum + r.totalPnl, 0) / levelResults.length;
    const avgWinRate = levelResults.reduce((sum, r) => sum + r.winRate, 0) / levelResults.length;
    const avgTrades = levelResults.reduce((sum, r) => sum + r.totalTrades, 0) / levelResults.length;
    const bestResult = levelResults.sort((a, b) => b.totalPnl - a.totalPnl)[0]!;

    console.log(`Entry Level ${level}%:`);
    console.log(`  Avg P&L: $${formatCurrency(avgPnl)} | Avg WinRate: ${formatPercent(avgWinRate)} | Avg Trades: ${avgTrades.toFixed(0)}`);
    console.log(`  Best config: R:R ${bestResult.minRRLong}/${bestResult.minRRShort} -> $${formatCurrency(bestResult.totalPnl)}`);
    console.log('');
  }

  console.log('='.repeat(100));
  console.log('ANALYSIS BY R:R MINIMUM');
  console.log(`${'='.repeat(100)  }\n`);

  for (const rr of minRRLongs) {
    const rrResults = results.filter(r => r.minRRLong === rr);
    if (rrResults.length === 0) continue;

    const avgPnl = rrResults.reduce((sum, r) => sum + r.totalPnl, 0) / rrResults.length;
    const avgWinRate = rrResults.reduce((sum, r) => sum + r.winRate, 0) / rrResults.length;
    const avgTrades = rrResults.reduce((sum, r) => sum + r.totalTrades, 0) / rrResults.length;
    const bestResult = rrResults.sort((a, b) => b.totalPnl - a.totalPnl)[0]!;

    console.log(`R:R Minimum ${rr} (LONG):`);
    console.log(`  Avg P&L: $${formatCurrency(avgPnl)} | Avg WinRate: ${formatPercent(avgWinRate)} | Avg Trades: ${avgTrades.toFixed(0)}`);
    console.log(`  Best config: Entry ${bestResult.entryLevel}% -> $${formatCurrency(bestResult.totalPnl)}`);
    console.log('');
  }

  if (!longOnly) {
    console.log('='.repeat(100));
    console.log('LONG vs SHORT COMPARISON');
    console.log(`${'='.repeat(100)  }\n`);

    const best = results[0]!;
    console.log(`Best Configuration:`);
    console.log(`  Entry Level: ${best.entryLevel}%`);
    console.log(`  R:R Minimum LONG: ${best.minRRLong}`);
    console.log(`  R:R Minimum SHORT: ${best.minRRShort}`);
    console.log('');
    console.log(`  LONG: ${best.longTrades} trades | P&L: $${formatCurrency(best.longPnl)} | WR: ${formatPercent(best.longWinRate)}`);
    console.log(`  SHORT: ${best.shortTrades} trades | P&L: $${formatCurrency(best.shortPnl)} | WR: ${formatPercent(best.shortWinRate)}`);
    console.log('');

    const longTotalPnl = results.reduce((sum, r) => sum + r.longPnl, 0);
    const shortTotalPnl = results.reduce((sum, r) => sum + r.shortPnl, 0);
    console.log(`Aggregate across all configs:`);
    console.log(`  LONG total P&L: $${formatCurrency(longTotalPnl)}`);
    console.log(`  SHORT total P&L: $${formatCurrency(shortTotalPnl)}`);
    console.log(`  Recommendation: ${longTotalPnl > shortTotalPnl ? 'Consider LONG-only mode' : 'Keep both directions'}`);
  }

  console.log(`\n${  '='.repeat(100)}`);
  console.log('BEST CONFIGURATION');
  console.log(`${'='.repeat(100)  }\n`);

  const best = results[0]!;
  console.log('Copy these values to your trading config:\n');
  console.log(JSON.stringify({
    maxFibonacciEntryProgressPercentLong: best.entryLevel,
    maxFibonacciEntryProgressPercentShort: best.entryLevel,
    minRiskRewardRatioLong: best.minRRLong,
    minRiskRewardRatioShort: best.minRRShort,
    results: {
      totalPnl: best.totalPnl,
      totalPnlPercent: best.totalPnlPercent,
      winRate: best.winRate,
      profitFactor: best.profitFactor,
      maxDrawdown: best.maxDrawdown,
      sharpeRatio: best.sharpeRatio,
      totalTrades: best.totalTrades,
    },
  }, null, 2));

  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`\n========== OPTIMIZATION COMPLETE ==========`);
  console.log(`Tested ${totalCombinations} combinations in ${elapsed.toFixed(1)}s`);
  console.log(`Average: ${(totalCombinations / elapsed).toFixed(1)} combinations/s`);

  process.exit(0);
};

runOptimization().catch((err) => {
  console.error('Optimization failed:', err);
  process.exit(1);
});
