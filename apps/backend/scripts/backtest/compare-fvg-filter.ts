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
const { BACKTEST_ENGINE, ABSOLUTE_MINIMUM_KLINES, DEFAULT_ENABLED_SETUPS } = await import('../../src/constants/index.js');

const SYMBOLS = ['BTCUSDT', 'ETHUSDT'];
const TIMEFRAME = '1h';
const INTERVAL_MS = 3600000;
const START_DATE = '2024-01-01';
const END_DATE = '2026-02-01';
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
  maxFibonacciEntryProgressPercent: FILTER_DEFAULTS.maxFibonacciEntryProgressPercent,
  minRiskRewardRatioLong: FILTER_DEFAULTS.minRiskRewardRatioLong,
  minRiskRewardRatioShort: FILTER_DEFAULTS.minRiskRewardRatioShort,
  useMomentumTimingFilter: FILTER_DEFAULTS.useMomentumTimingFilter,
  useBtcCorrelationFilter: false,
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
  useFundingFilter: false,
  useConfluenceScoring: FILTER_DEFAULTS.useConfluenceScoring,
  confluenceMinScore: FILTER_DEFAULTS.confluenceMinScore,
  useFvgFilter: false,
  fvgFilterProximityPercent: 0.5,
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  useCooldown: FILTER_DEFAULTS.useCooldown,
  cooldownMinutes: FILTER_DEFAULTS.cooldownMinutes,
  simulateFundingRates: false,
  simulateLiquidation: false,
  silent: true,
};

