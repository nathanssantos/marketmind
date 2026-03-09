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

const OUTPUT_DIR = process.env.OUTPUT_DIR || '/tmp/strategy-filter-ranking';
const PROGRESS_FILE = `${OUTPUT_DIR}/progress.json`;

const fmt = (num: number, decimals = 2): string => num.toFixed(decimals);
const pct = (num: number): string => `${num >= 0 ? '+' : ''}${fmt(num)}%`;

const formatEta = (ms: number): string => {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

const BASE_CONFIG = {
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
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  useCooldown: FILTER_DEFAULTS.useCooldown,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
  simulateFundingRates: true,
  simulateLiquidation: true,
  silent: true,
};

interface FilterPreset {
  id: string;
  label: string;
  overrides: Record<string, unknown>;
}

const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'baseline',
    label: 'Baseline (production defaults)',
    overrides: {
      useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
      useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
      useChoppinessFilter: FILTER_DEFAULTS.useChoppinessFilter,
      useVwapFilter: FILTER_DEFAULTS.useVwapFilter,
      useMomentumTimingFilter: FILTER_DEFAULTS.useMomentumTimingFilter,
      useBtcCorrelationFilter: FILTER_DEFAULTS.useBtcCorrelationFilter,
      useVolumeFilter: FILTER_DEFAULTS.useVolumeFilter,
      useMarketRegimeFilter: FILTER_DEFAULTS.useMarketRegimeFilter,
      useDirectionFilter: FILTER_DEFAULTS.useDirectionFilter,
      useFundingFilter: FILTER_DEFAULTS.useFundingFilter,
      useStochasticFilter: FILTER_DEFAULTS.useStochasticFilter,
      useStochasticRecoveryFilter: FILTER_DEFAULTS.useStochasticRecoveryFilter,
      useFvgFilter: false,
    },
  },
  {
    id: 'trend-only',
    label: 'Trend + ADX filters',
    overrides: {
      useTrendFilter: true,
      useAdxFilter: true,
      useChoppinessFilter: FILTER_DEFAULTS.useChoppinessFilter,
      useVwapFilter: false,
      useMomentumTimingFilter: false,
      useBtcCorrelationFilter: false,
      useVolumeFilter: false,
      useMarketRegimeFilter: false,
      useDirectionFilter: false,
      useFundingFilter: false,
      useStochasticFilter: false,
      useStochasticRecoveryFilter: false,
      useFvgFilter: false,
    },
  },
  {
    id: 'regime',
    label: 'Market regime filter',
    overrides: {
      useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
      useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
      useChoppinessFilter: FILTER_DEFAULTS.useChoppinessFilter,
      useVwapFilter: FILTER_DEFAULTS.useVwapFilter,
      useMomentumTimingFilter: false,
      useBtcCorrelationFilter: false,
      useVolumeFilter: false,
      useMarketRegimeFilter: true,
      useDirectionFilter: false,
      useFundingFilter: false,
      useStochasticFilter: false,
      useStochasticRecoveryFilter: false,
      useFvgFilter: false,
    },
  },
  {
    id: 'smc-filter',
    label: 'FVG (Smart Money) filter',
    overrides: {
      useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
      useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
      useChoppinessFilter: FILTER_DEFAULTS.useChoppinessFilter,
      useVwapFilter: false,
      useMomentumTimingFilter: false,
      useBtcCorrelationFilter: false,
      useVolumeFilter: false,
      useMarketRegimeFilter: false,
      useDirectionFilter: false,
      useFundingFilter: false,
      useStochasticFilter: false,
      useStochasticRecoveryFilter: false,
      useFvgFilter: true,
      fvgFilterProximityPercent: 0.5,
    },
  },
  {
    id: 'full-conservative',
    label: 'All trend/regime filters active',
    overrides: {
      useTrendFilter: true,
      useAdxFilter: true,
      useChoppinessFilter: true,
      useVwapFilter: true,
      useMomentumTimingFilter: true,
      useBtcCorrelationFilter: true,
      useVolumeFilter: true,
      useMarketRegimeFilter: true,
      useDirectionFilter: false,
      useFundingFilter: false,
      useStochasticFilter: false,
      useStochasticRecoveryFilter: false,
      useFvgFilter: false,
    },
  },
  {
    id: 'volume',
    label: 'Volume + momentum timing',
    overrides: {
      useTrendFilter: FILTER_DEFAULTS.useTrendFilter,
      useAdxFilter: FILTER_DEFAULTS.useAdxFilter,
      useChoppinessFilter: FILTER_DEFAULTS.useChoppinessFilter,
      useVwapFilter: FILTER_DEFAULTS.useVwapFilter,
      useMomentumTimingFilter: true,
      useBtcCorrelationFilter: false,
      useVolumeFilter: true,
      useMarketRegimeFilter: false,
      useDirectionFilter: false,
      useFundingFilter: false,
      useStochasticFilter: false,
      useStochasticRecoveryFilter: false,
      useFvgFilter: false,
    },
  },
];

