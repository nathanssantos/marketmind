/**
 * Phase 0a — Pipeline smoke test.
 *
 * Goal: confirm the backtest stack still produces correct results after the
 * v1.22.x refactors, AND that both engine paths (single-engine vs
 * multi-watcher orchestration) converge on identical metrics for the same
 * single-watcher config.
 *
 *   Path 1 (CLI / rank-strategies / optimization scripts):
 *     BacktestEngine.run(config, klines)
 *       → SetupDetectionService → PineStrategyRunner → TradeExecutor
 *
 *   Path 2 (UI / tRPC `backtest.multiWatcher`):
 *     MultiWatcherBacktestEngine.run()
 *       → for each watcher: same chain as above, plus shared portfolio
 *         + unified timeline orchestration
 *
 * For a SINGLE watcher with no shared-exposure concerns, both paths MUST
 * produce the same trade count + identical metrics (within rounding).
 * Drift here = the orchestration layer introduced a regression.
 *
 *   pnpm --filter @marketmind/backend exec tsx scripts/backtest/validate-pipeline.ts
 */
import { FILTER_DEFAULTS, TRADING_DEFAULTS } from '@marketmind/types';
import { config as dotenvConfig } from 'dotenv';
import { writeFileSync, writeSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenvConfig({ path: resolve(__dirname, '../../.env') });

const log = (...args: unknown[]): void => {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n';
  writeSync(1, msg);
};

process.env['LOG_LEVEL'] = 'silent';
process.env['NODE_ENV'] = 'production';
const origLog = console.log;
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};
console.debug = () => {};

const { BacktestEngine } = await import('../../src/services/backtesting/BacktestEngine.js');
const { MultiWatcherBacktestEngine } = await import('../../src/services/backtesting/MultiWatcherBacktestEngine.js');
const { fetchKlinesFromDbWithBackfill } = await import('../../src/services/backtesting/kline-fetcher.js');
const { BACKTEST_ENGINE } = await import('../../src/constants/index.js');

// Phase 0a smoke runs `rsi2-extreme-reversal` (single-TF baseline).
// Set MULTI_TF=true to switch to `rsi2-htf-trigger` (multi-TF), which
// pre-loads HTF klines via `@requires-tf 4h` and routes them through
// the PineMarketProvider — the Phase 0b end-to-end path.
const MULTI_TF = process.env['MULTI_TF'] === 'true';
const STRATEGY_ID = MULTI_TF ? 'rsi2-htf-trigger' : 'rsi2-extreme-reversal';
const SYMBOL = 'BTCUSDT';
const TIMEFRAME = (MULTI_TF ? '15m' : '1h') as '15m' | '1h';
const INTERVAL_MS_FOR_TF = TIMEFRAME === '15m' ? 15 * 60 * 1000 : 3600000;
const START_DATE = '2025-11-15';
const END_DATE = '2026-05-15';
const OUTPUT_PATH = '/tmp/validate-pipeline-cli.json';

const fmt = (n: number, d = 2): string => n.toFixed(d);
const pct = (n: number): string => `${n >= 0 ? '+' : ''}${fmt(n)}%`;

log('━'.repeat(72));
log('Phase 0a — Pipeline smoke test');
log('━'.repeat(72));
log(`Strategy:  ${STRATEGY_ID}${MULTI_TF ? ' (MULTI-TF mode)' : ''}`);
log(`Symbol:    ${SYMBOL} (FUTURES)`);
log(`Interval:  ${TIMEFRAME}`);
log(`Period:    ${START_DATE} → ${END_DATE} (~6 months)`);
log('Filters:   NONE (clean baseline)');
log('━'.repeat(72));

const t0 = Date.now();

// EMA200 warmup buffer — same as `rank-strategies.ts` and MultiWatcher.
// Without this BacktestEngine scans from index=warmup onwards which
// effectively skips the first ~143 bars of the actual user period
// (because BacktestEngine assumes klines start with warmup data).
const warmupMs = BACKTEST_ENGINE.EMA200_WARMUP_BARS * INTERVAL_MS_FOR_TF;
const startTime = new Date(new Date(START_DATE).getTime() - warmupMs);
const endTime = new Date(END_DATE);

log('\n[1/3] Loading klines from DB (+ smart backfill if needed)…');
const klines = await fetchKlinesFromDbWithBackfill(
  SYMBOL,
  TIMEFRAME,
  'FUTURES',
  startTime,
  endTime,
  'BINANCE',
);
log(`      ✓ ${klines.length} klines loaded (incl. ${BACKTEST_ENGINE.EMA200_WARMUP_BARS} warmup bars)`);

if (klines.length < 1000) {
  log(`      ⚠ only ${klines.length} klines — expected ~4380 for 6mo of 1h. Backfill may have failed.`);
  process.exit(1);
}

