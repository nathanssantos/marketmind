import {
  FILTER_DEFAULTS,
  TRADING_DEFAULTS,
  TRAILING_STOP_CONFIG,
  TRAILING_STOP_USER_DEFAULTS,
  type FibLevel,
} from '@marketmind/types';
import { config as dotenvConfig } from 'dotenv';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const QUICK_MODE = process.argv.includes('--quick');

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
const { GranularPriceIndex } = await import('../../src/services/backtesting/trailing-stop-backtest/GranularPriceIndex.js');
const { TrailingStopSimulator } = await import('../../src/services/backtesting/trailing-stop-backtest/TrailingStopSimulator.js');
const { klineQueries } = await import('../../src/services/database/klineQueries.js');
const { mapDbKlinesToApi } = await import('../../src/utils/kline-mapper.js');
const { smartBackfillKlines } = await import('../../src/services/binance-historical.js');
const { BACKTEST_ENGINE, ABSOLUTE_MINIMUM_KLINES, DEFAULT_ENABLED_SETUPS } = await import('../../src/constants/index.js');

const ACTIVE_STRATEGIES = [...DEFAULT_ENABLED_SETUPS];

const getIntervalMs = (interval: string): number => {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * 3600000;
  const units: Record<string, number> = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(match[1]) * (units[match[2]] ?? 3600000);
};

const SYMBOLS_FULL = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAMES_FULL = ['1h'];

const SYMBOLS_QUICK = ['BTCUSDT'];
const TIMEFRAMES_QUICK = ['4h', '1d'];

const SYMBOLS = QUICK_MODE ? SYMBOLS_QUICK : SYMBOLS_FULL;
const TIMEFRAMES = QUICK_MODE ? TIMEFRAMES_QUICK : TIMEFRAMES_FULL;

const PRODUCTION_BASE = {
  startDate: '2023-02-13',
  endDate: '2026-02-13',
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  marginType: 'CROSSED' as const,
  setupTypes: ACTIVE_STRATEGIES,
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
  useFvgFilter: FILTER_DEFAULTS.useFvgFilter,
  useConfluenceScoring: FILTER_DEFAULTS.useConfluenceScoring,
  confluenceMinScore: FILTER_DEFAULTS.confluenceMinScore,
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  useCooldown: FILTER_DEFAULTS.useCooldown,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
  simulateFundingRates: true,
  simulateLiquidation: true,
  silent: true,
};


const PARAM_GRID_FULL = {
  fibonacciTargetLevelLong: ['1.272', '1.618', '2', '2.618', '3.618'] as FibLevel[],
  fibonacciTargetLevelShort: ['1', '1.272', '1.618', '2', '2.618'] as FibLevel[],
  maxFibonacciEntryProgressPercent: [61.8, 78.6, 100, 127.2],
  maxFibonacciEntryProgressPercentLong: [61.8, 78.6, 100, 127.2],
  maxFibonacciEntryProgressPercentShort: [61.8, 78.6, 100, 127.2],
  minRiskRewardRatioLong: [0.5, 0.75, 1.0, 1.5],
  minRiskRewardRatioShort: [0.5, 0.75, 1.0, 1.5],
};

const PARAM_GRID_QUICK = {
  fibonacciTargetLevelLong: ['1.272', '2', '3.618'] as FibLevel[],
  fibonacciTargetLevelShort: ['1', '1.618', '2.618'] as FibLevel[],
  maxFibonacciEntryProgressPercent: [78.6, 100, 127.2],
  maxFibonacciEntryProgressPercentLong: [78.6, 100, 127.2],
  maxFibonacciEntryProgressPercentShort: [78.6, 100, 127.2],
  minRiskRewardRatioLong: [0.5, 1.0, 1.5],
  minRiskRewardRatioShort: [0.5, 1.0, 1.5],
};

const PARAM_GRID = QUICK_MODE ? PARAM_GRID_QUICK : PARAM_GRID_FULL;

const FILTER_GRID: Record<string, boolean[]> = {
  useStochasticRecoveryFilter: [false, true],
  useStochasticFilter: [false, true],
  useMomentumTimingFilter: [false, true],
  useBtcCorrelationFilter: [false, true],
  useVolumeFilter: [false, true],
  useDirectionFilter: [false, true],
  useAdxFilter: [false, true],
  useTrendFilter: [false, true],
  useChoppinessFilter: [false, true],
  useSuperTrendFilter: [false, true],
  useMarketRegimeFilter: [false, true],
  useBollingerSqueezeFilter: [false, true],
  useVwapFilter: [false, true],
  useMtfFilter: [false, true],
  useStochasticHtfFilter: [false, true],
  useStochasticRecoveryHtfFilter: [false, true],
  useFundingFilter: [false, true],
  useFvgFilter: [false, true],
};

type SwingRange = 'nearest' | 'extended';
const SWING_RANGE_VALUES: SwingRange[] = ['nearest', 'extended'];

const TRAILING_STOP_GRID = {
  activationPercentLong: [50, 70, 90, 100, 127.2],
  activationPercentShort: [50, 70, 80, 100, 127.2],
  distancePercentLong: [20, 30, 40, 50, 60],
  distancePercentShort: [15, 20, 30, 40, 50],
  stopOffsetPercent: [0, 0.001, 0.002, 0.003, 0.005],
};

interface TopValues {
  fibonacciTargetLevelLong: FibLevel[];
  fibonacciTargetLevelShort: FibLevel[];
  maxFibonacciEntryProgressPercent: number[];
  minRiskRewardRatioLong: number[];
  minRiskRewardRatioShort: number[];
}

interface Stage1Analysis {
  topValues: TopValues;
  filterOverrides: Record<string, boolean>;
  swingRange: SwingRange;
}

interface DirectionMetrics {
  trades: number;
  winRate: number;
  pnlPercent: number;
  avgTradePercent: number;
}

interface BacktestResultRow {
  stage: string;
  configId: string;
  fibLong: string;
  fibShort: string;
  entryProgress: number;
  rrLong: number;
  rrShort: number;
  symbol: string;
  timeframe: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  long: DirectionMetrics;
  short: DirectionMetrics;
}

interface TrailingStopResultRow {
  configId: string;
  baseConfigId: string;
  activationLong: number;
  activationShort: number;
  distanceLong: number;
  distanceShort: number;
  stopOffset: number;
  symbol: string;
  timeframe: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  trailingStopExits: number;
  takeProfitExits: number;
  stopLossExits: number;
  long: DirectionMetrics;
  short: DirectionMetrics;
}

interface ProgressData {
  completed: string[];
  stage1Results: BacktestResultRow[];
  stage2Results: BacktestResultRow[];
  stage3Results: TrailingStopResultRow[];
  baselineResults: BacktestResultRow[];
  stage1Analysis?: Stage1Analysis;
}

const TOP_N = 2;

const OUTPUT_DIR = process.env.OUTPUT_DIR || `/tmp/prod-parity-optimization-run`;
const PROGRESS_FILE = `${OUTPUT_DIR}/progress.json`;
const MAX_RETRIES = 1;

const fmt = (num: number, decimals = 2): string => num.toFixed(decimals);
const pct = (num: number): string => `${num >= 0 ? '+' : ''}${fmt(num)}%`;