const fmt = (n: number, d = 2) => n.toFixed(d);
const pct = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}%`;
const fmtCount = (n: number) => n.toString().padStart(4);

const strategies = [...DEFAULT_ENABLED_SETUPS];

log('');
log('═══════════════════════════════════════════════════════════════════════════════');
log('  FVG FILTER IMPACT ANALYSIS — DEFAULT_ENABLED_SETUPS');
log(`  Strategies: ${strategies.length} | Symbols: ${SYMBOLS.join(', ')} | TF: ${TIMEFRAME}`);
log(`  Period: ${START_DATE} → ${END_DATE} | FVG proximity: 0.5%`);
log('═══════════════════════════════════════════════════════════════════════════════');
log('');

interface Result {
  trades: number;
  winRate: number;
  pnl: number;
  sharpe: number;
  pf: number;
  maxDD: number;
}

interface Comparison {
  strategy: string;
  symbol: string;
  baseline: Result;
  withFvg: Result;
  tradeReduction: number;
  winRateChange: number;
  pnlChange: number;
  sharpeChange: number;
}

const comparisons: Comparison[] = [];

const klineCache = new Map<string, any[]>();

const fetchKlines = async (symbol: string): Promise<any[]> => {
  if (klineCache.has(symbol)) return klineCache.get(symbol)!;

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
    log(`  [backfill] ${symbol} — fetching from Binance...`);
    const expectedKlines = Math.ceil((endTime.getTime() - startTime.getTime()) / INTERVAL_MS);
    await smartBackfillKlines(symbol, TIMEFRAME as any, expectedKlines, 'FUTURES' as any);
    dbKlines = await klineQueries.findMany({
      symbol,
      interval: TIMEFRAME as any,
      marketType: 'FUTURES' as any,
      startTime,
      endTime,
    });
  }

  const mapped = mapDbKlinesToApi(dbKlines);
  klineCache.set(symbol, mapped);
  log(`  [cache] ${symbol}: ${mapped.length} klines loaded`);
  return mapped;
};

const runBacktest = async (strategyId: string, symbol: string, useFvg: boolean): Promise<Result | null> => {
  const klines = await fetchKlines(symbol);

  const engine = new BacktestEngine();
  const config = {
    ...BASE_CONFIG,
    setupTypes: [strategyId],
    symbol,
    interval: TIMEFRAME,
    exchange: 'BINANCE' as const,
    assetClass: 'CRYPTO' as const,
    useFvgFilter: useFvg,
  };

  try {
    const result = await engine.run(config, klines);
    return {
      trades: result.metrics.totalTrades,
      winRate: result.metrics.winRate,
      pnl: result.metrics.totalPnlPercent,
      sharpe: result.metrics.sharpeRatio ?? 0,
      pf: result.metrics.profitFactor,
      maxDD: result.metrics.maxDrawdownPercent ?? 0,
    };
  } catch (error) {
    log(`  [Error] ${strategyId}/${symbol}: ${error instanceof Error ? error.message : error}`);
    return null;
  }
};

let done = 0;
const total = strategies.length * SYMBOLS.length;

for (const symbol of SYMBOLS) {
  for (const strategyId of strategies) {
    done++;
    process.stdout.write(`\r  [${done}/${total}] ${strategyId} / ${symbol}              `);

    const baseline = await runBacktest(strategyId, symbol, false);
    const withFvg = await runBacktest(strategyId, symbol, true);

    if (!baseline || !withFvg) continue;

    comparisons.push({
      strategy: strategyId,
      symbol,
      baseline,
      withFvg,
      tradeReduction: baseline.trades > 0 ? ((baseline.trades - withFvg.trades) / baseline.trades) * 100 : 0,
      winRateChange: withFvg.winRate - baseline.winRate,
      pnlChange: withFvg.pnl - baseline.pnl,
      sharpeChange: withFvg.sharpe - baseline.sharpe,
    });
  }
}

log('\n');
log('─────────────────────────────────────────────────────────────────────────────────────────────────────────────');
log('  Strategy                       Symbol   | Baseline                            | FVG Filter                          | Δ WR     Δ PnL     Δ Sharpe');
log('                                          | Trades  WR%    PnL%    Sharpe  PF   | Trades  WR%    PnL%    Sharpe  PF   |');
log('─────────────────────────────────────────────────────────────────────────────────────────────────────────────');

for (const c of comparisons) {
  const name = c.strategy.padEnd(31);
  const sym = c.symbol.padEnd(8);
  const b = c.baseline;
  const f = c.withFvg;

  const deltaWR = c.winRateChange >= 0 ? `+${fmt(c.winRateChange)}` : fmt(c.winRateChange);
  const deltaPnL = c.pnlChange >= 0 ? `+${fmt(c.pnlChange)}` : fmt(c.pnlChange);
  const deltaSharpe = c.sharpeChange >= 0 ? `+${fmt(c.sharpeChange)}` : fmt(c.sharpeChange);
  const filterPct = `(-${fmt(c.tradeReduction)}%)`;

  log(
    `  ${name} ${sym} | ${fmtCount(b.trades)}  ${fmt(b.winRate)}%  ${pct(b.pnl).padStart(8)}  ${fmt(b.sharpe).padStart(6)}  ${fmt(b.pf)} | ${fmtCount(f.trades)}${filterPct.padStart(8)}  ${fmt(f.winRate)}%  ${pct(f.pnl).padStart(8)}  ${fmt(f.sharpe).padStart(6)}  ${fmt(f.pf)} | ${deltaWR.padStart(7)}%  ${deltaPnL.padStart(7)}%  ${deltaSharpe.padStart(7)}`
  );
}

log('─────────────────────────────────────────────────────────────────────────────────────────────────────────────');
log('');

// Summary
const improved = comparisons.filter(c => c.sharpeChange > 0.05);
const degraded = comparisons.filter(c => c.sharpeChange < -0.05);
const neutral = comparisons.filter(c => Math.abs(c.sharpeChange) <= 0.05);
const avgTradeReduction = comparisons.reduce((sum, c) => sum + c.tradeReduction, 0) / comparisons.length;
const avgWinRateChange = comparisons.reduce((sum, c) => sum + c.winRateChange, 0) / comparisons.length;
const avgPnlChange = comparisons.reduce((sum, c) => sum + c.pnlChange, 0) / comparisons.length;
const avgSharpeChange = comparisons.reduce((sum, c) => sum + c.sharpeChange, 0) / comparisons.length;

log('  SUMMARY');
log(`  Total comparisons : ${comparisons.length}`);
log(`  Avg trade reduction: ${fmt(avgTradeReduction)}% fewer trades with FVG filter`);
log(`  Avg win rate change: ${avgWinRateChange >= 0 ? '+' : ''}${fmt(avgWinRateChange)}%`);
log(`  Avg PnL change     : ${avgPnlChange >= 0 ? '+' : ''}${fmt(avgPnlChange)}%`);
log(`  Avg Sharpe change  : ${avgSharpeChange >= 0 ? '+' : ''}${fmt(avgSharpeChange)}`);
log('');
log(`  Improved (Sharpe > +0.05): ${improved.length} combos`);
log(`  Neutral  (|Sharpe| ≤ 0.05): ${neutral.length} combos`);
log(`  Degraded (Sharpe < -0.05): ${degraded.length} combos`);
log('');

if (improved.length > 0) {
  log('  TOP GAINERS (by Sharpe improvement):');
  improved
    .sort((a, b) => b.sharpeChange - a.sharpeChange)
    .slice(0, 5)
    .forEach(c => {
      log(`    ${c.strategy.padEnd(31)} ${c.symbol.padEnd(8)} Sharpe ${c.baseline.sharpe.toFixed(2)} → ${c.withFvg.sharpe.toFixed(2)} (+${c.sharpeChange.toFixed(2)})  WR ${c.baseline.winRate.toFixed(1)}% → ${c.withFvg.winRate.toFixed(1)}%  Trades: ${c.baseline.trades} → ${c.withFvg.trades}`);
    });
  log('');
}

if (degraded.length > 0) {
  log('  DEGRADED (FVG filter hurts these strategies):');
  degraded
    .sort((a, b) => a.sharpeChange - b.sharpeChange)
    .slice(0, 5)
    .forEach(c => {
      log(`    ${c.strategy.padEnd(31)} ${c.symbol.padEnd(8)} Sharpe ${c.baseline.sharpe.toFixed(2)} → ${c.withFvg.sharpe.toFixed(2)} (${c.sharpeChange.toFixed(2)})  Trades: ${c.baseline.trades} → ${c.withFvg.trades}`);
    });
  log('');
}

log('═══════════════════════════════════════════════════════════════════════════════');
log('  Done.');
log('');

process.exit(0);
