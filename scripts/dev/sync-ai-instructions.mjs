#!/usr/bin/env node
/**
 * Sync the AI-assistant instruction mirrors from the canonical CLAUDE.md.
 *
 * CLAUDE.md is the single source of truth for project/AI guidance. Other AI
 * tools read their own dotfiles, so we keep byte-identical copies and
 * regenerate them here. Run `pnpm sync:ai-docs` after editing CLAUDE.md.
 *
 * Usage:
 *   node scripts/dev/sync-ai-instructions.mjs            # write mirrors
 *   node scripts/dev/sync-ai-instructions.mjs --check    # CI: fail if stale
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SOURCE = 'CLAUDE.md';
const MIRRORS = ['.cursorrules', '.gemini/instructions.md', '.github/copilot-instructions.md'];

const source = readFileSync(path.join(repoRoot, SOURCE), 'utf-8');
const checkOnly = process.argv.includes('--check');

let stale = 0;
for (const mirror of MIRRORS) {
  const target = path.join(repoRoot, mirror);
  const current = (() => {
    try {
      return readFileSync(target, 'utf-8');
    } catch {
      return null;
    }
  })();
  if (current === source) continue;
  stale += 1;
  if (checkOnly) {
    console.error(`✗ ${mirror} is out of sync with ${SOURCE}`);
  } else {
    writeFileSync(target, source);
    console.log(`✓ synced ${mirror}`);
  }
}

if (checkOnly && stale > 0) {
  console.error(`\n${stale} mirror(s) stale — run \`pnpm sync:ai-docs\` and commit.`);
  process.exit(1);
}
if (!checkOnly) console.log(stale === 0 ? 'All AI-instruction mirrors already in sync.' : `Synced ${stale} mirror(s).`);
