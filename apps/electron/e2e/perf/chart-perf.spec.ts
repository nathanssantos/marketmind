import { test, expect } from '@playwright/test';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture, filterNoiseFromErrors, getCapturedErrors } from '../helpers/consoleCapture';
import {
  addIndicators,
  clearIndicators,
  driveFrames,
  enablePerfOverlay,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  waitForChartReady,
  waitForFrames,
  slowestSectionMs,
  componentRenderRate,
} from '../helpers/chartTestSetup';
import {
  MEASURE_FRAMES,
  loadBaseline,
  writeRunResult,
  type BaselineEntry,
} from './harness';

const WARMUP_FRAMES = 120;

const FIVE_PANEL_INDICATORS = [
  { catalogType: 'macd', params: { fast: 12, slow: 26, signal: 9 } },
  { catalogType: 'rsi', params: { period: 14 } },
  { catalogType: 'stoch', params: { k: 14, d: 3, smooth: 3 } },
  { catalogType: 'adx', params: { period: 14 } },
  { catalogType: 'bollingerBands', params: { period: 20, stdDev: 2 } },
];

const OVERLAY_ONLY_INDICATORS = [
  { catalogType: 'sma', params: { period: 20 } },
  { catalogType: 'ema', params: { period: 50 } },
  { catalogType: 'bollingerBands', params: { period: 20, stdDev: 2 } },
];

test.describe('Chart perf regression', () => {
  test.beforeEach(async ({ page }) => {
    await installConsoleCapture(page);
    await enablePerfOverlay(page);
    const klines = generateKlines({ count: 500, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });

    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
  });

  test('5-panel baseline: fps >= 20, slowest section <= 20ms', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, FIVE_PANEL_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);
    await driveFrames(page, MEASURE_FRAMES);

    const snap = await readPerfSnapshot(page);
    const baseline = loadBaseline();
    const key = '5-panels';

    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);

    expect(snap.enabled, 'perf overlay should be enabled').toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(20);

    if (baseline[key]) {
      const absoluteDelta = result.p95FrameMs - baseline[key].p95FrameMs;
      if (absoluteDelta > 0.5) {
        const regression = absoluteDelta / Math.max(baseline[key].p95FrameMs, 0.1);
        expect(regression, 'p95 frame regression vs baseline').toBeLessThanOrEqual(0.5);
      }
    }
  });

  test('overlay-only baseline: no panel churn', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_ONLY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);
    await driveFrames(page, MEASURE_FRAMES);

    const snap = await readPerfSnapshot(page);
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult('overlay-only', result);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(15);
  });

  test('sanity: no console errors during chart render', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, FIVE_PANEL_INDICATORS);
    await waitForFrames(page, WARMUP_FRAMES);

    const errors = await getCapturedErrors(page);
    const real = filterNoiseFromErrors(errors);
    expect(real, `unexpected errors:\n${real.join('\n---\n')}`).toHaveLength(0);
  });
});
