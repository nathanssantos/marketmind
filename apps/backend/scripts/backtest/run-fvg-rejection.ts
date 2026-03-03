import { FILTER_DEFAULTS, TRADING_DEFAULTS } from '@marketmind/types';
import { config as dotenvConfig } from 'dotenv';
import { writeSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenvConfig({ path: resolve(__dirname, '../../.env') });

const log = (...args: any[]): void => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
  writeSync(1, msg);
};

process.env['LOG_LEVEL'] = 'silent';
process.env['NODE_ENV'] = 'production';
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};
console.debug = () => {};

const { BacktestEngine } = await import('../../src/services/backtesting/BacktestEngine.js');
const { klineQueries } = await import('../../src/services/database/klineQueries.js');
const { mapDbKlinesToApi } = await import('../../src/utils/kline-mapper.js');
const { smartBackfillKlines } = await import('../../src/services/binance-historical.js');
const { BACKTEST_ENGINE, ABSOLUTE_MINIMUM_KLINES } = await import('../../src/constants/index.js');

const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '30m';
const INTERVAL_MS = 30 * 60 * 1000;
const START_DATE = '2023-02-01';
const END_DATE = '2026-02-01';
const STRATEGY_ID = 'fvg-rejection';

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
  useMomentumTimingFilter: false,
  useBtcCorrelationFilter: false,
  useVolumeFilter: false,
  useTrendFilter: false,
  useStochasticFilter: false,
  useStochasticRecoveryFilter: false,
  useStochasticHtfFilter: false,
  useStochasticRecoveryHtfFilter: false,
  useAdxFilter: false,
  useMtfFilter: false,
  useMarketRegimeFilter: false,
  useDirectionFilter: false,
  useFundingFilter: false,
  useConfluenceScoring: false,
  confluenceMinScore: FILTER_DEFAULTS.confluenceMinScore,
  useFvgFilter: false,
  fvgFilterProximityPercent: 0.5,
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  useCooldown: false,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
  simulateFundingRates: false,
  simulateLiquidation: false,
  silent: true,
};

