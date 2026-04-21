import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = resolve(HERE, 'last-run.json');
const BASELINE_PATH = resolve(HERE, 'baseline.json');

const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;
const WARMUP_FRAMES = 90;
const MEASURE_FRAMES = 600;
const PAN_FRAMES = 180;
const ZOOM_FRAMES = 90;
const TICK_STORM_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'];

const NOISE_FLOOR_MS = 0.5;
const RELATIVE_REGRESSION_CAP = 0.5;

const OVERLAY_INDICATORS = [
  { catalogType: 'sma', params: { period: 20 } },
  { catalogType: 'ema', params: { period: 50 } },
];

interface BaselineEntry {
  fps: number;
  p95FrameMs: number;
  renderRate: number;
  droppedFrames?: number;
  longSections?: number;
  generatedAt: string;
}

type BaselineMap = Record<string, BaselineEntry>;

const loadBaseline = (): BaselineMap => {
  if (!existsSync(BASELINE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineMap;
  } catch {
    return {};
  }
};

const writeRunResult = (key: string, entry: BaselineEntry): void => {
  let current: BaselineMap = {};
  if (existsSync(RESULTS_PATH)) {
    try {
      current = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as BaselineMap;
    } catch {
      current = {};
    }
  }
  current[key] = entry;
  writeFileSync(RESULTS_PATH, JSON.stringify(current, null, 2));
};

const assertRegression = (key: string, result: BaselineEntry): void => {
  const baseline = loadBaseline();
  if (!baseline[key]) return;
  const delta = result.p95FrameMs - baseline[key].p95FrameMs;
  if (delta <= NOISE_FLOOR_MS) return;
  const relative = delta / Math.max(baseline[key].p95FrameMs, 0.1);
  expect(relative, `${key}: p95 frame regression vs baseline`).toBeLessThanOrEqual(RELATIVE_REGRESSION_CAP);
};

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
