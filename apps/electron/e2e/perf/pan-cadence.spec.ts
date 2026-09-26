import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page } from '@playwright/test';
import { GRID_VERSION } from '../../src/shared/types/layout';
import { DEFAULT_LAYOUT_SEED, type DefaultLayoutSeed } from '../../src/renderer/store/seed/defaultLayoutSeed';
import { generateKlines } from '../helpers/klineFixtures';
import { installTrpcMock } from '../helpers/trpcMock';
import { installConsoleCapture } from '../helpers/consoleCapture';
import {
  addIndicators,
  clearIndicators,
  enablePerfOverlay,
  readPerfSnapshot,
  refreshPerfFlag,
  resetPerfMonitor,
  waitForChartReady,
} from '../helpers/chartTestSetup';
import { buildLayout, startRealisticEmitter } from '../helpers/realPanScenario';
import { installFrameProbe, startFrameProbe, stopFrameProbe, type FrameProbeReport } from '../helpers/frameProbe';
import { OVERLAY_INDICATORS } from './harness';

const HERE = dirname(fileURLToPath(import.meta.url));
const RESULTS_PATH = resolve(HERE, 'pan-cadence-last-run.json');
const RESULT_TAG = process.env['PAN_CADENCE_TAG'];

const PAN_WARMUP_MS = 1_000;
const PAN_MEASURE_MS = 3_000;
const PAN_INPUT_INTERVAL_MS = 8;
const PAN_PX_PER_MOVE = 3;
const PAN_AMPLITUDE_SHARE = 0.35;
const TOP_SECTIONS = 3;
const KLINES_SMALL = 500;
const KLINES_APP_DEFAULT = 10_000;
const ZOOMED_OUT_STEPS = 30;
const ZOOM_OUT_DELTA = -1;
const WHEEL_INPUT_INTERVAL_MS = 16;
const WHEEL_DELTA_PX = 60;
const WHEEL_FLIP_EVERY = 20;

type CadenceGesture = 'pan' | 'wheel';

interface CadenceScenario {
  key: string;
  title: string;
  klines: number;
  zoomOutSteps: number;
  live: boolean;
  indicators: boolean;
  extraCharts: number;
  gesture?: CadenceGesture;
}

interface CadenceResult {
  title: string;
  klines: number;
  canvasCount: number;
  visibleCandles: number | null;
  deviceScaleFactor: number;
  headless: boolean;
  inputHz: number;
  mmPerfFps: number;
  topSections: Array<{ name: string; avgMs: number }>;
  probe: FrameProbeReport;
  generatedAt: string;
}

const SCENARIOS: CadenceScenario[] = [
  { key: 'pan-500', title: '500 klines, idle', klines: KLINES_SMALL, zoomOutSteps: 0, live: false, indicators: false, extraCharts: 0 },
  { key: 'pan-10k', title: '10k klines, idle', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: false, indicators: false, extraCharts: 0 },
  { key: 'pan-10k-zoomed-out', title: '10k klines, zoomed out', klines: KLINES_APP_DEFAULT, zoomOutSteps: ZOOMED_OUT_STEPS, live: false, indicators: false, extraCharts: 0 },
  { key: 'pan-10k-live', title: '10k klines, live streams', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: true, indicators: false, extraCharts: 0 },
  { key: 'pan-10k-indicators', title: '10k klines, overlay indicators', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: false, indicators: true, extraCharts: 0 },
  { key: 'pan-10k-live-2x2', title: '10k klines, live streams, 2x2 charts', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: true, indicators: false, extraCharts: 3 },
  { key: 'wheel-10k', title: '10k klines, wheel zoom in/out', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: false, indicators: false, extraCharts: 0, gesture: 'wheel' },
];

const DPR2_SCENARIO: CadenceScenario = {
  key: 'pan-10k-dpr2', title: '10k klines, idle, DPR 2', klines: KLINES_APP_DEFAULT, zoomOutSteps: 0, live: false, indicators: false, extraCharts: 0,
};

