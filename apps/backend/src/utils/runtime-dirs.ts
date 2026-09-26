import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../env';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_ROOT = path.resolve(currentDir, '../..');

const DATA_DIR = env.MM_DATA_DIR ?? BACKEND_ROOT;

export const LOGS_DIR = path.join(DATA_DIR, 'logs');

export const OUTPUT_DIR = path.join(DATA_DIR, 'output');

export const BUILTIN_STRATEGIES_DIR = env.MM_STRATEGIES_DIR ?? path.join(BACKEND_ROOT, 'strategies', 'builtin');

export const USER_STRATEGIES_DIR = env.MM_USER_STRATEGIES_DIR ?? path.join(BACKEND_ROOT, 'strategies', 'user');

export const STRATEGY_DIRS = [BUILTIN_STRATEGIES_DIR, USER_STRATEGIES_DIR];

export const MIGRATIONS_DIR = env.MM_MIGRATIONS_DIR ?? path.join(BACKEND_ROOT, 'src', 'db', 'migrations');

export const ensureDir = (dir: string): string => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
