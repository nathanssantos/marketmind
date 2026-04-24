#!/usr/bin/env tsx
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ELECTRON_ROOT = resolve(HERE, '../../apps/electron');
const BASELINE_PATH = resolve(ELECTRON_ROOT, 'e2e/perf/baseline.json');
const RESULTS_PATH = resolve(ELECTRON_ROOT, 'e2e/perf/last-run.json');

interface Entry {
  fps: number;
  p95FrameMs: number;
  renderRate: number;
  generatedAt: string;
  [extra: string]: unknown;
}

type Map = Record<string, Entry>;

const isBaselineEntry = (entry: Record<string, unknown>): entry is Entry =>
  typeof entry.fps === 'number' &&
  typeof entry.p95FrameMs === 'number' &&
  typeof entry.renderRate === 'number';

if (!existsSync(RESULTS_PATH)) {
  console.error(`No results at ${RESULTS_PATH}. Run \`pnpm --filter @marketmind/electron test:perf\` first.`);
  process.exit(1);
}

const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as Record<string, Record<string, unknown>>;
const now = new Date().toISOString();

const next: Map = {};
const skipped: string[] = [];
for (const [key, entry] of Object.entries(results)) {
  if (!isBaselineEntry(entry)) {
    skipped.push(key);
    continue;
  }
  next[key] = { ...entry, generatedAt: now };
}

writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Baseline updated at ${BASELINE_PATH}`);
for (const [key, entry] of Object.entries(next)) {
  console.log(`  ${key}: fps=${entry.fps.toFixed(1)} p95FrameMs=${entry.p95FrameMs.toFixed(2)} renderRate=${entry.renderRate.toFixed(2)}`);
}
if (skipped.length > 0) {
  console.log(`\nSkipped (no fps/p95FrameMs/renderRate — not a baseline-shaped entry): ${skipped.join(', ')}`);
}
