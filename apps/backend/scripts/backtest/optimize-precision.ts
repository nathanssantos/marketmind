import { FILTER_DEFAULTS, TRADING_DEFAULTS, type FibLevel } from '@marketmind/types';
import { config as dotenvConfig } from 'dotenv';
import { mkdirSync, readdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import {
  type BacktestResultRow,
  type DirectionMetrics,
  type ScoringFunction,
  buildResultRow,
  createKlineCache,
  createProgressManager,
  createShutdownHandler,
  fmt,
  formatEta,
  log,
  pct,
  precisionScore,
  silenceConsole,
  splitByDirection,
} from './backtest-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const QUICK_MODE = process.argv.includes('--quick');

const originalConsoleError = silenceConsole();

const { BacktestEngine } = await import('../../src/services/backtesting/BacktestEngine.js');
const { klineQueries } = await import('../../src/services/database/klineQueries.js');
const { mapDbKlinesToApi } = await import('../../src/utils/kline-mapper.js');
const { smartBackfillKlines } = await import('../../src/services/binance-historical.js');
const { BACKTEST_ENGINE, ABSOLUTE_MINIMUM_KLINES } = await import('../../src/constants/index.js');

const STRATEGIES_DIR = resolve(__dirname, '../../strategies/builtin');

const SYMBOLS_FULL = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'];
const TIMEFRAMES_FULL = ['30m', '1h', '2h', '4h'];

const SYMBOLS_QUICK = ['BTCUSDT'];
const TIMEFRAMES_QUICK = ['1h', '4h'];

const SYMBOLS = QUICK_MODE ? SYMBOLS_QUICK : SYMBOLS_FULL;
const TIMEFRAMES = QUICK_MODE ? TIMEFRAMES_QUICK : TIMEFRAMES_FULL;

const MIN_TRADES_PER_SYMBOL = 10;
const MIN_WIN_RATE_PRESCREEN = 55;
const TOP_STRATEGIES_COUNT = QUICK_MODE ? 10 : 20;
const TOP_N = 2;

const PRODUCTION_BASE = {
  startDate: '2023-02-13',
  endDate: '2026-02-13',
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

interface Stage1Analysis {
  topStrategies: string[];
  topValues: {
    fibonacciTargetLevelLong: FibLevel[];
    fibonacciTargetLevelShort: FibLevel[];
    maxFibonacciEntryProgressPercent: number[];
    minRiskRewardRatioLong: number[];
    minRiskRewardRatioShort: number[];
  };
  filterOverrides: Record<string, boolean>;
  swingRange: SwingRange;
}

interface ProgressData {
  completed: string[];
  prescreenResults: Array<{ strategyId: string; symbol: string; timeframe: string; winRate: number; profitFactor: number; totalTrades: number; sharpeRatio: number; totalPnlPercent: number }>;
  stage1Results: BacktestResultRow[];
  stage2Results: BacktestResultRow[];
  baselineResults: BacktestResultRow[];
  stage1Analysis?: Stage1Analysis;
}

const OUTPUT_DIR = process.env.OUTPUT_DIR || `/tmp/precision-optimization-run`;
const PROGRESS_FILE = `${OUTPUT_DIR}/progress.json`;
const MAX_RETRIES = 1;

const klineCache = createKlineCache(
  klineQueries as any,
  mapDbKlinesToApi as any,
  smartBackfillKlines as any,
  {
    startDate: PRODUCTION_BASE.startDate,
    endDate: PRODUCTION_BASE.endDate,
    marketType: PRODUCTION_BASE.marketType,
    ema200WarmupBars: BACKTEST_ENGINE.EMA200_WARMUP_BARS,
    absoluteMinKlines: ABSOLUTE_MINIMUM_KLINES,
  }
);

const progress = createProgressManager<ProgressData>(PROGRESS_FILE, () => ({
  completed: [],
  prescreenResults: [],
  stage1Results: [],
  stage2Results: [],
  baselineResults: [],
}));

const shutdown = createShutdownHandler(() => progress.save());

const loadAllStrategyIds = (): string[] => {
  const files = readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(f => f.replace('.json', ''));
};

const runBacktest = async (
  config: Record<string, unknown>,
  symbol: string,
  tf: string
): Promise<{ trades: any[]; metrics: any; setupDetections: any[] } | null> => {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (shutdown.isShuttingDown()) return null;
      const klines = await klineCache.prefetch(symbol, tf);
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
  configs: Array<{ name: string; overrides: Record<string, unknown> }>,
  symbol: string,
  tf: string
): Promise<Array<{ name: string; trades: any[]; metrics: any; setupDetections: any[] }>> => {
  if (shutdown.isShuttingDown() || configs.length === 0) return [];

  try {
    const klines = await klineCache.prefetch(symbol, tf);
    if ((klines as unknown[]).length === 0) return [];

    const engine = new BacktestEngine();
    const batchConfigs = configs.map(c => ({
      ...PRODUCTION_BASE,
      ...c.overrides,
      symbol,
      interval: tf,
    }));

    const batchResults = await engine.runBatch(batchConfigs as any, klines);

    return batchResults.map((br: any, i: number) => ({
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

const runPrescreen = async (): Promise<string[]> => {
  log('\n' + '='.repeat(80));
  log('PRE-SCREEN - Running all strategies to find high win-rate candidates');
  log('='.repeat(80));

  const allStrategies = loadAllStrategyIds();
  const totalTasks = allStrategies.length * SYMBOLS.length * TIMEFRAMES.length;
  let completedCount = 0;
  const stageStart = Date.now();

  log(`  Strategies: ${allStrategies.length}`);
  log(`  Symbols: ${SYMBOLS.join(', ')}`);
  log(`  Timeframes: ${TIMEFRAMES.join(', ')}`);
  log(`  Total backtests: ${totalTasks}`);
  log(`  Min win rate: ${MIN_WIN_RATE_PRESCREEN}%`);
  log(`  Min trades per symbol: ${MIN_TRADES_PER_SYMBOL}`);

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      if (shutdown.isShuttingDown()) break;
      await klineCache.prefetch(symbol, tf);

      for (const strategyId of allStrategies) {
        if (shutdown.isShuttingDown()) break;
        const taskKey = `prescreen:${strategyId}:${symbol}:${tf}`;
        completedCount++;

        if (progress.completed.has(taskKey)) continue;

        const result = await runBacktest(
          { ...PRODUCTION_BASE, setupTypes: [strategyId] },
          symbol,
          tf
        );

        if (result && result.metrics.totalTrades > 0) {
          progress.data.prescreenResults.push({
            strategyId,
            symbol,
            timeframe: tf,
            winRate: result.metrics.winRate,
            profitFactor: result.metrics.profitFactor,
            totalTrades: result.metrics.totalTrades,
            sharpeRatio: result.metrics.sharpeRatio ?? 0,
            totalPnlPercent: result.metrics.totalPnlPercent,
          });
        }

        progress.completed.add(taskKey);

        if (completedCount % 20 === 0) {
          progress.save();
          const pctDone = (completedCount / totalTasks) * 100;
          const elapsed = Date.now() - stageStart;
          const rate = completedCount / elapsed;
          const eta = (totalTasks - completedCount) / rate;
          log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)}`);
        }
      }
    }
  }

  progress.save();

  const byStrategy = new Map<string, typeof progress.data.prescreenResults>();
  for (const r of progress.data.prescreenResults) {
    if (!byStrategy.has(r.strategyId)) byStrategy.set(r.strategyId, []);
    byStrategy.get(r.strategyId)!.push(r);
  }

  const ranked: Array<{ strategyId: string; avgWinRate: number; avgProfitFactor: number; avgSharpe: number; totalTrades: number; score: number }> = [];

  for (const [strategyId, rows] of byStrategy) {
    const allHaveMinTrades = SYMBOLS.every(sym =>
      rows.filter(r => r.symbol === sym).every(r => r.totalTrades >= MIN_TRADES_PER_SYMBOL)
    );
    if (!allHaveMinTrades) continue;

    const avgWinRate = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    const avgProfitFactor = rows.reduce((s, r) => s + r.profitFactor, 0) / rows.length;
    const avgSharpe = rows.reduce((s, r) => s + r.sharpeRatio, 0) / rows.length;
    const totalTrades = rows.reduce((s, r) => s + r.totalTrades, 0);
    const avgPnl = rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length;

    if (avgWinRate < MIN_WIN_RATE_PRESCREEN) continue;

    const score = precisionScore({ avgWinRate, avgProfitFactor, avgSharpe, avgPnl });
    ranked.push({ strategyId, avgWinRate, avgProfitFactor, avgSharpe, totalTrades, score });
  }

  ranked.sort((a, b) => b.score - a.score);

  log(`\n  Pre-screen results:`);
  log(`  Strategies with >= ${MIN_WIN_RATE_PRESCREEN}% avg win rate: ${ranked.length}`);
  log(`  Selecting top ${TOP_STRATEGIES_COUNT}\n`);

  for (let i = 0; i < Math.min(ranked.length, TOP_STRATEGIES_COUNT + 5); i++) {
    const r = ranked[i]!;
    const marker = i < TOP_STRATEGIES_COUNT ? ' <-- SELECTED' : '';
    log(`  ${(i + 1).toString().padStart(3)}. ${r.strategyId.padEnd(35)} WR: ${fmt(r.avgWinRate)}% | PF: ${fmt(r.avgProfitFactor)} | Sharpe: ${fmt(r.avgSharpe)} | Score: ${fmt(r.score)}${marker}`);
  }

  return ranked.slice(0, TOP_STRATEGIES_COUNT).map(r => r.strategyId);
};

const runStage1 = async (topStrategies: string[]): Promise<BacktestResultRow[]> => {
  log('\n' + '='.repeat(80));
  log('STAGE 1 - Parameter Sensitivity Sweeps (Precision-Optimized)');
  log('='.repeat(80));

  const results: BacktestResultRow[] = [...progress.data.stage1Results];
  const baselineResults: BacktestResultRow[] = [...progress.data.baselineResults];

  type SweepConfig = { name: string; overrides: Record<string, unknown> };
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

  const baseConfig = { ...PRODUCTION_BASE, setupTypes: topStrategies };
  const allConfigs = [{ name: 'baseline', overrides: {} }, ...sweepConfigs];
  const totalTasks = allConfigs.length * SYMBOLS.length * TIMEFRAMES.length;
  let completedCount = 0;
  const stageStart = Date.now();

  log(`  Top strategies: ${topStrategies.length}`);
  log(`  Configs: ${allConfigs.length} (1 baseline + ${sweepConfigs.length} sweeps)`);
  log(`  Total backtests: ${totalTasks}`);

  for (const symbol of SYMBOLS) {
    for (const tf of TIMEFRAMES) {
      if (shutdown.isShuttingDown()) break;
      await klineCache.prefetch(symbol, tf);

      for (const cfg of allConfigs) {
        if (shutdown.isShuttingDown()) break;
        const taskKey = `s1:${cfg.name}:${symbol}:${tf}`;
        completedCount++;

        if (progress.completed.has(taskKey)) continue;

        const fullConfig = { ...baseConfig, ...cfg.overrides };
        const result = await runBacktest(fullConfig, symbol, tf);

        if (result) {
          const row = buildResultRow('S1', cfg.name, fullConfig, symbol, tf, result.metrics, result.trades, baseConfig);

          if (cfg.name === 'baseline') {
            baselineResults.push(row);
          } else {
            results.push(row);
          }

          progress.completed.add(taskKey);
          progress.data.stage1Results = results;
          progress.data.baselineResults = baselineResults;

          if (completedCount % 10 === 0) {
            progress.save();
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

  progress.save();
  log(`  Stage 1 complete: ${results.length} sweep results + ${baselineResults.length} baseline results`);
  return results;
};

const analyzeStage1 = (
  results: BacktestResultRow[],
  baselineResults: BacktestResultRow[],
  topStrategies: string[],
  scoreFn: ScoringFunction
): Stage1Analysis => {
  log('\n' + '='.repeat(80));
  log('STAGE 1 ANALYSIS - Finding top parameter values (PRECISION scoring)');
  log('='.repeat(80));

  const baselineAvgWr = baselineResults.length > 0
    ? baselineResults.reduce((sum, r) => sum + r.winRate, 0) / baselineResults.length
    : 0;
  const baselineAvgPf = baselineResults.length > 0
    ? baselineResults.reduce((sum, r) => sum + r.profitFactor, 0) / baselineResults.length
    : 0;
  log(`  Baseline avg WR: ${fmt(baselineAvgWr)}% | avg PF: ${fmt(baselineAvgPf)}`);

  const analyzeParam = <T extends string | number>(
    prefix: string,
    values: T[],
    label: string
  ): T[] => {
    const scores: Array<{ value: T; avgWinRate: number; avgProfitFactor: number; avgSharpe: number; avgPnl: number; count: number }> = [];

    for (const val of values) {
      const matching = results.filter(r => r.configId === `${prefix}${val}`);
      if (matching.length === 0) continue;

      const avgWinRate = matching.reduce((s, r) => s + r.winRate, 0) / matching.length;
      const avgProfitFactor = matching.reduce((s, r) => s + r.profitFactor, 0) / matching.length;
      const avgSharpe = matching.reduce((s, r) => s + r.sharpeRatio, 0) / matching.length;
      const avgPnl = matching.reduce((s, r) => s + r.totalPnlPercent, 0) / matching.length;
      scores.push({ value: val, avgWinRate, avgProfitFactor, avgSharpe, avgPnl, count: matching.length });
    }

    scores.sort((a, b) => {
      const scoreA = scoreFn(a);
      const scoreB = scoreFn(b);
      return scoreB - scoreA;
    });

    log(`\n  ${label}:`);
    for (const s of scores) {
      const marker = scores.indexOf(s) < TOP_N ? ' <-- TOP' : '';
      log(`    ${String(s.value).padStart(8)}: WR ${fmt(s.avgWinRate).padStart(6)}% | PF ${fmt(s.avgProfitFactor).padStart(6)} | Sharpe ${fmt(s.avgSharpe).padStart(6)} | n=${s.count}${marker}`);
    }

    return scores.slice(0, TOP_N).map(s => s.value);
  };

  const topFibLong = analyzeParam('fibL-', PARAM_GRID.fibonacciTargetLevelLong, 'Fibonacci Target Level LONG');
  const topFibShort = analyzeParam('fibS-', PARAM_GRID.fibonacciTargetLevelShort, 'Fibonacci Target Level SHORT');
  const topEntry = analyzeParam('entry-', PARAM_GRID.maxFibonacciEntryProgressPercent, 'Max Entry Progress %');
  const topRrLong = analyzeParam('rrL-', PARAM_GRID.minRiskRewardRatioLong, 'Min R:R LONG');
  const topRrShort = analyzeParam('rrS-', PARAM_GRID.minRiskRewardRatioShort, 'Min R:R SHORT');

  log('\n  FILTER SENSITIVITY (precision scoring):');
  log('  ' + '-'.repeat(70));

  const filterOverrides: Record<string, boolean> = {};

  for (const filterName of Object.keys(FILTER_GRID)) {
    const onResults = results.filter(r => r.configId === `filter-${filterName}-true`);
    const offResults = results.filter(r => r.configId === `filter-${filterName}-false`);

    if (onResults.length === 0 || offResults.length === 0) continue;

    const onAvgWr = onResults.reduce((s, r) => s + r.winRate, 0) / onResults.length;
    const onAvgPf = onResults.reduce((s, r) => s + r.profitFactor, 0) / onResults.length;
    const offAvgWr = offResults.reduce((s, r) => s + r.winRate, 0) / offResults.length;
    const offAvgPf = offResults.reduce((s, r) => s + r.profitFactor, 0) / offResults.length;

    const onScore = scoreFn({
      avgWinRate: onAvgWr,
      avgProfitFactor: onAvgPf,
      avgSharpe: onResults.reduce((s, r) => s + r.sharpeRatio, 0) / onResults.length,
      avgPnl: onResults.reduce((s, r) => s + r.totalPnlPercent, 0) / onResults.length,
    });
    const offScore = scoreFn({
      avgWinRate: offAvgWr,
      avgProfitFactor: offAvgPf,
      avgSharpe: offResults.reduce((s, r) => s + r.sharpeRatio, 0) / offResults.length,
      avgPnl: offResults.reduce((s, r) => s + r.totalPnlPercent, 0) / offResults.length,
    });

    const best = onScore > offScore;
    log(`    ${filterName.padEnd(30)}: ON WR=${fmt(onAvgWr)}% PF=${fmt(onAvgPf)} OFF WR=${fmt(offAvgWr)}% PF=${fmt(offAvgPf)} -> ${best ? 'ON' : 'OFF'}`);
    filterOverrides[filterName] = best;
  }

  log('\n  SWING RANGE:');
  let bestSwingRange: SwingRange = 'nearest';

  for (const val of SWING_RANGE_VALUES) {
    const matching = results.filter(r => r.configId === `swing-${val}`);
    if (matching.length === 0) continue;
    const avgWr = matching.reduce((s, r) => s + r.winRate, 0) / matching.length;
    const avgPf = matching.reduce((s, r) => s + r.profitFactor, 0) / matching.length;
    log(`    ${val.padEnd(12)}: WR ${fmt(avgWr)}% | PF ${fmt(avgPf)} | n=${matching.length}`);
  }

  const nearestResults = results.filter(r => r.configId === 'swing-nearest');
  const extendedResults = results.filter(r => r.configId === 'swing-extended');

  if (nearestResults.length > 0 && extendedResults.length > 0) {
    const nearestAvgWr = nearestResults.reduce((s, r) => s + r.winRate, 0) / nearestResults.length;
    const extendedAvgWr = extendedResults.reduce((s, r) => s + r.winRate, 0) / extendedResults.length;
    bestSwingRange = extendedAvgWr > nearestAvgWr ? 'extended' : 'nearest';
    log(`    -> Best: ${bestSwingRange}`);
  }

  return {
    topStrategies,
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

const runStage2 = async (analysis: Stage1Analysis): Promise<BacktestResultRow[]> => {
  const { topValues, filterOverrides, swingRange: bestSwingRange, topStrategies } = analysis;
  log('\n' + '='.repeat(80));
  log('STAGE 2 - Cross-Product Optimization (batched)');
  log('='.repeat(80));

  const results: BacktestResultRow[] = [...progress.data.stage2Results];

  type ComboConfig = { name: string; overrides: Record<string, unknown> };
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
                setupTypes: topStrategies,
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

  log(`  Combinations: ${allCombos.length}`);
  log(`  Total backtests: ${totalTasks}`);

  for (const symbol of SYMBOLS) {
    const symbolStart = Date.now();

    for (const tf of TIMEFRAMES) {
      if (shutdown.isShuttingDown()) break;

      for (const [entry, combos] of combosByEntry) {
        if (shutdown.isShuttingDown()) break;

        const pendingCombos = combos.filter(c => {
          const taskKey = `s2:${c.name}:${symbol}:${tf}`;
          if (progress.completed.has(taskKey)) {
            completedCount++;
            return false;
          }
          return true;
        });

        if (pendingCombos.length === 0) continue;

        const batchResults = await runBatchBacktest(pendingCombos, symbol, tf);

        for (const br of batchResults) {
          const combo = pendingCombos.find(c => c.name === br.name);
          if (!combo) continue;

          const fullConfig = { ...PRODUCTION_BASE, ...combo.overrides };
          const row = buildResultRow('S2', combo.name, fullConfig, symbol, tf, br.metrics, br.trades, PRODUCTION_BASE);
          results.push(row);

          const taskKey = `s2:${combo.name}:${symbol}:${tf}`;
          progress.completed.add(taskKey);
        }

        completedCount += pendingCombos.length;
        progress.data.stage2Results = results;
        progress.save();

        const pctDone = (completedCount / totalTasks) * 100;
        const elapsed = Date.now() - stageStart;
        const rate = completedCount / elapsed;
        const eta = (totalTasks - completedCount) / rate;
        log(`  [Progress] ${completedCount}/${totalTasks} (${fmt(pctDone)}%) | ETA: ${formatEta(eta)} | batch=${pendingCombos.length} entry=${entry}`);
      }
    }

    const symbolElapsed = Date.now() - symbolStart;
    log(`  [Symbol] ${symbol} done in ${formatEta(symbolElapsed)}`);
  }

  progress.save();
  log(`  Stage 2 complete: ${results.length} results`);
  return results;
};

const generateImportableConfigs = (
  stage2Results: BacktestResultRow[],
  analysis: Stage1Analysis,
  scoreFn: ScoringFunction
): void => {
  log('\n' + '='.repeat(80));
  log('GENERATING IMPORTABLE CONFIGS');
  log('='.repeat(80));

  const byConfig = new Map<string, BacktestResultRow[]>();
  for (const r of stage2Results) {
    if (!byConfig.has(r.configId)) byConfig.set(r.configId, []);
    byConfig.get(r.configId)!.push(r);
  }

  const ranked: Array<{
    configId: string;
    avgWinRate: number;
    avgProfitFactor: number;
    avgSharpe: number;
    avgPnl: number;
    avgDD: number;
    totalTrades: number;
    score: number;
    sample: BacktestResultRow;
  }> = [];

  for (const [configId, rows] of byConfig) {
    const avgWinRate = rows.reduce((s, r) => s + r.winRate, 0) / rows.length;
    const avgProfitFactor = rows.reduce((s, r) => s + r.profitFactor, 0) / rows.length;
    const avgSharpe = rows.reduce((s, r) => s + r.sharpeRatio, 0) / rows.length;
    const avgPnl = rows.reduce((s, r) => s + r.totalPnlPercent, 0) / rows.length;
    const avgDD = rows.reduce((s, r) => s + r.maxDrawdownPercent, 0) / rows.length;
    const totalTrades = rows.reduce((s, r) => s + r.totalTrades, 0);
    const score = scoreFn({ avgWinRate, avgProfitFactor, avgSharpe, avgPnl });

    ranked.push({ configId, avgWinRate, avgProfitFactor, avgSharpe, avgPnl, avgDD, totalTrades, score, sample: rows[0]! });
  }

  ranked.sort((a, b) => b.score - a.score);

  log('\n  TOP 10 CONFIGS BY PRECISION SCORE:\n');
  log('  Rank | Config                                          | WR %   | PF     | Sharpe | PnL %      | Score');
  log('  ' + '-'.repeat(100));

  for (let i = 0; i < Math.min(10, ranked.length); i++) {
    const r = ranked[i]!;
    log(`  ${(i + 1).toString().padStart(4)} | ${r.configId.padEnd(47)} | ${fmt(r.avgWinRate).padStart(5)}% | ${fmt(r.avgProfitFactor).padStart(6)} | ${fmt(r.avgSharpe).padStart(6)} | ${pct(r.avgPnl).padStart(10)} | ${fmt(r.score).padStart(7)}`);
  }

  const topConfigs = ranked.slice(0, 5).map((r, i) => {
    const filterBooleans: Record<string, boolean> = {};
    for (const [key, val] of Object.entries(analysis.filterOverrides)) {
      filterBooleans[key] = val;
    }

    return {
      name: `High Precision v${i + 1}`,
      description: `Optimized for win rate + profit factor. Generated ${new Date().toISOString().split('T')[0]}`,
      enabledSetupTypes: analysis.topStrategies,
      fibonacciTargetLevelLong: r.sample.fibLong,
      fibonacciTargetLevelShort: r.sample.fibShort,
      fibonacciSwingRange: analysis.swingRange,
      maxFibonacciEntryProgressPercentLong: r.sample.entryProgress,
      maxFibonacciEntryProgressPercentShort: r.sample.entryProgress,
      minRiskRewardRatioLong: r.sample.rrLong,
      minRiskRewardRatioShort: r.sample.rrShort,
      ...filterBooleans,
      tradingMode: 'semi_assisted',
      _metrics: {
        avgWinRate: +fmt(r.avgWinRate),
        avgProfitFactor: +fmt(r.avgProfitFactor),
        avgSharpe: +fmt(r.avgSharpe),
        avgPnlPercent: +fmt(r.avgPnl),
        avgMaxDrawdown: +fmt(r.avgDD),
        totalTrades: r.totalTrades,
        score: +fmt(r.score),
      },
    };
  });

  writeFileSync(`${OUTPUT_DIR}/precision-configs.json`, JSON.stringify(topConfigs, null, 2));
  log(`\n  Wrote precision-configs.json (${topConfigs.length} configs)`);

  let summary = '';
  summary += '='.repeat(120) + '\n';
  summary += 'PRECISION OPTIMIZATION RESULTS\n';
  summary += '='.repeat(120) + '\n';
  summary += `Generated: ${new Date().toISOString()}\n`;
  summary += `Period: ${PRODUCTION_BASE.startDate} to ${PRODUCTION_BASE.endDate}\n`;
  summary += `Symbols: ${SYMBOLS.join(', ')}\n`;
  summary += `Timeframes: ${TIMEFRAMES.join(', ')}\n`;
  summary += `Scoring: 50% WinRate + 30% ProfitFactor + 20% Sharpe\n`;
  summary += `Top strategies: ${analysis.topStrategies.join(', ')}\n`;
  summary += `Total configs tested: S1=${progress.data.stage1Results.length} S2=${stage2Results.length}\n`;
  summary += '='.repeat(120) + '\n\n';

  summary += 'SELECTED STRATEGIES (pre-screen >= ' + MIN_WIN_RATE_PRESCREEN + '% avg WR)\n';
  summary += '-'.repeat(80) + '\n';
  for (const s of analysis.topStrategies) {
    const prescreenRows = progress.data.prescreenResults.filter(r => r.strategyId === s);
    const avgWr = prescreenRows.reduce((sum, r) => sum + r.winRate, 0) / (prescreenRows.length || 1);
    const avgPf = prescreenRows.reduce((sum, r) => sum + r.profitFactor, 0) / (prescreenRows.length || 1);
    summary += `  ${s.padEnd(35)} WR: ${fmt(avgWr)}% | PF: ${fmt(avgPf)}\n`;
  }

  summary += '\nFILTER SETTINGS\n';
  summary += '-'.repeat(80) + '\n';
  for (const [name, val] of Object.entries(analysis.filterOverrides)) {
    summary += `  ${name.padEnd(35)} ${val ? 'ON' : 'OFF'}\n`;
  }

  summary += `\n  fibonacciSwingRange: ${analysis.swingRange}\n`;

  summary += '\nTOP 20 CONFIGS\n';
  summary += '-'.repeat(140) + '\n';
  summary += 'Rank | Config                                          | WR %   | PF     | Sharpe | PnL %      | Max DD % | Trades | Score\n';
  summary += '-'.repeat(140) + '\n';

  ranked.slice(0, 20).forEach((r, i) => {
    summary += `${(i + 1).toString().padStart(4)} | ${r.configId.padEnd(47)} | ${fmt(r.avgWinRate).padStart(5)}% | ${fmt(r.avgProfitFactor).padStart(6)} | ${fmt(r.avgSharpe).padStart(6)} | ${pct(r.avgPnl).padStart(10)} | ${fmt(r.avgDD).padStart(7)}% | ${r.totalTrades.toString().padStart(6)} | ${fmt(r.score).padStart(7)}\n`;
  });

  writeFileSync(`${OUTPUT_DIR}/summary.txt`, summary);
  log(`  Wrote summary.txt`);

  let csv = 'Stage,ConfigId,FibLong,FibShort,EntryProg,RRLong,RRShort,Symbol,TF,Trades,WR,PnL%,PF,MaxDD%,Sharpe,LongT,LongWR,LongPnL%,ShortT,ShortWR,ShortPnL%\n';
  for (const r of [...progress.data.baselineResults, ...progress.data.stage1Results, ...stage2Results]) {
    csv += `${r.stage},${r.configId},${r.fibLong},${r.fibShort},${r.entryProgress},${r.rrLong},${r.rrShort},${r.symbol},${r.timeframe},${r.totalTrades},${fmt(r.winRate)},${fmt(r.totalPnlPercent)},${fmt(r.profitFactor)},${fmt(r.maxDrawdownPercent)},${fmt(r.sharpeRatio)},${r.long.trades},${fmt(r.long.winRate)},${fmt(r.long.pnlPercent)},${r.short.trades},${fmt(r.short.winRate)},${fmt(r.short.pnlPercent)}\n`;
  }
  writeFileSync(`${OUTPUT_DIR}/full-results.csv`, csv);
  log(`  Wrote full-results.csv`);

  log(`\n  All reports saved to: ${OUTPUT_DIR}`);
};

const main = async (): Promise<void> => {
  const startTime = Date.now();

  log('='.repeat(80));
  log(`PRECISION OPTIMIZATION${QUICK_MODE ? ' (QUICK MODE)' : ''}`);
  log('='.repeat(80));
  log(`Scoring: 50% WinRate + 30% ProfitFactor*10 + 20% Sharpe*5`);
  log(`Symbols: ${SYMBOLS.join(', ')}`);
  log(`Timeframes: ${TIMEFRAMES.join(', ')}`);
  log(`Output: ${OUTPUT_DIR}`);

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const topStrategies = await runPrescreen();

  if (topStrategies.length === 0) {
    log('\nABORTED: No strategies met the minimum win rate threshold');
    process.exit(1);
  }

  if (shutdown.isShuttingDown()) return;

  const stage1Results = await runStage1(topStrategies);
  if (shutdown.isShuttingDown()) return;

  const analysis = analyzeStage1(stage1Results, progress.data.baselineResults, topStrategies, precisionScore);
  progress.data.stage1Analysis = analysis;
  progress.save();

  const stage2Results = await runStage2(analysis);
  if (shutdown.isShuttingDown()) return;

  generateImportableConfigs(stage2Results, analysis, precisionScore);

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