const formatEta = (ms: number): string => {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

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

const klineCache = new Map<string, any[]>();

const clearKlineCache = (): void => {
  const size = klineCache.size;
  klineCache.clear();
  if (global.gc) global.gc();
  log(`  [Memory] Cleared kline cache (${size} entries)`);
};

const klineCacheKey = (symbol: string, tf: string): string => `${symbol}:${tf}`;

const loadProgress = (): ProgressData => {
  if (existsSync(PROGRESS_FILE)) {
    return JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { completed: [], stage1Results: [], stage2Results: [], stage3Results: [], baselineResults: [] };
};

const saveProgress = (data: ProgressData): void => {
  writeFileSync(PROGRESS_FILE, JSON.stringify(data, null, 2));
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

const prefetchKlines = async (symbol: string, tf: string): Promise<any[]> => {
  const key = klineCacheKey(symbol, tf);
  if (klineCache.has(key)) return klineCache.get(key)!;

  log(`  [Prefetch] ${symbol}/${tf}...`);

  const intervalMs = getIntervalMs(tf);
  const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * intervalMs;
  const startTime = new Date(new Date(PRODUCTION_BASE.startDate).getTime() - warmupMs);
  const endTime = new Date(PRODUCTION_BASE.endDate);
  const marketType = PRODUCTION_BASE.marketType ?? 'FUTURES';

  let dbKlines = await klineQueries.findMany({
    symbol,
    interval: tf as any,
    marketType: marketType as any,
    startTime,
    endTime,
  });

  if (dbKlines.length < ABSOLUTE_MINIMUM_KLINES) {
    log(`    DB has ${dbKlines.length} klines, backfilling...`);
    const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / intervalMs);
    await smartBackfillKlines(symbol, tf as any, expectedKlines, marketType as any);

    dbKlines = await klineQueries.findMany({
      symbol,
      interval: tf as any,
      marketType: marketType as any,
      startTime,
      endTime,
    });
    log(`    After backfill: ${dbKlines.length} klines`);
  } else {
    log(`    Loaded ${dbKlines.length} klines from DB`);
  }

  const mapped = mapDbKlinesToApi(dbKlines);

  const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / intervalMs);
  const ratio = mapped.length / expectedKlines;
  if (ratio < 0.9) {
    log(`    [Warning] ${symbol}/${tf}: only ${mapped.length}/${expectedKlines} klines (${fmt(ratio * 100)}%) — results may be unreliable`);
  }

  klineCache.set(key, mapped);
  return mapped;
};

const runBacktest = async (
  config: Record<string, any>,
  symbol: string,
  tf: string
): Promise<{ trades: any[]; metrics: any; setupDetections: any[] } | null> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (shuttingDown) return null;
      const klines = await prefetchKlines(symbol, tf);
      const engine = new BacktestEngine();
      const result = await engine.run({ ...config, symbol, interval: tf }, klines);
      return {
        trades: result.trades || [],
        metrics: result.metrics,
        setupDetections: result.setupDetections || [],
      };
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        log(`  [Retry] ${symbol}/${tf} attempt ${attempt + 1}/${MAX_RETRIES + 1}:`, error instanceof Error ? error.message : error);
        continue;
      }
      log(`  [Error] ${symbol}/${tf}:`, error instanceof Error ? error.message : error);
      return null;
    }
  }
  return null;
};

const runBatchBacktest = async (
  configs: Array<{ name: string; overrides: Record<string, any> }>,
  symbol: string,
  tf: string
): Promise<Array<{ name: string; trades: any[]; metrics: any; setupDetections: any[] }>> => {
  if (shuttingDown || configs.length === 0) return [];

  try {
    const klines = await prefetchKlines(symbol, tf);
    if (klines.length === 0) return [];

    const engine = new BacktestEngine();
    const batchConfigs = configs.map(c => ({
      ...PRODUCTION_BASE,
      ...c.overrides,
      symbol,
      interval: tf,
    }));

    const batchResults = await engine.runBatch(batchConfigs as any, klines);

    return batchResults.map((br, i) => ({
      name: configs[i]!.name,
      trades: br.result.trades || [],
      metrics: br.result.metrics,
      setupDetections: br.result.setupDetections || [],
    }));
  } catch (error) {
    log(`  [BatchError] ${symbol}/${tf}:`, error instanceof Error ? error.message : error);
    return [];
  }
};

const buildResultRow = (
  stage: string,
  configId: string,
  config: Record<string, any>,
  symbol: string,
  tf: string,
  metrics: any,
  trades: any[]
): BacktestResultRow => {
  const dirs = splitByDirection(trades);
  return {
    stage,
    configId,
    fibLong: config.fibonacciTargetLevelLong ?? PRODUCTION_BASE.fibonacciTargetLevelLong,
    fibShort: config.fibonacciTargetLevelShort ?? PRODUCTION_BASE.fibonacciTargetLevelShort,
    entryProgress: config.maxFibonacciEntryProgressPercentLong ?? PRODUCTION_BASE.maxFibonacciEntryProgressPercentLong,
    rrLong: config.minRiskRewardRatioLong ?? PRODUCTION_BASE.minRiskRewardRatioLong,
    rrShort: config.minRiskRewardRatioShort ?? PRODUCTION_BASE.minRiskRewardRatioShort,
    symbol,
    timeframe: tf,
    totalTrades: metrics.totalTrades,
    winRate: metrics.winRate,
    totalPnlPercent: metrics.totalPnlPercent,
    profitFactor: metrics.profitFactor,
    maxDrawdownPercent: metrics.maxDrawdownPercent ?? 0,
    sharpeRatio: metrics.sharpeRatio ?? 0,
    long: dirs.long,
    short: dirs.short,
  };
};

const runValidation = async (): Promise<boolean> => {
  log('\n' + '='.repeat(80));
  log('VALIDATION - Running 3 quick backtests on BTCUSDT/4h');
  log('='.repeat(80));

  const validationConfigs = [
    { name: 'baseline (production)', overrides: {} },
    { name: 'fib-long=1.272', overrides: { fibonacciTargetLevelLong: '1.272' as FibLevel } },
    { name: 'rr-long=1.5', overrides: { minRiskRewardRatioLong: 1.5 } },
  ];

  for (const vc of validationConfigs) {
    log(`\n  Testing: ${vc.name}`);
    const result = await runBacktest({ ...PRODUCTION_BASE, ...vc.overrides }, 'BTCUSDT', '4h');

    if (!result) {
      log(`  FAILED: No result for ${vc.name}`);
      return false;
    }

    const dirs = splitByDirection(result.trades);

    log(`    Trades: ${result.metrics.totalTrades} (L:${dirs.long.trades} S:${dirs.short.trades})`);
    log(`    PnL: ${pct(result.metrics.totalPnlPercent)} (L:${pct(dirs.long.pnlPercent)} S:${pct(dirs.short.pnlPercent)})`);
    log(`    WR: ${fmt(result.metrics.winRate)}% | PF: ${fmt(result.metrics.profitFactor)} | Sharpe: ${fmt(result.metrics.sharpeRatio ?? 0)}`);

    if (result.metrics.totalTrades === 0) {
      log(`  ABORT: Zero trades for ${vc.name}`);
      return false;
    }
  }

  log('\n  Validation PASSED - all configs produced trades');
  return true;
};