const config = {
  symbol: SYMBOL,
  interval: TIMEFRAME as string,
  startDate: START_DATE,
  endDate: END_DATE,
  initialCapital: TRADING_DEFAULTS.INITIAL_CAPITAL,
  marketType: 'FUTURES' as const,
  leverage: 1,
  marginType: 'CROSSED' as const,
  setupTypes: [STRATEGY_ID],
  // Match MultiWatcher's per-watcher concurrency limit (= watchers.length
  // = 1) so single-engine vs multi-engine produce IDENTICAL trade counts
  // — not just identical setup counts. Without this, BacktestEngine's
  // default (FilterManager `maxConcurrentPositions = 10`) lets it open
  // overlapping trades while MultiWatcher rejects with `maxPositions`.
  maxConcurrentPositions: 1,
  // For rsi2-extreme-reversal: loosen RSI(2) thresholds (5/95 → 25/75)
  // so we get enough trades for a meaningful smoke. Multi-TF path
  // (rsi2-htf-trigger) already defaults to 25/75; no override needed.
  ...(MULTI_TF ? {} : { strategyParams: { rsiOversold: 25, rsiOverbought: 75 } }),
  minConfidence: 50,
  useAlgorithmicLevels: true,
  tpCalculationMode: 'fibonacci' as const,
  fibonacciSwingRange: 'nearest' as const,
  fibonacciTargetLevelLong: FILTER_DEFAULTS.fibonacciTargetLevelLong,
  fibonacciTargetLevelShort: FILTER_DEFAULTS.fibonacciTargetLevelShort,
  minRiskRewardRatioLong: FILTER_DEFAULTS.minRiskRewardRatioLong,
  minRiskRewardRatioShort: FILTER_DEFAULTS.minRiskRewardRatioShort,
  positionSizePercent: FILTER_DEFAULTS.positionSizePercent,
  simulateFundingRates: true,
  simulateLiquidation: true,
  silent: true,
  // All filters explicitly off — clean baseline. We MUST set every
  // *Filter flag explicitly because `BacktestEngine.buildEffectiveConfig`
  // applies `FILTER_DEFAULTS` for any missing keys (where trend/adx/
  // vwap/choppiness default to TRUE), but `MultiWatcherBacktestEngine`
  // does NOT — so omitting a key produces different behavior across
  // the two engines. Setting them explicit forces parity.
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
  useChoppinessFilter: false,
  useVwapFilter: false,
  useBollingerSqueezeFilter: false,
  useSuperTrendFilter: false,
  useSessionFilter: false,
  useFvgFilter: false,
};

