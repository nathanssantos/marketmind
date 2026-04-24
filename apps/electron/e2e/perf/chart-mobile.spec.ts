import { test, expect } from '@playwright/test';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture, filterNoiseFromErrors, getCapturedErrors } from '../helpers/consoleCapture';
import {
  addIndicators,
  clearIndicators,
  componentRenderRate,
  driveFrames,
  drivePan,
  driveWheelZoom,
  enablePerfOverlay,
  pushPriceTicks,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  slowestSectionMs,
  waitForChartReady,
} from '../helpers/chartTestSetup';
import {
  OVERLAY_INDICATORS,
  WARMUP_FRAMES,
  MEASURE_FRAMES,
  assertRegression,
  writeRunResult,
  type BaselineEntry,
} from './harness';

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const PAN_FRAMES = 180;
const ZOOM_FRAMES = 90;
const TICK_STORM_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

test.describe('Chart mobile-viewport perf', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ ...MOBILE_VIEWPORT });
    await installConsoleCapture(page);
    await enablePerfOverlay(page);
    const klines = generateKlines({ count: 500, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });

    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
  });

  test('mobile overlay baseline: fps >= 20 at 390x844', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);
    await driveFrames(page, MEASURE_FRAMES);

    const snap = await readPerfSnapshot(page);
    const key = 'mobile-overlay';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);

    const errors = filterNoiseFromErrors(await getCapturedErrors(page));
    expect(errors, `errors:\n${errors.join('\n---\n')}`).toHaveLength(0);
  });

  test('mobile pan+zoom: sustained interaction at narrow viewport', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    await drivePan(page, PAN_FRAMES, 120);
    await driveWheelZoom(page, ZOOM_FRAMES);
    await driveFrames(page, 60);

    const snap = await readPerfSnapshot(page);
    const key = 'mobile-pan-zoom';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      droppedFrames: snap.droppedFrames,
      longSections: snap.longSections.length,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('mobile tick storm: price ticks with reduced sidebar footprint', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
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
    const key = 'mobile-tick-storm';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });
});
