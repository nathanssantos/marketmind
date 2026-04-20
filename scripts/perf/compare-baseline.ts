#!/usr/bin/env tsx
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ELECTRON_ROOT = resolve(HERE, '../../apps/electron');
const BASELINE_PATH = resolve(ELECTRON_ROOT, 'e2e/perf/baseline.json');
const RESULTS_PATH = resolve(ELECTRON_ROOT, 'e2e/perf/last-run.json');

const REGRESSION_THRESHOLD = 0.1;

const COLOR = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[90m',
};

interface Entry {
  fps: number;
  p95FrameMs: number;
  renderRate: number;
  generatedAt: string;
}

type Map = Record<string, Entry>;

const load = (path: string): Map => {
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Map;
  } catch {
    return {};
  }
};

const pct = (current: number, baseline: number): number => {
  if (baseline === 0) return 0;
  return (current - baseline) / baseline;
};

interface Row {
  key: string;
  metric: 'fps' | 'p95FrameMs' | 'renderRate';
  baseline: number;
  current: number;
  delta: number;
  status: 'pass' | 'warn' | 'fail';
}

const evaluate = (metric: Row['metric'], delta: number): Row['status'] => {
  const higherIsBetter = metric === 'fps';
  const regression = higherIsBetter ? -delta : delta;
  if (regression > REGRESSION_THRESHOLD) return 'fail';
  if (regression > REGRESSION_THRESHOLD / 2) return 'warn';
  return 'pass';
};

const color = (row: Row): string => {
  switch (row.status) {
    case 'pass':
      return COLOR.green;
    case 'warn':
      return COLOR.yellow;
    case 'fail':
      return COLOR.red;
  }
};

const symbol = (row: Row): string => {
  switch (row.status) {
    case 'pass':
      return 'OK';
    case 'warn':
      return 'WARN';
    case 'fail':
      return 'FAIL';
  }
};

const formatDelta = (value: number): string => {
  const signed = value >= 0 ? `+${(value * 100).toFixed(1)}` : `${(value * 100).toFixed(1)}`;
  return `${signed}%`;
};

const rows: Row[] = [];
const baseline = load(BASELINE_PATH);
const current = load(RESULTS_PATH);

if (Object.keys(current).length === 0) {
  console.error(`${COLOR.red}No current results found at${COLOR.reset} ${RESULTS_PATH}`);
  console.error(`Run \`pnpm --filter @marketmind/electron test:perf\` first.`);
  process.exit(1);
}

const metrics: Array<Row['metric']> = ['fps', 'p95FrameMs', 'renderRate'];

for (const key of Object.keys(current)) {
  const base = baseline[key];
  const curr = current[key];
  if (!curr) continue;
  for (const metric of metrics) {
    const b = base?.[metric] ?? curr[metric];
    const c = curr[metric];
    const delta = base ? pct(c, b) : 0;
    rows.push({
      key,
      metric,
      baseline: b,
      current: c,
      delta,
      status: base ? evaluate(metric, delta) : 'pass',
    });
  }
}

const header = ['Test', 'Metric', 'Baseline', 'Current', 'Delta', 'Status'];
const widths = [22, 12, 10, 10, 10, 8];

const pad = (value: string, width: number): string => value.padEnd(width).slice(0, width);

console.log();
console.log(`${COLOR.bold}Chart perf baseline comparison${COLOR.reset}`);
console.log(`${COLOR.dim}Regression threshold: ${(REGRESSION_THRESHOLD * 100).toFixed(0)}%${COLOR.reset}`);
console.log();
console.log(header.map((h, i) => pad(h, widths[i]!)).join(' '));
console.log(widths.map((w) => '-'.repeat(w)).join(' '));

let anyFail = false;
for (const row of rows) {
  const cells = [
    pad(row.key, widths[0]!),
    pad(row.metric, widths[1]!),
    pad(row.baseline.toFixed(2), widths[2]!),
    pad(row.current.toFixed(2), widths[3]!),
    pad(formatDelta(row.delta), widths[4]!),
    pad(symbol(row), widths[5]!),
  ];
  console.log(`${color(row)}${cells.join(' ')}${COLOR.reset}`);
  if (row.status === 'fail') anyFail = true;
}

console.log();

if (anyFail) {
  console.error(`${COLOR.red}Regression detected.${COLOR.reset} At least one metric degraded more than ${(REGRESSION_THRESHOLD * 100).toFixed(0)}%.`);
  process.exit(1);
}

console.log(`${COLOR.green}All metrics within baseline tolerance.${COLOR.reset}`);