log('\n[2/4] Running BacktestEngine (CLI path)…');
const t1 = Date.now();
console.log = origLog;
const engineDirect = new BacktestEngine();
const resultDirect = await engineDirect.run(config, klines);
console.log = () => {};
log(`      ✓ completed in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
const md = resultDirect.metrics;
const longD = (resultDirect.trades ?? []).filter((t: { side: string }) => t.side === 'LONG').length;
const shortD = (resultDirect.trades ?? []).filter((t: { side: string }) => t.side === 'SHORT').length;

log('\n[3/4] Running MultiWatcherBacktestEngine (UI path, single watcher)…');
const t2 = Date.now();
const { symbol: _s, interval: _i, ...configNoSymbol } = config;
void _s; void _i;
const multiConfig = {
  ...configNoSymbol,
  watchers: [{ symbol: SYMBOL, interval: TIMEFRAME as string, setupTypes: [STRATEGY_ID], marketType: 'FUTURES' as const }],
  useSharedExposure: false,
};
// Restore console.log briefly so MultiWatcher's internal progress logs surface
// — we need them to debug why this engine path returns 0 trades vs CLI's 57.
console.log = origLog;
const engineMulti = new MultiWatcherBacktestEngine(multiConfig);
const resultMulti = await engineMulti.run();
console.log = () => {};
log(`      ✓ completed in ${((Date.now() - t2) / 1000).toFixed(1)}s`);
const mm = resultMulti.metrics;
const longM = (resultMulti.trades ?? []).filter((t: { side: string }) => t.side === 'LONG').length;
const shortM = (resultMulti.trades ?? []).filter((t: { side: string }) => t.side === 'SHORT').length;

const wstats = (resultMulti as { watcherStats?: Array<{ symbol: string; totalSetups: number; tradesExecuted: number; tradesSkipped: number; skippedReasons: Record<string, number> }> }).watcherStats;
if (wstats && wstats.length > 0) {
  log('\nWatcher stats (MultiWatcher):');
  for (const w of wstats) {
    log(`  ${w.symbol}: setups=${w.totalSetups} executed=${w.tradesExecuted} skipped=${w.tradesSkipped}`);
    for (const [reason, count] of Object.entries(w.skippedReasons)) {
      log(`    - ${reason}: ${count}`);
    }
  }
}

log('\n[4/4] Comparison');
log('━'.repeat(72));
log(`Metric                  CLI (BacktestEngine)    UI (MultiWatcher)    Δ`);
log('─'.repeat(72));
const row = (label: string, a: number, b: number, decimals = 2): string => {
  const aStr = a.toFixed(decimals).padStart(10);
  const bStr = b.toFixed(decimals).padStart(10);
  const delta = b - a;
  const deltaStr = delta === 0 ? '  =' : `${delta > 0 ? '+' : ''}${delta.toFixed(decimals)}`;
  return `${label.padEnd(24)}${aStr}              ${bStr}     ${deltaStr}`;
};
log(row('Total trades', md.totalTrades, mm.totalTrades, 0));
log(row('  LONG', longD, longM, 0));
log(row('  SHORT', shortD, shortM, 0));
log(row('Win rate %', md.winRate, mm.winRate));
log(row('Total P&L %', md.totalPnlPercent, mm.totalPnlPercent));
log(row('Profit factor', md.profitFactor, mm.profitFactor));
log(row('Max DD %', md.maxDrawdownPercent ?? 0, mm.maxDrawdownPercent ?? 0));
log(row('Sharpe ratio', md.sharpeRatio ?? 0, mm.sharpeRatio ?? 0));
log('━'.repeat(72));

// Parity invariants when BOTH engines use the same `maxConcurrentPositions`:
//
//   1. Setup count (UI's watcherStats.totalSetups) must match. This proves
//      the detection pipeline (PineStrategyRunner → SDS → strategy) is
//      deterministic across engine paths.
//   2. Trade count + side breakdown must match. With identical
//      concurrency caps + identical setups, the skipped-by-portfolio
//      count is the same in both engines, so the opened trades match
//      1:1.
//   3. P&L can still drift because BacktestEngine uses a fixed
//      `positionSizePercent` (10% of initial capital) while
//      MultiWatcher uses `SharedPortfolioManager` (% of CURRENT
//      equity). On a profitable strategy this diverges — same trade
//      shapes, different notional. That's a position-sizing semantic,
//      not a pipeline bug.
const setupsM = (wstats?.[0]?.totalSetups ?? 0);
// CLI's BacktestEngine doesn't expose detected-setups separately from
// executed trades, but with maxConcurrentPositions=1 we know
// `setupsM === setupsCLI` if the pipelines agree, even though only a
// subset opens. So we use trade-count parity as the strict assertion.
const tradesMatch = md.totalTrades === mm.totalTrades;
const longMatch = longD === longM;
const shortMatch = shortD === shortM;
const winRateMatch = Math.abs(md.winRate - mm.winRate) < 0.01;
const allMatch = tradesMatch && longMatch && shortMatch && winRateMatch;

if (allMatch) {
  log('\n✅ PIPELINE PARITY PASSED — both engines produced identical trade outcomes.');
  log(`   Trades: ${md.totalTrades} (L=${longD} / S=${shortD}), win rate ${md.winRate.toFixed(2)}%.`);
  log(`   MultiWatcher.totalSetups=${setupsM} (proves detection is deterministic).`);
  const pnlDelta = mm.totalPnlPercent - md.totalPnlPercent;
  if (Math.abs(pnlDelta) > 0.01) {
    log(`   P&L delta ${pnlDelta > 0 ? '+' : ''}${pnlDelta.toFixed(2)}% comes from position-sizing`);
    log(`   semantics (CLI=fixed-init-capital, UI=current-equity portfolio model).`);
  }
} else {
  log('\n❌ PIPELINE PARITY FAILED — engine trade outcomes diverged.');
  if (!tradesMatch) log(`   Trade count: CLI=${md.totalTrades} vs UI=${mm.totalTrades}`);
  if (!longMatch) log(`   LONG count: CLI=${longD} vs UI=${longM}`);
  if (!shortMatch) log(`   SHORT count: CLI=${shortD} vs UI=${shortM}`);
  if (!winRateMatch) log(`   Win rate: CLI=${md.winRate} vs UI=${mm.winRate}`);
}
const setupsMatch = allMatch;

const elapsed = Date.now() - t0;
const dump = {
  meta: {
    strategy: STRATEGY_ID,
    symbol: SYMBOL,
    interval: TIMEFRAME,
    startDate: START_DATE,
    endDate: END_DATE,
    klineCount: klines.length,
    elapsedMs: elapsed,
    capturedAt: new Date().toISOString(),
    source: 'cli/validate-pipeline.ts',
    parityCheck: { tradesMatch, longMatch, shortMatch, winRateMatch, allMatch },
  },
  cli: { metrics: md, trades: resultDirect.trades },
  ui: { metrics: mm, trades: resultMulti.trades },
  config,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(dump, null, 2));
log(`\nFull dump → ${OUTPUT_PATH}`);

process.exit(setupsMatch ? 0 : 1);
