#!/usr/bin/env node
/**
 * Audit `apps/electron/src/renderer/components/` for forbidden hardcoded
 * shade literals + `_dark={{}}` overrides per docs/archive/V1_POST_RELEASE_PLAN.md.
 *
 * As of v1.2 the renderer is clean. This script protects that invariant —
 * runs in CI (planned via lint:audit) and exits non-zero on any new violation.
 *
 * Forbidden patterns (regex per file):
 *   - color="X.{50..900}" / bg="X.{50..900}" / borderColor="X.{50..900}"
 *     where X ∈ {red, green, blue, yellow, orange, purple, gray, pink, teal, cyan}
 *   - _dark={{ ... }} overrides (semantic tokens auto-resolve dark/light)
 *
 * Usage:
 *   node scripts/audit-shade-literals.mjs            # exits non-zero on any hit
 *   node scripts/audit-shade-literals.mjs --list     # print every hit (no fail)
 *
 * Files explicitly skipped: test files, primitives in ui/ that wrap Chakra
 * (alert.tsx, slider.tsx) which legitimately use Chakra's own shade scale
 * for theming hooks.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve('apps/electron/src/renderer/components');
const LIST_MODE = process.argv.includes('--list');

const FORBIDDEN = [
  {
    name: 'shade-literal-color',
    re: /\b(?:color|bg|borderColor|borderLeftColor|borderTopColor|borderRightColor|borderBottomColor)="(?:red|green|blue|yellow|orange|purple|gray|pink|teal|cyan)\.(?:50|100|200|300|400|500|600|700|800|900)"/g,
  },
  {
    name: '_dark-override',
    re: /_dark=\{\{/g,
  },
  {
    // Same anti-pattern as `_dark={{...}}` but nested inside an object
    // literal (e.g. `_hover={{ bg: 'gray.100', _dark: { bg: 'gray.700' } }}`,
    // or a top-level styles const that's spread later). Semantic tokens
    // (bg.muted etc.) auto-resolve dark/light, so the nested override
    // duplicates the work and locks specific shades that bypass the theme.
    name: '_dark-override-nested',
    re: /^\s*_dark:\s*\{/gm,
  },
  {
    // V1_4 rule: tinted-card anti-pattern — <Box bg="X.subtle" ... borderColor="X.muted">
    // wraps content in a heavy colored container. Use <Callout> for inline
    // messages or plain Stack/Box (no tint) for content groups inside a section.
    // Only flags when Box has BOTH the colored bg AND a matching colored
    // border (the visually heavy tinted-card variant), not the lighter
    // `bg="X.subtle"`-only badges/pills.
    name: 'tinted-card-Box',
    re: /\bbg="(?:red|green|blue|yellow|orange|purple|teal|pink)\.subtle"[^>]*\bborderColor="(?:red|green|blue|yellow|orange|purple|teal|pink)\.muted"/g,
  },
  {
    // V1_4 rule: dynamic shade pair in JSX expression — usually expresses
    // bidirectional trading semantics (LONG/SHORT, profit/loss,
    // bullish/bearish) with raw shade literals. The static-shade rule above
    // only catches `color="X.500"`; this catches the JSX-expression form
    // `color={cond ? 'green.500' : 'red.500'}` (and variants on bg /
    // borderColor / borderLeftColor / valueColor). Both `green.NNN` AND
    // `red.NNN` must appear in the same prop expression — that's the
    // signature of bidirectional semantics.
    //
    // Use semantic tokens instead:
    //   trading.long / trading.short  (side)
    //   trading.profit / trading.loss  (P&L)
    //
    // Single-shade dynamic uses (`'blue.500' : 'fg.muted'`) are intentionally
    // not flagged — those are usually UI accent colors (active state, focus
    // border) and have a different migration path (colorPalette tokens).
    name: 'dynamic-shade-pair',
    re: /(?:color|bg|borderColor|borderLeftColor|borderRightColor|borderTopColor|borderBottomColor|valueColor)=\{[^}]*'(?:green|red)\.\d{2,3}'[^}]*'(?:green|red)\.\d{2,3}'/g,
  },
  {
    // V1_5 rule: template-string shade literal — same shade-literal class as
    // rule #1 but smuggled through a JSX expression with template literals,
    // e.g. `borderColor={`${getTypeColor(isLong)}.500`}` where getTypeColor
    // returns `'green'` / `'red'`. Bypasses every other rule because the
    // shade literal is built at runtime. Still ends up rendering as
    // `green.500` / `red.500` which is what we banned. Detected by looking
    // for `${...}.NNN` inside a backtick-quoted string assigned to a color
    // prop. Use semantic tokens (`trading.long` / `trading.short` etc.).
    //
    // Caught: OrderCard.tsx ~v1.5 — `borderColor={`${getTypeColor(...)}.500`}`
    name: 'template-string-shade',
    re: /(?:color|bg|borderColor|borderLeftColor|borderRightColor|borderTopColor|borderBottomColor|valueColor)=\{`\$\{[^}`]+\}\.(?:50|100|200|300|400|500|600|700|800|900)`\}/g,
  },
];

const SKIP_FILES = new Set([
  'alert.tsx',
  'slider.tsx',
]);

const walk = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.name.endsWith('.tsx') && !entry.name.endsWith('.test.tsx') && !SKIP_FILES.has(entry.name)) {
      files.push(full);
    }
  }
  return files;
};

const files = await walk(ROOT);
const violations = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  for (const rule of FORBIDDEN) {
    let m;
    rule.re.lastIndex = 0;
    while ((m = rule.re.exec(content)) !== null) {
      const before = content.slice(0, m.index);
      const line = before.split('\n').length;
      const col = m.index - before.lastIndexOf('\n');
      violations.push({
        file: path.relative(process.cwd(), file),
        line,
        col,
        rule: rule.name,
        match: m[0],
      });
    }
  }
}

if (violations.length === 0) {
  console.log(`✓ ${files.length} files scanned, 0 forbidden patterns.`);
  process.exit(0);
}

console.log(`✗ ${violations.length} forbidden pattern(s) in ${files.length} files:\n`);
for (const v of violations) {
  console.log(`  ${v.file}:${v.line}:${v.col}  [${v.rule}]  ${v.match}`);
}
console.log(`\nSee docs/UI_STYLE_GUIDE.md § Color tokens for the semantic-token alternatives.`);

if (LIST_MODE) {
  process.exit(0);
}
process.exit(1);