const runStage1 = async (progress: ProgressData): Promise<BacktestResultRow[]> => {
  log('\n' + '='.repeat(80));
  log('STAGE 1 - Parameter Sensitivity Sweeps');
  log('='.repeat(80));

  const completedSet = new Set(progress.completed);
  const results: BacktestResultRow[] = [...progress.stage1Results];
  const baselineResults: BacktestResultRow[] = [...progress.baselineResults];

  type SweepConfig = { name: string; overrides: Record<string, any> };

  const sweepConfigs: SweepConfig[] = [];

  for (const val of PARAM_GRID.fibonacciTargetLevelLong) {
    sweepConfigs.push({ name: `fibL-${val}`, overrides: { fibonacciTargetLevelLong: val } });
  }
  for (const val of PARAM_GRID.fibonacciTargetLevelShort) {
    sweepConfigs.push({ name: `fibS-${val}`, overrides: { fibonacciTargetLevelShort: val } });
  }
  for (const val of PARAM_GRID.maxFibonacciEntryProgressPercent) {
    sweepConfigs.push({ name: `entry-${val}`, overrides: { maxFibonacciEntryProgressPercentLong: val, maxFibonacciEntryProgressPercentShort: val } });
  }
  for (const val of PARAM_GRID.minRiskRewardRatioLong) {
    sweepConfigs.push({ name: `rrL-${val}`, overrides: { minRiskRewardRatioLong: val } });
  }
  for (const val of PARAM_GRID.minRiskRewardRatioShort) {
    sweepConfigs.push({ name: `rrS-${val}`, overrides: { minRiskRewardRatioShort: val } });
  }

  for (const [filterName, values] of Object.entries(FILTER_GRID)) {
    for (const val of values) {
      sweepConfigs.push({
        name: `filter-${filterName}-${val}`,
        overrides: { [filterName]: val },
      });
    }
  }

  for (const val of SWING_RANGE_VALUES) {
    sweepConfigs.push({
      name: `swing-${val}`,
      overrides: { fibonacciSwingRange: val },
    });
  }

  const allConfigs = [{ name: 'baseline', overrides: {} }, ...sweepConfigs];
  const totalTasks = allConfigs.length * SYMBOLS.length * TIMEFRAMES.length;
  let completedCount = 0;
  const stageStart = Date.now();

  log(`  Configs: ${allConfigs.length} (1 baseline + ${sweepConfigs.length} sweeps)`);
  log(`  Symbol-TFs: ${SYMBOLS.length * TIMEFRAMES.length}`);
  log(`  Total backtests: ${totalTasks}`);

  for (const symbol of SYMBOLS) {
    const symbolStart = Date.now();
    let symbolTrades = 0;
    let symbolPnl = 0;

    for (const tf of TIMEFRAMES) {
      if (shuttingDown) break;
      await prefetchKlines(symbol, tf);

      for (const cfg of allConfigs) {
        if (shuttingDown) break;
        const taskKey = `s1:${cfg.name}:${symbol}:${tf}`;
        completedCount++;

        if (completedSet.has(taskKey)) continue;

        const fullConfig = { ...PRODUCTION_BASE, ...cfg.overrides };
        const result = await runBacktest(fullConfig, symbol, tf);

        if (result) {
          const row = buildResultRow('S1', cfg.name, fullConfig, symbol, tf, result.metrics, result.trades);

          if (cfg.name === 'baseline') {
            baselineResults.push(row);
          } else {
            results.push(row);
          }
          symbolTrades += result.metrics.totalTrades;
          symbolPnl += result.metrics.totalPnlPercent;

          completedSet.add(taskKey);
          progress.completed = [...completedSet];
          progress.stage1Results = results;
          progress.baselineResults = baselineResults;
          currentProgress = progress;

          if (completedCount % 10 === 0) {
            saveProgress(progress);
            const pctDone = (completedCount / totalTasks) * 100;
            const elapsed = Date.now() - stageStart;
            const rate = completedCount / elapsed;
            const eta = (totalTasks - completedCount) / rate;
            log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)}`);
          }
        }
      }
    }

    const symbolElapsed = Date.now() - symbolStart;
    log(`  [Symbol] ${symbol} done in ${formatEta(symbolElapsed)} | ${symbolTrades} trades | avg PnL ${pct(symbolPnl / (allConfigs.length * TIMEFRAMES.length))}`);
  }

  saveProgress(progress);
  log(`  Stage 1 complete: ${results.length} sweep results + ${baselineResults.length} baseline results`);
  return results;
};

const analyzeStage1 = (results: BacktestResultRow[], baselineResults: BacktestResultRow[]): Stage1Analysis => {
  log('\n' + '='.repeat(80));
  log('STAGE 1 ANALYSIS - Finding top parameter values');
  log('='.repeat(80));

  const baselineAvgPnl = baselineResults.length > 0
    ? baselineResults.reduce((sum, r) => sum + r.totalPnlPercent, 0) / baselineResults.length
    : 0;
  log(`  Baseline avg PnL: ${pct(baselineAvgPnl)}`);

  const analyzeParam = <T extends string | number>(
    prefix: string,
    values: T[],
    label: string
  ): T[] => {
    const scores: Array<{ value: T; avgPnl: number; avgSharpe: number; count: number }> = [];

    for (const val of values) {
      const matching = results.filter(r => r.configId === `${prefix}${val}`);
      if (matching.length === 0) continue;

      const avgPnl = matching.reduce((s, r) => s + r.totalPnlPercent, 0) / matching.length;
      const avgSharpe = matching.reduce((s, r) => s + r.sharpeRatio, 0) / matching.length;
      scores.push({ value: val, avgPnl, avgSharpe, count: matching.length });
    }

    scores.sort((a, b) => {
      const scoreA = a.avgPnl * 0.6 + a.avgSharpe * 10 * 0.4;
      const scoreB = b.avgPnl * 0.6 + b.avgSharpe * 10 * 0.4;
      return scoreB - scoreA;
    });

    log(`\n  ${label}:`);
    for (const s of scores) {
      const marker = scores.indexOf(s) < 3 ? ' <-- TOP' : '';
      log(`    ${String(s.value).padStart(8)}: PnL ${pct(s.avgPnl).padStart(10)} | Sharpe ${fmt(s.avgSharpe).padStart(6)} | n=${s.count}${marker}`);
    }

    return scores.slice(0, TOP_N).map(s => s.value);
  };

  const topFibLong = analyzeParam('fibL-', PARAM_GRID.fibonacciTargetLevelLong, 'Fibonacci Target Level LONG');
  const topFibShort = analyzeParam('fibS-', PARAM_GRID.fibonacciTargetLevelShort, 'Fibonacci Target Level SHORT');
  const topEntry = analyzeParam('entry-', PARAM_GRID.maxFibonacciEntryProgressPercent, 'Max Entry Progress %');
  const topRrLong = analyzeParam('rrL-', PARAM_GRID.minRiskRewardRatioLong, 'Min R:R LONG');
  const topRrShort = analyzeParam('rrS-', PARAM_GRID.minRiskRewardRatioShort, 'Min R:R SHORT');

  log('\n  FILTER SENSITIVITY:');
  log('  ' + '-'.repeat(70));

  const filterOverrides: Record<string, boolean> = {};

  for (const filterName of Object.keys(FILTER_GRID)) {
    const onResults = results.filter(r => r.configId === `filter-${filterName}-true`);
    const offResults = results.filter(r => r.configId === `filter-${filterName}-false`);

    if (onResults.length === 0 || offResults.length === 0) continue;

    const onAvgPnl = onResults.reduce((s, r) => s + r.totalPnlPercent, 0) / onResults.length;
    const offAvgPnl = offResults.reduce((s, r) => s + r.totalPnlPercent, 0) / offResults.length;
    const best = onAvgPnl > offAvgPnl;

    log(`    ${filterName.padEnd(30)}: ON=${pct(onAvgPnl).padStart(10)} OFF=${pct(offAvgPnl).padStart(10)} -> ${best ? 'ON' : 'OFF'}`);
    filterOverrides[filterName] = best;
  }

  log('\n  SWING RANGE:');
  log('  ' + '-'.repeat(70));

  let bestSwingRange: SwingRange = 'nearest';

  for (const val of SWING_RANGE_VALUES) {
    const matching = results.filter(r => r.configId === `swing-${val}`);
    if (matching.length === 0) continue;
    const avgPnl = matching.reduce((s, r) => s + r.totalPnlPercent, 0) / matching.length;
    log(`    ${val.padEnd(30)}: PnL ${pct(avgPnl).padStart(10)} | n=${matching.length}`);
  }

  const nearestResults = results.filter(r => r.configId === 'swing-nearest');
  const extendedResults = results.filter(r => r.configId === 'swing-extended');

  if (nearestResults.length > 0 && extendedResults.length > 0) {
    const nearestAvg = nearestResults.reduce((s, r) => s + r.totalPnlPercent, 0) / nearestResults.length;
    const extendedAvg = extendedResults.reduce((s, r) => s + r.totalPnlPercent, 0) / extendedResults.length;
    bestSwingRange = extendedAvg > nearestAvg ? 'extended' : 'nearest';
    log(`    -> Best: ${bestSwingRange}`);
  }

  return {
    topValues: {
      fibonacciTargetLevelLong: topFibLong as FibLevel[],
      fibonacciTargetLevelShort: topFibShort as FibLevel[],
      maxFibonacciEntryProgressPercent: topEntry as number[],
      minRiskRewardRatioLong: topRrLong as number[],
      minRiskRewardRatioShort: topRrShort as number[],
    },
    filterOverrides,
    swingRange: bestSwingRange,
  };
};

const runStage2 = async (analysis: Stage1Analysis, progress: ProgressData): Promise<BacktestResultRow[]> => {
  const { topValues, filterOverrides, swingRange: bestSwingRange } = analysis;
  log('\n' + '='.repeat(80));
  log('STAGE 2 - Top Combinations Cross-Product (batched)');
  log('='.repeat(80));

  const completedSet = new Set(progress.completed);
  const results: BacktestResultRow[] = [...progress.stage2Results];

  type ComboConfig = { name: string; overrides: Record<string, any> };

  const combosByEntry = new Map<number, ComboConfig[]>();

  for (const fibL of topValues.fibonacciTargetLevelLong) {
    for (const fibS of topValues.fibonacciTargetLevelShort) {
      const fibLNum = parseFloat(fibL);
      const fibSNum = parseFloat(fibS);
      if (fibSNum > fibLNum) continue;

      for (const entry of topValues.maxFibonacciEntryProgressPercent) {
        for (const rrL of topValues.minRiskRewardRatioLong) {
          for (const rrS of topValues.minRiskRewardRatioShort) {
            const name = `fL${fibL}-fS${fibS}-e${entry}-rL${rrL}-rS${rrS}`;
            const combo: ComboConfig = {
              name,
              overrides: {
                ...filterOverrides,
                fibonacciSwingRange: bestSwingRange,
                fibonacciTargetLevelLong: fibL,
                fibonacciTargetLevelShort: fibS,
                maxFibonacciEntryProgressPercentLong: entry,
                maxFibonacciEntryProgressPercentShort: entry,
                minRiskRewardRatioLong: rrL,
                minRiskRewardRatioShort: rrS,
              },
            };
            if (!combosByEntry.has(entry)) combosByEntry.set(entry, []);
            combosByEntry.get(entry)!.push(combo);
          }
        }
      }
    }
  }

  const allCombos = [...combosByEntry.values()].flat();
  const totalTasks = allCombos.length * SYMBOLS.length * TIMEFRAMES.length;
  let completedCount = 0;
  const stageStart = Date.now();

  log(`  Entry groups: ${combosByEntry.size} (${[...combosByEntry.keys()].join(', ')})`);
  log(`  Combinations: ${allCombos.length} (after filtering fibS > fibL)`);
  log(`  Total backtests: ${totalTasks}`);
  log(`  Optimization: batching by maxFibonacciEntryProgressPercent (shared setup detection)`);

  for (const symbol of SYMBOLS) {
    const symbolStart = Date.now();
    let symbolTrades = 0;

    for (const tf of TIMEFRAMES) {
      if (shuttingDown) break;

      for (const [entry, combos] of combosByEntry) {
        if (shuttingDown) break;

        const pendingCombos = combos.filter(c => {
          const taskKey = `s2:${c.name}:${symbol}:${tf}`;
          if (completedSet.has(taskKey)) {
            completedCount++;
            return false;
          }
          return true;
        });

        if (pendingCombos.length === 0) {
          completedCount += combos.length - pendingCombos.length;
          continue;
        }

        const batchResults = await runBatchBacktest(pendingCombos, symbol, tf);

        for (const br of batchResults) {
          const combo = pendingCombos.find(c => c.name === br.name);
          if (!combo) continue;

          const fullConfig = { ...PRODUCTION_BASE, ...combo.overrides };
          const row = buildResultRow('S2', combo.name, fullConfig, symbol, tf, br.metrics, br.trades);
          results.push(row);
          symbolTrades += br.metrics.totalTrades;

          const taskKey = `s2:${combo.name}:${symbol}:${tf}`;
          completedSet.add(taskKey);
        }

        completedCount += pendingCombos.length;
        progress.completed = [...completedSet];
        progress.stage2Results = results;
        currentProgress = progress;

        saveProgress(progress);
        const pctDone = (completedCount / totalTasks) * 100;
        const elapsed = Date.now() - stageStart;
        const rate = completedCount / elapsed;
        const eta = (totalTasks - completedCount) / rate;
        log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)} | batch=${pendingCombos.length} entry=${entry}`);
      }
    }

    const symbolElapsed = Date.now() - symbolStart;
    log(`  [Symbol] ${symbol} done in ${formatEta(symbolElapsed)} | ${symbolTrades} trades`);
  }

  saveProgress(progress);
  log(`  Stage 2 complete: ${results.length} results`);
  return results;
};

