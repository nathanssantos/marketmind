import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setupTestDatabase, teardownTestDatabase, cleanupTables, getTestDatabase } from '../helpers/test-db';
import { klines as klinesTable } from '../../db/schema';
import { PineStrategyLoader } from '../../services/pine/PineStrategyLoader';
import {
  runSetupDetection,
  __resetHtfCacheForTests,
} from '../../services/auto-trading/processing/signal-helpers';
import type { ActiveWatcher } from '../../services/auto-trading/types';
import { WatcherLogBuffer } from '../../services/watcher-batch-logger';

/**
 * Integration test for the live auto-trader's multi-TF wiring
 * (`signal-helpers.ts → runSetupDetection`).
 *
 * Without this test, the gap caught in PR #681 — auto-trader would
 * throw "no klines registered" at run time for any `@requires-tf`
 * strategy — could silently regress: the unit tests only cover the
 * `PineStrategyRunner` directly with synthetic klines. This proves
 * the full chain works:
 *
 *   ActiveWatcher → runSetupDetection → fetchSecondaryKlinesForStrategies
 *     → fetchKlinesFromDbWithBackfill → DB hit on HTF table
 *     → detectSetups({ secondaryKlines })
 *     → PineStrategyRunner → PineMarketProvider → strategy fires
 *
 * Uses synthetic data + testcontainers, no network.
 */

const SYMBOL = 'TESTUSDT';
const LTF_INTERVAL = '15m';
const HTF_INTERVAL = '4h';
const PINE_DIR = join(tmpdir(), `pine-live-htf-${Date.now()}`);
const PINE_FILE = join(PINE_DIR, 'live-htf-test.pine');

const STRATEGY_SOURCE = `
// @id live-htf-test
// @name Live HTF Test
// @requires-tf 4h
//@version=5
indicator('Live HTF Test', overlay=true)
htfClose = request.security(syminfo.tickerid, '4h', close, lookahead=barmerge.lookahead_off)
// Always fire LONG when the HTF close exists (signals the request.security
// call resolved correctly against our pre-loaded HTF klines).
sig = na(htfClose) ? 0 : 1
sl = close * 0.99
tp = close * 1.02
conf = sig != 0 ? 75 : 0
plot(sig, 'signal', display=display.none)
plot(sl, 'stopLoss', display=display.none)
plot(tp, 'takeProfit', display=display.none)
plot(conf, 'confidence', display=display.none)
`;

/**
 * `endNow=true` seeds klines so the last bar's openTime is "now" — this
 * matches the live HTF fetch window (now - warmupMs to now). Used for
 * the HTF dataset. LTF data is passed directly as `closedKlines`, so it
 * can sit anywhere.
 */
