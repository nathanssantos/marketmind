import { test, expect } from '@playwright/test';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture } from '../helpers/consoleCapture';
import {
  addIndicators,
  clearIndicators,
  componentRenderRate,
  componentRenderTotal,
  driveFrames,
  drivePan,
  enableChartQuickTrade,
  enablePerfOverlay,
  pushPriceTicks,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  slowestSectionMs,
  waitForChartReady,
} from '../helpers/chartTestSetup';
import {
  WARMUP_FRAMES,
  TICK_STORM_SYMBOLS,
  writeRunResult,
  writeDiagnose,
} from './harness';

/**
 * Reproduces the user's reported pan-stutter scenario:
 *
 *   - Open futures wallet with one open position (LONG BTCUSDT)
 *   - SL + TP algo orders attached to that position
 *   - 5 indicators mounted (SMA / EMA / RSI / MACD / BB)
 *   - Concurrent price tick storm across 10 symbols (live PnL flicker)
 *   - User pans the chart for ~4 seconds
 *
 * Captures: render rate of ChartCanvas + key sibling components
 * (Portfolio, OrdersList, FuturesQuickTradeToolbar) to identify which
 * subscriber chains light up under combined load. The synthetic
 * tick-storm test in sibling-renders.spec.ts shows clean numbers (0/s)
 * because no position is open — siblings short-circuit when there's
 * nothing to render.
 */

const FAKE_WALLET_ID = 'wallet-perf-1';
const SYMBOL = 'BTCUSDT';
const PAN_FRAMES = 240;

