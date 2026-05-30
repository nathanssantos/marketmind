import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));

const BACKEND_ROOT = path.resolve(currentDir, '../..');

export const LOGS_DIR = path.join(BACKEND_ROOT, 'logs');

export const OUTPUT_DIR = path.join(BACKEND_ROOT, 'output');

export const ensureDir = (dir: string): string => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
};
