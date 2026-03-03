import { FILTER_DEFAULTS, TRADING_DEFAULTS } from '@marketmind/types';
import { config as dotenvConfig } from 'dotenv';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../../.env') });

import { writeSync } from 'fs';

const log = (...args: any[]): void => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
  writeSync(1, msg);
};

process.env['LOG_LEVEL'] = 'silent';
process.env['NODE_ENV'] = 'production';
console.log = () => {};
console.info = () => {};
console.warn = () => {};
const originalConsoleError = console.error;
console.error = () => {};
console.debug = () => {};

const { BacktestEngine } = await import('../../src/services/backtesting/BacktestEngine.js');
const { klineQueries } = await import('../../src/services/database/klineQueries.js');
const { mapDbKlinesToApi } = await import('../../src/utils/kline-mapper.js');
const { smartBackfillKlines } = await import('../../src/services/binance-historical.js');
const { BACKTEST_ENGINE, ABSOLUTE_MINIMUM_KLINES } = await import('../../src/constants/index.js');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAME = '1h';
const INTERVAL_MS = 3600000;

const START_DATE = '2023-02-18';
const END_DATE = '2026-02-18';

const STRATEGIES_DIR = resolve(__dirname, '../../strategies/builtin');

const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/strategy-ranking';
const PROGRESS_FILE = `${OUTPUT_DIR}/progress.json`;

const fmt = (num: number, decimals = 2): string => num.toFixed(decimals);
const pct = (num: number): string => `${num >= 0 ? '+' : ''}${fmt(num)}%`;

const formatEta = (ms: number): string => {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const PRODUCTION_CONFIG = {
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  marginType: 'CROSSED' as const,
  minConfidence: 50,
  useAlgorithmicLevels: true,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciSwingRange: 'nearest' as const,
  fibonacciTargetLevelLong: FILTER_DEFAULTS.fibonacciTargetLevelLong,
  fibonacciTargetLevelShort: FILTER_DEFAULTS.fibonacciTargetLevelShort,
  maxFibonacciEntryProgressPercentLong: FILTER_DEFAULTS.maxFibonacciEntryProgressPercentLong,
  maxFibonacciEntryProgressPercentShort: FILTER_DEFAULTS.maxFibonacciEntryProgressPercentShort,
  minRiskRewardRatioLong: FILTER_DEFAULTS.minRiskRewardRatioLong,
  minRiskRewardRatioShort: FILTER_DEFAULTS.minRiskRewardRatioShort,
  useMomentumTimingFilter: FILTER_DEFAULTS.useMomentumTimingFilter,
  useBtcCorrelationFilter: FILTER_DEFAULTS.useBtcCorrelationFilter,
  useVolumeFilter: FILTER_DEFAULTS.useVolumeFilter,
  useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
  useStochasticFilter: FILTER_DEFAULTS.useStochasticFilter,
  useStochasticRecoveryFilter: FILTER_DEFAULTS.useStochasticRecoveryFilter,
  useStochasticHtfFilter: FILTER_DEFAULTS.useStochasticHtfFilter,
  useStochasticRecoveryHtfFilter: FILTER_DEFAULTS.useStochasticRecoveryHtfFilter,
  useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
  useMtfFilter: FILTER_DEFAULTS.useMtfFilter,
  useMarketRegimeFilter: FILTER_DEFAULTS.useMarketRegimeFilter,
  useDirectionFilter: FILTER_DEFAULTS.useDirectionFilter,
  useFundingFilter: FILTER_DEFAULTS.useFundingFilter,
  useConfluenceScoring: FILTER_DEFAULTS.useConfluenceScoring,
  confluenceMinScore: FILTER_DEFAULTS.confluenceMinScore,
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  useCooldown: FILTER_DEFAULTS.useCooldown,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
  simulateFundingRates: true,
  simulateLiquidation: true,
  silent: true,
};

interface DirectionMetrics {
  trades: number;
  winRate: number;
  pnlPercent: number;
  avgTradePercent: number;
}

interface StrategyResult {
  strategyId: string;
  symbol: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  long: DirectionMetrics;
  short: DirectionMetrics;
}

interface StrategyRanking {
  strategyId: string;
  avgPnlPercent: number;
  avgSharpe: number;
  avgWinRate: number;
  avgProfitFactor: number;
  avgMaxDrawdown: number;
  totalTradesAll: number;
  score: number;
  bySymbol: Map<string, StrategyResult>;
}

interface ProgressData {
  completed: string[];
  results: StrategyResult[];
}

let shuttingDown = false;
let currentProgress: ProgressData | null = null;

const handleShutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`\n[${signal}] Saving progress and shutting down...`);
  if (currentProgress) {
    saveProgress(currentProgress);
    log(`  Progress saved. Resume by re-running the script.`);
  }
  process.exit(0);
};

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

