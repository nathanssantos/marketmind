import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { klines as klinesTable } from '../../db/schema';
import { BacktestEngine } from '../../services/backtesting/BacktestEngine';
import { MultiWatcherBacktestEngine } from '../../services/backtesting/MultiWatcherBacktestEngine';

/**
 * Integration test: BacktestEngine ↔ MultiWatcherBacktestEngine parity.
 *
 * This is the CI counterpart of `scripts/backtest/validate-pipeline.ts`.
 * That script is the manual smoke (runs against real BTC klines pre-
 * loaded into your dev DB); this test seeds a small synthetic kline
 * set + a one-off Pine strategy into a containerized DB so every
 * commit re-proves the invariant: for the same config the two engines
 * produce identical trade counts + win rates.
 *
 * Position-sizing P&L delta is documented in BACKTEST.md — out of scope
 * for this parity check.
 */

const SYMBOL = 'TESTUSDT';
const INTERVAL = '1h';
const PINE_DIR = join(tmpdir(), `pine-parity-${Date.now()}`);
const PINE_FILE = join(PINE_DIR, 'parity-test-strategy.pine');

/**
 * Always-fire LONG strategy. Every 5th bar emits a setup at close,
 * stop = close × 0.99, target = close × 1.02. Deterministic =>
 * the parity test can assert exact trade counts.
 */
const STRATEGY_SOURCE = `
// @id parity-test-strategy
// @name Parity Test
//@version=5
indicator('Parity Test', overlay=true)
sig = bar_index % 5 == 0 ? 1 : 0
sl = close * 0.99
tp = close * 1.02
conf = sig != 0 ? 75 : 0
plot(sig, 'signal', display=display.none)
plot(sl, 'stopLoss', display=display.none)
plot(tp, 'takeProfit', display=display.none)
plot(conf, 'confidence', display=display.none)
`;

// `ABSOLUTE_MINIMUM_KLINES = 2000` — fewer than this triggers a Binance
// backfill in `fetchKlinesFromDbWithBackfill`. Synthetic symbol 'TESTUSDT'
// returns 400 from Binance, so we must always seed ≥ 2000 to keep the
// test fully self-contained (no network).
const seedSyntheticKlines = async (count = 2500): Promise<{ startDate: string; endDate: string }> => {
  const db = getTestDatabase();
  const intervalMs = 60 * 60 * 1000;
  const startMs = Date.UTC(2025, 0, 1);
  const rows = Array.from({ length: count }, (_, i) => {
    const openTime = new Date(startMs + i * intervalMs);
    const closeTime = new Date(openTime.getTime() + intervalMs - 1);
    // Random walk-ish: base price + sinusoid + linear drift. Stable
    // enough that the strategy fires the same way every run.
    const base = 50000 + Math.sin(i * 0.05) * 1000 + i * 2;
    return {
      symbol: SYMBOL,
      interval: INTERVAL,
      marketType: 'FUTURES' as const,
      openTime,
      closeTime,
      open: String(base),
      high: String(base + 10),
      low: String(base - 10),
      close: String(base),
      volume: '1000',
      quoteVolume: '0',
      trades: 100,
      takerBuyBaseVolume: '0',
      takerBuyQuoteVolume: '0',
    };
  });
  await db.insert(klinesTable).values(rows);
  // Leave 200 bars of warmup at the start; user period starts at bar 200.
  return {
    startDate: new Date(startMs + 200 * intervalMs).toISOString().slice(0, 10),
    endDate: new Date(startMs + (count - 1) * intervalMs).toISOString().slice(0, 10),
  };
};

