/**
 * Phase 0a — Pipeline smoke test.
 *
 * Goal: confirm the backtest stack (kline loading + SetupDetectionService +
 * PineStrategyRunner + BacktestEngine + TradeExecutor) still produces correct
 * results after the v1.22.x refactors. Picks `rsi2-extreme-reversal` because
 * it's the closest existing strategy to what we're building next (RSI(2)
 * extremes + swing low/high stop), and runs it on BTC futures 1h × 6 months
 * with NO filters — clean baseline.
 *
 * Output: a JSON dump to /tmp/validate-pipeline-cli.json so we can diff
 * against the UI run (manually triggered via BacktestDialog with identical
 * config) and confirm both paths converge to the same metrics.
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
console.log = () => {};
console.info = () => {};
console.warn = () => {};
console.error = () => {};
console.debug = () => {};

const { BacktestEngine } = await import('../../src/services/backtesting/BacktestEngine.js');
const { fetchKlinesFromDbWithBackfill } = await import('../../src/services/backtesting/kline-fetcher.js');

const STRATEGY_ID = 'rsi2-extreme-reversal';
const SYMBOL = 'BTCUSDT';
const TIMEFRAME = '1h' as const;
const START_DATE = '2025-11-15';
const END_DATE = '2026-05-15';
const OUTPUT_PATH = '/tmp/validate-pipeline-cli.json';

const fmt = (n: number, d = 2): string => n.toFixed(d);
const pct = (n: number): string => `${n >= 0 ? '+' : ''}${fmt(n)}%`;

log('━'.repeat(72));
log('Phase 0a — Pipeline smoke test');
log('━'.repeat(72));
log(`Strategy:  ${STRATEGY_ID}`);
log(`Symbol:    ${SYMBOL} (FUTURES)`);
log(`Interval:  ${TIMEFRAME}`);
log(`Period:    ${START_DATE} → ${END_DATE} (~6 months)`);
log('Filters:   NONE (clean baseline)');
log('━'.repeat(72));

const t0 = Date.now();

const startTime = new Date(START_DATE);
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
log(`      ✓ ${klines.length} klines loaded`);

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
  // Loosen RSI(2) thresholds so we get enough trades for a meaningful
  // smoke test. Default 5/95 fires only on the most violent extremes
  // (got 2 trades in 6mo); 25/75 is a classic mean-reversion band that
  // still selects oversold/overbought territory but gives ~30-60 trades.
  // This is a SMOKE test config — for real strategy validation we'd
  // sweep these via the optimizer.
  strategyParams: {
    rsiOversold: 25,
    rsiOverbought: 75,
  },
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
  // All filters explicitly off — clean baseline
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
};

log('\n[2/3] Running BacktestEngine…');
const engine = new BacktestEngine();
const result = await engine.run(config, klines);
const elapsed = Date.now() - t0;
log(`      ✓ completed in ${(elapsed / 1000).toFixed(1)}s`);

const m = result.metrics;
const longTrades = (result.trades ?? []).filter((t: { side: string }) => t.side === 'LONG');
const shortTrades = (result.trades ?? []).filter((t: { side: string }) => t.side === 'SHORT');

log('\n[3/3] Results');
log('━'.repeat(72));
log(`Total trades:        ${m.totalTrades}`);
log(`  LONG:              ${longTrades.length}`);
log(`  SHORT:             ${shortTrades.length}`);
log(`Win rate:            ${pct(m.winRate)}`);
log(`Total P&L:           ${pct(m.totalPnlPercent)}`);
log(`Profit factor:       ${fmt(m.profitFactor)}`);
log(`Max drawdown:        ${pct(m.maxDrawdownPercent ?? 0)}`);
log(`Sharpe ratio:        ${fmt(m.sharpeRatio ?? 0)}`);
log(`Avg trade P&L:       ${pct(m.avgTradePnlPercent ?? 0)}`);
log('━'.repeat(72));

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
  },
  metrics: m,
  config,
  trades: result.trades,
};

writeFileSync(OUTPUT_PATH, JSON.stringify(dump, null, 2));
log(`\nFull dump → ${OUTPUT_PATH}`);
log(`\nNext: open BacktestDialog in the app, configure the SAME params, run,`);
log(`      and compare metrics. They MUST match within rounding tolerance.`);

process.exit(0);