const getTopStage2Configs = (
  stage2Results: BacktestResultRow[],
  topN: number = 5
): Array<{ name: string; overrides: Record<string, any> }> => {
  const byConfig = new Map<string, BacktestResultRow[]>();
  for (const r of stage2Results) {
    if (!byConfig.has(r.configId)) byConfig.set(r.configId, []);
    byConfig.get(r.configId)!.push(r);
  }

  const ranked: Array<{ configId: string; avgPnl: number; avgSharpe: number; rows: BacktestResultRow[] }> = [];
  for (const [configId, rows] of byConfig) {
    const avgPnl = rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length;
    const avgSharpe = rows.reduce((s, r) => s + r.sharpeRatio, 0) / rows.length;
    ranked.push({ configId, avgPnl, avgSharpe, rows });
  }

  ranked.sort((a, b) => {
    const scoreA = a.avgPnl * 0.6 + a.avgSharpe * 10 * 0.4;
    const scoreB = b.avgPnl * 0.6 + b.avgSharpe * 10 * 0.4;
    return scoreB - scoreA;
  });

  return ranked.slice(0, topN).map(r => {
    const sample = r.rows[0]!;
    return {
      name: r.configId,
      overrides: {
        fibonacciTargetLevelLong: sample.fibLong,
        fibonacciTargetLevelShort: sample.fibShort,
        maxFibonacciEntryProgressPercentLong: sample.entryProgress,
        maxFibonacciEntryProgressPercentShort: sample.entryProgress,
        minRiskRewardRatioLong: sample.rrLong,
        minRiskRewardRatioShort: sample.rrShort,
      },
    };
  });
};

const getTopStage2ConfigsWithOverrides = (
  stage2Results: BacktestResultRow[],
  filterOverrides: Record<string, boolean>,
  swingRange: SwingRange,
  topN: number = 5
): Array<{ name: string; overrides: Record<string, any> }> =>
  getTopStage2Configs(stage2Results, topN).map(c => ({
    ...c,
    overrides: {
      ...filterOverrides,
      fibonacciSwingRange: swingRange,
      ...c.overrides,
    },
  }));