const fmt = (n: number, d = 2) => n.toFixed(d);
const pct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`;

const PRESETS = [
  { label: 'Baseline (no filters)', useTrendFilter: false, useDirectionFilter: false },
  { label: 'Trend Filter (EMA21)',   useTrendFilter: true,  useDirectionFilter: false },
  { label: 'Direction Filter',       useTrendFilter: false, useDirectionFilter: true },
  { label: 'Trend + Direction',      useTrendFilter: true,  useDirectionFilter: true },
];

log('');
log('═══════════════════════════════════════════════════════════════════════════════');
log(`  FVG REJECTION — FILTER COMPARISON`);
log(`  Strategy: ${STRATEGY_ID} | Symbol: ${SYMBOL} | TF: ${TIMEFRAME}`);
log(`  Period: ${START_DATE} → ${END_DATE} (3 years)`);
log('═══════════════════════════════════════════════════════════════════════════════');
log('');
log('  Loading klines...');

const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * INTERVAL_MS;
const startTime = new Date(new Date(START_DATE).getTime() - warmupMs);
const endTime = new Date(END_DATE);

let dbKlines = await klineQueries.findMany({
  symbol: SYMBOL,
  interval: TIMEFRAME as any,
  marketType: 'FUTURES' as any,
  startTime,
  endTime,
});

if (dbKlines.length < ABSOLUTE_MINIMUM_KLINES) {
  log(`  [backfill] Fetching from Binance...`);
  const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / INTERVAL_MS);
  await smartBackfillKlines(SYMBOL, TIMEFRAME as any, expectedKlines, 'FUTURES' as any);
  dbKlines = await klineQueries.findMany({
    symbol: SYMBOL,
    interval: TIMEFRAME as any,
    marketType: 'FUTURES' as any,
    startTime,
    endTime,
  });
}

const klines = mapDbKlinesToApi(dbKlines);
log(`  ${klines.length.toLocaleString()} klines loaded`);
log('');

type PresetResult = {
  label: string;
  trades: number;
  winRate: number;
  pnl: number;
  profitFactor: number;
  sharpe: number;
  maxDrawdown: number;
  longs: number;
  shorts: number;
  longWR: number;
  shortWR: number;
  byYear: Record<string, { trades: number; wins: number; pnl: number }>;
};

const results: PresetResult[] = [];

for (const preset of PRESETS) {
  log(`  Running: ${preset.label}...`);

  const engine = new BacktestEngine();
  const result = await engine.run(
    {
      ...BASE_CONFIG,
      useTrendFilter: preset.useTrendFilter,
      useDirectionFilter: preset.useDirectionFilter,
      setupTypes: [STRATEGY_ID],
      symbol: SYMBOL,
      interval: TIMEFRAME,
      exchange: 'BINANCE' as const,
      assetClass: 'CRYPTO' as const,
    },
    klines,
  );

  const m = result.metrics;
  const trades = result.trades ?? [];
  const longs = trades.filter(t => t.direction === 'LONG');
  const shorts = trades.filter(t => t.direction === 'SHORT');
  const longWins = longs.filter(t => (t.pnlPercent ?? 0) > 0).length;
  const shortWins = shorts.filter(t => (t.pnlPercent ?? 0) > 0).length;

  const byYear: Record<string, { trades: number; wins: number; pnl: number }> = {};
  for (const t of trades) {
    const year = new Date(t.entryTime).getFullYear().toString();
    if (!byYear[year]) byYear[year] = { trades: 0, wins: 0, pnl: 0 };
    byYear[year]!.trades++;
    if ((t.pnlPercent ?? 0) > 0) byYear[year]!.wins++;
    byYear[year]!.pnl += t.pnlPercent ?? 0;
  }

  results.push({
    label: preset.label,
    trades: m.totalTrades,
    winRate: m.winRate,
    pnl: m.totalPnlPercent,
    profitFactor: m.profitFactor,
    sharpe: m.sharpeRatio ?? 0,
    maxDrawdown: m.maxDrawdownPercent ?? 0,
    longs: longs.length,
    shorts: shorts.length,
    longWR: longs.length > 0 ? (longWins / longs.length) * 100 : 0,
    shortWR: shorts.length > 0 ? (shortWins / shorts.length) * 100 : 0,
    byYear,
  });
}

log('');

for (const r of results) {
  log('─────────────────────────────────────────────────────────────────────────────');
  log(`  ${r.label.toUpperCase()}`);
  log('─────────────────────────────────────────────────────────────────────────────');
  log('');
  log(`  Total Trades      : ${r.trades}`);
  log(`  Win Rate          : ${fmt(r.winRate)}%`);
  log(`  Total PnL         : ${pct(r.pnl)}`);
  log(`  Profit Factor     : ${fmt(r.profitFactor)}`);
  log(`  Sharpe Ratio      : ${fmt(r.sharpe)}`);
  log(`  Max Drawdown      : ${fmt(r.maxDrawdown)}%`);
  log('');
  log(`  LONGs  : ${r.longs} trades — ${fmt(r.longWR)}% WR`);
  log(`  SHORTs : ${r.shorts} trades — ${fmt(r.shortWR)}% WR`);
  log('');

  if (r.trades > 0) {
    log('  BY YEAR:');
    for (const [year, stats] of Object.entries(r.byYear).sort()) {
      const wr = stats.trades > 0 ? (stats.wins / stats.trades) * 100 : 0;
      log(`    ${year}  Trades: ${String(stats.trades).padStart(4)}  WR: ${fmt(wr)}%  PnL: ${pct(stats.pnl)}`);
    }
    log('');
  }
}

log('═══════════════════════════════════════════════════════════════════════════════');
log('  COMPARISON SUMMARY');
log('═══════════════════════════════════════════════════════════════════════════════');
log('');
log(`  ${'Preset'.padEnd(24)} ${'Trades'.padStart(7)} ${'WR'.padStart(7)} ${'PnL'.padStart(10)} ${'PF'.padStart(6)} ${'Sharpe'.padStart(8)} ${'MaxDD'.padStart(8)}`);
log(`  ${'─'.repeat(24)} ${'─'.repeat(7)} ${'─'.repeat(7)} ${'─'.repeat(10)} ${'─'.repeat(6)} ${'─'.repeat(8)} ${'─'.repeat(8)}`);
for (const r of results) {
  log(
    `  ${r.label.padEnd(24)} ` +
    `${String(r.trades).padStart(7)} ` +
    `${(fmt(r.winRate) + '%').padStart(7)} ` +
    `${pct(r.pnl).padStart(10)} ` +
    `${fmt(r.profitFactor).padStart(6)} ` +
    `${fmt(r.sharpe).padStart(8)} ` +
    `${(fmt(r.maxDrawdown) + '%').padStart(8)}`
  );
}
log('');

log('═══════════════════════════════════════════════════════════════════════════════');
log('  Done.');
log('');

process.exit(0);
