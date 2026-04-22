import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKlines, nextKline } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture, filterNoiseFromErrors, getCapturedErrors } from '../helpers/consoleCapture';
import {
  addIndicators,
  appendKline,
  clearDrawings,
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
  seedDrawings,
  slowestSectionMs,
  updateLatestKline,
  waitForChartReady,
  waitForFrames,
  type StressDrawingSeed,
} from '../helpers/chartTestSetup';
import type { PerfSnapshot } from '../../src/renderer/utils/canvas/perfMonitor';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = resolve(HERE, 'last-run.json');
const BASELINE_PATH = resolve(HERE, 'baseline.json');
const DIAGNOSE_PATH = resolve(HERE, `diagnose-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
const DIAGNOSE = process.env['PERF_DIAGNOSE'] === '1';

const WARMUP_FRAMES = 90;
const MEASURE_FRAMES = 600;
const TICK_STORM_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT'];
const TICK_STORM_SYMBOLS_X20 = [
  ...TICK_STORM_SYMBOLS,
  'TRXUSDT', 'LTCUSDT', 'BCHUSDT', 'ATOMUSDT', 'NEARUSDT',
  'APTUSDT', 'ARBUSDT', 'OPUSDT', 'FILUSDT', 'ETCUSDT',
];
const MANY_DRAWINGS_COUNT = 80;
const STRESS_PAN_FRAMES = 180;
const STRESS_ZOOM_FRAMES = 90;
const KLINE_REPLACE_ITERATIONS = 60;
const KLINE_REPLACE_INTERVAL_MS = 100;
const KLINE_APPEND_ITERATIONS = 12;
const KLINE_APPEND_INTERVAL_MS = 500;
const PAN_FRAMES = 240;
const ZOOM_FRAMES = 120;
const INDICATOR_CHURN_CYCLES = 20;
const INDICATOR_CHURN_SETTLE_FRAMES = 6;
const IDLE_TICK_POLL_FRAMES = 300;
const IDLE_TICK_POLL_CHARTCANVAS_CAP = 1;
const MOUNT_UNMOUNT_CYCLES = 10;
const MOUNT_UNMOUNT_DRIVE_FRAMES = 30;
const MOUNT_UNMOUNT_UNMOUNT_FRAMES = 15;
const MOUNT_UNMOUNT_HEAP_GROWTH_CAP = 1.0;

const NOISE_FLOOR_MS = 0.5;
const RELATIVE_REGRESSION_CAP = 0.5;

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

const writeDiagnose = (key: string, snap: PerfSnapshot): void => {
  if (!DIAGNOSE) return;
  let current: Record<string, unknown> = {};
  if (existsSync(DIAGNOSE_PATH)) {
    try {
      current = JSON.parse(readFileSync(DIAGNOSE_PATH, 'utf8')) as Record<string, unknown>;
    } catch {
      current = {};
    }
  }
  current[key] = {
    fps: snap.fps,
    lastFrameMs: snap.lastFrameMs,
    droppedFrames: snap.droppedFrames,
    longSections: snap.longSections.length,
    longSectionDetails: snap.longSections.slice(-5),
    topSections: snap.sections.slice(0, 5),
    topComponents: snap.componentRenders.slice(0, 5),
  };
  writeFileSync(DIAGNOSE_PATH, JSON.stringify(current, null, 2));
};

const assertRegression = (key: string, result: BaselineEntry): void => {
  const baseline = loadBaseline();
  if (!baseline[key]) return;
  const delta = result.p95FrameMs - baseline[key].p95FrameMs;
  if (delta <= NOISE_FLOOR_MS) return;
  const relative = delta / Math.max(baseline[key].p95FrameMs, 0.1);
  expect(relative, `${key}: p95 frame regression vs baseline`).toBeLessThanOrEqual(RELATIVE_REGRESSION_CAP);
};

const OVERLAY_INDICATORS = [
  { catalogType: 'sma', params: { period: 20 } },
  { catalogType: 'ema', params: { period: 50 } },
];

test.describe('Chart hot-path perf', () => {
  test.beforeEach(async ({ page }) => {
    await installConsoleCapture(page);
    await enablePerfOverlay(page);
    await page.route('**/socket.io/**', (route) => route.abort());
    const klines = generateKlines({ count: 500, symbol: 'BTCUSDT', interval: '1h' });
    await installTrpcMock(page, { klines });

    await page.goto('/');
    await waitForChartReady(page);
    await refreshPerfFlag(page);
  });

  test('price tick storm: 10 symbols x 100 ticks/sec for 5s', async ({ page }) => {
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
    const key = 'price-tick-storm';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);

    const errors = filterNoiseFromErrors(await getCapturedErrors(page));
    expect(errors, `errors:\n${errors.join('\n---\n')}`).toHaveLength(0);
  });

  test('kline replace loop: current-bar ticks', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    let iter = 0;
    let stop = false;
    const replaceLoop = (async () => {
      while (!stop && iter < KLINE_REPLACE_ITERATIONS) {
        iter += 1;
        const drift = (iter % 20) - 10;
        await updateLatestKline(page, { close: 50_000 + drift * 5, volume: 100 + iter });
        await new Promise((r) => setTimeout(r, KLINE_REPLACE_INTERVAL_MS));
      }
    })();

    await driveFrames(page, MEASURE_FRAMES);
    stop = true;
    await replaceLoop;

    const snap = await readPerfSnapshot(page);
    const key = 'kline-replace-loop';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(iter).toBeGreaterThan(0);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('kline append: new bar each 500ms', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    const seed = generateKlines({ count: 1, symbol: 'BTCUSDT', interval: '1h' })[0]!;
    let prev = seed;
    let appended = 0;
    let stop = false;
    const appendLoop = (async () => {
      let seedCounter = 1;
      while (!stop && appended < KLINE_APPEND_ITERATIONS) {
        seedCounter += 1;
        const kline = nextKline(prev, seedCounter * 7919);
        await appendKline(page, kline);
        prev = kline;
        appended += 1;
        await new Promise((r) => setTimeout(r, KLINE_APPEND_INTERVAL_MS));
      }
    })();

    await driveFrames(page, MEASURE_FRAMES);
    stop = true;
    await appendLoop;

    const snap = await readPerfSnapshot(page);
    const key = 'kline-append';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(appended).toBeGreaterThan(0);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('pan drag loop: sustained horizontal drag', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    await drivePan(page, PAN_FRAMES);
    await driveFrames(page, 60);

    const snap = await readPerfSnapshot(page);
    const key = 'pan-drag-loop';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      droppedFrames: snap.droppedFrames,
      longSections: snap.longSections.length,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('wheel zoom loop: alternating in/out', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    await driveWheelZoom(page, ZOOM_FRAMES);
    await driveFrames(page, 60);

    const snap = await readPerfSnapshot(page);
    const key = 'wheel-zoom-loop';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      droppedFrames: snap.droppedFrames,
      longSections: snap.longSections.length,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('indicator churn: add/remove indicator instances', async ({ page }) => {
    await clearIndicators(page);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    let cycles = 0;
    let stop = false;
    const churnLoop = (async () => {
      while (!stop && cycles < INDICATOR_CHURN_CYCLES) {
        await addIndicators(page, OVERLAY_INDICATORS);
        await driveFrames(page, INDICATOR_CHURN_SETTLE_FRAMES);
        await clearIndicators(page);
        await driveFrames(page, INDICATOR_CHURN_SETTLE_FRAMES);
        cycles += 1;
      }
    })();

    await driveFrames(page, MEASURE_FRAMES);
    stop = true;
    await churnLoop;

    const snap = await readPerfSnapshot(page);
    const key = 'indicator-churn';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      droppedFrames: snap.droppedFrames,
      longSections: snap.longSections.length,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(cycles).toBeGreaterThan(0);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });

  test('many drawings: 80 mixed drawings under pan+zoom', async ({ page }) => {
    await clearIndicators(page);
    await clearDrawings(page);
    await addIndicators(page, OVERLAY_INDICATORS);

    const seeds: StressDrawingSeed[] = [];
    for (let i = 0; i < MANY_DRAWINGS_COUNT; i += 1) {
      const mod = i % 3;
      const startIndex = 50 + i * 5;
      const startPrice = 50_000 + (i % 20) * 100;
      if (mod === 0) {
        seeds.push({
          type: 'line',
          startIndex,
          startPrice,
          endIndex: startIndex + 30,
          endPrice: startPrice + 500,
        });
      } else if (mod === 1) {
        seeds.push({
          type: 'rectangle',
          startIndex,
          startPrice,
          endIndex: startIndex + 40,
          endPrice: startPrice + 800,
        });
      } else {
        seeds.push({ type: 'horizontalLine', startIndex, startPrice });
      }
    }
    const seeded = await seedDrawings(page, 'BTCUSDT', '1h', seeds);

    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    await drivePan(page, STRESS_PAN_FRAMES);
    await driveWheelZoom(page, STRESS_ZOOM_FRAMES);
    await driveFrames(page, 60);

    const snap = await readPerfSnapshot(page);
    const key = 'many-drawings';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      droppedFrames: snap.droppedFrames,
      longSections: snap.longSections.length,
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(seeded).toBe(MANY_DRAWINGS_COUNT);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);

    await clearDrawings(page);
  });

  test('hover-and-tick-storm: ChartCanvas + QuickTradeToolbar stay bounded during hover + ticks', async ({ page }) => {
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
    const key = 'hover-and-tick-storm';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(
      componentRenderRate(snap, 'ChartCanvas'),
      'ChartCanvas re-rendering under hover+tick storm — likely hoveredKlineIndex in external + hot selectors (Parts 2-3)',
    ).toBeLessThanOrEqual(2);
    expect(
      componentRenderRate(snap, 'QuickTradeToolbar'),
      'QuickTradeToolbar re-rendering under tick storm — subscribed to usePriceStore via selector (Part 2)',
    ).toBeLessThanOrEqual(10);
  });

  test('idle tick-poll: no ticks -> ChartCanvas stays quiet', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await waitForFrames(page, 30);
    await resetPerfMonitor(page);

    await waitForFrames(page, IDLE_TICK_POLL_FRAMES);

    const snap = await readPerfSnapshot(page);
    const key = 'idle-tick-poll';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(
      componentRenderRate(snap, 'ChartCanvas'),
      'ChartCanvas re-rendering while idle (no ticks, no mouse) — tick-poll gate regressed',
    ).toBeLessThanOrEqual(IDLE_TICK_POLL_CHARTCANVAS_CAP);
    assertRegression(key, result);
  });

  test('mount-unmount churn: chart heap + instances bounded across 10 cycles', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);

    const baseline = await page.evaluate(async () => {
      const g = globalThis as unknown as {
        gc?: () => void;
        __canvasManagerInstances?: Set<unknown>;
      };
      if (typeof g.gc === 'function') g.gc();
      await new Promise<void>((r) => setTimeout(r, 50));
      const mem = (window.performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return {
        heap: mem?.usedJSHeapSize ?? 0,
        instances: g.__canvasManagerInstances?.size ?? 0,
      };
    });

    await resetPerfMonitor(page);

    for (let i = 0; i < MOUNT_UNMOUNT_CYCLES; i += 1) {
      await page.evaluate(() => {
        window.history.pushState(null, '', '/login');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await waitForFrames(page, MOUNT_UNMOUNT_UNMOUNT_FRAMES);
      await page.evaluate(() => {
        window.history.pushState(null, '', '/');
        window.dispatchEvent(new PopStateEvent('popstate'));
      });
      await waitForChartReady(page);
      await driveFrames(page, MOUNT_UNMOUNT_DRIVE_FRAMES);
    }

    const final = await page.evaluate(async () => {
      const g = globalThis as unknown as {
        gc?: () => void;
        __canvasManagerInstances?: Set<unknown>;
      };
      if (typeof g.gc === 'function') g.gc();
      await new Promise<void>((r) => setTimeout(r, 100));
      const mem = (window.performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
      return {
        heap: mem?.usedJSHeapSize ?? 0,
        instances: g.__canvasManagerInstances?.size ?? 0,
      };
    });

    const snap = await readPerfSnapshot(page);
    const key = 'mount-unmount-churn';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(
      final.instances,
      `canvas manager instances leaked: ${final.instances} alive after ${MOUNT_UNMOUNT_CYCLES} cycles (baseline ${baseline.instances})`,
    ).toBeLessThanOrEqual(baseline.instances + 1);

    if (baseline.heap > 0) {
      const growth = (final.heap - baseline.heap) / baseline.heap;
      expect(
        growth,
        `heap grew ${(growth * 100).toFixed(1)}% across ${MOUNT_UNMOUNT_CYCLES} mount/unmount cycles (baseline ${baseline.heap}, final ${final.heap})`,
      ).toBeLessThan(MOUNT_UNMOUNT_HEAP_GROWTH_CAP);
    }
  });

  test('20-symbol tick storm: double-width price batch path', async ({ page }) => {
    await clearIndicators(page);
    await addIndicators(page, OVERLAY_INDICATORS);
    await driveFrames(page, WARMUP_FRAMES);
    await resetPerfMonitor(page);

    let stop = false;
    const tickLoop = (async () => {
      let seed = 0;
      while (!stop) {
        const ticks: Record<string, number> = {};
        for (const sym of TICK_STORM_SYMBOLS_X20) {
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
    const key = 'price-tick-storm-20';
    const result: BaselineEntry = {
      fps: snap.fps,
      p95FrameMs: slowestSectionMs(snap),
      renderRate: componentRenderRate(snap, 'ChartCanvas'),
      generatedAt: new Date().toISOString(),
    };
    writeRunResult(key, result);
    writeDiagnose(key, snap);

    expect(snap.enabled).toBe(true);
    expect(snap.fps).toBeGreaterThanOrEqual(20);
    expect(slowestSectionMs(snap)).toBeLessThanOrEqual(25);
    assertRegression(key, result);
  });
});
