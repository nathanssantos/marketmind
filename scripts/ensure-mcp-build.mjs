#!/usr/bin/env node
/**
 * Ensure the MarketMind MCP servers are built so the versioned `.mcp.json`
 * works out of the box after a fresh `pnpm install`.
 *
 * Performance-conscious by design:
 *   - Skips entirely in CI (MCP servers are dev-only tooling).
 *   - Skips instantly when every mcp server already has its dist/index.js.
 *   - Only runs `pnpm mcp:build` when at least one server is missing its build.
 *
 * Wired as the repo `postinstall` hook.
 */

import { existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');

const log = (...args) => console.log('[ensure-mcp-build]', ...args);

if (process.env.CI) {
  log('CI detected — skipping MCP build (dev-only tooling).');
  process.exit(0);
}

const mcpPackages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('mcp-'))
  .map((entry) => entry.name);

if (mcpPackages.length === 0) process.exit(0);

const missing = mcpPackages.filter(
  (name) => !existsSync(path.join(PACKAGES_DIR, name, 'dist', 'index.js')),
);

if (missing.length === 0) {
  log('All MCP server builds present — nothing to do.');
  process.exit(0);
}

log(`Building MCP servers (missing: ${missing.join(', ')})...`);

try {
  execSync('pnpm mcp:build', { cwd: REPO_ROOT, stdio: 'inherit' });
  log('MCP servers built.');
} catch (err) {
  log('MCP build failed — run `pnpm mcp:build` manually to enable .mcp.json.');
  log(String(err?.message ?? err));
  process.exit(0);
}
