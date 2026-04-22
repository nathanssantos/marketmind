import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import type { PerfSnapshot } from '../../src/renderer/utils/canvas/perfMonitor';

const HERE = dirname(fileURLToPath(import.meta.url));

export const BASELINE_PATH = resolve(HERE, 'baseline.json');
export const RESULTS_PATH = resolve(HERE, 'last-run.json');
export const DIAGNOSE_PATH = resolve(
  HERE,
  `diagnose-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
);
export const DIAGNOSE = process.env['PERF_DIAGNOSE'] === '1';

export const WARMUP_FRAMES = 90;
export const MEASURE_FRAMES = 600;
export const NOISE_FLOOR_MS = 0.5;
export const RELATIVE_REGRESSION_CAP = 0.5;

export const OVERLAY_INDICATORS = [
  { catalogType: 'sma', params: { period: 20 } },
  { catalogType: 'ema', params: { period: 50 } },
];

export const TICK_STORM_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
];

export interface BaselineEntry {
  fps: number;
  p95FrameMs: number;
  renderRate: number;
  droppedFrames?: number;
  longSections?: number;
  generatedAt: string;
}

export type BaselineMap = Record<string, BaselineEntry>;

export const loadBaseline = (): BaselineMap => {
  if (!existsSync(BASELINE_PATH)) return {};
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as BaselineMap;
  } catch {
    return {};
  }
};

export const writeRunResult = <T extends Record<string, unknown> | BaselineEntry>(
  key: string,
  entry: T,
): void => {
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

export const writeDiagnose = (key: string, snap: PerfSnapshot): void => {
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

export const assertRegression = (key: string, result: BaselineEntry): void => {
  const baseline = loadBaseline();
  if (!baseline[key]) return;
  const delta = result.p95FrameMs - baseline[key].p95FrameMs;
  if (delta <= NOISE_FLOOR_MS) return;
  const relative = delta / Math.max(baseline[key].p95FrameMs, 0.1);
  expect(relative, `${key}: p95 frame regression vs baseline`).toBeLessThanOrEqual(RELATIVE_REGRESSION_CAP);
};
