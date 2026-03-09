import { existsSync, readFileSync, writeFileSync, writeSync } from 'fs';

export const log = (...args: unknown[]): void => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
  writeSync(1, msg);
};

export const fmt = (num: number, decimals = 2): string => num.toFixed(decimals);
export const pct = (num: number): string => `${num >= 0 ? '+' : ''}${fmt(num)}%`;

export const formatEta = (ms: number): string => {
  if (ms <= 0) return '0m';
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export const getIntervalMs = (interval: string): number => {
  const match = interval.match(/^(\d+)([mhdw])$/);
  if (!match?.[1] || !match[2]) return 4 * 3600000;
  const units: Record<string, number> = { m: 60000, h: 3600000, d: 86400000, w: 604800000 };
  return parseInt(match[1]) * (units[match[2]] ?? 3600000);
};

export interface DirectionMetrics {
  trades: number;
  winRate: number;
  pnlPercent: number;
  avgTradePercent: number;
}

export const splitByDirection = (trades: { side: string; pnlPercent?: number }[]): { long: DirectionMetrics; short: DirectionMetrics } => {
  const longTrades = trades.filter(t => t.side === 'LONG');
  const shortTrades = trades.filter(t => t.side === 'SHORT');

  const longWins = longTrades.filter(t => (t.pnlPercent ?? 0) > 0).length;
  const shortWins = shortTrades.filter(t => (t.pnlPercent ?? 0) > 0).length;

  const longPnl = longTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);
  const shortPnl = shortTrades.reduce((sum, t) => sum + (t.pnlPercent ?? 0), 0);

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

export interface ProgressManager<T> {
  data: T;
  completed: Set<string>;
  save: () => void;
}

export const createProgressManager = <T extends { completed: string[] }>(
  progressFile: string,
  defaultData: () => T
): ProgressManager<T> => {
  const data = existsSync(progressFile)
    ? JSON.parse(readFileSync(progressFile, 'utf-8')) as T
    : defaultData();

  const completed = new Set(data.completed);

  const save = (): void => {
    data.completed = [...completed];
    writeFileSync(progressFile, JSON.stringify(data, null, 2));
  };

  return { data, completed, save };
};

export const createShutdownHandler = <T>(
  progressSaver: () => void
): { isShuttingDown: () => boolean } => {
  let shuttingDown = false;

  const handle = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    log(`\n[${signal}] Saving progress and shutting down...`);
    progressSaver();
    log(`  Progress saved. Resume by re-running the script.`);
    process.exit(0);
  };

  process.on('SIGINT', () => handle('SIGINT'));
  process.on('SIGTERM', () => handle('SIGTERM'));

  return { isShuttingDown: () => shuttingDown };
};

export const silenceConsole = (): (() => void) => {
  process.env['LOG_LEVEL'] = 'silent';
  process.env['NODE_ENV'] = 'production';
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  const originalError = console.error;
  console.error = () => {};
  console.debug = () => {};
  return originalError;
};

export interface KlineCacheConfig {
  startDate: string;
  endDate: string;
  marketType: string;
  ema200WarmupBars: number;
  absoluteMinKlines: number;
}

export const createKlineCache = (
  klineQueries: { findMany: (params: Record<string, unknown>) => Promise<unknown[]> },
  mapDbKlinesToApi: (klines: unknown[]) => unknown[],
  smartBackfillKlines: (symbol: string, interval: string, count: number, marketType: string) => Promise<void>,
  config: KlineCacheConfig
) => {
  const cache = new Map<string, unknown[]>();

  const cacheKey = (symbol: string, tf: string): string => `${symbol}:${tf}`;

  const prefetch = async (symbol: string, tf: string): Promise<unknown[]> => {
    const key = cacheKey(symbol, tf);
    if (cache.has(key)) return cache.get(key)!;

    log(`  [Prefetch] ${symbol}/${tf}...`);

    const intervalMs = getIntervalMs(tf);
    const warmupMs = config.ema200WarmupBars * intervalMs;
    const startTime = new Date(new Date(config.startDate).getTime() - warmupMs);
    const endTime = new Date(config.endDate);

    let dbKlines = await klineQueries.findMany({
      symbol,
      interval: tf,
      marketType: config.marketType,
      startTime,
      endTime,
    });

    if (dbKlines.length < config.absoluteMinKlines) {
      log(`    DB has ${dbKlines.length} klines, backfilling...`);
      const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / intervalMs);
      await smartBackfillKlines(symbol, tf, expectedKlines, config.marketType);

      dbKlines = await klineQueries.findMany({
        symbol,
        interval: tf,
        marketType: config.marketType,
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

    cache.set(key, mapped);
    return mapped;
  };

  const clear = (): void => {
    const size = cache.size;
    cache.clear();
    if (global.gc) global.gc();
    log(`  [Memory] Cleared kline cache (${size} entries)`);
  };

  const get = (symbol: string, tf: string): unknown[] | undefined => cache.get(cacheKey(symbol, tf));

  return { prefetch, clear, get };
};

export interface BacktestResultRow {
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

export const buildResultRow = (
  stage: string,
  configId: string,
  config: Record<string, unknown>,
  symbol: string,
  tf: string,
  metrics: Record<string, number>,
  trades: { side: string; pnlPercent?: number }[],
  baseConfig: Record<string, unknown>
): BacktestResultRow => {
  const dirs = splitByDirection(trades);
  return {
    stage,
    configId,
    fibLong: (config.fibonacciTargetLevelLong ?? baseConfig.fibonacciTargetLevelLong) as string,
    fibShort: (config.fibonacciTargetLevelShort ?? baseConfig.fibonacciTargetLevelShort) as string,
    entryProgress: (config.maxFibonacciEntryProgressPercentLong ?? baseConfig.maxFibonacciEntryProgressPercentLong) as number,
    rrLong: (config.minRiskRewardRatioLong ?? baseConfig.minRiskRewardRatioLong) as number,
    rrShort: (config.minRiskRewardRatioShort ?? baseConfig.minRiskRewardRatioShort) as number,
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

export type ScoringFunction = (row: { avgWinRate: number; avgProfitFactor: number; avgSharpe: number; avgPnl: number }) => number;

export const pnlSharpeScore: ScoringFunction = (r) => r.avgPnl * 0.6 + r.avgSharpe * 10 * 0.4;

export const precisionScore: ScoringFunction = (r) =>
  r.avgWinRate * 0.50 + r.avgProfitFactor * 10 * 0.30 + r.avgSharpe * 5 * 0.20;