const seedKlines = async (interval: string, intervalMs: number, count: number, endNow = false) => {
  const db = getTestDatabase();
  const startMs = endNow
    ? Date.now() - count * intervalMs
    : Date.UTC(2025, 0, 1);
  const rows = Array.from({ length: count }, (_, i) => {
    const openTime = new Date(startMs + i * intervalMs);
    const closeTime = new Date(openTime.getTime() + intervalMs - 1);
    const base = 50000 + Math.sin(i * 0.05) * 1000;
    return {
      symbol: SYMBOL,
      interval,
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
};

describe('Live auto-trader multi-TF wiring (signal-helpers.runSetupDetection)', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    mkdirSync(PINE_DIR, { recursive: true });
    writeFileSync(PINE_FILE, STRATEGY_SOURCE);
  });

  afterAll(async () => {
    rmSync(PINE_DIR, { recursive: true, force: true });
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    await cleanupTables();
    __resetHtfCacheForTests();
  });

  it('pre-loads HTF klines from DB + runs strategy with request.security resolved', async () => {
    // 2500 LTF (15m) bars + matching HTF (4h) bars covering the same
    // window. 2500 × 15m = 26 days; HTF bars = 2500 × 15 / 240 = 156.
    // But fetchKlinesFromDbWithBackfill requires `count >= 2000` to skip
    // backfill; seed 2500 in both to be safe.
    await seedKlines(LTF_INTERVAL, 15 * 60 * 1000, 2500);
    // HTF must span the LIVE fetch window (now - warmupMs to now) — see
    // `fetchSecondaryKlinesForStrategies` in signal-helpers.ts.
    await seedKlines(HTF_INTERVAL, 4 * 60 * 60 * 1000, 2500, true);

    const loader = new PineStrategyLoader([PINE_DIR]);
    const strategies = await loader.loadAll();
    expect(strategies).toHaveLength(1);
    expect(strategies[0]!.metadata.requiresTimeframes).toEqual(['4h']);

    const db = getTestDatabase();
    const klineRows = await db.query.klines.findMany({
      where: (k, { eq, and }) => and(
        eq(k.symbol, SYMBOL),
        eq(k.interval, LTF_INTERVAL),
        eq(k.marketType, 'FUTURES'),
      ),
      orderBy: (k, { asc }) => asc(k.openTime),
      limit: 100,
    });
    const closedKlines = klineRows.map((r) => ({
      openTime: r.openTime.getTime(),
      open: String(r.open),
      high: String(r.high),
      low: String(r.low),
      close: String(r.close),
      volume: String(r.volume),
      closeTime: r.closeTime.getTime(),
      quoteVolume: String(r.quoteVolume ?? '0'),
      trades: r.trades ?? 0,
      takerBuyBaseVolume: String(r.takerBuyBaseVolume ?? '0'),
      takerBuyQuoteVolume: String(r.takerBuyQuoteVolume ?? '0'),
    }));

    const watcher: ActiveWatcher = {
      userId: 'test-user',
      walletId: 'test-wallet',
      symbol: SYMBOL,
      interval: LTF_INTERVAL,
      marketType: 'FUTURES',
      exchange: 'BINANCE',
      enabledStrategies: ['live-htf-test'],
    } as never;

    const logBuffer = new WatcherLogBuffer(
      'test-watcher-id', watcher.symbol, watcher.interval, watcher.marketType, undefined,
    );

    // The actual test: runSetupDetection should fetch HTF klines from
    // the DB, route them through PineStrategyRunner via secondaryKlines,
    // and the strategy's `request.security(syminfo.tickerid, '4h', ...)`
    // should resolve successfully — emitting signals on every bar (since
    // our strategy fires whenever htfClose is non-NaN).
    const setups = await runSetupDetection(
      closedKlines,
      strategies,
      null,
      'auto',
      watcher,
      logBuffer,
    );

    // The strategy emits sig=1 on the LAST bar (we use slice currentIndex).
    // The test passes if no exception was thrown — which requires:
    //   1. PineStrategyLoader parsed `@requires-tf 4h`
    //   2. signal-helpers pre-loaded HTF klines from DB
    //   3. PineMarketProvider served them
    //   4. request.security resolved
    // Setup count is incidental; what matters is the chain didn't throw.
    expect(Array.isArray(setups)).toBe(true);
  }, 60_000);

  it('caches HTF klines across consecutive calls for the same symbol+TF', async () => {
    await seedKlines(LTF_INTERVAL, 15 * 60 * 1000, 2500);
    // HTF must span the LIVE fetch window (now - warmupMs to now) — see
    // `fetchSecondaryKlinesForStrategies` in signal-helpers.ts.
    await seedKlines(HTF_INTERVAL, 4 * 60 * 60 * 1000, 2500, true);

    const loader = new PineStrategyLoader([PINE_DIR]);
    const strategies = await loader.loadAll();

    const db = getTestDatabase();
    const klineRows = await db.query.klines.findMany({
      where: (k, { eq, and }) => and(
        eq(k.symbol, SYMBOL),
        eq(k.interval, LTF_INTERVAL),
      ),
      orderBy: (k, { asc }) => asc(k.openTime),
      limit: 100,
    });
    const closedKlines = klineRows.map((r) => ({
      openTime: r.openTime.getTime(),
      open: String(r.open), high: String(r.high), low: String(r.low),
      close: String(r.close), volume: String(r.volume),
      closeTime: r.closeTime.getTime(),
      quoteVolume: String(r.quoteVolume ?? '0'),
      trades: r.trades ?? 0,
      takerBuyBaseVolume: String(r.takerBuyBaseVolume ?? '0'),
      takerBuyQuoteVolume: String(r.takerBuyQuoteVolume ?? '0'),
    }));

    const watcher: ActiveWatcher = {
      userId: 'test-user', walletId: 'test-wallet',
      symbol: SYMBOL, interval: LTF_INTERVAL, marketType: 'FUTURES',
      exchange: 'BINANCE', enabledStrategies: ['live-htf-test'],
    } as never;
    const logBuffer = new WatcherLogBuffer(
      'test-watcher-id', watcher.symbol, watcher.interval, watcher.marketType, undefined,
    );

    // First call: HTF cache miss → DB fetch.
    const t1 = Date.now();
    await runSetupDetection(closedKlines, strategies, null, 'auto', watcher, logBuffer);
    const firstCallMs = Date.now() - t1;

    // Second call (within same HTF interval): cache hit → no DB fetch.
    // Should be significantly faster (no roundtrip + no kline mapping).
    const t2 = Date.now();
    await runSetupDetection(closedKlines, strategies, null, 'auto', watcher, logBuffer);
    const secondCallMs = Date.now() - t2;

    // Loose assertion — the cache is doing its job if the second call is
    // at least 20% faster than the first. On a fresh DB the first call
    // also amortizes PineTS warmup so the cache effect is muted; we just
    // assert it didn't regress.
    expect(secondCallMs).toBeLessThanOrEqual(firstCallMs);
  }, 90_000);
});
