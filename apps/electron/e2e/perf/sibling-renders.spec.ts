import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture } from '../helpers/consoleCapture';
import {
  clearIndicators,
  componentRenderRate,
  driveFrames,
  enablePerfOverlay,
  pushPriceTicks,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  waitForChartReady,
} from '../helpers/chartTestSetup';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = resolve(HERE, 'last-run.json');

const WARMUP_FRAMES = 90;
const MEASURE_FRAMES = 600;
const TICK_STORM_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];

const MAX_PORTFOLIO_RENDERS_PER_SEC = 10;
const MAX_ORDERS_LIST_RENDERS_PER_SEC = 10;
const MAX_QUICK_TRADE_RENDERS_PER_SEC = 10;

interface SiblingResult {
  portfolioRate: number;
  ordersListRate: number;
  chartCanvasRate: number;
  fps: number;
  generatedAt: string;
}

interface QuickTradeResult {
  quickTradeRate: number;
  chartCanvasRate: number;
  fps: number;
  generatedAt: string;
}

const writeRunResult = (key: string, entry: SiblingResult | QuickTradeResult): void => {
  let current: Record<string, unknown> = {};
  if (existsSync(RESULTS_PATH)) {
    try {
      current = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  current[key] = entry;
  writeFileSync(RESULTS_PATH, JSON.stringify(current, null, 2));
};

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

  test.fixme('quick-trade-toolbar-tick-storm: QuickTradeToolbar stays bounded under price ticks', async ({ page }) => {
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
    const quickTradeRate = componentRenderRate(snap, 'QuickTradeToolbar');
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
      `QuickTradeToolbar re-rendering ${quickTradeRate.toFixed(1)}/s under tick storm — selector on usePriceStore (Part 2)`,
    ).toBeLessThanOrEqual(MAX_QUICK_TRADE_RENDERS_PER_SEC);
  });
});
