import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const BUILTIN_DIR = process.env.MM_MCP_STRATEGY_BUILTIN_DIR
  ?? path.resolve('apps/backend/strategies/builtin');
const USER_DIR = process.env.MM_MCP_STRATEGY_USER_DIR
  ?? path.resolve('apps/backend/strategies/user');

interface StrategyMeta {
  id: string;
  name: string;
  version?: string;
  description?: string;
  author?: string;
  tags?: string[];
  strategyType?: string;
  momentumType?: string;
  source: 'builtin' | 'user';
  filename: string;
}

const METADATA_KEYS = ['id', 'name', 'version', 'description', 'author', 'tags', 'strategyType', 'momentumType'] as const;

const parsePineHeader = (source: string): Partial<StrategyMeta> => {
  const meta: Partial<StrategyMeta> = {};
  const lines = source.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('//')) {
      if (trimmed.startsWith('//@version')) continue;
      if (trimmed.length === 0) continue;
      if (!trimmed.startsWith('// @')) break; // header section ends
    }
    const match = trimmed.match(/^\/\/\s*@(\w+)\s+(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key || rawValue === undefined) continue;
    if (!METADATA_KEYS.includes(key as (typeof METADATA_KEYS)[number])) continue;
    if (key === 'tags') {
      meta.tags = rawValue.split(',').map((t) => t.trim()).filter(Boolean);
    } else {
      (meta as Record<string, unknown>)[key] = rawValue.trim();
    }
  }
  return meta;
};

const listDir = async (dir: string, source: 'builtin' | 'user'): Promise<StrategyMeta[]> => {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const files = entries.filter((f) => f.endsWith('.pine'));
  const out: StrategyMeta[] = [];
  for (const filename of files) {
    const filepath = path.join(dir, filename);
    try {
      const src = await readFile(filepath, 'utf8');
      const header = parsePineHeader(src);
      const id = header.id ?? filename.replace(/\.pine$/, '');
      out.push({
        id,
        name: header.name ?? id,
        version: header.version,
        description: header.description,
        author: header.author,
        tags: header.tags,
        strategyType: header.strategyType,
        momentumType: header.momentumType,
        source,
        filename,
      });
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
};

export const listStrategies = async (): Promise<StrategyMeta[]> => {
  const [builtin, user] = await Promise.all([
    listDir(BUILTIN_DIR, 'builtin'),
    listDir(USER_DIR, 'user'),
  ]);
  return [...builtin, ...user].sort((a, b) => a.id.localeCompare(b.id));
};

export const findStrategyFile = async (id: string): Promise<{ filepath: string; source: 'builtin' | 'user' } | null> => {
  const candidates = [
    { dir: BUILTIN_DIR, source: 'builtin' as const },
    { dir: USER_DIR, source: 'user' as const },
  ];
  for (const { dir, source } of candidates) {
    const filename = `${id}.pine`;
    const filepath = path.join(dir, filename);
    try {
      await stat(filepath);
      return { filepath, source };
    } catch {
      /* try next */
    }
  }
  return null;
};

export const exportStrategy = async (id: string): Promise<{ id: string; source: string; filename: string; pine: string }> => {
  const found = await findStrategyFile(id);
  if (!found) throw new Error(`strategy not found: ${id}`);
  const pine = await readFile(found.filepath, 'utf8');
  return {
    id,
    source: found.source,
    filename: path.basename(found.filepath),
    pine,
  };
};

const validatePineSource = (source: string, expectedId: string): { ok: boolean; reason?: string } => {
  const header = parsePineHeader(source);
  if (!header.id) return { ok: false, reason: 'missing `// @id` header' };
  if (header.id !== expectedId) return { ok: false, reason: `header @id (${header.id}) does not match requested id (${expectedId})` };
  if (!header.name) return { ok: false, reason: 'missing `// @name` header' };
  if (!source.includes('//@version=5')) return { ok: false, reason: 'missing `//@version=5` directive' };
  return { ok: true };
};

export const createUserStrategy = async (id: string, source: string, overwrite = false): Promise<{ ok: true; filepath: string }> => {
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`invalid id (use lowercase, digits, hyphens): ${id}`);
  const validation = validatePineSource(source, id);
  if (!validation.ok) throw new Error(`pine validation failed: ${validation.reason}`);
  const filepath = path.join(USER_DIR, `${id}.pine`);
  if (!overwrite) {
    try {
      await stat(filepath);
      throw new Error(`strategy already exists at ${filepath} — pass overwrite=true to replace`);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  }
  const { mkdir } = await import('node:fs/promises');
  await mkdir(USER_DIR, { recursive: true });
  await writeFile(filepath, source, 'utf8');
  return { ok: true, filepath };
};

export const getStrategyDirs = (): { builtin: string; user: string } => ({ builtin: BUILTIN_DIR, user: USER_DIR });
