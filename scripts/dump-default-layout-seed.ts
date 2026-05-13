#!/usr/bin/env -S node --experimental-strip-types
/**
 * Regenerate `apps/electron/src/renderer/store/seed/defaultLayoutSeed.ts`
 * from the project owner's live Postgres state — captures the layout
 * presets, symbol tabs, and indicator instances exactly as they look
 * day-to-day. New users boot into this snapshot.
 *
 * Reads (using DATABASE_URL from apps/backend/.env):
 *   - user_layouts.data        → symbolTabs / activeSymbolTabId / activeLayoutId / layoutPresets
 *   - user_preferences (category='chart', key='indicatorInstances')
 *                              → IndicatorInstance[] (panelId, params, visibility)
 *   - user_indicators          → id → label mapping (label is what the seed binds by)
 *
 * Pattern bindings are left empty (populated at activation time by
 * useAutoActivateDefaultPatterns — see the comment in the seed file).
 *
 * If multiple users exist in the DB, pass the user id as the first arg:
 *   node --experimental-strip-types scripts/dump-default-layout-seed.ts <userId>
 */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const requireFromBackend = createRequire(
  path.resolve(import.meta.dirname, '..', 'apps', 'backend', 'package.json'),
);
const { Client } = requireFromBackend('pg') as typeof import('pg');

// Inline .env loader — avoid the `dotenv` dependency since this is a
// one-off maintenance script.
const ENV_PATH = path.resolve(import.meta.dirname, '..', 'apps', 'backend', '.env');
for (const line of readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim().replace(/^"|"$/g, '');
  if (!process.env[key]) process.env[key] = value;
}

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is not set (looked in apps/backend/.env)');
  process.exit(1);
}

const SEED_PATH = path.resolve(
  import.meta.dirname,
  '..',
  'apps/electron/src/renderer/store/seed/defaultLayoutSeed.ts',
);

const client = new Client({ connectionString: DATABASE_URL });
await client.connect();

const userArg = process.argv[2];
const usersRes = await client.query<{ id: string; email: string }>(
  userArg
    ? 'SELECT id, email FROM users WHERE id = $1'
    : 'SELECT id, email FROM users ORDER BY created_at ASC',
  userArg ? [userArg] : [],
);
if (usersRes.rows.length === 0) {
  console.error(`No user found${userArg ? ` with id ${userArg}` : ''}`);
  process.exit(1);
}
if (usersRes.rows.length > 1 && !userArg) {
  console.error(`Multiple users found — pass one of:`);
  for (const u of usersRes.rows) console.error(`  ${u.id}  (${u.email})`);
  process.exit(1);
}
const user = usersRes.rows[0]!;
console.log(`Dumping seed for user: ${user.email} (${user.id})`);

const layoutRes = await client.query<{ data: string }>(
  'SELECT data FROM user_layouts WHERE user_id = $1',
  [user.id],
);
if (layoutRes.rows.length === 0) {
  console.error('No layout row found for this user.');
  process.exit(1);
}
const layoutData = JSON.parse(layoutRes.rows[0]!.data) as {
  symbolTabs: unknown[];
  activeSymbolTabId: string;
  activeLayoutId: string;
  layoutPresets: unknown[];
};

const prefsRes = await client.query<{ value: string }>(
  `SELECT value FROM user_preferences WHERE user_id = $1 AND category = 'chart' AND key = 'indicatorInstances'`,
  [user.id],
);
const instances = prefsRes.rows.length > 0
  ? (JSON.parse(prefsRes.rows[0]!.value) as Array<{
      userIndicatorId: string;
      catalogType: string;
      params: Record<string, unknown>;
      visible: boolean;
      panelId?: string;
    }>)
  : [];

const indicatorsRes = await client.query<{ id: string; label: string }>(
  'SELECT id, label FROM user_indicators WHERE user_id = $1',
  [user.id],
);
const idToLabel = new Map(indicatorsRes.rows.map((r) => [r.id, r.label]));

await client.end();

// Translate instances → seed bindings. Drop any instance whose
// userIndicatorId isn't in the catalog (orphan from a deleted indicator),
// or that has no panelId (legacy globals, see comment in indicatorStore).
const indicatorBindings = instances
  .filter((i) => idToLabel.has(i.userIndicatorId) && typeof i.panelId === 'string')
  .map((i) => ({
    label: idToLabel.get(i.userIndicatorId)!,
    catalogType: i.catalogType,
    params: i.params,
    panelId: i.panelId!,
    visible: i.visible,
  }));

console.log(`  symbolTabs:        ${layoutData.symbolTabs.length}`);
console.log(`  layoutPresets:     ${layoutData.layoutPresets.length}`);
console.log(`  indicatorBindings: ${indicatorBindings.length}  (from ${instances.length} runtime instances)`);

const seed = {
  symbolTabs: layoutData.symbolTabs,
  activeSymbolTabId: layoutData.activeSymbolTabId,
  activeLayoutId: layoutData.activeLayoutId,
  layoutPresets: layoutData.layoutPresets,
  indicatorBindings,
};

// Preserve the prologue (imports + types + comment + export line) by
// rewriting only the literal value. Find the `export const DEFAULT_LAYOUT_SEED`
// line and replace everything from there to the file's terminal `};`.
const original = readFileSync(SEED_PATH, 'utf8');
const exportMarker = 'export const DEFAULT_LAYOUT_SEED: DefaultLayoutSeed =';
const exportIdx = original.indexOf(exportMarker);
if (exportIdx === -1) {
  console.error(`Could not find "${exportMarker}" in ${SEED_PATH}`);
  process.exit(1);
}

const prologue = original.slice(0, exportIdx);
const serialized = JSON.stringify(seed, null, 2);
const newBody = `${exportMarker} {\n  patternBindings: [],\n  ${serialized.slice(1, -1).trim()}\n};\n`;
writeFileSync(SEED_PATH, prologue + newBody, 'utf8');

console.log(`✓ wrote ${SEED_PATH}`);