const runStage3 = async (
  stage2Results: BacktestResultRow[],
  analysis: Stage1Analysis,
  progress: ProgressData
): Promise<TrailingStopResultRow[]> => {
  const { filterOverrides, swingRange: bestSwingRange } = analysis;
  log('\n' + '='.repeat(80));
  log('STAGE 3 - Trailing Stop Optimization');
  log('='.repeat(80));

  const completedSet = new Set(progress.completed);
  const results: TrailingStopResultRow[] = [...progress.stage3Results];
  const topConfigs = getTopStage2ConfigsWithOverrides(stage2Results, filterOverrides, bestSwingRange, 5);

  log(`  Top configs from Stage 2: ${topConfigs.length}`);
  for (const cfg of topConfigs) log(`    - ${cfg.name}`);

  type TSCombo = {
    name: string;
    activationLong: number;
    activationShort: number;
    distanceLong: number;
    distanceShort: number;
    stopOffset: number;
  };

  const tsCombos: TSCombo[] = [];
  for (const actL of TRAILING_STOP_GRID.activationPercentLong) {
    for (const actS of TRAILING_STOP_GRID.activationPercentShort) {
      for (const dL of TRAILING_STOP_GRID.distancePercentLong) {
        for (const dS of TRAILING_STOP_GRID.distancePercentShort) {
          for (const offset of TRAILING_STOP_GRID.stopOffsetPercent) {
            tsCombos.push({
              name: `aL${actL}-aS${actS}-dL${dL}-dS${dS}-off${offset}`,
              activationLong: actL,
              activationShort: actS,
              distanceLong: dL,
              distanceShort: dS,
              stopOffset: offset,
            });
          }
        }
      }
    }
  }

  const totalTasks = topConfigs.length * tsCombos.length * SYMBOLS.length * TIMEFRAMES.length;
  let completedCount = 0;
  const stageStart = Date.now();

  const configsByEntry = new Map<number, typeof topConfigs>();
  for (const cfg of topConfigs) {
    const entry = cfg.overrides.maxFibonacciEntryProgressPercentLong ?? PRODUCTION_BASE.maxFibonacciEntryProgressPercentLong;
    if (!configsByEntry.has(entry)) configsByEntry.set(entry, []);
    configsByEntry.get(entry)!.push(cfg);
  }

  log(`  Trailing stop combos: ${tsCombos.length}`);
  log(`  Total simulations: ${totalTasks}`);
  log(`  Entry progress groups: ${configsByEntry.size} (batched from ${topConfigs.length} configs)`);

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      if (shuttingDown) break;
      const klines = await prefetchKlines(symbol, tf);
      if (klines.length === 0) {
        completedCount += topConfigs.length * tsCombos.length;
        continue;
      }

      const granularIndex = new GranularPriceIndex(klines);

      for (const [_entry, configGroup] of configsByEntry) {
        if (shuttingDown) break;

        const batchResults = await runBatchBacktest(configGroup, symbol, tf);

        const resultsByName = new Map<string, (typeof batchResults)[0]>();
        for (const br of batchResults) resultsByName.set(br.name, br);

        for (const baseCfg of configGroup) {
          const btResult = resultsByName.get(baseCfg.name);
          if (!btResult || btResult.trades.length === 0) {
            completedCount += tsCombos.length;
            continue;
          }

          const setupMap = new Map<string, any>();
          for (const setup of btResult.setupDetections) setupMap.set(setup.id, setup);

          const tradeSetups = btResult.trades.map((trade: any) => {
            const setup = setupMap.get(trade.setupId);
            return {
              id: trade.id,
              symbol: trade.symbol ?? symbol,
              side: trade.side,
              entryPrice: trade.entryPrice,
              entryTime: typeof trade.entryTime === 'string' ? new Date(trade.entryTime).getTime() : trade.entryTime,
              stopLoss: trade.stopLoss ?? trade.entryPrice * (trade.side === 'LONG' ? 0.98 : 1.02),
              takeProfit: trade.takeProfit ?? trade.entryPrice * (trade.side === 'LONG' ? 1.04 : 0.96),
              quantity: trade.quantity,
              atr: setup?.atr,
              fibonacciProjection: setup?.fibonacciProjection ?? null,
              maxExitTime: typeof trade.exitTime === 'string' ? new Date(trade.exitTime).getTime() : trade.exitTime,
            };
          });

          for (const tsCombo of tsCombos) {
            const taskKey = `s3:${baseCfg.name}:${tsCombo.name}:${symbol}:${tf}`;
            completedCount++;

            if (completedSet.has(taskKey)) continue;

            const simConfig = {
              trailingStopEnabled: true,
              long: {
                activationPercent: tsCombo.activationLong,
                distancePercent: tsCombo.distanceLong,
                atrMultiplier: TRAILING_STOP_CONFIG.ATR_MULTIPLIER,
                breakevenProfitThreshold: TRAILING_STOP_CONFIG.BREAKEVEN_THRESHOLD,
                stopOffsetPercent: tsCombo.stopOffset,
              },
              short: {
                activationPercent: tsCombo.activationShort,
                distancePercent: tsCombo.distanceShort,
                atrMultiplier: TRAILING_STOP_CONFIG.ATR_MULTIPLIER,
                breakevenProfitThreshold: TRAILING_STOP_CONFIG.BREAKEVEN_THRESHOLD,
                stopOffsetPercent: tsCombo.stopOffset,
              },
              useAdaptiveTrailing: TRAILING_STOP_USER_DEFAULTS.useAdaptiveTrailing,
              marketType: 'FUTURES' as const,
              useBnbDiscount: false,
              vipLevel: 0,
            };

            const simulator = new TrailingStopSimulator(simConfig, granularIndex);

            let tsExits = 0;
            let tpExits = 0;
            let slExits = 0;
            const simulatedTrades: Array<{ side: string; pnlPercent: number }> = [];

            for (const tradeSetup of tradeSetups) {
              const simResult = simulator.simulateTrade(tradeSetup);

              if (simResult.exitReason === 'TRAILING_STOP') tsExits++;
              else if (simResult.exitReason === 'TAKE_PROFIT') tpExits++;
              else if (simResult.exitReason === 'STOP_LOSS') slExits++;

              simulatedTrades.push({
                side: tradeSetup.side,
                pnlPercent: simResult.pnlPercent,
              });
            }

            const totalPnl = simulatedTrades.reduce((s, t) => s + t.pnlPercent, 0);
            const wins = simulatedTrades.filter(t => t.pnlPercent > 0).length;
            const totalCount = simulatedTrades.length;

            const longSim = simulatedTrades.filter(t => t.side === 'LONG');
            const shortSim = simulatedTrades.filter(t => t.side === 'SHORT');

            const longWins = longSim.filter(t => t.pnlPercent > 0).length;
            const shortWins = shortSim.filter(t => t.pnlPercent > 0).length;
            const longPnl = longSim.reduce((s, t) => s + t.pnlPercent, 0);
            const shortPnl = shortSim.reduce((s, t) => s + t.pnlPercent, 0);

            const row: TrailingStopResultRow = {
              configId: `${baseCfg.name}|${tsCombo.name}`,
              baseConfigId: baseCfg.name,
              activationLong: tsCombo.activationLong,
              activationShort: tsCombo.activationShort,
              distanceLong: tsCombo.distanceLong,
              distanceShort: tsCombo.distanceShort,
              stopOffset: tsCombo.stopOffset,
              symbol,
              timeframe: tf,
              totalTrades: totalCount,
              winRate: totalCount > 0 ? (wins / totalCount) * 100 : 0,
              totalPnlPercent: totalPnl,
              maxDrawdownPercent: 0,
              sharpeRatio: 0,
              trailingStopExits: tsExits,
              takeProfitExits: tpExits,
              stopLossExits: slExits,
              long: {
                trades: longSim.length,
                winRate: longSim.length > 0 ? (longWins / longSim.length) * 100 : 0,
                pnlPercent: longPnl,
                avgTradePercent: longSim.length > 0 ? longPnl / longSim.length : 0,
              },
              short: {
                trades: shortSim.length,
                winRate: shortSim.length > 0 ? (shortWins / shortSim.length) * 100 : 0,
                pnlPercent: shortPnl,
                avgTradePercent: shortSim.length > 0 ? shortPnl / shortSim.length : 0,
              },
            };

            results.push(row);
            completedSet.add(taskKey);
            progress.completed = [...completedSet];
            progress.stage3Results = results;
            currentProgress = progress;

            if (completedCount % 50 === 0) {
              saveProgress(progress);
              const pctDone = (completedCount / totalTasks) * 100;
              const elapsed = Date.now() - stageStart;
              const rate = completedCount / elapsed;
              const eta = (totalTasks - completedCount) / rate;
              log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)}`);
            }
          }
        }
      }
    }
  }

  saveProgress(progress);
  log(`  Stage 3 complete: ${results.length} results`);
  return results;
};

const generateReports = (
  baselineResults: BacktestResultRow[],
  stage1Results: BacktestResultRow[],
  stage2Results: BacktestResultRow[],
  stage3Results: TrailingStopResultRow[],
  analysis: Stage1Analysis
): void => {
  log('\n' + '='.repeat(80));
  log('GENERATING REPORTS');
  log('='.repeat(80));

  const baselineAvgPnl = baselineResults.length > 0
    ? baselineResults.reduce((s, r) => s + r.totalPnlPercent, 0) / baselineResults.length
    : 0;
  const baselineAvgSharpe = baselineResults.length > 0
    ? baselineResults.reduce((s, r) => s + r.sharpeRatio, 0) / baselineResults.length
    : 0;

  let summary = '';
  summary += '='.repeat(120) + '\n';
  summary += 'PRODUCTION-PARITY OPTIMIZATION RESULTS\n';
  summary += '='.repeat(120) + '\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${PRODUCTION_BASE.startDate} to ${PRODUCTION_BASE.endDate}\n`;
  summary += `Symbols: ${SYMBOLS.join(', ')}\n`;
  summary += `Timeframes: ${TIMEFRAMES.join(', ')}\n`;
  summary += `Strategies: ${ACTIVE_STRATEGIES.length} (portfolio mode)\n`;
  summary += `Market: ${PRODUCTION_BASE.marketType} | Leverage: ${PRODUCTION_BASE.leverage}\n`;
  summary += `Total backtests: S1=${baselineResults.length + stage1Results.length} S2=${stage2Results.length} S3=${stage3Results.length}\n`;
  summary += '='.repeat(120) + '\n\n';

  summary += 'PRODUCTION BASELINE\n';
  summary += '-'.repeat(80) + '\n';
  summary += `  Fib Long: ${PRODUCTION_BASE.fibonacciTargetLevelLong} | Fib Short: ${PRODUCTION_BASE.fibonacciTargetLevelShort}\n`;
  summary += `  Entry Progress: ${PRODUCTION_BASE.maxFibonacciEntryProgressPercent}% | R:R Long: ${PRODUCTION_BASE.minRiskRewardRatioLong} | R:R Short: ${PRODUCTION_BASE.minRiskRewardRatioShort}\n`;
  summary += `  Trailing LONG Activation: ${TRAILING_STOP_USER_DEFAULTS.trailingActivationPercentLong * 100}%\n`;
  summary += `  Trailing SHORT Activation: ${TRAILING_STOP_USER_DEFAULTS.trailingActivationPercentShort * 100}%\n`;
  summary += `  Avg PnL: ${pct(baselineAvgPnl)} | Avg Sharpe: ${fmt(baselineAvgSharpe)}\n\n`;

  const baselineBySymbol = new Map<string, BacktestResultRow[]>();
  for (const r of baselineResults) {
    if (!baselineBySymbol.has(r.symbol)) baselineBySymbol.set(r.symbol, []);
    baselineBySymbol.get(r.symbol)!.push(r);
  }
  for (const [symbol, rows] of baselineBySymbol) {
    const avg = rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length;
    const avgL = rows.reduce((s, r) => s + r.long.pnlPercent, 0) / rows.length;
    const avgS = rows.reduce((s, r) => s + r.short.pnlPercent, 0) / rows.length;
    summary += `  ${symbol}: PnL ${pct(avg)} (L:${pct(avgL)} S:${pct(avgS)})\n`;
  }

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'STAGE 1 - PARAMETER SENSITIVITY\n';
  summary += '='.repeat(120) + '\n\n';

  const paramGroups: Array<{ label: string; prefix: string; values: (string | number)[] }> = [
    { label: 'Fibonacci Target LONG', prefix: 'fibL-', values: PARAM_GRID.fibonacciTargetLevelLong },
    { label: 'Fibonacci Target SHORT', prefix: 'fibS-', values: PARAM_GRID.fibonacciTargetLevelShort },
    { label: 'Max Entry Progress %', prefix: 'entry-', values: PARAM_GRID.maxFibonacciEntryProgressPercent },
    { label: 'Min R:R LONG', prefix: 'rrL-', values: PARAM_GRID.minRiskRewardRatioLong },
    { label: 'Min R:R SHORT', prefix: 'rrS-', values: PARAM_GRID.minRiskRewardRatioShort },
  ];

  for (const pg of paramGroups) {
    summary += `${pg.label}\n`;
    summary += '-'.repeat(100) + '\n';
    summary += 'Value    | Avg PnL %   | Avg Sharpe | Avg WR %  | Avg L PnL % | Avg S PnL % | Trades | vs Baseline\n';
    summary += '-'.repeat(100) + '\n';

    const valueScores: Array<{ val: string | number; avgPnl: number }> = [];

    for (const val of pg.values) {
      const matching = stage1Results.filter(r => r.configId === `${pg.prefix}${val}`);
      if (matching.length === 0) continue;

      const avgPnl = matching.reduce((s, r) => s + r.totalPnlPercent, 0) / matching.length;
      const avgSharpe = matching.reduce((s, r) => s + r.sharpeRatio, 0) / matching.length;
      const avgWr = matching.reduce((s, r) => s + r.winRate, 0) / matching.length;
      const avgLPnl = matching.reduce((s, r) => s + r.long.pnlPercent, 0) / matching.length;
      const avgSPnl = matching.reduce((s, r) => s + r.short.pnlPercent, 0) / matching.length;
      const totalTrades = matching.reduce((s, r) => s + r.totalTrades, 0);
      const diff = avgPnl - baselineAvgPnl;

      valueScores.push({ val, avgPnl });

      summary += `${String(val).padStart(8)} | ${pct(avgPnl).padStart(11)} | ${fmt(avgSharpe).padStart(10)} | ${fmt(avgWr).padStart(8)}% | ${pct(avgLPnl).padStart(11)} | ${pct(avgSPnl).padStart(11)} | ${totalTrades.toString().padStart(6)} | ${pct(diff).padStart(10)}\n`;
    }
    summary += '\n';
  }

  summary += '='.repeat(120) + '\n';
  summary += 'FILTER SENSITIVITY (ON vs OFF)\n';
  summary += '='.repeat(120) + '\n\n';

  summary += 'Filter                         | ON PnL %    | OFF PnL %   | Best  | Applied\n';
  summary += '-'.repeat(100) + '\n';

  for (const filterName of Object.keys(FILTER_GRID)) {
    const onResults = stage1Results.filter(r => r.configId === `filter-${filterName}-true`);
    const offResults = stage1Results.filter(r => r.configId === `filter-${filterName}-false`);

    if (onResults.length === 0 || offResults.length === 0) continue;

    const onAvgPnl = onResults.reduce((s, r) => s + r.totalPnlPercent, 0) / onResults.length;
    const offAvgPnl = offResults.reduce((s, r) => s + r.totalPnlPercent, 0) / offResults.length;
    const best = analysis.filterOverrides[filterName] ? 'ON' : 'OFF';
    const applied = analysis.filterOverrides[filterName] ?? (PRODUCTION_BASE as Record<string, any>)[filterName] ?? false;

    summary += `${filterName.padEnd(30)} | ${pct(onAvgPnl).padStart(11)} | ${pct(offAvgPnl).padStart(11)} | ${best.padStart(5)} | ${applied ? 'ON' : 'OFF'}\n`;
  }

  summary += '\nSWING RANGE\n';
  summary += '-'.repeat(100) + '\n';

  for (const val of SWING_RANGE_VALUES) {
    const matching = stage1Results.filter(r => r.configId === `swing-${val}`);
    if (matching.length === 0) continue;
    const avgPnl = matching.reduce((s, r) => s + r.totalPnlPercent, 0) / matching.length;
    const marker = val === analysis.swingRange ? ' <-- SELECTED' : '';
    summary += `  ${val.padEnd(12)}: PnL ${pct(avgPnl).padStart(10)} | n=${matching.length}${marker}\n`;
  }

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'STAGE 2 - TOP COMBINATIONS\n';
  summary += '='.repeat(120) + '\n\n';

  const byConfig2 = new Map<string, BacktestResultRow[]>();
  for (const r of stage2Results) {
    if (!byConfig2.has(r.configId)) byConfig2.set(r.configId, []);
    byConfig2.get(r.configId)!.push(r);
  }

  const ranked2: Array<{
    configId: string;
    avgPnl: number;
    avgSharpe: number;
    avgWr: number;
    avgLPnl: number;
    avgSPnl: number;
    totalTrades: number;
    avgDD: number;
    sample: BacktestResultRow;
  }> = [];

  for (const [configId, rows] of byConfig2) {
    ranked2.push({
      configId,
      avgPnl: rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length,
      avgSharpe: rows.reduce((s, r) => s + r.sharpeRatio, 0) / rows.length,
      avgWr: rows.reduce((s, r) => s + r.winRate, 0) / rows.length,
      avgLPnl: rows.reduce((s, r) => s + r.long.pnlPercent, 0) / rows.length,
      avgSPnl: rows.reduce((s, r) => s + r.short.pnlPercent, 0) / rows.length,
      totalTrades: rows.reduce((s, r) => s + r.totalTrades, 0),
      avgDD: rows.reduce((s, r) => s + r.maxDrawdownPercent, 0) / rows.length,
      sample: rows[0]!,
    });
  }

  ranked2.sort((a, b) => {
    const scoreA = a.avgPnl * 0.6 + a.avgSharpe * 10 * 0.4;
    const scoreB = b.avgPnl * 0.6 + b.avgSharpe * 10 * 0.4;
    return scoreB - scoreA;
  });

  summary += 'TOP 20 COMBINATIONS\n';
  summary += '-'.repeat(160) + '\n';
  summary += 'Rank | Config                                          | Avg PnL %  | Sharpe | WR %   | L PnL %    | S PnL %    | Max DD % | Trades | vs BL\n';
  summary += '-'.repeat(160) + '\n';

  ranked2.slice(0, 20).forEach((r, i) => {
    const diff = r.avgPnl - baselineAvgPnl;
    summary += `${(i + 1).toString().padStart(4)} | ${r.configId.padEnd(47)} | ${pct(r.avgPnl).padStart(10)} | ${fmt(r.avgSharpe).padStart(6)} | ${fmt(r.avgWr).padStart(5)}% | ${pct(r.avgLPnl).padStart(10)} | ${pct(r.avgSPnl).padStart(10)} | ${fmt(r.avgDD).padStart(7)}% | ${r.totalTrades.toString().padStart(6)} | ${pct(diff).padStart(8)}\n`;
  });

  if (stage3Results.length > 0) {
    summary += '\n' + '='.repeat(120) + '\n';
    summary += 'STAGE 3 - TRAILING STOP OPTIMIZATION\n';
    summary += '='.repeat(120) + '\n\n';

    const byTsConfig = new Map<string, TrailingStopResultRow[]>();
    for (const r of stage3Results) {
      const key = `${r.activationLong}-${r.activationShort}-${r.distanceLong}-${r.distanceShort}-${r.stopOffset}`;
      if (!byTsConfig.has(key)) byTsConfig.set(key, []);
      byTsConfig.get(key)!.push(r);
    }

    const rankedTs: Array<{
      key: string;
      actL: number;
      actS: number;
      distL: number;
      distS: number;
      offset: number;
      avgPnl: number;
      avgWr: number;
      totalTrades: number;
      avgTsExits: number;
      avgTpExits: number;
      avgSlExits: number;
      avgLPnl: number;
      avgSPnl: number;
    }> = [];

    for (const [key, rows] of byTsConfig) {
      const sample = rows[0]!;
      rankedTs.push({
        key,
        actL: sample.activationLong,
        actS: sample.activationShort,
        distL: sample.distanceLong,
        distS: sample.distanceShort,
        offset: sample.stopOffset,
        avgPnl: rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length,
        avgWr: rows.reduce((s, r) => s + r.winRate, 0) / rows.length,
        totalTrades: rows.reduce((s, r) => s + r.totalTrades, 0),
        avgTsExits: rows.reduce((s, r) => s + r.trailingStopExits, 0) / rows.length,
        avgTpExits: rows.reduce((s, r) => s + r.takeProfitExits, 0) / rows.length,
        avgSlExits: rows.reduce((s, r) => s + r.stopLossExits, 0) / rows.length,
        avgLPnl: rows.reduce((s, r) => s + r.long.pnlPercent, 0) / rows.length,
        avgSPnl: rows.reduce((s, r) => s + r.short.pnlPercent, 0) / rows.length,
      });
    }

    rankedTs.sort((a, b) => b.avgPnl - a.avgPnl);

    summary += 'TRAILING STOP CONFIGS (aggregated across all base configs & symbol-TFs)\n';
    summary += '-'.repeat(180) + '\n';
    summary += 'Rank | Act L % | Act S % | Dist L | Dist S | Offset | Avg PnL %  | WR %   | L PnL %    | S PnL %    | TS Exits | TP Exits | SL Exits\n';
    summary += '-'.repeat(170) + '\n';

    rankedTs.slice(0, 30).forEach((r, i) => {
      summary += `${(i + 1).toString().padStart(4)} | ${fmt(r.actL).padStart(7)} | ${fmt(r.actS).padStart(7)} | ${fmt(r.distL).padStart(6)} | ${fmt(r.distS).padStart(6)} | ${fmt(r.offset, 3).padStart(6)} | ${pct(r.avgPnl).padStart(10)} | ${fmt(r.avgWr).padStart(5)}% | ${pct(r.avgLPnl).padStart(10)} | ${pct(r.avgSPnl).padStart(10)} | ${fmt(r.avgTsExits).padStart(8)} | ${fmt(r.avgTpExits).padStart(8)} | ${fmt(r.avgSlExits).padStart(8)}\n`;
    });

    summary += '\nPARAMETER SENSITIVITY BREAKDOWN\n';
    summary += '-'.repeat(80) + '\n';

    const sensAnalysis = <T extends string | number>(label: string, getter: (r: TrailingStopResultRow) => T): void => {
      const byVal = new Map<T, TrailingStopResultRow[]>();
      for (const r of stage3Results) {
        const val = getter(r);
        if (!byVal.has(val)) byVal.set(val, []);
        byVal.get(val)!.push(r);
      }
      const ranked = [...byVal.entries()]
        .map(([val, rows]) => ({
          val,
          avgPnl: rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length,
          avgWr: rows.reduce((s, r) => s + r.winRate, 0) / rows.length,
          n: rows.length,
        }))
        .sort((a, b) => b.avgPnl - a.avgPnl);

      summary += `\n  ${label}:\n`;
      for (const r of ranked) {
        const marker = ranked.indexOf(r) === 0 ? ' <-- BEST' : '';
        summary += `    ${String(r.val).padStart(8)}: PnL ${pct(r.avgPnl).padStart(10)} | WR ${fmt(r.avgWr).padStart(6)}% | n=${r.n}${marker}\n`;
      }
    };

    sensAnalysis('Activation % LONG', r => r.activationLong);
    sensAnalysis('Activation % SHORT', r => r.activationShort);
    sensAnalysis('Distance % LONG', r => r.distanceLong);
    sensAnalysis('Distance % SHORT', r => r.distanceShort);
    sensAnalysis('Stop Offset %', r => r.stopOffset);
  }

  summary += '\n' + '='.repeat(120) + '\n';
  summary += 'RECOMMENDATIONS\n';
  summary += '='.repeat(120) + '\n\n';

  const bestS2 = ranked2[0];
  if (bestS2) {
    const diff = bestS2.avgPnl - baselineAvgPnl;
    summary += `BEST OVERALL CONFIG (Stage 2):\n`;
    summary += `  ${bestS2.configId}\n`;
    summary += `  Fib Long: ${bestS2.sample.fibLong} | Fib Short: ${bestS2.sample.fibShort}\n`;
    summary += `  Entry Progress: ${bestS2.sample.entryProgress}% | R:R Long: ${bestS2.sample.rrLong} | R:R Short: ${bestS2.sample.rrShort}\n`;
    summary += `  Avg PnL: ${pct(bestS2.avgPnl)} | Sharpe: ${fmt(bestS2.avgSharpe)} | WR: ${fmt(bestS2.avgWr)}%\n`;
    summary += `  Improvement vs baseline: ${pct(diff)}\n\n`;

    const prodFibL = PRODUCTION_BASE.fibonacciTargetLevelLong;
    const prodFibS = PRODUCTION_BASE.fibonacciTargetLevelShort;
    const prodEntry = PRODUCTION_BASE.maxFibonacciEntryProgressPercentLong;
    const prodRrL = PRODUCTION_BASE.minRiskRewardRatioLong;
    const prodRrS = PRODUCTION_BASE.minRiskRewardRatioShort;

    summary += 'PARAMETER CHANGES RECOMMENDED:\n';
    summary += '-'.repeat(80) + '\n';

    if (bestS2.sample.fibLong !== prodFibL) {
      summary += `  fibonacciTargetLevelLong: ${prodFibL} -> ${bestS2.sample.fibLong}\n`;
    }
    if (bestS2.sample.fibShort !== prodFibS) {
      summary += `  fibonacciTargetLevelShort: ${prodFibS} -> ${bestS2.sample.fibShort}\n`;
    }
    if (bestS2.sample.entryProgress !== prodEntry) {
      summary += `  maxFibonacciEntryProgressPercent: ${prodEntry} -> ${bestS2.sample.entryProgress}\n`;
    }
    if (bestS2.sample.rrLong !== prodRrL) {
      summary += `  minRiskRewardRatioLong: ${prodRrL} -> ${bestS2.sample.rrLong}\n`;
    }
    if (bestS2.sample.rrShort !== prodRrS) {
      summary += `  minRiskRewardRatioShort: ${prodRrS} -> ${bestS2.sample.rrShort}\n`;
    }

    if (
      bestS2.sample.fibLong === prodFibL &&
      bestS2.sample.fibShort === prodFibS &&
      bestS2.sample.entryProgress === prodEntry &&
      bestS2.sample.rrLong === prodRrL &&
      bestS2.sample.rrShort === prodRrS
    ) {
      summary += '  No changes needed - production defaults are optimal!\n';
    }

    summary += '\nFILTER CHANGES RECOMMENDED:\n';
    summary += '-'.repeat(80) + '\n';

    let filterChanges = 0;
    for (const [filterName, bestValue] of Object.entries(analysis.filterOverrides)) {
      const prodValue = (PRODUCTION_BASE as Record<string, any>)[filterName] ?? false;
      if (bestValue !== prodValue) {
        summary += `  ${filterName}: ${prodValue ? 'ON' : 'OFF'} -> ${bestValue ? 'ON' : 'OFF'}\n`;
        filterChanges++;
      }
    }
    if (filterChanges === 0) summary += '  No filter changes needed - production defaults are optimal!\n';

    if (analysis.swingRange !== PRODUCTION_BASE.fibonacciSwingRange) {
      summary += `\n  fibonacciSwingRange: ${PRODUCTION_BASE.fibonacciSwingRange} -> ${analysis.swingRange}\n`;
    }
  }

  if (stage3Results.length > 0) {
    const byTsFull = new Map<string, TrailingStopResultRow[]>();
    for (const r of stage3Results) {
      const key = r.configId;
      if (!byTsFull.has(key)) byTsFull.set(key, []);
      byTsFull.get(key)!.push(r);
    }

    const bestTsOverall = [...byTsFull.entries()]
      .map(([key, rows]) => ({
        key,
        sample: rows[0]!,
        avgPnl: rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length,
      }))
      .sort((a, b) => b.avgPnl - a.avgPnl)[0];

    if (bestTsOverall) {
      const prodActL = TRAILING_STOP_USER_DEFAULTS.trailingActivationPercentLong * 100;
      const prodActS = TRAILING_STOP_USER_DEFAULTS.trailingActivationPercentShort * 100;
      const prodDistL = TRAILING_STOP_USER_DEFAULTS.trailingDistancePercentLong * 100;
      const prodDistS = TRAILING_STOP_USER_DEFAULTS.trailingDistancePercentShort * 100;
      const prodOffset = TRAILING_STOP_USER_DEFAULTS.trailingStopOffsetPercent;

      summary += '\nTRAILING STOP CHANGES RECOMMENDED:\n';
      summary += '-'.repeat(80) + '\n';

      if (bestTsOverall.sample.activationLong !== prodActL) {
        summary += `  trailingActivationPercentLong: ${prodActL}% -> ${bestTsOverall.sample.activationLong}%\n`;
      }
      if (bestTsOverall.sample.activationShort !== prodActS) {
        summary += `  trailingActivationPercentShort: ${prodActS}% -> ${bestTsOverall.sample.activationShort}%\n`;
      }
      if (bestTsOverall.sample.distanceLong !== prodDistL) {
        summary += `  trailingDistancePercentLong: ${prodDistL}% -> ${bestTsOverall.sample.distanceLong}%\n`;
      }
      if (bestTsOverall.sample.distanceShort !== prodDistS) {
        summary += `  trailingDistancePercentShort: ${prodDistS}% -> ${bestTsOverall.sample.distanceShort}%\n`;
      }
      if (bestTsOverall.sample.stopOffset !== prodOffset) {
        summary += `  trailingStopOffsetPercent: ${prodOffset} -> ${bestTsOverall.sample.stopOffset}\n`;
      }

      if (
        bestTsOverall.sample.activationLong === prodActL &&
        bestTsOverall.sample.activationShort === prodActS &&
        bestTsOverall.sample.distanceLong === prodDistL &&
        bestTsOverall.sample.distanceShort === prodDistS &&
        bestTsOverall.sample.stopOffset === prodOffset
      ) {
        summary += '  No changes needed - production trailing stop defaults are optimal!\n';
      }
    }
  }

  writeFileSync(`${OUTPUT_DIR}/summary.txt`, summary);
  log(`  Wrote summary.txt`);

  let csv = 'Stage,ConfigId,FibLong,FibShort,EntryProg,RRLong,RRShort,Symbol,TF,Trades,WR,PnL%,PF,MaxDD%,Sharpe,LongT,LongWR,LongPnL%,ShortT,ShortWR,ShortPnL%\n';

  for (const r of [...baselineResults, ...stage1Results, ...stage2Results]) {
    csv += `${r.stage},${r.configId},${r.fibLong},${r.fibShort},${r.entryProgress},${r.rrLong},${r.rrShort},${r.symbol},${r.timeframe},${r.totalTrades},${fmt(r.winRate)},${fmt(r.totalPnlPercent)},${fmt(r.profitFactor)},${fmt(r.maxDrawdownPercent)},${fmt(r.sharpeRatio)},${r.long.trades},${fmt(r.long.winRate)},${fmt(r.long.pnlPercent)},${r.short.trades},${fmt(r.short.winRate)},${fmt(r.short.pnlPercent)}\n`;
  }

  writeFileSync(`${OUTPUT_DIR}/full-results.csv`, csv);
  log(`  Wrote full-results.csv`);

  if (stage3Results.length > 0) {
    let tsCsv = 'ConfigId,BaseConfig,ActL,ActS,DistL,DistS,StopOffset,Symbol,TF,Trades,WR,PnL%,MaxDD%,Sharpe,TSExits,TPExits,SLExits,LongT,LongWR,LongPnL%,ShortT,ShortWR,ShortPnL%\n';

    for (const r of stage3Results) {
      tsCsv += `${r.configId},${r.baseConfigId},${r.activationLong},${r.activationShort},${r.distanceLong},${r.distanceShort},${r.stopOffset},${r.symbol},${r.timeframe},${r.totalTrades},${fmt(r.winRate)},${fmt(r.totalPnlPercent)},${fmt(r.maxDrawdownPercent)},${fmt(r.sharpeRatio)},${r.trailingStopExits},${r.takeProfitExits},${r.stopLossExits},${r.long.trades},${fmt(r.long.winRate)},${fmt(r.long.pnlPercent)},${r.short.trades},${fmt(r.short.winRate)},${fmt(r.short.pnlPercent)}\n`;
    }

    writeFileSync(`${OUTPUT_DIR}/trailing-stop-results.csv`, tsCsv);
    log(`  Wrote trailing-stop-results.csv`);
  }

  if (bestS2) {
    const optimalConfig = {
      fibonacciTargetLevelLong: bestS2.sample.fibLong,
      fibonacciTargetLevelShort: bestS2.sample.fibShort,
      maxFibonacciEntryProgressPercentLong: bestS2.sample.entryProgress,
      maxFibonacciEntryProgressPercentShort: bestS2.sample.entryProgress,
      minRiskRewardRatioLong: bestS2.sample.rrLong,
      minRiskRewardRatioShort: bestS2.sample.rrShort,
      fibonacciSwingRange: analysis.swingRange,
      filters: analysis.filterOverrides,
      metrics: {
        avgPnlPercent: bestS2.avgPnl,
        avgSharpe: bestS2.avgSharpe,
        avgWinRate: bestS2.avgWr,
        avgMaxDrawdown: bestS2.avgDD,
      },
    };
    writeFileSync(`${OUTPUT_DIR}/optimal-config.json`, JSON.stringify(optimalConfig, null, 2));
    log(`  Wrote optimal-config.json`);
  }

  log(`\n  All reports saved to: ${OUTPUT_DIR}`);
};

const main = async (): Promise<void> => {
  const startTime = Date.now();

  log('='.repeat(80));
  log(`PRODUCTION-PARITY FULL CONFIG OPTIMIZATION${QUICK_MODE ? ' (QUICK MODE)' : ''}`);
  log('='.repeat(80));
  log(`Mode: ${QUICK_MODE ? 'QUICK (validation only)' : 'FULL'}`);
  log(`Symbols: ${SYMBOLS.join(', ')}`);
  log(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  log(`Strategies: ${ACTIVE_STRATEGIES.length} (portfolio mode)`);
  log(`Output: ${OUTPUT_DIR}`);
  log(`Production defaults: FibL=${PRODUCTION_BASE.fibonacciTargetLevelLong} FibS=${PRODUCTION_BASE.fibonacciTargetLevelShort} Entry=${PRODUCTION_BASE.maxFibonacciEntryProgressPercent}% RRL=${PRODUCTION_BASE.minRiskRewardRatioLong} RRS=${PRODUCTION_BASE.minRiskRewardRatioShort}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const isValid = await runValidation();
  if (!isValid) {
    log('\nABORTED: Validation failed');
    process.exit(1);
  }

  const progress = loadProgress();
  currentProgress = progress;

  const stage1Results = await runStage1(progress);
  if (shuttingDown) return;
  const analysis = analyzeStage1(stage1Results, progress.baselineResults);

  const stage2Results = await runStage2(analysis, progress);
  if (shuttingDown) return;

  let stage3Results: TrailingStopResultRow[] = [];
  if (QUICK_MODE) {
    log('\n[QUICK MODE] Skipping Stage 3 (trailing stop optimization)');
  } else {
    stage3Results = await runStage3(stage2Results, analysis, progress);
    if (shuttingDown) return;
  }

  generateReports(progress.baselineResults, stage1Results, stage2Results, stage3Results, analysis);

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
