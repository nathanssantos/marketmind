#!/usr/bin/env node
/**
 * Audit i18n key coverage: scan every `t('foo.bar', ...)` call in the
 * renderer, extract the key, and verify it exists in en/pt/es/fr
 * translation JSONs.
 *
 * Used for the v1.6 A.6 follow-up: after the t-with-fallback sweep
 * stripped every `t('foo', 'Default')` second-arg fallback, any key
 * that wasn't actually present in JSON would now render as the raw
 * key string at runtime. This script catches that drift.
 *
 * Limitations (deliberate):
 * - Only matches static string literal keys: `t('a.b.c')` and
 *   `t('a.b.c', { vars })`. Dynamic keys (`t(`a.${x}`)`) are skipped
 *   with a warning since we can't statically resolve them.
 * - Only checks the renderer (apps/electron/src/renderer/) — backend
 *   tRPC/zod messages are validated separately.
 *
 * Usage:
 *   node scripts/audit-i18n-key-coverage.mjs           # exits non-zero on missing keys (en)
 *   node scripts/audit-i18n-key-coverage.mjs --list    # print every miss + dynamic
 *   node scripts/audit-i18n-key-coverage.mjs --all     # check all 4 locales (en is canonical)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('apps/electron/src/renderer');
const LOCALES_DIR = path.resolve('apps/electron/src/renderer/locales');
const LIST = process.argv.includes('--list');
const CHECK_ALL = process.argv.includes('--all');
const SKIP_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'dist-web', '__tests__', 'locales']);

/**
 * Return true if a dotted path resolves to a string in the JSON tree.
 */
const resolveKey = (json, dottedKey) => {
  const segments = dottedKey.split('.');
  let cur = json;
  for (const seg of segments) {
    if (cur === null || typeof cur !== 'object') return false;
    if (!(seg in cur)) return false;
    cur = cur[seg];
  }
  return typeof cur === 'string';
};

const walk = async (dir, files = []) => {
  const entries = await readdir(dir);
  for (const entry of entries) {
    const full = path.join(dir, entry);
    const s = await stat(full);
    if (s.isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      await walk(full, files);
    } else {
      if (SKIP_PATTERNS.some((p) => p.test(entry))) continue;
      if (entry.endsWith('.tsx') || entry.endsWith('.ts')) files.push(full);
    }
  }
  return files;
};

const TKEY_RE = /\bt\(\s*(['"])((?:\\.|(?!\1)[^\\])+)\1/g;
const DYNAMIC_TKEY_RE = /\bt\(\s*`([^`]*\$\{[^`]+)`/g;

const main = async () => {
  // Load all locale JSONs (en is canonical).
  const locales = ['en', 'pt', 'es', 'fr'];
  const localeData = {};
  for (const locale of locales) {
    const file = path.join(LOCALES_DIR, locale, 'translation.json');
    localeData[locale] = JSON.parse(await readFile(file, 'utf8'));
  }

  const files = await walk(ROOT);
  const usedKeys = new Set();
  const dynamicCallsites = []; // { file, snippet }

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const content = await readFile(file, 'utf8');

    let m;
    TKEY_RE.lastIndex = 0;
    while ((m = TKEY_RE.exec(content)) !== null) {
      const key = m[2];
      if (!key) continue;
      if (!key.includes('.')) continue; // not a dotted i18n key
      usedKeys.add(key);
    }

    DYNAMIC_TKEY_RE.lastIndex = 0;
    while ((m = DYNAMIC_TKEY_RE.exec(content)) !== null) {
      dynamicCallsites.push({ file: rel, snippet: m[0] });
    }
  }

  // Check coverage.
  const checkLocales = CHECK_ALL ? locales : ['en'];
  const missing = {};
  for (const locale of checkLocales) {
    const miss = [];
    for (const key of usedKeys) {
      if (!resolveKey(localeData[locale], key)) miss.push(key);
    }
    missing[locale] = miss.sort();
  }

  let anyMiss = false;
  for (const locale of checkLocales) {
    const miss = missing[locale];
    if (miss.length > 0) {
      anyMiss = true;
      console.log(`\n[${locale}] ${miss.length} missing key${miss.length === 1 ? '' : 's'}:`);
      if (LIST) {
        for (const k of miss) console.log(`  ${k}`);
      } else {
        for (const k of miss.slice(0, 25)) console.log(`  ${k}`);
        if (miss.length > 25) console.log(`  ... +${miss.length - 25} more (use --list)`);
      }
    }
  }

  if (dynamicCallsites.length > 0 && LIST) {
    console.log(`\nDynamic t(\`...\${...}\`) calls (${dynamicCallsites.length} — not validatable):`);
    for (const { file, snippet } of dynamicCallsites.slice(0, 10)) {
      console.log(`  ${file}: ${snippet}`);
    }
    if (dynamicCallsites.length > 10) console.log(`  ... +${dynamicCallsites.length - 10} more`);
  }

  console.log(`\naudit-i18n-key-coverage: ${usedKeys.size} static keys checked, ${dynamicCallsites.length} dynamic skipped`);
  if (!anyMiss) {
    console.log('clean ✓');
    process.exit(0);
  }
  process.exit(1);
};

main().catch((err) => {
  console.error('audit-i18n-key-coverage: fatal', err);
  process.exit(2);
});