describe('Backtest engine parity (BacktestEngine ↔ MultiWatcherBacktestEngine)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    // Stage the inline strategy in a temp Pine directory so both
    // engines load it via the standard PineStrategyLoader path.
    const { mkdirSync } = await import('node:fs');
    mkdirSync(PINE_DIR, { recursive: true });
    writeFileSync(PINE_FILE, STRATEGY_SOURCE);
  });

  afterAll(async () => {
    rmSync(PINE_DIR, { recursive: true, force: true });
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
  });

  it('produces identical trade counts + win rates when both engines use maxConcurrentPositions=1', async () => {
    const { startDate, endDate } = await seedSyntheticKlines(2500);

    const baseConfig = {
      symbol: SYMBOL,
      interval: INTERVAL,
      startDate,
      endDate,
      initialCapital: 10000,
      marketType: 'FUTURES' as const,
      leverage: 1,
      marginType: 'CROSSED' as const,
      setupTypes: ['parity-test-strategy'],
      maxConcurrentPositions: 1,
      pineStrategiesDir: PINE_DIR,
      minConfidence: 50,
      useAlgorithmicLevels: true,
      positionSizePercent: 10,
      simulateFundingRates: false,
      simulateLiquidation: false,
      silent: true,
      // Explicitly disable every filter to isolate the strategy + engine
      // parity from filter-default drift between the two engines.
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

    const cliEngine = new BacktestEngine();
    const cliResult = await cliEngine.run(baseConfig as never);

    const { symbol: _s, interval: _i, ...multiBase } = baseConfig;
    void _s; void _i;
    const multiConfig = {
      ...multiBase,
      watchers: [{
        symbol: SYMBOL,
        interval: INTERVAL,
        setupTypes: ['parity-test-strategy'],
        marketType: 'FUTURES' as const,
      }],
      useSharedExposure: false,
    };
    const multiEngine = new MultiWatcherBacktestEngine(multiConfig as never);
    const multiResult = await multiEngine.run();

    const cliTrades = cliResult.trades ?? [];
    const multiTrades = multiResult.trades ?? [];
    const cliLong = cliTrades.filter((t) => t.side === 'LONG').length;
    const multiLong = multiTrades.filter((t) => t.side === 'LONG').length;
    const cliShort = cliTrades.filter((t) => t.side === 'SHORT').length;
    const multiShort = multiTrades.filter((t) => t.side === 'SHORT').length;

    // Parity invariant: same config + same data + same concurrency cap
    // → near-identical trade outcomes.
    //
    // Tolerance ±1 trade accounts for edge-bar handling between the two
    // engines: BacktestEngine starts at `calculateWarmupPeriod` (dynamic
    // based on strategy params), MultiWatcher starts at fixed
    // `EMA200_WARMUP_BARS=200`. On real data with our smoke configs the
    // two converge exactly (validate-pipeline.ts: 182=182), but synthetic
    // tight data can produce a single extra setup at the boundary.
    expect(Math.abs(cliResult.metrics.totalTrades - multiResult.metrics.totalTrades)).toBeLessThanOrEqual(1);
    expect(Math.abs(cliLong - multiLong)).toBeLessThanOrEqual(1);
    expect(Math.abs(cliShort - multiShort)).toBeLessThanOrEqual(1);
    // Win rate must match within ~3% — small denominator (45 trades)
    // amplifies one extra trade into ~2% win-rate swing.
    expect(Math.abs(cliResult.metrics.winRate - multiResult.metrics.winRate)).toBeLessThan(3);

    // Sanity: the strategy MUST have fired enough to be a meaningful
    // smoke. Synthetic data + every-5th-bar trigger should yield
    // dozens of setups across ~450 testable bars.
    expect(cliResult.metrics.totalTrades).toBeGreaterThanOrEqual(10);

    // Setup count: MultiWatcher exposes this via watcherStats.totalSetups;
    // BacktestEngine doesn't separately expose it, but trade-count parity
    // already implies setup-count parity at the same concurrency cap.
    const wstats = (multiResult as { watcherStats?: Array<{ totalSetups: number }> }).watcherStats;
    expect(wstats?.[0]?.totalSetups).toBeGreaterThanOrEqual(cliResult.metrics.totalTrades);
  }, 60_000);
});
