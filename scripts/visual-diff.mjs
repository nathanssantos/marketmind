#!/usr/bin/env node
/**
 * Compare a freshly-run gallery session against the committed baseline.
 *
 * Usage:
 *   node scripts/visual-diff.mjs <session-dir>
 *   node scripts/visual-diff.mjs              # picks the most recent session
 *
 * Reports which files differ from baseline. Pure byte-equality compare for
 * now — a follow-up will add pixelmatch with `maxDiffPixels=200` and
 * `threshold=0.2` to ignore antialiasing noise.
 *
 * Exit codes:
 *   0 — all files match baseline
 *   1 — at least one file differs (or session/baseline missing)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SCREENSHOT_DIR = path.resolve('apps/electron/screenshots');
const BASELINE_DIR = path.join(SCREENSHOT_DIR, 'baseline');

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

console.log(`session:  ${sessionDir}`);
console.log(`baseline: ${BASELINE_DIR}\n`);

const baselineFiles = (await readdir(BASELINE_DIR)).filter((f) => f.endsWith('.png'));
const sessionFiles = (await readdir(sessionDir)).filter((f) => f.endsWith('.png'));

const diffs = [];
const missingFromSession = [];
const newInSession = [];

for (const file of baselineFiles) {
  if (!sessionFiles.includes(file)) {
    missingFromSession.push(file);
    continue;
  }
  const [a, b] = await Promise.all([
    readFile(path.join(BASELINE_DIR, file)),
    readFile(path.join(sessionDir, file)),
  ]);
  if (!a.equals(b)) {
    diffs.push({ file, baselineBytes: a.length, sessionBytes: b.length });
  }
}

for (const file of sessionFiles) {
  if (!baselineFiles.includes(file)) newInSession.push(file);
}

console.log(`baseline files:  ${baselineFiles.length}`);
console.log(`session files:   ${sessionFiles.length}`);
console.log(`diffs:           ${diffs.length}`);
console.log(`missing:         ${missingFromSession.length}`);
console.log(`new in session:  ${newInSession.length}`);

if (diffs.length > 0) {
  console.log('\n--- DIFFS ---');
  for (const d of diffs) {
    const delta = d.sessionBytes - d.baselineBytes;
    const sign = delta >= 0 ? '+' : '';
    console.log(`  ${d.file}  (${sign}${delta} bytes)`);
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

const failed = diffs.length > 0 || missingFromSession.length > 0;
process.exit(failed ? 1 : 0);
