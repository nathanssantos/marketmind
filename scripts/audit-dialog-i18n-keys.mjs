#!/usr/bin/env node
/**
 * Validate the `<feature>.dialogs.<dialog>.<key>` i18n key shape per
 * v1.6 Track E.5.
 *
 * Reads every locale JSON under apps/electron/src/renderer/locales/, walks
 * any path of the form `<anything>.dialogs.<dialogName>.*`, and asserts:
 *
 *   1. Within each `dialogs.<dialog>.*` subtree, only allowed leaf keys
 *      appear. Allowed keys are listed in ALLOWED_KEYS below.
 *   2. en is the canonical locale: every other locale has exactly the
 *      same key set under each `dialogs.<dialog>.*` subtree.
 *
 * The script is a no-op while no dialog has been migrated to the
 * convention — those subtrees simply don't exist yet. As Track A
 * dialog rewrites land, more subtrees show up and get checked.
 *
 * Usage:
 *   node scripts/audit-dialog-i18n-keys.mjs           # exits non-zero on any violation
 *   node scripts/audit-dialog-i18n-keys.mjs --list    # print every hit (no fail)
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const LOCALES_DIR = path.resolve('apps/electron/src/renderer/locales');
const LIST_MODE = process.argv.includes('--list');
const CANONICAL_LOCALE = 'en';

/**
 * Allowed leaf keys within a `<feature>.dialogs.<dialog>.*` subtree.
 * Anything else is a violation.
 */
const ALLOWED_LEAF_KEYS = new Set([
  'title',
  'description',
  'submit',
  'cancel',
  'success',
  'failure',
  'confirm.title',
  'confirm.body',
  'confirm.cta',
]);

/**
 * Allowed key prefixes — patterns where the trailing segment varies
 * (e.g. `field.<fieldName>.label`). Match by `startsWith` after dotting.
 */
const ALLOWED_PREFIXES = [
  /^field\.[a-zA-Z0-9_]+\.(label|helper|placeholder|error)$/,
  /^section\.[a-zA-Z0-9_]+\.(title|description)$/,
];

const isAllowedLeaf = (rel) => {
  if (ALLOWED_LEAF_KEYS.has(rel)) return true;
  return ALLOWED_PREFIXES.some((re) => re.test(rel));
};

/**
 * Walk a JSON object and collect every leaf path.
 * Returns Map<dotted-path, leaf-value>.
 */
const collectLeaves = (obj, prefix = '', out = new Map()) => {
  for (const [key, value] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      collectLeaves(value, next, out);
    } else {
      out.set(next, value);
    }
  }
  return out;
};

/**
 * Group leaves by their `dialogs.<dialog>` parent. Returns
 * Map<dialogPath, Map<relativeLeaf, value>>.
 */
const groupByDialog = (leaves) => {
  const groups = new Map();
  for (const [path, value] of leaves) {
    const m = path.match(/^(.*\.dialogs\.[a-zA-Z0-9_]+)\.(.+)$/);
    if (!m) continue;
    const [, dialogPath, relative] = m;
    if (!groups.has(dialogPath)) groups.set(dialogPath, new Map());
    groups.get(dialogPath).set(relative, value);
  }
  return groups;
};

const loadLocale = async (locale) => {
  const file = path.join(LOCALES_DIR, locale, 'translation.json');
  const raw = await readFile(file, 'utf8');
  return JSON.parse(raw);
};

const listLocales = async () => {
  const entries = await readdir(LOCALES_DIR);
  const locales = [];
  for (const entry of entries) {
    const s = await stat(path.join(LOCALES_DIR, entry));
    if (s.isDirectory()) locales.push(entry);
  }
  return locales.sort();
};

const main = async () => {
  const locales = await listLocales();
  if (!locales.includes(CANONICAL_LOCALE)) {
    console.error(`audit-dialog-i18n-keys: canonical locale "${CANONICAL_LOCALE}" not found`);
    process.exit(2);
  }

  const localeData = {};
  for (const locale of locales) {
    localeData[locale] = collectLeaves(await loadLocale(locale));
  }
  const localeGroups = Object.fromEntries(
    Object.entries(localeData).map(([loc, leaves]) => [loc, groupByDialog(leaves)]),
  );

  const violations = [];

  // Rule 1: leaf keys within each dialog subtree must be allowed.
  for (const [locale, groups] of Object.entries(localeGroups)) {
    for (const [dialogPath, leaves] of groups) {
      for (const rel of leaves.keys()) {
        if (!isAllowedLeaf(rel)) {
          violations.push({
            kind: 'forbidden-leaf',
            locale,
            dialogPath,
            key: rel,
          });
        }
      }
    }
  }

  // Rule 2: every locale must have the same key set per dialog as the canonical locale.
  const canonical = localeGroups[CANONICAL_LOCALE];
  for (const [locale, groups] of Object.entries(localeGroups)) {
    if (locale === CANONICAL_LOCALE) continue;
    for (const [dialogPath, canonicalLeaves] of canonical) {
      const otherLeaves = groups.get(dialogPath) ?? new Map();
      for (const key of canonicalLeaves.keys()) {
        if (!otherLeaves.has(key)) {
          violations.push({
            kind: 'missing-translation',
            locale,
            dialogPath,
            key,
          });
        }
      }
      for (const key of otherLeaves.keys()) {
        if (!canonicalLeaves.has(key)) {
          violations.push({
            kind: 'extra-translation',
            locale,
            dialogPath,
            key,
          });
        }
      }
    }
    // Also catch: dialogs that exist in non-canonical but not in canonical.
    for (const dialogPath of groups.keys()) {
      if (!canonical.has(dialogPath)) {
        violations.push({
          kind: 'extra-dialog',
          locale,
          dialogPath,
          key: '',
        });
      }
    }
  }

  if (violations.length === 0) {
    const dialogCount = canonical.size;
    console.log(`audit-dialog-i18n-keys: clean (${dialogCount} dialog${dialogCount === 1 ? '' : 's'} checked across ${locales.length} locales)`);
    process.exit(0);
  }

  for (const v of violations) {
    const tag = v.kind.padEnd(22);
    console.log(`${tag}  [${v.locale}] ${v.dialogPath}${v.key ? `.${v.key}` : ''}`);
  }
  console.log(`\naudit-dialog-i18n-keys: ${violations.length} violation${violations.length === 1 ? '' : 's'} found`);
  if (LIST_MODE) process.exit(0);
  process.exit(1);
};

main().catch((err) => {
  console.error('audit-dialog-i18n-keys: fatal', err);
  process.exit(2);
});
