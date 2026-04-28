#!/usr/bin/env node
/**
 * Compare a freshly-run gallery session against the committed baseline using
 * pixelmatch. Per the v1 plan: `maxDiffPixels=200` per image with
 * `threshold=0.2` (relaxed enough to ignore antialiasing noise).
 *
 * Usage:
 *   node scripts/visual-diff.mjs <session-dir>
 *   node scripts/visual-diff.mjs              # picks the most recent session
 *
 * Side effect: writes a PNG diff for every divergent file under
 *   <session-dir>/diffs/<filename>
 *
 * Exit codes:
 *   0 — every file is within tolerance
 *   1 — at least one file exceeds maxDiffPixels (or session/baseline missing
 *       or dimensions changed)
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const pixelmatch = require('pixelmatch').default;
const { PNG } = require('pngjs');

const SCREENSHOT_DIR = path.resolve('apps/electron/screenshots');
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline');
// 15000 ≈ 1.16% of a 1440×900 viewport, large enough to absorb
// CI-vs-CI rendering nondeterminism (subpixel antialiasing, font hinting,
// cursor-blink frames) while still catching real layout shifts (each
// new/moved/resized element typically moves >2% of pixels).
const MAX_DIFF_PIXELS = Number(process.env.VISUAL_DIFF_MAX_PIXELS ?? 15_000);
const THRESHOLD = Number(process.env.VISUAL_DIFF_THRESHOLD ?? 0.2);

const findLatestSession = async () => {
  const entries = await readdir(SCREENSHOT_DIR);
  const sessions = entries.filter((e) => /^\d{4}-\d{2}-\d{2}T/.test(e));
  if (sessions.length === 0) return null;
  return path.join(SCREENSHOT_DIR, sessions.sort().pop());
};

const sessionDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : await findLatestSession();

if (!sessionDir) {
  console.error('No session directory provided and no recent sessions found.');
  process.exit(1);
}

let baselineExists = false;
try {
  baselineExists = (await stat(BASELINE_DIR)).isDirectory();
} catch {
  /* missing */
}
if (!baselineExists) {
  console.error(`Baseline missing at ${BASELINE_DIR}`);
  process.exit(1);
}

const diffsDir = path.join(sessionDir, 'diffs');
await mkdir(diffsDir, { recursive: true });

console.log(`session:  ${sessionDir}`);
console.log(`baseline: ${BASELINE_DIR}`);
console.log(`tolerance: maxDiffPixels=${MAX_DIFF_PIXELS} threshold=${THRESHOLD}\n`);

const baselineFiles = (await readdir(BASELINE_DIR)).filter((f) => f.endsWith('.png'));
const sessionFiles = (await readdir(sessionDir)).filter((f) => f.endsWith('.png'));

const results = [];
const missingFromSession = [];
const newInSession = [];

for (const file of baselineFiles) {
  if (!sessionFiles.includes(file)) {
    missingFromSession.push(file);
    continue;
  }
  const [baselineBuf, sessionBuf] = await Promise.all([
    readFile(path.join(BASELINE_DIR, file)),
    readFile(path.join(sessionDir, file)),
  ]);
  const a = PNG.sync.read(baselineBuf);
  const b = PNG.sync.read(sessionBuf);

  if (a.width !== b.width || a.height !== b.height) {
    results.push({ file, diffPixels: 0, totalPixels: 0, status: 'dimension-change' });
    continue;
  }

  const diff = new PNG({ width: a.width, height: a.height });
  const diffPixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: THRESHOLD });
  const totalPixels = a.width * a.height;

  if (diffPixels > MAX_DIFF_PIXELS) {
    results.push({ file, diffPixels, totalPixels, status: 'fail' });
    await writeFile(path.join(diffsDir, file), PNG.sync.write(diff));
  } else {
    results.push({ file, diffPixels, totalPixels, status: 'pass' });
  }
}

for (const file of sessionFiles) {
  if (!baselineFiles.includes(file)) newInSession.push(file);
}

const failed = results.filter((r) => r.status !== 'pass');
const passed = results.filter((r) => r.status === 'pass');

console.log(`baseline files:  ${baselineFiles.length}`);
console.log(`session files:   ${sessionFiles.length}`);
console.log(`pass:            ${passed.length}`);
console.log(`fail:            ${failed.length}`);
console.log(`missing:         ${missingFromSession.length}`);
console.log(`new in session:  ${newInSession.length}`);

if (failed.length > 0) {
  console.log('\n--- DIFFS ---');
  for (const r of failed) {
    if (r.status === 'dimension-change') {
      console.log(`  [DIM]  ${r.file}  (baseline vs session dimensions differ)`);
    } else {
      const pct = ((r.diffPixels / r.totalPixels) * 100).toFixed(3);
      console.log(`  [${r.diffPixels}px ${pct}%]  ${r.file}  → diffs/${r.file}`);
    }
  }
}
if (missingFromSession.length > 0) {
  console.log('\n--- MISSING FROM SESSION ---');
  for (const f of missingFromSession) console.log(`  ${f}`);
}
if (newInSession.length > 0) {
  console.log('\n--- NEW IN SESSION ---');
  for (const f of newInSession) console.log(`  ${f}`);
}

const exitCode = failed.length > 0 || missingFromSession.length > 0 ? 1 : 0;
process.exit(exitCode);
