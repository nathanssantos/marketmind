#!/usr/bin/env node
/**
 * Catch-all audit script for v1.6 dialog rules. Each rule maps to a
 * design-system contract documented in docs/V1_6_PLAN.md.
 *
 * Rules:
 *   modal-file-suffix       — no new *Modal.tsx files (Track E.1)
 *   raw-dialog-root         — no hand-rolled <Dialog.Root> outside ui/
 *                             (must go through <DialogShell> / <FormDialog>)
 *   raw-maxw-on-dialog      — no raw maxW="..." on Dialog.Content
 *                             (use <DialogShell size="..."> instead)
 *   t-with-fallback         — no t('...', 'fallback') calls
 *                             (i18n JSON is the single source of truth)
 *   props-not-extending-base — interface .*DialogProps that doesn't
 *                              extend DialogControlProps and includes
 *                              `isOpen` + `onClose` fields
 *
 * Usage:
 *   node scripts/audit-dialog-rules.mjs           # default: prints
 *                                                  per-rule counts and
 *                                                  exits 0 (warnings only)
 *   node scripts/audit-dialog-rules.mjs --strict  # exits 1 on any hit
 *                                                  (CI gate mode)
 *   node scripts/audit-dialog-rules.mjs --list    # prints every hit
 *
 * The default `--warn` mode lets the script ship now and surface drift
 * via CI logs while Track A modal rewrites land. Once the modal sweep
 * finishes, CI flips the script to `--strict`.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('apps/electron/src/renderer');
const STRICT = process.argv.includes('--strict');
const LIST = process.argv.includes('--list');

const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-electron', 'dist-web', '__tests__']);
const SKIP_PATTERNS = [
  /\.test\.tsx?$/,
  /\.spec\.tsx?$/,
];

/** ui/ primitives are allowed to use Dialog.Root + maxW + define their own Props. */
const UI_PRIMITIVE_DIR = path.join(ROOT, 'components', 'ui');

const RULES = [
  {
    name: 'modal-file-suffix',
    description: 'New *Modal.tsx files are forbidden — use *Dialog.tsx (E.1).',
    appliesToFile: (file) => file.endsWith('Modal.tsx') || file.endsWith('Modal.test.tsx'),
    check: () => true, // file-level rule; the file path itself is the violation
  },
  {
    name: 'raw-dialog-root',
    description: 'Hand-rolled <Dialog.Root> outside ui/ — use <DialogShell> or <FormDialog>.',
    skipFile: (file) => file.startsWith(UI_PRIMITIVE_DIR),
    re: /<Dialog\.Root\b|<DialogRoot\b/g,
  },
  {
    name: 'raw-maxw-on-dialog',
    description: 'Raw maxW="..." on a Dialog.Content/DialogContent — use <DialogShell size="...">.',
    skipFile: (file) => file.startsWith(UI_PRIMITIVE_DIR),
    re: /<Dialog\.Content[^>]*\bmaxW=|<DialogContent[^>]*\bmaxW=/g,
  },
  {
    name: 't-with-fallback',
    description: "t('key', 'fallback') calls — keep i18n JSON authoritative (drop the second string arg).",
    re: /\bt\(\s*['"][^'"]+['"]\s*,\s*['"][^'"]+['"]\s*[,)]/g,
  },
  {
    name: 'props-not-extending-base',
    description: 'interface .*DialogProps with { isOpen; onClose } not extending DialogControlProps.',
    skipFile: (file) => file.startsWith(UI_PRIMITIVE_DIR),
    customCheck: (content) => {
      const hits = [];
      const re = /(?:export\s+)?interface\s+(\w*DialogProps)\s*(extends\s+[^{]+)?\s*\{([^}]+)\}/g;
      let m;
      while ((m = re.exec(content)) !== null) {
        const [whole, name, ext, body] = m;
        if (ext && /DialogControlProps/.test(ext)) continue;
        const hasIsOpen = /\bisOpen\s*:\s*boolean/.test(body);
        const hasOnClose = /\bonClose\s*:\s*\(/.test(body);
        if (hasIsOpen && hasOnClose) {
          hits.push({ token: name, snippet: whole.split('\n')[0] });
        }
      }
      return hits;
    },
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
    const content = await readFile(file, 'utf8');

    for (const rule of RULES) {
      if (rule.skipFile?.(file)) continue;

      if (rule.appliesToFile) {
        if (rule.appliesToFile(file) && rule.check(content)) {
          violations.push({ rule: rule.name, file: rel, snippet: '(file-level)' });
        }
        continue;
      }

      if (rule.customCheck) {
        const hits = rule.customCheck(content);
        for (const h of hits) {
          violations.push({ rule: rule.name, file: rel, snippet: h.snippet });
        }
        continue;
      }

      if (rule.re) {
        const matches = content.match(rule.re);
        if (matches) {
          for (const m of matches) {
            violations.push({ rule: rule.name, file: rel, snippet: m });
          }
        }
      }
    }
  }

  // Group by rule for the summary.
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
  }

  if (violations.length === 0) {
    console.log('audit-dialog-rules: clean');
    process.exit(0);
  }

  console.log('audit-dialog-rules: per-rule counts');
  for (const rule of RULES) {
    const n = byRule.get(rule.name)?.length ?? 0;
    const tag = n === 0 ? 'OK ' : 'HIT';
    console.log(`  [${tag}] ${rule.name.padEnd(28)} ${n.toString().padStart(4)}  — ${rule.description}`);
  }
  console.log(`\ntotal: ${violations.length} violation${violations.length === 1 ? '' : 's'}`);

  if (STRICT) process.exit(1);
  console.log('(running in warn mode — pass --strict to fail CI on any hit)');
  process.exit(0);
};

main().catch((err) => {
  console.error('audit-dialog-rules: fatal', err);
  process.exit(2);
});