interface PresetResult {
  presetId: string;
  symbol: string;
  totalTrades: number;
  winRate: number;
  totalPnlPercent: number;
  profitFactor: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
}

interface StrategyPresetSummary {
  strategyId: string;
  presetId: string;
  avgPnlPercent: number;
  avgSharpe: number;
  avgWinRate: number;
  avgProfitFactor: number;
  totalTrades: number;
  score: number;
}

interface ProgressData {
  completed: string[];
  results: PresetResult[];
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
  klineCache.set(symbol, mapped);
  return mapped;
};

const loadAllStrategyIds = (): string[] => {
  const files = readdirSync(STRATEGIES_DIR).filter(f => f.endsWith('.json')).sort();
  return files.map(f => f.replace('.json', ''));
};

const runBacktest = async (
  strategyId: string,
  symbol: string,
  presetId: string,
  preset: FilterPreset,
  klines: any[]
): Promise<PresetResult | null> => {
  try {
    const engine = new BacktestEngine();
    const config = {
      ...BASE_CONFIG,
      ...preset.overrides,
      setupTypes: [strategyId],
      symbol,
      interval: TIMEFRAME,
    };
    const result = await engine.run(config, klines);

    return {
      presetId,
      symbol,
      totalTrades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      totalPnlPercent: result.metrics.totalPnlPercent,
      profitFactor: result.metrics.profitFactor,
      maxDrawdownPercent: result.metrics.maxDrawdownPercent ?? 0,
      sharpeRatio: result.metrics.sharpeRatio ?? 0,
    };
  } catch (error) {
    log(`  [Error] ${strategyId}/${symbol}/${presetId}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
};

const generateReport = (allResults: Map<string, PresetResult[]>): void => {
  log('\n' + '='.repeat(100));
  log('GENERATING REPORTS');
  log('='.repeat(100));

  const summaries: StrategyPresetSummary[] = [];

  for (const [strategyId, results] of allResults) {
    const byPreset = new Map<string, PresetResult[]>();
    for (const r of results) {
      if (!byPreset.has(r.presetId)) byPreset.set(r.presetId, []);
      byPreset.get(r.presetId)!.push(r);
    }

    for (const [presetId, presetResults] of byPreset) {
      if (presetResults.length === 0) continue;
      const avgPnl = presetResults.reduce((s, r) => s + r.totalPnlPercent, 0) / presetResults.length;
      const avgSharpe = presetResults.reduce((s, r) => s + r.sharpeRatio, 0) / presetResults.length;
      const avgWr = presetResults.reduce((s, r) => s + r.winRate, 0) / presetResults.length;
      const avgPf = presetResults.reduce((s, r) => s + r.profitFactor, 0) / presetResults.length;
      const totalTrades = presetResults.reduce((s, r) => s + r.totalTrades, 0);
      const score = avgPnl * 0.6 + avgSharpe * 10 * 0.4;

      summaries.push({ strategyId, presetId, avgPnlPercent: avgPnl, avgSharpe, avgWinRate: avgWr, avgProfitFactor: avgPf, totalTrades, score });
    }
  }

  let report = '';
  report += '='.repeat(120) + '\n';
  report += 'STRATEGY × FILTER PRESET RANKING\n';
  report += '='.repeat(120) + '\n';
  report += `Generated: ${new Date().toISOString()}\n`;
  report += `Period: ${START_DATE} to ${END_DATE}\n`;
  report += `Symbols: ${SYMBOLS.join(', ')} | Timeframe: ${TIMEFRAME}\n\n`;

  report += 'FILTER PRESETS:\n';
  for (const p of FILTER_PRESETS) {
    report += `  ${p.id.padEnd(20)} - ${p.label}\n`;
  }
  report += '\n';

  report += 'BEST PRESET PER STRATEGY (sorted by score)\n';
  report += '-'.repeat(120) + '\n';
  report += 'Strategy                               | Best Preset          | Avg PnL %  | Sharpe | WR %   | PF     | Trades\n';
  report += '-'.repeat(120) + '\n';

  const bestPerStrategy = new Map<string, StrategyPresetSummary>();
  for (const s of summaries) {
    const existing = bestPerStrategy.get(s.strategyId);
    if (!existing || s.score > existing.score) bestPerStrategy.set(s.strategyId, s);
  }

  const sortedBest = [...bestPerStrategy.values()].sort((a, b) => b.score - a.score);
  for (const s of sortedBest) {
    report += `${s.strategyId.padEnd(38)} | ${s.presetId.padEnd(20)} | ${pct(s.avgPnlPercent).padStart(10)} | ${fmt(s.avgSharpe).padStart(6)} | ${fmt(s.avgWinRate).padStart(5)}% | ${fmt(s.avgProfitFactor).padStart(6)} | ${s.totalTrades.toString().padStart(6)}\n`;
  }

  report += '\n' + '='.repeat(120) + '\n';
  report += 'PER-STRATEGY BREAKDOWN (best preset highlighted with *)\n';
  report += '='.repeat(120) + '\n\n';

  const strategyIds = [...new Set(summaries.map(s => s.strategyId))].sort();
  for (const strategyId of strategyIds) {
    const stratSummaries = summaries.filter(s => s.strategyId === strategyId);
    const best = bestPerStrategy.get(strategyId);

    report += `${strategyId}\n`;
    report += '  Preset                | Avg PnL %  | Sharpe | WR %   | PF     | Trades | Score\n';
    report += '  ' + '-'.repeat(85) + '\n';

    for (const preset of FILTER_PRESETS) {
      const s = stratSummaries.find(x => x.presetId === preset.id);
      if (!s) {
        report += `  ${preset.id.padEnd(20)} | (no results)\n`;
        continue;
      }
      const marker = s.presetId === best?.presetId ? '*' : ' ';
      report += `${marker} ${s.presetId.padEnd(20)} | ${pct(s.avgPnlPercent).padStart(10)} | ${fmt(s.avgSharpe).padStart(6)} | ${fmt(s.avgWinRate).padStart(5)}% | ${fmt(s.avgProfitFactor).padStart(6)} | ${s.totalTrades.toString().padStart(6)} | ${fmt(s.score).padStart(7)}\n`;
    }
    report += '\n';
  }

  report += '='.repeat(120) + '\n';
  report += 'FVG FILTER IMPACT ANALYSIS\n';
  report += '='.repeat(120) + '\n\n';

  const fvgImpact: Array<{ strategyId: string; baselinePnl: number; fvgPnl: number; delta: number }> = [];
  for (const strategyId of strategyIds) {
    const baseline = summaries.find(s => s.strategyId === strategyId && s.presetId === 'baseline');
    const fvg = summaries.find(s => s.strategyId === strategyId && s.presetId === 'smc-filter');
    if (baseline && fvg) {
      fvgImpact.push({ strategyId, baselinePnl: baseline.avgPnlPercent, fvgPnl: fvg.avgPnlPercent, delta: fvg.avgPnlPercent - baseline.avgPnlPercent });
    }
  }

  fvgImpact.sort((a, b) => b.delta - a.delta);

  report += 'FVG filter improves these strategies most (top 20):\n';
  report += 'Strategy                               | Baseline PnL | FVG PnL    | Delta\n';
  report += '-'.repeat(80) + '\n';
  for (const item of fvgImpact.slice(0, 20)) {
    report += `${item.strategyId.padEnd(38)} | ${pct(item.baselinePnl).padStart(12)} | ${pct(item.fvgPnl).padStart(10)} | ${pct(item.delta).padStart(8)}\n`;
  }

  report += '\nFVG filter hurts these strategies most (bottom 10):\n';
  report += 'Strategy                               | Baseline PnL | FVG PnL    | Delta\n';
  report += '-'.repeat(80) + '\n';
  for (const item of fvgImpact.slice(-10).reverse()) {
    report += `${item.strategyId.padEnd(38)} | ${pct(item.baselinePnl).padStart(12)} | ${pct(item.fvgPnl).padStart(10)} | ${pct(item.delta).padStart(8)}\n`;
  }

  writeFileSync(`${OUTPUT_DIR}/filter-ranking.txt`, report);
  log(`  Wrote filter-ranking.txt`);

  let csv = 'Strategy,Preset,Symbol,Trades,WinRate,PnL%,ProfitFactor,MaxDD%,Sharpe\n';
  for (const [strategyId, results] of allResults) {
    for (const r of results) {
      csv += `${strategyId},${r.presetId},${r.symbol},${r.totalTrades},${fmt(r.winRate)},${fmt(r.totalPnlPercent)},${fmt(r.profitFactor)},${fmt(r.maxDrawdownPercent)},${fmt(r.sharpeRatio)}\n`;
    }
  }
  writeFileSync(`${OUTPUT_DIR}/filter-results.csv`, csv);
  log(`  Wrote filter-results.csv`);

  const jsonOutput = sortedBest.slice(0, 30).map(s => ({
    strategyId: s.strategyId,
    bestPreset: s.presetId,
    avgPnlPercent: +fmt(s.avgPnlPercent),
    avgSharpe: +fmt(s.avgSharpe),
    avgWinRate: +fmt(s.avgWinRate),
    score: +fmt(s.score),
  }));
  writeFileSync(`${OUTPUT_DIR}/top-strategies-by-filter.json`, JSON.stringify(jsonOutput, null, 2));
  log(`  Wrote top-strategies-by-filter.json`);

  log(`\n  All reports saved to: ${OUTPUT_DIR}`);
};

const main = async (): Promise<void> => {
  const startTime = Date.now();
  const allStrategies = loadAllStrategyIds();

  const totalTasks = allStrategies.length * SYMBOLS.length * FILTER_PRESETS.length;

  log('='.repeat(80));
  log('STRATEGY × FILTER RANKING - Backtest All Strategies with Filter Presets');
  log('='.repeat(80));
  log(`Strategies: ${allStrategies.length}`);
  log(`Symbols: ${SYMBOLS.join(', ')}`);
  log(`Timeframe: ${TIMEFRAME}`);
  log(`Period: ${START_DATE} to ${END_DATE}`);
  log(`Filter presets: ${FILTER_PRESETS.length} (${FILTER_PRESETS.map(p => p.id).join(', ')})`);
  log(`Output: ${OUTPUT_DIR}`);
  log(`Total backtests: ${totalTasks}`);

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

    for (const preset of FILTER_PRESETS) {
      if (shuttingDown) break;

      for (const symbol of SYMBOLS) {
        if (shuttingDown) break;

        const taskKey = `${strategyId}:${preset.id}:${symbol}`;
        if (completedSet.has(taskKey)) {
          completedCount++;
          continue;
        }

        const klines = klineCache.get(symbol)!;
        const result = await runBacktest(strategyId, symbol, preset.id, preset, klines);

        if (result) {
          results.push(result as any);
        }

        completedSet.add(taskKey);
        completedCount++;

        progress.completed = [...completedSet];
        progress.results = results;
        currentProgress = progress;

        if (completedCount % 30 === 0) {
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

  saveProgress(progress);
  log(`\n  Backtests complete: ${results.length} results`);

  const resultsByStrategy = new Map<string, PresetResult[]>();
  for (const strategyId of allStrategies) {
    resultsByStrategy.set(strategyId, []);
  }

  const rawResults = results as unknown as Array<PresetResult & { strategyId?: string }>;
  const progressResults = progress.results as unknown as Array<any>;
  const completedEntries = [...completedSet];

  for (const taskKey of completedEntries) {
    const parts = taskKey.split(':');
    if (parts.length < 3) continue;
    const sid = parts.slice(0, -2).join(':');
    const presetId = parts[parts.length - 2]!;
    const symbol = parts[parts.length - 1]!;

    const matchingResults = (progress.results as any[]).filter(
      (r: any) => r.presetId === presetId && r.symbol === symbol
    );
    const r = matchingResults[matchingResults.length - 1];
    if (r && resultsByStrategy.has(sid)) {
      resultsByStrategy.get(sid)!.push({ ...r });
    }
  }

  generateReport(resultsByStrategy);

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