const singleChartLayout = (): DefaultLayoutSeed & { gridVersion: number } => {
  const layoutPresets = DEFAULT_LAYOUT_SEED.layoutPresets.map((preset) => {
    if (preset.id !== DEFAULT_LAYOUT_SEED.activeLayoutId) return preset;
    const firstChart = preset.grid.find((panel) => panel.kind === 'chart');
    if (!firstChart) throw new Error('active layout preset has no chart panel');
    const width = Math.max(...preset.grid.map((panel) => panel.gridPosition.x + panel.gridPosition.w));
    const height = Math.max(...preset.grid.map((panel) => panel.gridPosition.y + panel.gridPosition.h));
    return { ...preset, grid: [{ ...firstChart, gridPosition: { x: 0, y: 0, w: width, h: height } }] };
  });
  return { ...DEFAULT_LAYOUT_SEED, layoutPresets, gridVersion: GRID_VERSION };
};

const writeCadenceResult = (key: string, entry: CadenceResult): void => {
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

const readVisibleCandles = (page: Page): Promise<number | null> =>
  page.evaluate(() => {
    const viewport = window.__canvasManager?.getViewport();
    return viewport ? Math.round(viewport.end - viewport.start) : null;
  });

const countCanvases = (page: Page): Promise<number> => page.locator('canvas').count();

const chartCenter = async (page: Page): Promise<{ x: number; y: number; width: number }> => {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) throw new Error('canvas has no bounding box');
  return { x: box.x + box.width / 2, y: box.y + box.height / 2, width: box.width };
};

const zoomOut = async (page: Page, steps: number): Promise<void> => {
  if (steps === 0) return;
  await page.evaluate(
    ({ count, delta }) => {
      const manager = window.__canvasManager;
      if (!manager) throw new Error('__canvasManager not exposed');
      for (let i = 0; i < count; i += 1) manager.zoom(delta);
    },
    { count: steps, delta: ZOOM_OUT_DELTA },
  );
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
};

const steadyPan = async (page: Page, durationMs: number): Promise<number> => {
  const center = await chartCenter(page);
  const amplitude = center.width * PAN_AMPLITUDE_SHARE;
  await page.mouse.move(center.x, center.y);
  await page.mouse.down();
  const startedAt = Date.now();
  let dx = 0;
  let direction = -1;
  let moves = 0;
  while (Date.now() - startedAt < durationMs) {
    dx += direction * PAN_PX_PER_MOVE;
    if (Math.abs(dx) >= amplitude) direction *= -1;
    await page.mouse.move(center.x + dx, center.y);
    moves += 1;
    await new Promise((r) => setTimeout(r, PAN_INPUT_INTERVAL_MS));
  }
  await page.mouse.up();
  return (moves * 1000) / (Date.now() - startedAt);
};

const steadyWheel = async (page: Page, durationMs: number): Promise<number> => {
  const center = await chartCenter(page);
  await page.mouse.move(center.x, center.y);
  const startedAt = Date.now();
  let events = 0;
  while (Date.now() - startedAt < durationMs) {
    const direction = Math.floor(events / WHEEL_FLIP_EVERY) % 2 === 0 ? 1 : -1;
    await page.mouse.wheel(0, direction * WHEEL_DELTA_PX);
    events += 1;
    await new Promise((r) => setTimeout(r, WHEEL_INPUT_INTERVAL_MS));
  }
  return (events * 1000) / (Date.now() - startedAt);
};

const driveGesture = (page: Page, gesture: CadenceGesture, durationMs: number): Promise<number> =>
  gesture === 'wheel' ? steadyWheel(page, durationMs) : steadyPan(page, durationMs);

