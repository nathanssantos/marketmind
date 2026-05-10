import { test, expect } from '@playwright/test';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture } from '../helpers/consoleCapture';
import {
  clearIndicators,
  componentRenderRate,
  driveFrames,
  enableChartQuickTrade,
  enablePerfOverlay,
  pushPriceTicks,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  waitForChartReady,
} from '../helpers/chartTestSetup';
import { TICK_STORM_SYMBOLS, WARMUP_FRAMES, MEASURE_FRAMES, writeRunResult } from './harness';

const MAX_PORTFOLIO_RENDERS_PER_SEC = 10;
const MAX_ORDERS_LIST_RENDERS_PER_SEC = 10;
const MAX_QUICK_TRADE_RENDERS_PER_SEC = 10;

interface SiblingResult {
  portfolioRate: number;
  ordersListRate: number;
  chartCanvasRate: number;
  fps: number;
  generatedAt: string;
  [key: string]: unknown;
}

interface QuickTradeResult {
  quickTradeRate: number;
  chartCanvasRate: number;
  fps: number;
  generatedAt: string;
  [key: string]: unknown;
}

test.describe('Sibling renderer hot-path', () => {
  test.beforeEach(async ({ page }) => {
    await installConsoleCapture(page);
    await enablePerfOverlay(page);
    const klines = generateKlines({ count: 500, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });

    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
  });

  test('portfolio + orders list render rates stay bounded during price tick storm', async ({ page }) => {
    await clearIndicators(page);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

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

    await driveFrames(page, MEASURE_FRAMES);
    stop = true;
    await tickLoop;

    const snap = await readPerfSnapshot(page);
    const portfolioRate = componentRenderRate(snap, 'Portfolio');
    const ordersListRate = componentRenderRate(snap, 'OrdersList');
    const chartCanvasRate = componentRenderRate(snap, 'ChartCanvas');

    writeRunResult('sibling-renders-under-ticks', {
      portfolioRate,
      ordersListRate,
      chartCanvasRate,
      fps: snap.fps,
      generatedAt: new Date().toISOString(),
    });

    expect(snap.enabled).toBe(true);
    expect(
      portfolioRate,
      `Portfolio re-rendering ${portfolioRate.toFixed(1)}/s under tick storm — likely subscribed to usePriceStore via a selector`,
    ).toBeLessThanOrEqual(MAX_PORTFOLIO_RENDERS_PER_SEC);
    expect(
      ordersListRate,
      `OrdersList re-rendering ${ordersListRate.toFixed(1)}/s under tick storm — likely subscribed to a hot store via a selector`,
    ).toBeLessThanOrEqual(MAX_ORDERS_LIST_RENDERS_PER_SEC);
  });

  test('quick-trade-toolbar-tick-storm: TradeTicket stays bounded under price ticks', async ({ page }) => {
    await clearIndicators(page);
    await enableChartQuickTrade(page);
    await page.waitForFunction(
      () => {
        const snap = window.__mmPerf?.getSnapshot();
        return snap?.componentRenders.some((c) => c.name === 'TradeTicket') ?? false;
      },
      { timeout: 5_000 },
    );
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

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

    await driveFrames(page, MEASURE_FRAMES);
    stop = true;
    await tickLoop;

    const snap = await readPerfSnapshot(page);
    const quickTradeRate = componentRenderRate(snap, 'TradeTicket');
    const chartCanvasRate = componentRenderRate(snap, 'ChartCanvas');

    writeRunResult('quick-trade-toolbar-tick-storm', {
      quickTradeRate,
      chartCanvasRate,
      fps: snap.fps,
      generatedAt: new Date().toISOString(),
    });

    expect(snap.enabled).toBe(true);
    expect(
      quickTradeRate,
      `TradeTicket re-rendering ${quickTradeRate.toFixed(1)}/s under tick storm — selector on usePriceStore (Part 2)`,
    ).toBeLessThanOrEqual(MAX_QUICK_TRADE_RENDERS_PER_SEC);
  });
});