const loadProgress = (): ProgressData => {
  if (existsSync(PROGRESS_FILE)) return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  return { completed: [], results: [] };
};

const saveProgress = (data: ProgressData): void => {
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
};

const klineCache = new Map<string, any[]>();

const prefetchKlines = async (symbol: string): Promise<any[]> => {
  if (klineCache.has(symbol)) return klineCache.get(symbol)!;

  log(`  [Prefetch] ${symbol}/${TIMEFRAME}...`);

  const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * INTERVAL_MS;
  const startTime = new Date(new Date(START_DATE).getTime() - warmupMs);
  const endTime = new Date(END_DATE);

  let dbKlines = await klineQueries.findMany({
    symbol,
    interval: TIMEFRAME as any,
    marketType: 'FUTURES' as any,
    startTime,
    endTime,
  });

  if (dbKlines.length < ABSOLUTE_MINIMUM_KLINES) {
    log(`    DB has ${dbKlines.length} klines, backfilling...`);
    const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / INTERVAL_MS);
    await smartBackfillKlines(symbol, TIMEFRAME as any, expectedKlines, 'FUTURES' as any);

    dbKlines = await klineQueries.findMany({
      symbol,
      interval: TIMEFRAME as any,
      marketType: 'FUTURES' as any,
      startTime,
      endTime,
    });
    log(`    After backfill: ${dbKlines.length} klines`);
  } else {
    log(`    Loaded ${dbKlines.length} klines from DB`);
  }

  const mapped = mapDbKlinesToApi(dbKlines);

  const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / INTERVAL_MS);
  const ratio = mapped.length / expectedKlines;
  if (ratio < 0.9) {
    log(`    [Warning] ${symbol}/${TIMEFRAME}: only ${mapped.length}/${expectedKlines} klines (${fmt(ratio * 100)}%) — results may be unreliable`);
  }

  klineCache.set(symbol, mapped);
  return mapped;
};

const splitByDirection = (trades: any[]): { long: DirectionMetrics; short: DirectionMetrics } => {
  const longTrades = trades.filter((t: any) => t.side === 'LONG');
  const shortTrades = trades.filter((t: any) => t.side === 'SHORT');

  const longWins = longTrades.filter((t: any) => (t.pnlPercent ?? 0) > 0).length;
  const shortWins = shortTrades.filter((t: any) => (t.pnlPercent ?? 0) > 0).length;

  const longPnl = longTrades.reduce((sum: number, t: any) => sum + (t.pnlPercent ?? 0), 0);
  const shortPnl = shortTrades.reduce((sum: number, t: any) => sum + (t.pnlPercent ?? 0), 0);

  return {
    long: {
      trades: longTrades.length,
      winRate: longTrades.length > 0 ? (longWins / longTrades.length) * 100 : 0,
      pnlPercent: longPnl,
      avgTradePercent: longTrades.length > 0 ? longPnl / longTrades.length : 0,
    },
    short: {
      trades: shortTrades.length,
      winRate: shortTrades.length > 0 ? (shortWins / shortTrades.length) * 100 : 0,
      pnlPercent: shortPnl,
      avgTradePercent: shortTrades.length > 0 ? shortPnl / shortTrades.length : 0,
    },
  };
};

const loadAllStrategyIds = (): string[] => {
  const files = readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(f => f.replace('.json', ''));
};

