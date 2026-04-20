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
}

type Map = Record<string, Entry>;

if (!existsSync(RESULTS_PATH)) {
  console.error(`No results at ${RESULTS_PATH}. Run \`pnpm --filter @marketmind/electron test:perf\` first.`);
  process.exit(1);
}

const results = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as Map;
const now = new Date().toISOString();

const next: Map = {};
for (const [key, entry] of Object.entries(results)) {
  next[key] = { ...entry, generatedAt: now };
}

writeFileSync(BASELINE_PATH, `${JSON.stringify(next, null, 2)}\n`);
console.log(`Baseline updated at ${BASELINE_PATH}`);
for (const [key, entry] of Object.entries(next)) {
  console.log(`  ${key}: fps=${entry.fps.toFixed(1)} p95FrameMs=${entry.p95FrameMs.toFixed(2)} renderRate=${entry.renderRate.toFixed(2)}`);
}
