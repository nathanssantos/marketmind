#!/usr/bin/env node
/**
 * Catch-all audit script for v1.7 panel rules. Each rule maps to a
 * design-system contract documented in docs/V1_7_PLAN.md and the
 * dialog-patterns bible (which extends to non-dialog surfaces).
 *
 * Scope: panels, sidebars, tabs, toolbars, pages — anywhere
 * `<FormSection>` / `<PanelHeader>` / `<RecordRow>` / `<EmptyState>`
 * / `<Spinner>` panel combo would be the right primitive choice.
 *
 * Rules:
 *   bespoke-record-row     — `<Box borderWidth="1px" borderColor="border"
 *                             borderRadius="md" p={2|3}>` shape outside
 *                             ui/ — use <RecordRow density="compact|card">.
 *   bespoke-loading-text   — bare `<Text>{t('common.loading')}</Text>` or
 *                             `<MetaText>{t('common.loading')}</MetaText>`
 *                             — use the standard Spinner panel combo
 *                             (`<Flex justify="center"><Spinner size={MM.spinner.panel.size} /></Flex>`).
 *
 * Default mode is `--warn` (counts only, exits 0). `--strict` flips it
 * to a CI gate; `--list` prints every hit.
 *
 * The deliberate exclusions (still allowed for now):
 *   - Bespoke section headers using `<Text fontSize="xs" fontWeight="semibold">`
 *     directly. The dialog patterns bible mandates `<FormSection title>` /
 *     `<PanelHeader title>` for sections, but enforcing this would catch
 *     dozens of inline title patterns in legacy code (badge counts, status
 *     pills inside flex headers). Tracked as a v1.9 follow-up.
 *   - Bespoke `<EmptyState>` violations — already covered by manual review;
 *     adding a regex here would have many false positives because
 *     `fontSize="xs" color="fg.muted"` is a generic muted-text pattern,
 *     not specific to empty states.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('apps/electron/src/renderer');
const STRICT = process.argv.includes('--strict');
const LIST = process.argv.includes('--list');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'dist-web', '__tests__']);
const SKIP_PATTERNS = [/\.test\.tsx?$/, /\.spec\.tsx?$/];

/** ui/ primitives are allowed to define their own framing. */
const UI_PRIMITIVE_DIR = path.join(ROOT, 'components', 'ui');

/**
 * Files that are out of scope for the panel rules:
 *   - dialog-shell wrappers (covered by audit-dialog-rules.mjs)
 *   - the chart canvas + drawing low-level rendering files
 */
const OUT_OF_SCOPE = [
  /\/Chart\/(orderLine|render|chartContext|drawings\/[A-Z]|crosshair|tooltip)/i,
  /\/utils\//,
  /\/services\//,
  /\/store\//,
  /\/hooks\//,
];

const RULES = [
  {
    name: 'bespoke-record-row',
    description: 'Hand-rolled bordered list row — use <RecordRow density="compact|card">.',
    skipFile: (file) => file.startsWith(UI_PRIMITIVE_DIR),
    // Match <Box ... borderWidth="1px" ... borderColor="border" ... borderRadius="md" ... > shapes
    // used as list rows (with px/py or p in the same opening tag).
    re: /<Box(?=[^>]*\bborderWidth="1px")(?=[^>]*\bborderColor="border(?:\.[a-z]+)?")(?=[^>]*\bborderRadius="md")(?=[^>]*\bp=\{[23]\}|\bpx=\{[23]\}|\bpy=\{[23]\})[^>]*>/g,
  },
  {
    name: 'bespoke-loading-text',
    description: "Bare <Text>{t('common.loading')}</Text> or <MetaText>{t('common.loading')}</MetaText> — use the Spinner panel combo.",
    skipFile: (file) => file.startsWith(UI_PRIMITIVE_DIR),
    re: /<(?:Text|MetaText)[^>]*>\{?\s*t\(\s*['"]common\.loading['"]\s*\)\s*\}?<\/(?:Text|MetaText)>/g,
  },
];

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

const main = async () => {
  const files = await walk(ROOT);
  const violations = [];

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    if (OUT_OF_SCOPE.some((re) => re.test(rel))) continue;

    const content = await readFile(file, 'utf8');

    for (const rule of RULES) {
      if (rule.skipFile?.(file)) continue;
      if (rule.re) {
        const matches = content.match(rule.re);
        if (matches) {
          for (const m of matches) {
            violations.push({ rule: rule.name, file: rel, snippet: m.slice(0, 120) });
          }
        }
      }
    }
  }

  const byRule = new Map();
  for (const v of violations) {
    if (!byRule.has(v.rule)) byRule.set(v.rule, []);
    byRule.get(v.rule).push(v);
  }

  if (LIST) {
    for (const [rule, hits] of byRule) {
      console.log(`\n[${rule}] ${hits.length} hit${hits.length === 1 ? '' : 's'}`);
      for (const h of hits) {
        console.log(`  ${h.file}: ${h.snippet}`);
      }
    }
  } else {
    if (violations.length === 0) {
      console.log('audit-panel-rules: clean');
    } else {
      for (const rule of RULES) {
        const count = byRule.get(rule.name)?.length ?? 0;
        console.log(`${rule.name.padEnd(24)} ${count} hit${count === 1 ? '' : 's'}`);
      }
      console.log(`\naudit-panel-rules: ${violations.length} violations found`);
      if (!STRICT) {
        console.log("(warn mode — pass '--list' for details, '--strict' to fail in CI)");
      }
    }
  }

  process.exit(STRICT && violations.length > 0 ? 1 : 0);
};

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