const runStrategyBacktest = async (
  strategyId: string,
  symbol: string,
  klines: any[]
): Promise<StrategyResult | null> => {
  try {
    const engine = new BacktestEngine();
    const config = {
      ...PRODUCTION_CONFIG,
      setupTypes: [strategyId],
      symbol,
      interval: TIMEFRAME,
    };
    const result = await engine.run(config, klines);
    const dirs = splitByDirection(result.trades || []);

    return {
      strategyId,
      symbol,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      totalPnlPercent: result.metrics.totalPnlPercent,
      profitFactor: result.metrics.profitFactor,
      maxDrawdownPercent: result.metrics.maxDrawdownPercent ?? 0,
      sharpeRatio: result.metrics.sharpeRatio ?? 0,
      long: dirs.long,
      short: dirs.short,
    };
  } catch (error) {
    log(`  [Error] ${strategyId}/${symbol}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
};

const generateReport = (results: StrategyResult[]): void => {
  log('\n' + '='.repeat(80));
  log('GENERATING REPORTS');
  log('='.repeat(80));

  const byStrategy = new Map<string, StrategyResult[]>();
  for (const r of results) {
    if (!byStrategy.has(r.strategyId)) byStrategy.set(r.strategyId, []);
    byStrategy.get(r.strategyId)!.push(r);
  }

  const rankings: StrategyRanking[] = [];

  for (const [strategyId, rows] of byStrategy) {
    const avgPnl = rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length;
    const avgSharpe = rows.reduce((s, r) => s + r.sharpeRatio, 0) / rows.length;
    const avgWr = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    const avgPf = rows.reduce((s, r) => s + r.profitFactor, 0) / rows.length;
    const avgDd = rows.reduce((s, r) => s + r.maxDrawdownPercent, 0) / rows.length;
    const totalTrades = rows.reduce((s, r) => s + r.totalTrades, 0);
    const score = avgPnl * 0.6 + avgSharpe * 10 * 0.4;

    const bySymbol = new Map<string, StrategyResult>();
    for (const r of rows) bySymbol.set(r.symbol, r);

    rankings.push({
      strategyId,
      avgPnlPercent: avgPnl,
      avgSharpe,
      avgWinRate: avgWr,
      avgProfitFactor: avgPf,
      avgMaxDrawdown: avgDd,
      totalTradesAll: totalTrades,
      score,
      bySymbol,
    });
  }

  rankings.sort((a, b) => b.score - a.score);

  let summary = '';
  summary += '='.repeat(140) + '\n';
  summary += 'STRATEGY RANKING - All Strategies Backtest Results\n';
  summary += '='.repeat(140) + '\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${START_DATE} to ${END_DATE} (3 years)\n`;
  summary += `Symbols: ${SYMBOLS.join(', ')}\n`;
  summary += `Timeframe: ${TIMEFRAME}\n`;
  summary += `Market: FUTURES | Leverage: 1x | Config: Production defaults\n`;
  summary += `Total strategies tested: ${rankings.length}\n`;
  summary += `Total backtests: ${results.length}\n`;
  summary += '='.repeat(140) + '\n\n';

  summary += 'OVERALL RANKING (sorted by composite score: 60% PnL + 40% Sharpe)\n';
  summary += '-'.repeat(140) + '\n';
  summary += 'Rank | Strategy                              | Avg PnL %  | Sharpe | WR %   | PF     | Max DD % | Trades | Score   | L PnL %    | S PnL %\n';
  summary += '-'.repeat(140) + '\n';

  for (let i = 0; i < rankings.length; i++) {
    const r = rankings[i]!;
    const avgLPnl = [...r.bySymbol.values()].reduce((s, v) => s + v.long.pnlPercent, 0) / r.bySymbol.size;
    const avgSPnl = [...r.bySymbol.values()].reduce((s, v) => s + v.short.pnlPercent, 0) / r.bySymbol.size;

    summary += `${(i + 1).toString().padStart(4)} | ${r.strategyId.padEnd(37)} | ${pct(r.avgPnlPercent).padStart(10)} | ${fmt(r.avgSharpe).padStart(6)} | ${fmt(r.avgWinRate).padStart(5)}% | ${fmt(r.avgProfitFactor).padStart(6)} | ${fmt(r.avgMaxDrawdown).padStart(7)}% | ${r.totalTradesAll.toString().padStart(6)} | ${fmt(r.score).padStart(7)} | ${pct(avgLPnl).padStart(10)} | ${pct(avgSPnl).padStart(10)}\n`;
  }

  const profitable = rankings.filter(r => r.avgPnlPercent > 0);
  const unprofitable = rankings.filter(r => r.avgPnlPercent <= 0);
  const noTrades = rankings.filter(r => r.totalTradesAll === 0);

  summary += '\n' + '='.repeat(140) + '\n';
  summary += `SUMMARY: ${profitable.length} profitable | ${unprofitable.length} unprofitable | ${noTrades.length} with zero trades\n`;
  summary += '='.repeat(140) + '\n\n';

  summary += 'PER-SYMBOL BREAKDOWN (Top 30 strategies)\n';
  summary += '-'.repeat(140) + '\n\n';

  for (const symbol of SYMBOLS) {
    summary += `${symbol}\n`;
    summary += '-'.repeat(100) + '\n';
    summary += 'Rank | Strategy                              | PnL %      | Sharpe | WR %   | PF     | Max DD % | Trades | L PnL %    | S PnL %\n';
    summary += '-'.repeat(100) + '\n';

    const symbolRanked = rankings
      .filter(r => r.bySymbol.has(symbol))
      .map(r => ({ ...r, result: r.bySymbol.get(symbol)! }))
      .sort((a, b) => b.result.totalPnlPercent - a.result.totalPnlPercent);

    for (let i = 0; i < Math.min(30, symbolRanked.length); i++) {
      const r = symbolRanked[i]!;
      const sr = r.result;
      summary += `${(i + 1).toString().padStart(4)} | ${r.strategyId.padEnd(37)} | ${pct(sr.totalPnlPercent).padStart(10)} | ${fmt(sr.sharpeRatio).padStart(6)} | ${fmt(sr.winRate).padStart(5)}% | ${fmt(sr.profitFactor).padStart(6)} | ${fmt(sr.maxDrawdownPercent).padStart(7)}% | ${sr.totalTrades.toString().padStart(6)} | ${pct(sr.long.pnlPercent).padStart(10)} | ${pct(sr.short.pnlPercent).padStart(10)}\n`;
    }
    summary += '\n';
  }

  summary += '='.repeat(140) + '\n';
  summary += 'CONSISTENCY ANALYSIS (strategies profitable on ALL 3 symbols)\n';
  summary += '='.repeat(140) + '\n\n';

  const consistent = rankings.filter(r => {
    if (r.bySymbol.size < SYMBOLS.length) return false;
    return [...r.bySymbol.values()].every(sr => sr.totalPnlPercent > 0);
  }).sort((a, b) => b.score - a.score);

  if (consistent.length === 0) {
    summary += '  No strategy was profitable on all 3 symbols.\n\n';
  } else {
    summary += `  ${consistent.length} strategies profitable on all 3 symbols:\n\n`;
    summary += '  Rank | Strategy                              | Avg PnL %  | BTC PnL %  | ETH PnL %  | SOL PnL %  | Sharpe | Score\n';
    summary += '  ' + '-'.repeat(120) + '\n';

    for (let i = 0; i < consistent.length; i++) {
      const r = consistent[i]!;
      const btc = r.bySymbol.get('BTCUSDT')?.totalPnlPercent ?? 0;
      const eth = r.bySymbol.get('ETHUSDT')?.totalPnlPercent ?? 0;
      const sol = r.bySymbol.get('SOLUSDT')?.totalPnlPercent ?? 0;

      summary += `  ${(i + 1).toString().padStart(4)} | ${r.strategyId.padEnd(37)} | ${pct(r.avgPnlPercent).padStart(10)} | ${pct(btc).padStart(10)} | ${pct(eth).padStart(10)} | ${pct(sol).padStart(10)} | ${fmt(r.avgSharpe).padStart(6)} | ${fmt(r.score).padStart(7)}\n`;
    }
  }

  summary += '\n' + '='.repeat(140) + '\n';
  summary += 'TOP 10 RECOMMENDED (best composite score with min 5 trades per symbol)\n';
  summary += '='.repeat(140) + '\n\n';

  const qualified = rankings.filter(r => {
    if (r.bySymbol.size < SYMBOLS.length) return false;
    return [...r.bySymbol.values()].every(sr => sr.totalTrades >= 5);
  });

  for (let i = 0; i < Math.min(10, qualified.length); i++) {
    const r = qualified[i]!;
    summary += `#${i + 1} ${r.strategyId}\n`;
    summary += `   Avg PnL: ${pct(r.avgPnlPercent)} | Sharpe: ${fmt(r.avgSharpe)} | WR: ${fmt(r.avgWinRate)}% | PF: ${fmt(r.avgProfitFactor)} | Score: ${fmt(r.score)}\n`;

    for (const symbol of SYMBOLS) {
      const sr = r.bySymbol.get(symbol);
      if (!sr) continue;
      summary += `   ${symbol}: PnL ${pct(sr.totalPnlPercent)} | WR ${fmt(sr.winRate)}% | ${sr.totalTrades} trades (L:${sr.long.trades} S:${sr.short.trades}) | DD ${fmt(sr.maxDrawdownPercent)}%\n`;
    }
    summary += '\n';
  }

  writeFileSync(`${OUTPUT_DIR}/ranking.txt`, summary);
  log(`  Wrote ranking.txt`);

  let csv = 'Strategy,Symbol,Trades,WinRate,PnL%,ProfitFactor,MaxDD%,Sharpe,LongTrades,LongWR,LongPnL%,ShortTrades,ShortWR,ShortPnL%\n';
  for (const r of results) {
    csv += `${r.strategyId},${r.symbol},${r.totalTrades},${fmt(r.winRate)},${fmt(r.totalPnlPercent)},${fmt(r.profitFactor)},${fmt(r.maxDrawdownPercent)},${fmt(r.sharpeRatio)},${r.long.trades},${fmt(r.long.winRate)},${fmt(r.long.pnlPercent)},${r.short.trades},${fmt(r.short.winRate)},${fmt(r.short.pnlPercent)}\n`;
  }
  writeFileSync(`${OUTPUT_DIR}/results.csv`, csv);
  log(`  Wrote results.csv`);

  const topStrategies = qualified.slice(0, 20).map(r => ({
    strategyId: r.strategyId,
    avgPnlPercent: +fmt(r.avgPnlPercent),
    avgSharpe: +fmt(r.avgSharpe),
    avgWinRate: +fmt(r.avgWinRate),
    avgProfitFactor: +fmt(r.avgProfitFactor),
    avgMaxDrawdown: +fmt(r.avgMaxDrawdown),
    totalTrades: r.totalTradesAll,
    score: +fmt(r.score),
    bySymbol: Object.fromEntries(
      [...r.bySymbol.entries()].map(([sym, sr]) => [sym, {
        pnlPercent: +fmt(sr.totalPnlPercent),
        winRate: +fmt(sr.winRate),
        trades: sr.totalTrades,
        sharpe: +fmt(sr.sharpeRatio),
        maxDrawdown: +fmt(sr.maxDrawdownPercent),
      }])
    ),
  }));
  writeFileSync(`${OUTPUT_DIR}/top-strategies.json`, JSON.stringify(topStrategies, null, 2));
  log(`  Wrote top-strategies.json`);

  log(`\n  All reports saved to: ${OUTPUT_DIR}`);
};

const main = async (): Promise<void> => {
  const startTime = Date.now();
  const allStrategies = loadAllStrategyIds();

  log('='.repeat(80));
  log('STRATEGY RANKING - Backtest All Strategies');
  log('='.repeat(80));
  log(`Strategies: ${allStrategies.length}`);
  log(`Symbols: ${SYMBOLS.join(', ')}`);
  log(`Timeframe: ${TIMEFRAME}`);
  log(`Period: ${START_DATE} to ${END_DATE}`);
  log(`Config: Production defaults (FUTURES, 1x leverage)`);
  log(`Output: ${OUTPUT_DIR}`);
  log(`Total backtests: ${allStrategies.length * SYMBOLS.length}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  log('\n[Prefetch] Loading klines for all symbols...');
  for (const symbol of SYMBOLS) {
    if (shuttingDown) break;
    await prefetchKlines(symbol);
  }

  const progress = loadProgress();
  currentProgress = progress;
  const completedSet = new Set(progress.completed);
  const results = [...progress.results];

  const totalTasks = allStrategies.length * SYMBOLS.length;
  let completedCount = completedSet.size;

  if (completedCount > 0) {
    log(`\n[Resume] Found ${completedCount}/${totalTasks} completed backtests`);
  }

  log('\n' + '='.repeat(80));
  log('RUNNING BACKTESTS');
  log('='.repeat(80));

  const stageStart = Date.now();

  for (const strategyId of allStrategies) {
    if (shuttingDown) break;

    for (const symbol of SYMBOLS) {
      if (shuttingDown) break;

      const taskKey = `${strategyId}:${symbol}`;
      if (completedSet.has(taskKey)) {
        completedCount++;
        continue;
      }

      const klines = klineCache.get(symbol)!;
      const result = await runStrategyBacktest(strategyId, symbol, klines);

      if (result) {
        results.push(result);

        if (result.totalTrades > 0) {
          log(`  ${strategyId.padEnd(35)} ${symbol}: ${pct(result.totalPnlPercent).padStart(10)} | WR ${fmt(result.winRate).padStart(5)}% | ${result.totalTrades} trades`);
        }
      }

      completedSet.add(taskKey);
      completedCount++;

      progress.completed = [...completedSet];
      progress.results = results;
      currentProgress = progress;

      if (completedCount % 15 === 0) {
        saveProgress(progress);
        const pctDone = (completedCount / totalTasks) * 100;
        const elapsed = Date.now() - stageStart;
        const rate = completedCount / elapsed;
        const eta = (totalTasks - completedCount) / rate;
        log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)}`);
      }
    }
  }

  saveProgress(progress);
  log(`\n  Backtests complete: ${results.length} results`);

  generateReport(results);

  const elapsed = Date.now() - startTime;
  const hours = Math.floor(elapsed / 3600000);
  const minutes = Math.floor((elapsed % 3600000) / 60000);
  log(`\nTotal time: ${hours}h ${minutes}m`);

  process.exit(0);
};

main().catch((error) => {
  originalConsoleError('Fatal error:', error);
  log('Fatal error:', error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
