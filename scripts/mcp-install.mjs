#!/usr/bin/env node
/**
 * Register every MarketMind MCP server in the Claude Code config (`~/.claude.json`).
 *
 * Auto-detection: walks `packages/mcp-*` and uses each package's `bin` entry
 * (or `main` as fallback) to construct an `mcpServers` entry. Existing entries
 * with the same name are replaced; entries from other tools are preserved.
 *
 * Usage:
 *   pnpm mcp:install               # write to ~/.claude.json
 *   pnpm mcp:install --dry-run     # preview the patch
 *   pnpm mcp:install --uninstall   # remove MarketMind entries
 */

import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(REPO_ROOT, 'packages');
const CLAUDE_CONFIG_PATH = process.env.MM_MCP_CLAUDE_CONFIG_PATH ?? path.join(homedir(), '.claude.json');

const NAMESPACE = 'marketmind-';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const uninstall = argv.includes('--uninstall');

const log = (...args) => console.log('[mcp-install]', ...args);

const tryReadFile = async (p) => {
  try {
    return await readFile(p, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
};

const findMcpPackages = async () => {
  const entries = await readdir(PACKAGES_DIR);
  const out = [];
  for (const entry of entries) {
    if (!entry.startsWith('mcp-')) continue;
    const pkgPath = path.join(PACKAGES_DIR, entry);
    const manifestPath = path.join(pkgPath, 'package.json');
    const raw = await tryReadFile(manifestPath);
    if (raw === null) continue;
    const manifest = JSON.parse(raw);
    const binEntry = manifest.bin && (typeof manifest.bin === 'string' ? manifest.bin : Object.values(manifest.bin)[0]);
    const main = manifest.main ?? './dist/index.js';
    const entryPoint = binEntry ?? main;
    if (!entryPoint) continue;
    const absoluteEntry = path.resolve(pkgPath, entryPoint);
    const surface = entry.replace(/^mcp-/, '');
    out.push({
      name: `${NAMESPACE}${surface}`,
      packageName: manifest.name,
      version: manifest.version,
      entry: absoluteEntry,
      packagePath: pkgPath,
      mcp: manifest.mcp ?? null,
    });
  }
  return out;
};

const buildServerEntry = (pkg) => {
  const env = { ...(pkg.mcp?.env ?? {}) };
  return {
    command: 'node',
    args: [pkg.entry],
    ...(Object.keys(env).length > 0 ? { env } : {}),
  };
};

const main = async () => {
  const packages = await findMcpPackages();
  if (packages.length === 0) {
    log('No MCP packages found under packages/mcp-*');
    process.exit(1);
  }

  log(`Found ${packages.length} MarketMind MCP package(s):`);
  for (const p of packages) log(`  - ${p.name} → ${p.entry}`);

  let config = {};
  const raw = await tryReadFile(CLAUDE_CONFIG_PATH);
  if (raw !== null && raw.trim().length > 0) {
    config = JSON.parse(raw);
  }

  if (!config.mcpServers || typeof config.mcpServers !== 'object') {
    config.mcpServers = {};
  }

  if (uninstall) {
    let removed = 0;
    for (const name of Object.keys(config.mcpServers)) {
      if (name.startsWith(NAMESPACE)) {
        delete config.mcpServers[name];
        removed += 1;
      }
    }
    log(`Removing ${removed} MarketMind MCP entries`);
  } else {
    for (const pkg of packages) {
      config.mcpServers[pkg.name] = buildServerEntry(pkg);
    }
    log(`Registered ${packages.length} MarketMind MCP entries`);
  }

  if (dryRun) {
    log(`(dry-run) target: ${CLAUDE_CONFIG_PATH}`);
    log('(dry-run) mcpServers section after patch:');
    const filtered = Object.fromEntries(
      Object.entries(config.mcpServers).filter(([k]) => k.startsWith(NAMESPACE)),
    );
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  await mkdir(path.dirname(CLAUDE_CONFIG_PATH), { recursive: true });
  await writeFile(CLAUDE_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  log(`Wrote ${CLAUDE_CONFIG_PATH}`);
  log('Restart Claude Code (or reload the MCP config) to pick up the new servers.');
};

main().catch((err) => {
  console.error('[mcp-install] failed:', err);
  process.exit(1);
});