const FAKE_WALLET = {
  id: FAKE_WALLET_ID,
  userId: 'user-perf',
  name: 'Perf Wallet',
  walletType: 'live',
  marketType: 'FUTURES',
  exchange: 'binance',
  isActive: true,
  currentBalance: '10000',
  totalWalletBalance: '10000',
  apiKeyEncrypted: 'x',
  apiSecretEncrypted: 'x',
  apiKeyMasked: 'xxx',
  testnet: false,
  agentTradingEnabled: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const FAKE_OPEN_EXECUTION = {
  id: 'exec-perf-1',
  userId: 'user-perf',
  walletId: FAKE_WALLET_ID,
  symbol: SYMBOL,
  side: 'LONG',
  status: 'open',
  entryPrice: '50000',
  quantity: '0.5',
  leverage: 10,
  stopLoss: '48000',
  takeProfit: '54000',
  marketType: 'FUTURES',
  entryOrderId: 'order-entry-1',
  stopLossAlgoId: 'algo-sl-1',
  takeProfitAlgoId: 'algo-tp-1',
  partialClosePnl: '0',
  pnl: null,
  pnlPercent: null,
  fees: null,
  exitPrice: null,
  closedAt: null,
  openedAt: new Date(Date.now() - 60_000).toISOString(),
  createdAt: new Date(Date.now() - 60_000).toISOString(),
  updatedAt: new Date(Date.now() - 60_000).toISOString(),
};

const FAKE_OPEN_ORDERS = [
  {
    id: 'order-entry-1',
    orderId: 'order-entry-1',
    symbol: SYMBOL,
    side: 'BUY',
    type: 'LIMIT',
    status: 'FILLED',
    price: '50000',
    origQty: '0.5',
    executedQty: '0.5',
    walletId: FAKE_WALLET_ID,
    marketType: 'FUTURES',
  },
];

const FAKE_OPEN_ALGO_ORDERS = [
  {
    algoId: 'algo-sl-1',
    symbol: SYMBOL,
    side: 'SELL',
    type: 'STOP_MARKET',
    triggerPrice: '48000',
    quantity: '0.5',
    reduceOnly: true,
  },
  {
    algoId: 'algo-tp-1',
    symbol: SYMBOL,
    side: 'SELL',
    type: 'TAKE_PROFIT_MARKET',
    triggerPrice: '54000',
    quantity: '0.5',
    reduceOnly: true,
  },
];

const FIVE_INDICATORS = [
  { catalogType: 'sma', params: { period: 20 } },
  { catalogType: 'ema', params: { period: 50 } },
  { catalogType: 'rsi', params: { period: 14 } },
  { catalogType: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
  { catalogType: 'bb', params: { period: 20, stdDev: 2 } },
];

test.describe('Live-scenario perf (pan + open position + indicators + ticks)', () => {
  test.beforeEach(async ({ page }) => {
    await installConsoleCapture(page);
    await enablePerfOverlay(page);

    const klines = generateKlines({ count: 500, symbol: SYMBOL, interval: '15m' });
    await installTrpcMock(page, {
      klines,
      overrides: {
        'wallet.list': () => [FAKE_WALLET],
        'wallet.listActive': () => [FAKE_WALLET],
        'trading.getTradeExecutions': () => [FAKE_OPEN_EXECUTION],
        'trading.getOrders': () => FAKE_OPEN_ORDERS,
        'trading.getPositions': () => [],
        'futuresTrading.getOpenOrders': () => [],
        'futuresTrading.getOpenAlgoOrders': () => FAKE_OPEN_ALGO_ORDERS,
        'futuresTrading.getOpenDbOrderIds': () => ['order-entry-1', 'algo-sl-1', 'algo-tp-1'],
      },
    });

    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
    await enableChartQuickTrade(page);
  });

  test('pan with open position + 5 indicators + tick storm → component render rates stay bounded', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, FIVE_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    // Background tick loop — pushes prices for 10 symbols every ~10ms,
    // simulating a live trading session where multiple watchers stream
    // updates concurrently.
    let stop = false;
    const tickLoop = (async () => {
      let seed = 0;
      while (!stop) {
        const ticks: Record<string, number> = {};
        for (const sym of TICK_STORM_SYMBOLS) {
          seed += 1;
          ticks[sym] = 50_000 + ((seed % 1000) * 0.1);
        }
        await pushPriceTicks(page, ticks);
        await new Promise((r) => setTimeout(r, 10));
      }
    })();

    // Pan the chart for ~PAN_FRAMES rAFs (≈4s at 60fps).
    await drivePan(page, PAN_FRAMES);

    stop = true;
    await tickLoop;

    const snap = await readPerfSnapshot(page);
    const fps = snap.fps;
    const slowestMs = slowestSectionMs(snap);
    const droppedFrames = snap.droppedFrames;
    const longSections = snap.longSections.length;
    const chartCanvasTotal = componentRenderTotal(snap, 'ChartCanvas');
    const chartCanvasRate = componentRenderRate(snap, 'ChartCanvas');
    const portfolioRate = componentRenderRate(snap, 'Portfolio');
    const ordersListRate = componentRenderRate(snap, 'OrdersList');
    const quickTradeRate = componentRenderRate(snap, 'QuickTradeToolbar');
    const indicatorsRate = componentRenderRate(snap, 'useGenericChartIndicators');

    const result = {
      fps,
      p95FrameMs: slowestMs,
      droppedFrames,
      longSections,
      chartCanvasTotal,
      chartCanvasRate,
      portfolioRate,
      ordersListRate,
      quickTradeRate,
      indicatorsRate,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult('pan-with-open-position-and-tick-storm', result);
    writeDiagnose('pan-with-open-position-and-tick-storm', snap);

    // Assertions — these document the user's expectation that pan
    // should not light up sibling React rerenders. ChartCanvas itself
    // is allowed up to 30 renders in the pan window (≈4s of 240
    // frames) since gesture-driven viewport state changes are
    // unavoidable. Portfolio/OrdersList/QuickTradeToolbar should
    // never rerender during pan — they don't depend on viewport
    // state, only on order/position state which doesn't change in
    // this test.
    expect(snap.enabled).toBe(true);
    expect(fps, `pan FPS dropped to ${fps} under tick-storm + open position`).toBeGreaterThanOrEqual(20);
    expect(droppedFrames, `${droppedFrames} dropped frames during pan (cap: 5)`).toBeLessThanOrEqual(5);
    expect(slowestMs, `slowest canvas section ${slowestMs.toFixed(2)}ms (cap: 25ms)`).toBeLessThanOrEqual(25);

    // The point-of-pain check: sibling components must NOT render at
    // tick-storm rate during a pan gesture. If any of these fail, the
    // failure message names the offender — the next step is to find
    // the selector subscription that's making it hot.
    expect(
      portfolioRate,
      `Portfolio re-rendering ${portfolioRate.toFixed(1)}/s during pan + tick storm — selector on usePriceStore?`,
    ).toBeLessThanOrEqual(10);
    expect(
      ordersListRate,
      `OrdersList re-rendering ${ordersListRate.toFixed(1)}/s during pan + tick storm — selector on usePriceStore?`,
    ).toBeLessThanOrEqual(10);
    expect(
      quickTradeRate,
      `QuickTradeToolbar re-rendering ${quickTradeRate.toFixed(1)}/s during pan + tick storm — selector on usePriceStore?`,
    ).toBeLessThanOrEqual(10);
  });
});
