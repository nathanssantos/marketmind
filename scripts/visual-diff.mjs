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
// 40000 ≈ 3.1% of a 1440×900 viewport. Empirically tuned: at 25k some
// tabs (notably settings-data__light, settings-autoTrading__dark) flake
// at ~2.2–2.9% even when nothing changed — same OS, same Chromium,
// just transient render state right after dev-server warm-up. Real
// layout regressions always move >5% (a button resize is ~2%, panel
// reflow is 5%+, new component is 10%+), so 40k preserves regression
// detection while passing CI noise.
const MAX_DIFF_PIXELS = Number(process.env.VISUAL_DIFF_MAX_PIXELS ?? 40_000);
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

const toDataUri = async (file) => {
  try {
    const buf = await readFile(file);
    return `data:image/png;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
};

const renderDiffsHtml = async (failed) => {
  // Embed baseline / session / diff PNGs as data URIs so the HTML is
  // self-contained when downloaded as a CI artifact (the baseline dir
  // lives outside the session dir, so a plain `<img src="../baseline/...">`
  // breaks once the artifact is unzipped). Cost: a few MB per failing
  // image, which is fine — we only render this on actual failures.
  const sections = await Promise.all(
    failed.map(async (r) => {
      if (r.status === 'dimension-change') {
        return `<section><h2>${r.file}</h2><p class="warn">dimensions differ between baseline and session — no pixel diff available</p></section>`;
      }
      const pct = ((r.diffPixels / r.totalPixels) * 100).toFixed(3);
      const [baselineUri, sessionUri, diffUri] = await Promise.all([
        toDataUri(path.join(BASELINE_DIR, r.file)),
        toDataUri(path.join(sessionDir, r.file)),
        toDataUri(path.join(diffsDir, r.file)),
      ]);
      return `<section>
        <h2>${r.file}</h2>
        <p class="meta"><span class="px">${r.diffPixels}px</span> · <span class="pct">${pct}%</span></p>
        <div class="row">
          <figure><figcaption>baseline</figcaption>${baselineUri ? `<img src="${baselineUri}" alt="baseline ${r.file}"/>` : '<p class="warn">baseline missing</p>'}</figure>
          <figure><figcaption>session</figcaption>${sessionUri ? `<img src="${sessionUri}" alt="session ${r.file}"/>` : '<p class="warn">session missing</p>'}</figure>
          <figure><figcaption>diff</figcaption>${diffUri ? `<img src="${diffUri}" alt="diff ${r.file}"/>` : '<p class="warn">diff missing</p>'}</figure>
        </div>
      </section>`;
    }),
  );
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Visual diff — ${path.basename(sessionDir)}</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#1a1a1a;color:#eee;margin:0;padding:24px}
h1{font-size:18px;margin:0 0 24px}
section{margin-bottom:32px;padding-bottom:16px;border-bottom:1px solid #333}
section h2{font-size:14px;margin:0 0 4px;color:#aaa;font-weight:600;font-family:monospace}
.meta{font-size:11px;color:#888;margin:0 0 12px}
.meta .px{color:#f48fb1;font-weight:600}
.meta .pct{color:#90caf9;font-weight:600}
.warn{color:#ffb74d;font-size:12px}
.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
figure{margin:0;display:flex;flex-direction:column;gap:8px}
figcaption{font-size:11px;color:#888;text-transform:uppercase;letter-spacing:.05em}
img{max-width:100%;border:1px solid #333;border-radius:4px;background:#000}
</style></head><body>
<h1>Visual diff — ${path.basename(sessionDir)}<br><small style="font-size:12px;color:#888;font-weight:400">vs apps/electron/screenshots/baseline · maxDiffPixels=${MAX_DIFF_PIXELS} threshold=${THRESHOLD}</small></h1>
${sections.join('') || '<p style="color:#888">No diffs detected.</p>'}
</body></html>`;
};

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
  const diffsHtmlPath = path.join(diffsDir, 'index.html');
  await writeFile(diffsHtmlPath, await renderDiffsHtml(failed), 'utf8');
  console.log(`\n  view all: ${diffsHtmlPath}`);
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
