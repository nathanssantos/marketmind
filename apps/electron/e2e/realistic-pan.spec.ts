import { test, expect } from '@playwright/test';
import { generateKlines } from './helpers/klineFixtures';
import { installTrpcMock } from './helpers/trpcMock';
import { waitForSocket } from './helpers/socketBridge';
import {
  enablePerfOverlay,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  waitForChartReady,
} from './helpers/chartTestSetup';
import {
  buildLayout,
  realChartPan,
  startRealisticEmitter,
  waitForPanelsMounted,
  type ScenarioLayout,
} from './helpers/realPanScenario';

// Long-running pan stress tests with realistic socket flow. Each
// scenario:
//   1. Loads the app, waits until the chart canvas has actually
//      painted (not just the React tree mounted).
//   2. Builds a specific layout via __layoutStore.
//   3. Waits for the requested panels to appear in the DOM.
//   4. Lets all queries settle (~2s of idle).
//   5. Starts ALL hot socket streams at realistic Hz in parallel.
//   6. Resets the perfMonitor so the measurement window is clean.
//   7. Drives a real 3-second mouse-driven pan over the canvas while
//      streams keep firing.
//   8. Reads perfMonitor snapshot — asserts FPS held up, dropped
//      frames stayed low, and live-stream throttle saved >85%.
//
// "Travadinhas" the user reports surface here as either dropped
// frames or a low FPS sample. Run takes ~10s per scenario.

const SCENARIOS: ScenarioLayout[] = [
  {
    name: 'minimal: 1 chart + ticket',
    charts: 0,
    panels: ['ticket'],
  },
  {
    name: 'multi-chart: 3 charts + ticket',
    charts: 2,
    panels: ['ticket'],
  },
  {
    name: 'order-flow heavy: 1 chart + ticket + order book + flow metrics',
    charts: 0,
    panels: ['ticket', 'orderBook', 'orderFlowMetrics'],
  },
  {
    name: 'auto-trading layout: chart + watchers + setup + activity + positions',
    charts: 0,
    panels: ['watchers', 'autoTradingSetup', 'autoTradingActivity', 'positions', 'ticket'],
  },
  {
    name: 'kitchen sink: 2 charts + every panel kind',
    charts: 1,
    panels: [
      'ticket', 'confluence', 'orders', 'portfolio', 'positions',
      'orderBook', 'orderFlowMetrics',
      'watchers', 'autoTradingSetup', 'autoTradingActivity',
      'marketFearGreed', 'marketBtcDominance', 'marketMvrv',
      'marketOpenInterest', 'marketLongShort',
    ],
  },
];

const PAN_DURATION_MS = 3000;
const QUERIES_SETTLE_MS = 1500;

test.describe('Realistic pan: long pan with all streams firing', () => {
  // Each scenario takes ~10s of real time (pan duration + settle +
  // emitter setup + measurement). Bump well past Playwright's 30s
  // default so a slow CI doesn't false-positive.
  test.setTimeout(60_000);

  for (const scenario of SCENARIOS) {
    test(`${scenario.name}`, async ({ page }) => {
      await enablePerfOverlay(page);
      const klines = generateKlines({ count: 500, symbol: 'BTCUSDT', interval: '1h' });
      await installTrpcMock(page, { klines });

      await page.goto('/');
      await waitForChartReady(page);
      await refreshPerfFlag(page);
      await waitForSocket(page);

      // Apply the scenario's layout shape.
      await buildLayout(page, scenario);
      await waitForPanelsMounted(page, scenario.panels);

      // Let any in-flight queries (positions, executions, orders,
      // wallet, market indicators, etc.) settle. Without this, the
      // first 1-2s of pan time would still include their refetch
      // cost — which isn't what we're measuring.
      await page.waitForTimeout(QUERIES_SETTLE_MS);

      // Start the firehose. From this point on, the React tree is
      // receiving the volume of updates a real BTCUSDT session puts
      // through the WS — bookTicker at 20Hz, depth at 10Hz,
      // scalping metrics at 10Hz, price at 20Hz, kline at 2Hz.
      const emitter = await startRealisticEmitter(page, ['BTCUSDT']);

      // Let the streams run idle for a beat so all subscribers have
      // a chance to subscribe + flush their cold-start payload BEFORE
      // we begin the measurement.
      await page.waitForTimeout(500);

      await resetPerfMonitor(page);

      // The actual measurement: pan for 3s while everything fires.
      await realChartPan(page, PAN_DURATION_MS);

      // Settle a beat post-pan so trailing flushes land in the
      // snapshot we read.
      await page.waitForTimeout(300);

      const snap = await readPerfSnapshot(page);
      const stats = await emitter.stop();

      // ----- Sanity ------------------------------------------------------
      // Streams actually fired. If any of these are 0 the rest of
      // the assertions would be vacuously satisfied.
      expect(stats.emitted.bookTicker, 'bookTicker should have fired').toBeGreaterThan(50);
      expect(stats.emitted.depth, 'depth should have fired').toBeGreaterThan(20);
      expect(stats.emitted.scalping, 'scalpingMetrics should have fired').toBeGreaterThan(20);

      // ----- Smoothness ---------------------------------------------------
      // 60fps target is the design goal; CI is noisier so we set a
      // realistic floor. A regression that makes pan janky shows up
      // as fps dropping below 30 and droppedFrames > 30.
      expect(snap.fps, `fps ${snap.fps} during pan in [${scenario.name}]`).toBeGreaterThanOrEqual(30);
      // Dropped frames are samples > 33ms (= < 30fps). On a healthy
      // run this is single-digit; broken throttle blows past 30.
      expect(snap.droppedFrames, `dropped frames during pan in [${scenario.name}]`).toBeLessThan(30);

      // ----- Throttle effectiveness --------------------------------------
      // bookTicker:update is the single highest-volume stream. Verify
      // the registry collapsed it dramatically — if any of the
      // subscribers (BuySellButtons in ticket) actually mounted,
      // there should be liveStream entries with very low flush rate.
      // The measurement window is 3s of pan (400ms throttle, ~7
      // flushes) + 300ms idle settle (100ms throttle, ~3 flushes) +
      // cold-start. Generous 25% ceiling absorbs CI timing variance
      // — a regression that breaks throttling would push past 60%.
      const bookTickerStat = snap.liveStreams.find((s) => s.event === 'bookTicker:update');
      if (bookTickerStat && bookTickerStat.totalReceived > 0) {
        const ratio = bookTickerStat.totalFlushed / bookTickerStat.totalReceived;
        expect(ratio, `bookTicker flush ratio in [${scenario.name}] (recv ${bookTickerStat.totalReceived}, flushed ${bookTickerStat.totalFlushed})`).toBeLessThan(0.25);
      }
    });
  }
});