const formatLine = (key: string, result: CadenceResult): string => {
  const { probe } = result;
  return [
    key,
    `charts=${result.canvasCount}`,
    `visible=${result.visibleCandles ?? '?'}`,
    `input=${result.inputHz.toFixed(0)}Hz`,
    `renders/s=${probe.renders.perSec.toFixed(1)}`,
    `render-gap p50/p95/max=${probe.renders.p50.toFixed(1)}/${probe.renders.p95.toFixed(1)}/${probe.renders.max.toFixed(1)}ms`,
    `>34ms=${probe.renders.over34ms}`,
    `js p50/p95=${probe.renderJsMs.p50.toFixed(1)}/${probe.renderJsMs.p95.toFixed(1)}ms`,
    `snapshot p50/max=${probe.baseSnapshotMs.p50.toFixed(1)}/${probe.baseSnapshotMs.max.toFixed(1)}ms (${probe.baseSnapshotMs.count})`,
    `raf nominal=${probe.raf.nominalMs.toFixed(1)}ms missed=${probe.raf.missedPct.toFixed(1)}%`,
    `latency p50/p95=${probe.inputToRenderMs.p50.toFixed(1)}/${probe.inputToRenderMs.p95.toFixed(1)}ms`,
    `loaf=${probe.longAnimationFrames.count} (${probe.longAnimationFrames.totalMs.toFixed(0)}ms)`,
    `heapΔ=${probe.heapDeltaMB === null ? '?' : probe.heapDeltaMB.toFixed(1)}MB`,
  ].join(' | ');
};

const runScenario = async (page: Page, scenario: CadenceScenario, deviceScaleFactor: number, headless: boolean): Promise<void> => {
  await installConsoleCapture(page);
  await enablePerfOverlay(page);
  await page.route('**/socket.io/**', (route) => route.abort());
  const klines = generateKlines({ count: scenario.klines, symbol: 'BTCUSDT', interval: '1h' });
  await installTrpcMock(page, { klines, overrides: { 'layout.get': () => singleChartLayout() } });
  await page.goto('/');
  await waitForChartReady(page);
  await refreshPerfFlag(page);

  if (scenario.extraCharts > 0) {
    await buildLayout(page, { name: scenario.title, charts: scenario.extraCharts, panels: [] });
    await waitForChartReady(page);
  }
  await clearIndicators(page);
  if (scenario.indicators) await addIndicators(page, OVERLAY_INDICATORS);
  await zoomOut(page, scenario.zoomOutSteps);
  const visibleCandles = await readVisibleCandles(page);
  const canvasCount = await countCanvases(page);

  const gesture = scenario.gesture ?? 'pan';
  const emitter = scenario.live ? await startRealisticEmitter(page, ['BTCUSDT']) : null;
  await driveGesture(page, gesture, PAN_WARMUP_MS);

  await installFrameProbe(page);
  await resetPerfMonitor(page);
  await startFrameProbe(page);
  const inputHz = await driveGesture(page, gesture, PAN_MEASURE_MS);
  const probe = await stopFrameProbe(page);
  const snap = await readPerfSnapshot(page);
  if (emitter) await emitter.stop();

  const result: CadenceResult = {
    title: scenario.title,
    klines: scenario.klines,
    canvasCount,
    visibleCandles,
    deviceScaleFactor,
    headless,
    inputHz,
    mmPerfFps: snap.fps,
    topSections: snap.sections.slice(0, TOP_SECTIONS).map((s) => ({ name: s.name, avgMs: s.avgMs })),
    probe,
    generatedAt: new Date().toISOString(),
  };
  const resultKey = RESULT_TAG ? `${scenario.key}@${RESULT_TAG}` : scenario.key;
  writeCadenceResult(resultKey, result);
  console.log(formatLine(resultKey, result));

  expect(snap.enabled).toBe(true);
  if (gesture === 'pan') expect(probe.inputEvents).toBeGreaterThan(0);
  expect(probe.renders.count).toBeGreaterThan(0);
};

test.describe('Chart pan cadence', () => {
  for (const scenario of SCENARIOS) {
    test(`${scenario.key}: ${scenario.title}`, async ({ page }, testInfo) => {
      await runScenario(page, scenario, 1, testInfo.project.use.headless !== false);
    });
  }
});

test.describe('Chart pan cadence at DPR 2', () => {
  test.use({ deviceScaleFactor: 2 });

  test(`${DPR2_SCENARIO.key}: ${DPR2_SCENARIO.title}`, async ({ page }, testInfo) => {
    await runScenario(page, DPR2_SCENARIO, 2, testInfo.project.use.headless !== false);
  });
});
